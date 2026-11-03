import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg, matchArg, shotArg] = process.argv;
const match = matchArg || "7c984779";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9404;
const profile = mkdtempSync(join(tmpdir(), "dtk-live-width-"));
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
let seq = 0; const pending = new Map(); const errors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Page.navigate", { url: urlArg });
await sleep(11000);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
await ev(`(() => { const b=[...document.querySelectorAll("button")].find(n=>n.innerText.trim()==="继续"); if (b) b.click(); return true; })()`);
await sleep(1200);
const opened = await ev(`(() => { const row=[...document.querySelectorAll('[data-row-key^="session:"]')].find(n=>n.getAttribute("data-row-key").includes(${JSON.stringify(match)})); if (row) row.click(); return !!row; })()`);
if (!opened) throw new Error("session row not found");
await sleep(9000);

let failures = 0;
for (const width of [1280, 1024, 900, 760, 640, 520, 420, 380]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(900);
  const state = await ev(`(() => {
    const visible = (el) => el.getClientRects().length > 0;
    const reports = [...document.querySelectorAll("[data-goodies-turn-report]")].filter(visible);
    const clock = document.querySelector('[data-turn-tail] [data-clock="end"]');
    const row = clock ? clock.querySelector('[class*="_endInfo"]') || clock : null;
    const rowChildren = row ? [...row.children].filter((n) => n.getClientRects().length > 0 && n.getBoundingClientRect().width > 1) : [];
    const boxes = rowChildren.map((n) => { const b = n.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, text: (n.innerText || "").replace(/\\s+/g, " ").slice(0, 16) }; });
    const overlaps = [];
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (x > 1 && y > 1) overlaps.push([a.text, b.text, Math.round(x)]);
    }
    const parts = [...new Set(reports.flatMap((r) => [...r.querySelectorAll("[data-dtk-part]")]).filter((p) => p.getClientRects().length > 0).map((p) => p.getAttribute("data-dtk-part")))];
    const clipped = row ? reports.filter((r) => r.getBoundingClientRect().right > row.getBoundingClientRect().right + 1).length : 0;
    return { clipped, reports: reports.length, slots: document.querySelectorAll("[data-dtk-slot]").length, parts, overlaps, docScroll: document.documentElement.scrollWidth, viewport: innerWidth, seatErrors: document.querySelectorAll("[data-slot-error]").length };
  })()`);
  const wide = width >= 760;
  const ok = state.overlaps.length === 0 && state.clipped === 0 && state.docScroll <= state.viewport && (!wide || (state.reports > 0 && state.parts.includes("speed")));
  if (!ok) failures += 1;
  console.log(`width ${width}: reports=${state.reports} slots=${state.slots} parts=${state.parts.join("/")} overlaps=${state.overlaps.length} clipped=${state.clipped} scroll=${state.docScroll}/${state.viewport} ${ok ? "ok" : "FAIL"}`);
}
if (shotArg) {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", shotArg);
}
console.log("console errors:", JSON.stringify(errors.slice(0, 3)));
console.log(failures === 0 ? "LIVE WIDTH OK" : `LIVE WIDTH FAILED (${failures})`);
child.kill();
process.exit(failures === 0 ? 0 : 1);
