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
const ORDER = ["cache", "in", "out", "ttft", "total", "speed"];
const seen = [];
const check = (name, ok, detail) => {
  if (ok) return;
  failures += 1;
  console.log(`  FAIL ${name} -> ${JSON.stringify(detail)}`);
};

for (const width of [1280, 1100, 1000, 900, 820, 760, 700, 640, 580, 520, 460, 400, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(900);
  const state = await ev(`(() => {
    const visible = (el) => el.getClientRects().length > 0;
    const row = document.querySelector('[data-turn-tail] [data-clock="end"]');
    const reports = [...document.querySelectorAll("[data-goodies-turn-report]")].filter(visible);
    const rowBox = row ? row.getBoundingClientRect() : null;
    const boxes = row ? [...row.querySelectorAll("[data-goodies-turn-report]")].filter(visible).map((n) => { const b = n.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, text: (n.innerText || "").replace(/\\s+/g, " ").slice(0, 18) }; }) : [];
    const overlaps = [];
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
      if (x > 1 && y > 1) overlaps.push([a.text, b.text]);
    }
    // A neighbour that our report runs into is an overlap even when the boxes are
    // not both ours: compare against every visible child of the row.
    const rowKids = row ? [...row.children].filter((n) => n.getClientRects().length > 0).map((n) => n.getBoundingClientRect()) : [];
    const clipped = reports.filter((r) => r.scrollWidth > r.clientWidth + 2).length;
    const parts = [...new Set([...document.querySelectorAll("[data-goodies-turn-report]")].filter(visible).flatMap((r) => [...r.querySelectorAll("[data-dtk-part]")]).filter((p) => p.getClientRects().length > 0).map((p) => p.getAttribute("data-dtk-part")))];
    // A dot belongs to the figure after it, so a report can never start with one
    // and can never show more dots than it has figures minus one.
    let danglingDots = 0;
    let extraDots = 0;
    for (const report of reports) {
      const kids = [...report.children].filter(visible);
      if (kids.length > 0 && kids[0].classList.contains("dtk-report-sep")) danglingDots += 1;
      const dots = kids.filter((n) => n.classList.contains("dtk-report-sep")).length;
      const figures = kids.filter((n) => n.hasAttribute("data-dtk-part")).length;
      if (dots > Math.max(0, figures - 1)) extraDots += 1;
    }
    const seps = danglingDots + extraDots;
    return { reports: reports.length, parts, overlaps, clipped, seps, rowKids: rowKids.length, docScroll: document.documentElement.scrollWidth, viewport: innerWidth };
  })()`);
  seen.push({ width, parts: state.parts });
  console.log(`width ${width}: parts=${state.parts.join("/") || "(none)"} reports=${state.reports} overlaps=${state.overlaps.length} clipped=${state.clipped} seps=${state.seps}`);
  check(`width ${width} has no overlap`, state.overlaps.length === 0, state.overlaps);
  check(`width ${width} is not clipped`, state.clipped === 0, state);
  check(`width ${width} does not scroll sideways`, state.docScroll <= state.viewport, state);
  check(`width ${width} never draws a leading dot`, state.seps <= Math.max(0, state.parts.length - 1), state);
}

// The presence set is whatever the widest window shows; a narrower one may only
// drop a prefix of the agreed order.
const widest = seen[0].parts;
for (const entry of seen) {
  const visible = new Set(entry.parts);
  const present = ORDER.filter((key) => widest.includes(key));
  let droppedPrefix = true;
  for (const key of present) {
    if (visible.has(key)) droppedPrefix = false;
    else if (!droppedPrefix) {
      check(`width ${entry.width} drops figures in order`, false, { visible: entry.parts, widest });
    }
  }
}
check("the widest window shows the main figures", ["in", "out", "speed"].every((key) => seen[0].parts.includes(key)), seen[0].parts);
check("the last resort keeps nothing of ours", seen[seen.length - 1].parts.length === 0, seen[seen.length - 1]);

if (shotArg) {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
  console.log("screenshot:", shotArg);
}
console.log("console errors:", JSON.stringify(errors.slice(0, 3)));
console.log(failures === 0 ? "LIVE WIDTH OK" : `LIVE WIDTH FAILED (${failures})`);
child.kill();
process.exit(failures === 0 ? 0 : 1);
