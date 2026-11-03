import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg, widthArg, shotArg] = process.argv;
const width = Number(widthArg || 640);
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9409;
const profile = mkdtempSync(join(tmpdir(), "dtk-fit-shot-"));
const child = execFile(
  EDGE,
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1280,900", "about:blank"],
  { stdio: "ignore" }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 40 && !page; i += 1) {
  try { const t = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); page = t.find((x) => x.type === "page"); } catch {}
  if (!page) await sleep(300);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
let seq = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: urlArg });
await sleep(11000);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await ev(`(() => { const b=[...document.querySelectorAll("button")].find(n=>n.innerText.trim()==="继续"); if (b) b.click(); return true; })()`);
await sleep(1200);
await ev(`(() => { const row=[...document.querySelectorAll('[data-row-key^="session:"]')].find(n=>n.getAttribute("data-row-key").includes("7c984779")); if (row) row.click(); return !!row; })()`);
await sleep(9000);
await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 2, mobile: false });
await sleep(1200);
const point = await ev(`(() => {
  const report = [...document.querySelectorAll("[data-goodies-turn-report]")].find((r) => r.getClientRects().length > 0);
  const tail = report ? report.closest("[data-turn-tail]") : null;
  if (!tail) return null;
  tail.scrollIntoView({ block: "center" });
  const b = report.getBoundingClientRect();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
})()`);
if (point) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
  await sleep(700);
}
const clip = await ev(`(() => {
  const clock = document.querySelector('[data-turn-tail] [data-clock="end"]');
  if (!clock) return null;
  const b = clock.getBoundingClientRect();
  return { x: Math.max(0, b.x - 30), y: Math.max(0, b.y - 10), width: Math.min(innerWidth - Math.max(0, b.x - 30), b.width + 60), height: b.height + 20, scale: 2 };
})()`);
const shot = await send("Page.captureScreenshot", clip ? { format: "png", clip } : { format: "png" });
writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
console.log("shot:", shotArg, "width:", width);
child.kill();
process.exit(0);
