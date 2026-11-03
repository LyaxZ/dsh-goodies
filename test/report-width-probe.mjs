/**
 * Does the per-turn report stay readable at every window width?
 *
 * Builds the real footer markup around the plugin's own stylesheet and measures
 * it at a series of widths. This is a layout test, so it needs no session and no
 * model: the row is the same shape DSH renders (pill, usage slot, clock, timing
 * slot), and the question is whether the parts overlap or push the page sideways.
 *
 * usage: node test/report-width-probe.mjs [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { CSS } = require("../src/shared.cjs");
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const shotArg = process.argv[2];

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9401;
const profile = mkdtempSync(join(tmpdir(), "dtk-width-"));

// The footer pieces DSH itself styles, copied from the running build so the test
// row behaves like the real one.
const NATIVE_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,"Segoe UI",sans-serif;font-size:14px}
.chat{padding:16px;display:flex;justify-content:center}
.tail{width:100%;max-width:720px;display:flex;flex-direction:column;gap:16px}
.actions{height:28px;align-items:center;gap:8px;display:flex;margin-top:4px;margin-left:-6px}
.endInfo{min-width:0;color:#666;align-items:center;gap:8px;margin-left:8px;display:inline-flex}
.timeEnd{font-size:12px;line-height:24px;color:inherit;white-space:nowrap}
.pill{width:15px;height:15px;border-radius:4px;background:#d0d5dd;display:inline-block;flex:none}
.timeStart{font-size:13px;line-height:24px;color:#666;white-space:nowrap;padding-right:12px}
`;

const page = `<!doctype html><html><head><meta charset="utf-8">
<style>${NATIVE_CSS}</style>
<style>${CSS}</style>
</head><body>
<div class="chat"><div class="tail">
  <div class="actions" data-clock="end">
    <span class="timeStart">10月30日 18:49</span>
    <div class="endInfo">
      <span class="pill"></span>
      <span class="dtk-slot" data-dtk-slot="usage"><span class="dtk-report" data-goodies-turn-report="usage" data-turn="693"><span class="dtk-report-part" data-dtk-part="in">输入 105</span><span class="dtk-report-part" data-dtk-part="out">输出 15K</span><span class="dtk-report-part" data-dtk-part="cache">缓存 349K</span></span></span>
      <span class="timeEnd">12m 04s</span>
      <span class="dtk-slot" data-dtk-slot="time"><span class="dtk-report" data-goodies-turn-report="timing" data-turn="693"><span class="dtk-report-part" data-dtk-part="ttft">首字 3.2s</span><span class="dtk-report-part" data-dtk-part="total">总用时 12m 04s</span><span class="dtk-report-part" data-dtk-part="speed">25.4 tok/s</span></span></span>
    </div>
  </div>
</div></div>
</body></html>`;

const pagePath = join(tmpdir(), `dtk-report-width-${Date.now()}.html`);
writeFileSync(pagePath, page, "utf8");

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

let target;
for (let attempt = 0; attempt < 40 && !target; attempt += 1) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = targets.find((entry) => entry.type === "page");
  } catch {
    // Not up yet.
  }
  if (!target) await sleep(300);
}
if (!target) throw new Error("no CDP target");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

let failures = 0;
const check = (name, condition, detail) => {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name} -> ${JSON.stringify(detail)}`);
};

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url: `file:///${pagePath.replace(/\\/g, "/")}` });
await sleep(1500);
const ev = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

for (const width of [1280, 1024, 900, 760, 640, 560, 480, 420, 380]) {
  // The chat column is the window minus the sidebar and its padding.
  const column = Math.min(720, width - 292);
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(120);
  const state = await ev(`(() => {
    document.querySelector(".tail").style.width = ${column} + "px";
    const row = document.querySelector(".endInfo");
    const visible = [...row.children].filter((n) => getComputedStyle(n).display !== "none" && n.getBoundingClientRect().width > 0);
    const boxes = visible.map((n) => { const b = n.getBoundingClientRect(); return { x: b.x, right: b.right, y: b.y, bottom: b.bottom, text: (n.innerText || "").replace(/\\s+/g, " ").slice(0, 22) }; });
    const overlaps = [];
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i], b = boxes[j];
        const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
        if (x > 1 && y > 1) overlaps.push([a.text, b.text, Math.round(x)]);
      }
    }
    const parts = [...row.querySelectorAll("[data-dtk-part]")]
      .filter((p) => p.getClientRects().length > 0)
      .map((p) => p.getAttribute("data-dtk-part"));
    return {
      column: ${column},
      overlaps,
      parts,
      rowWidth: Math.round(row.getBoundingClientRect().width),
      rowScroll: row.scrollWidth,
      docScroll: document.documentElement.scrollWidth,
      viewport: innerWidth
    };
  })()`);
  console.log(`width ${width} (column ${state.column}): parts=${state.parts.join("/")} row=${state.rowWidth}`);
  check(`width ${width} has no overlapping parts`, state.overlaps.length === 0, state.overlaps);
  const wide = state.column >= 300;
  check(`width ${width} keeps the speed`, !wide || state.parts.includes("speed"), state.parts);
  check(`width ${width} keeps a figure`, !wide || state.parts.length > 0, state.parts);
  check(`width ${width} does not scroll sideways`, state.docScroll <= state.viewport, state);
}

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
if (shotArg) {
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
  console.log(`screenshot: ${shotArg}`);
}

console.log(failures === 0 ? "WIDTH OK" : `WIDTH FAILED (${failures})`);
child.kill();
process.exit(failures === 0 ? 0 : 1);
