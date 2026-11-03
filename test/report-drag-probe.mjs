/**
 * Does the report follow a column that is being dragged?
 *
 * No window resize happens while the sidebar is dragged: only the room given to
 * the conversation changes. This probe narrows the conversation in place, step
 * by step, and checks that the figures step out one by one as it happens.
 *
 * usage: node test/report-drag-probe.mjs <url-with-token> [session-match]
 */
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg, matchArg] = process.argv;
const match = matchArg || "7c984779";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9410;
const profile = mkdtempSync(join(tmpdir(), "dtk-drag-"));
const child = execFile(
  EDGE,
  ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1400,900", "about:blank"],
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
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
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

// Keep the window size fixed: everything below changes only the conversation
// column, the way dragging the sidebar does.
const parts = async () => ev(`(() => {
  const visible = (el) => el.getClientRects().length > 0;
  const reports = [...document.querySelectorAll("[data-goodies-turn-report]")].filter(visible);
  const clipped = reports.filter((r) => r.scrollWidth > r.clientWidth + 2).length;
  const names = [...new Set(reports.flatMap((r) => [...r.querySelectorAll("[data-dtk-part]")]).filter(visible).map((p) => p.getAttribute("data-dtk-part")))];
  return { names, clipped };
})()`);

const baseline = await parts();
console.log("baseline:", JSON.stringify(baseline));

let failures = 0;
const steps = [];
// Shrinking the conversation frame is what dragging the sidebar does: the window
// never resizes, only the room given to the conversation does.
for (const width of [900, 780, 700, 620, 560, 500, 440]) {
  await ev(`(() => {
    const frame = document.querySelector('[class*="EvIC1a_frame"]');
    if (frame !== null) {
      frame.style.width = ${width} + "px";
      frame.style.maxWidth = "none";
    }
    return true;
  })()`);
  await sleep(500);
  const state = await parts();
  const rowWidth = await ev(`(() => { const row = document.querySelector('[data-turn-tail] [data-clock="end"]'); return row ? Math.round(row.getBoundingClientRect().width) : 0; })()`);
  steps.push({ shrink: width, rowWidth, names: state.names, clipped: state.clipped });
  console.log(`frame ${width}px (row ${rowWidth}): parts=${state.names.join("/") || "(none)"} clipped=${state.clipped}`);
  if (state.clipped !== 0) {
    failures += 1;
    console.log("  FAIL the figures did not give way in time");
  }
}

// The figures may only leave in the agreed order, and they must actually leave
// while the column narrows: that is what "one by one" means.
const ORDER = ["cache", "in", "out", "ttft", "total", "speed"];
const first = steps[0].names;
// Whatever the widest row shows is the full list; a narrower row may only keep a
// tail of it, so the figures that are gone must be exactly a leading run.
const present = ORDER.filter((key) => first.includes(key));
let lastCount = first.length;
let everDropped = false;
for (const step of steps) {
  const visible = new Set(step.names);
  // What is gone has to be a leading run of the agreed order: count how many
  // leading figures are missing, and the rest must all still be on screen.
  let gone = 0;
  while (gone < present.length && !visible.has(present[gone])) gone += 1;
  const expected = present.slice(gone);
  const ordered =
    expected.length === step.names.length && expected.every((key) => visible.has(key));
  if (!ordered) {
    failures += 1;
    console.log(`  FAIL at row ${step.rowWidth} the figures left out of order: ${step.names.join("/") || "(none)"} instead of ${expected.join("/") || "(none)"}`);
  }
  if (step.names.length < lastCount) everDropped = true;
  lastCount = step.names.length;
}
if (!everDropped) {
  failures += 1;
  console.log("  FAIL nothing gave way while the column narrowed");
}

console.log(failures === 0 ? "DRAG OK" : `DRAG FAILED (${failures})`);
child.kill();
process.exit(failures === 0 ? 0 : 1);
