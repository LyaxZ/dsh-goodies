/**
 * usage: node test/error-probe.mjs <url-with-token>
 * Loads the page, collects full exception details, prints them.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/error-probe.mjs <url-with-token>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9341;
const profile = mkdtempSync(join(tmpdir(), "dtk-err-"));
const child = execFile(
  EDGE,
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1440,1000", "about:blank"],
  { stdio: "ignore" }
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findTarget() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await r.json();
      const page = targets.find((t) => t.type === "page" && t.url?.startsWith("about:blank"));
      if (page) return page;
    } catch {}
    await sleep(300);
  }
  throw new Error("no CDP target");
}

const target = await findTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
const seq = { n: 0 };
const pending = new Map();
const exceptions = [];
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    const d = message.params.exceptionDetails;
    exceptions.push({ text: d.text, message: d.exception?.description ?? d.exception?.value ?? null, url: d.url, line: d.lineNumber, column: d.columnNumber, stack: d.stackTrace?.callFrames?.slice(0, 4) ?? null });
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq.n;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await send("Runtime.enable");
await send("Page.enable");
await send("Page.navigate", { url: urlArg });
await sleep(9000);
console.log(JSON.stringify(exceptions.slice(0, 6), null, 2));
console.log(`total exceptions: ${exceptions.length}`);
ws.close();
child.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch {}
