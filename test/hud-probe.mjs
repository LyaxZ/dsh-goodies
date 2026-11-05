/**
 * Smoke-test the live HUD without running a model turn: inject a fake
 * `[data-chat-running]` row, then assert the HUD renders, its star actually
 * breathes, the tooltip is coherent, and it disappears with the row.
 * usage: node test/hud-probe.mjs <url-with-token> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, shotArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/hud-probe.mjs <url-with-token> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9361;
const profile = mkdtempSync(join(tmpdir(), "dtk-hud-"));
const child = execFile(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: "ignore" }
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findTarget() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((t) => t.type === "page" && t.url?.startsWith("about:blank"));
      if (page) return page;
    } catch {}
    await sleep(300);
  }
  throw new Error("no CDP target");
}

class Cdp {
  constructor() {
    this.pending = new Map();
    this.seq = 0;
    this.errors = [];
  }
  async connect(url) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        this.errors.push(details?.exception?.description ?? details?.text);
      }
    });
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

let failures = 0;
function check(label, ok, detail) {
  if (ok) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL ${label}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  }
}

async function main() {
  const target = await findTarget();
  const cdp = new Cdp();
  await cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: urlArg });
  await sleep(9000);
  const ev = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  const before = await ev(`document.querySelectorAll("[data-goodies-live-speed]").length`);
  check("hud hidden while idle", before === 0, before);

  // A fake running row is enough: the HUD only needs the marker node.
  await ev(`(() => {
    const row = document.createElement("div");
    row.setAttribute("data-chat-running", "");
    row.id = "dtk-fake-running";
    const inner = document.createElement("div");
    inner.className = "dtk_fake_runningContent";
    inner.textContent = "深度求索中，用时 1 秒";
    row.appendChild(inner);
    document.body.appendChild(row);
    row.scrollIntoView({ block: "center" });
    return true;
  })()`);
  await sleep(900);

  const hud = await ev(`(() => {
    const node = document.querySelector("[data-goodies-live-speed]");
    if (!node) return null;
    const star = node.querySelector(".dtk-live-star");
    return {
      text: node.textContent,
      title: node.getAttribute("title"),
      total: node.getAttribute("data-live-total"),
      totalText: node.querySelector(".dtk-live-metric.is-total .dtk-live-value")?.textContent ?? null,
      now: node.getAttribute("data-live-now"),
      starOpacity: star ? Number(getComputedStyle(star).opacity) : null,
      starSize: star ? Math.round(star.getBoundingClientRect().width) : null,
    };
  })()`);
  check("hud renders for a running row", hud !== null);
  if (hud !== null) {
    check("hud shows speed and unit", /tok\/s/.test(hud.text), hud.text);
    check("hud shows token total", /tokens/.test(hud.text), hud.text);
    const totalValues = await ev(`(() => [...document.querySelectorAll("[data-goodies-live-speed] .dtk-live-metric.is-total .dtk-live-value")].map((node) => node.textContent))()`);
    check("the total is printed once", totalValues.length === 1, totalValues);
    check("hud total uses a compact number", /^(\d+(\.\d)?[KMB]?|\d+)$/.test(String(hud.totalText)), hud.totalText);
    check("hud has no stray symbols", !/[≈Σ]/.test(hud.text), hud.text);
    check("tooltip is coherent", /tok\/s/.test(hud.title ?? "") && /tokens/.test(hud.title ?? ""), hud.title);
    check("star is at least 12px", hud.starSize !== null && hud.starSize >= 12, hud.starSize);
  }

  // The waveform is drawn from one reading per second, so give it two beats.
  await sleep(2400);
  const wave = await ev(`(() => {
    const hud = document.querySelector("[data-goodies-live-speed]");
    if (!hud) return null;
    const bars = [...hud.querySelectorAll(".dtk-live-wave .dtk-live-bar")];
    const speed = hud.querySelector(".dtk-live-metric.is-now");
    const star = hud.querySelector(".dtk-live-star");
    const waveBox = hud.querySelector(".dtk-live-wave");
    return {
      count: bars.length,
      heights: bars.map((bar) => Math.round(bar.getBoundingClientRect().height)),
      firstFlagged: bars.length > 0 && bars[0].classList.contains("is-last"),
      waveLeft: waveBox ? Math.round(waveBox.getBoundingClientRect().left) : null,
      waveRight: waveBox ? Math.round(waveBox.getBoundingClientRect().right) : null,
      speedLeft: speed ? Math.round(speed.getBoundingClientRect().left) : null,
      starRight: star ? Math.round(star.getBoundingClientRect().right) : null,
      starLeft: star ? Math.round(star.getBoundingClientRect().left) : null,
      waveWidth: waveBox ? Math.round(waveBox.getBoundingClientRect().width) : 0,
    };
  })()`);
  check("waveform shows twenty readings", wave !== null && wave.count === 20, wave);
  check("the wave keeps one width", wave !== null && Math.abs(wave.waveWidth - 78) <= 1, wave && wave.waveWidth);
  const anchored = await ev(`(() => {
    const hud = document.querySelector("[data-goodies-live-speed]");
    const star = hud.querySelector(".dtk-live-star");
    const total = hud.querySelector(".dtk-live-metric.is-total .dtk-live-value");
    const before = { star: star.getBoundingClientRect().left, right: hud.getBoundingClientRect().right, width: total.getBoundingClientRect().width };
    total.textContent = "1.2K";
    const after = { star: star.getBoundingClientRect().left, right: hud.getBoundingClientRect().right, width: total.getBoundingClientRect().width };
    return { before, after };
  })()`);
  if (wave !== null) {
    check("the newest slot is the leftmost", wave.firstFlagged === true, wave);
    check("waveform bars stay within the row height", Math.max(...wave.heights) <= 14 && Math.min(...wave.heights) >= 2, wave.heights);
    check("the newest bar is marked", wave.firstFlagged === true);
    check("the star leads the waveform", wave.starRight !== null && wave.waveLeft !== null && wave.starRight <= wave.waveLeft, wave);
    check("the waveform sits before the reading", wave.waveRight !== null && wave.speedLeft !== null && wave.waveRight <= wave.speedLeft, wave);

    const sizes = await ev(`(() => {
      const hud = document.querySelector("[data-goodies-live-speed]");
      const value = hud.querySelector(".dtk-live-metric.is-now .dtk-live-value");
      const total = hud.querySelector(".dtk-live-metric.is-total .dtk-live-value");
      return value && total ? { speed: value.style.width, total: total.style.width } : null;
    })()`);
    check("each reading sizes itself", sizes !== null && /^\d+ch$/.test(sizes.speed) && /^\d+ch$/.test(sizes.total), sizes);
  }


  const samples = [];
  for (let index = 0; index < 6; index += 1) {
    samples.push(
      await ev(`(() => {
        const star = document.querySelector("[data-goodies-live-speed] .dtk-live-star");
        return star ? Number(getComputedStyle(star).opacity) : null;
      })()`)
    );
    await sleep(350);
  }
  const distinct = new Set(samples.map((value) => (value === null ? "null" : value.toFixed(2))));
  const numbers = samples.filter((value) => typeof value === "number");
  check("star opacity changes over time", distinct.size >= 3, samples);
  check("star never disappears", numbers.length > 0 && Math.min(...numbers) >= 0.2, samples);
  check("star reaches near full", numbers.length > 0 && Math.max(...numbers) > 0.9, samples);

  if (shotArg) {
    const box = await ev(`(() => {
      const hud = document.querySelector("[data-goodies-live-speed]");
      if (!hud) return null;
      const rect = hud.getBoundingClientRect();
      return { x: Math.max(0, rect.left + window.scrollX - 18), y: Math.max(0, rect.top + window.scrollY - 10), width: rect.width + 36, height: rect.height + 20 };
    })()`);
    const shot = await cdp.send("Page.captureScreenshot", box ? { format: "png", clip: { ...box, scale: 3 } } : { format: "png" });
    mkdirSync(dirname(shotArg), { recursive: true });
    const { writeFileSync } = await import("node:fs");
    writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
    console.log("screenshot:", shotArg);
  }

  await ev(`document.getElementById("dtk-fake-running")?.remove()`);
  await sleep(900);
  const after = await ev(`document.querySelectorAll("[data-goodies-live-speed]").length`);
  check("hud clears when the run ends", after === 0, after);
  check("no page exceptions", cdp.errors.length === 0, cdp.errors);

  console.log(failures === 0 ? "HUD OK" : `HUD FAILED (${failures})`);
  child.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("hud probe crashed:", error.message);
  child.kill();
  process.exit(1);
});
