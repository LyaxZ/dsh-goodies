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
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
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
