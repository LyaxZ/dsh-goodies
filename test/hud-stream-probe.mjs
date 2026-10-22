/**
 * Does the reading move while text grows?
 *
 * Injects a stand-in running row plus a stand-in answer node whose text grows
 * in small steps, then samples the HUD: a coarse store update must not leave
 * the reading frozen, and the total must never trail the speed.
 *
 * usage: node test/hud-stream-probe.mjs <url-with-token>
 */
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/hud-stream-probe.mjs <url-with-token>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9373;
const profile = mkdtempSync(join(tmpdir(), "dtk-stream-"));
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
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  await ev(`(() => {
    const answer = document.createElement("div");
    answer.setAttribute("data-chat-flow-kind", "assistant");
    answer.id = "dtk-fake-answer";
    document.body.appendChild(answer);
    const row = document.createElement("div");
    row.setAttribute("data-chat-running", "");
    const inner = document.createElement("div");
    inner.className = "dtk_fake_runningContent";
    inner.textContent = "深度求索中";
    row.appendChild(inner);
    document.body.appendChild(row);
    return true;
  })()`);
  await sleep(700);

  const samples = [];
  for (let step = 0; step < 16; step += 1) {
    await ev(`(() => {
      const answer = document.getElementById("dtk-fake-answer");
      answer.textContent += " alpha bravo charlie delta";
      return answer.textContent.length;
    })()`);
    await sleep(120);
    samples.push(
      await ev(`(() => {
        const pill = document.querySelector("[data-goodies-live-speed]");
        if (!pill) return null;
        return {
          total: Number(pill.getAttribute("data-live-total")),
          speed: parseFloat(pill.getAttribute("data-live-now")) || 0,
        };
      })()`)
    );
  }

  const totals = samples.filter(Boolean).map((s) => s.total);
  const distinct = new Set(totals).size;
  const growing = totals.every((value, index) => index === 0 || value >= totals[index - 1]);
  console.log("totals:", JSON.stringify(totals));
  check("the reading exists while text grows", totals.length > 0, samples.length);
  check("the total moves with the text", distinct >= 4, { distinct, totals });
  check("the total never steps back", growing, totals);
  check("a speed is shown", samples.some((s) => s && s.speed > 0), samples);

  // Roughly a token per second of text cannot exceed the total on screen.
  const last = samples[samples.length - 1];
  check("the total is at least a second of the shown speed", !last || last.total >= Math.round(last.speed * 0.6), last);

  await ev(`(() => {
    document.getElementById("dtk-fake-answer")?.remove();
    document.querySelector("[data-chat-running]")?.remove();
    return true;
  })()`);
  await sleep(500);
  const gone = await ev(`document.querySelectorAll("[data-goodies-live-speed]").length`);
  check("the hud clears afterwards", gone === 0, gone);
  check("no page exceptions", cdp.errors.length === 0, cdp.errors);

  console.log(failures === 0 ? "STREAM OK" : `STREAM FAILED (${failures})`);
  child.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("stream probe crashed:", error.message);
  child.kill();
  process.exit(1);
});
