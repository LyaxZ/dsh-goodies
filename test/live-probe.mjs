/**
 * Is the host's live counter reachable from the page?
 *
 * The channel is served by the host half; this checks the browser can read it
 * with its own session cookie and that the payload has the expected shape.
 *
 * usage: node test/live-probe.mjs <url-with-token>
 */
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/live-probe.mjs <url-with-token>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9375;
const profile = mkdtempSync(join(tmpdir(), "dtk-live-"));
const child = execFile(
  EDGE,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" }
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findTarget() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.url?.startsWith("about:blank"));
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

  const result = await cdp.send("Runtime.evaluate", {
    expression: `fetch("/dsh-goodies/live", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { status: r.status })
      .then((body) => ({ ok: true, body }))
      .catch((error) => ({ ok: false, error: String(error) }))`,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = result.result?.value;
  console.log("channel:", JSON.stringify(value));

  check("the live channel answers", value?.ok === true && value.body && typeof value.body === "object", value);
  check("the payload carries a session map", value?.body && typeof value.body.sessions === "object", value?.body);
  check("the payload carries a timestamp", value?.body && typeof value.body.at === "number", value?.body);

  console.log(failures === 0 ? "LIVE OK" : `LIVE FAILED (${failures})`);
  child.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("live probe crashed:", error.message);
  child.kill();
  process.exit(1);
});
