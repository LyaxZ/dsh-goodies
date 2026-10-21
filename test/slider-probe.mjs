/**
 * Click the effort slider track at a given ratio, then report the trigger text.
 * usage: node test/slider-probe.mjs <url-with-token> <ratio 0-1> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, ratioArg, shotArg, modeArg] = process.argv;
if (!urlArg || !ratioArg) {
  console.error("usage: node test/slider-probe.mjs <url-with-token> <ratio> [screenshot.png]");
  process.exit(2);
}
const ratio = Math.max(0, Math.min(1, Number(ratioArg)));

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9351;
const profile = mkdtempSync(join(tmpdir(), "dtk-sld-"));
const child = execFile(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "--window-size=1440,1000", "about:blank"], { stdio: "ignore" });
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

class Cdp {
  constructor() { this.pending = new Map(); this.seq = 0; this.errors = []; }
  async connect(url) {
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (event) => {
      const m = JSON.parse(event.data);
      if (m.id !== undefined && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
        return;
      }
      if (m.method === "Runtime.exceptionThrown") this.errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
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

async function main() {
  const target = await findTarget();
  const cdp = new Cdp();
  await cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: urlArg });
  await sleep(9000);
  const ev = async (expression) => {
    const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result.value;
  };
  const clickAt = async (x, y) => {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(1200);
  };
  const before = await ev(`document.querySelector('[data-composer-card] button[aria-haspopup="menu"]')?.innerText ?? null`);
  console.log("trigger before:", JSON.stringify(before));
  const trigger = await ev(`(() => { const b = document.querySelector('[data-composer-card] button[aria-haspopup="menu"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (trigger) await clickAt(trigger.x, trigger.y);
  const cell = await ev(`(() => { const n = Array.from(document.querySelectorAll('[role="menuitem"]')).find((x) => /推理等级|Reasoning effort/i.test(x.innerText)); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (cell) await clickAt(cell.x, cell.y);
  const slider = await ev(`(() => { const t = document.querySelector('.dtk-effort-track'); if (!t) return null; const r = t.getBoundingClientRect(); const s = document.querySelector('.dtk-effort-menu-label')?.textContent ?? null; return { x: r.left, w: r.width, y: r.top + r.height / 2, label: s, count: document.querySelector('[data-dtk-effort-menu]')?.getAttribute('data-dtk-menu-count') }; })()`);
  console.log("slider:", JSON.stringify(slider));
  if (slider) {
    const diag = await ev(`(() => {
      const menu = document.querySelector('[data-dtk-effort-menu]');
      const track = document.querySelector('.dtk-effort-track');
      const label = document.querySelector('.dtk-effort-menu-label');
      const radio = menu?.querySelector('button[role="menuitemradio"]');
      const fill = document.querySelector('.dtk-effort-fill');
      const thumb = document.querySelector('.dtk-effort-thumb');
      const panel = document.querySelector('.dtk-effort-panel');
      if (!track || !label) return null;
      const t = track.getBoundingClientRect();
      const l = label.getBoundingClientRect();
      const thumbRect = thumb ? thumb.getBoundingClientRect() : null;
      const fillRect = fill ? fill.getBoundingClientRect() : null;
      const nc = menu ? getComputedStyle(menu) : null;
      const before = menu ? getComputedStyle(menu, '::before') : null;
      const after = menu ? getComputedStyle(menu, '::after') : null;
      const nearSparks = Array.from(document.querySelectorAll('.dtk-effort-spark')).map((n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.y < t.top + 6 && r.x < t.left + 40);
      const stack = document.elementsFromPoint(t.left + 10, t.top - 1).slice(0, 4).map((n) => n.className || n.tagName);
      const pc = panel ? getComputedStyle(panel) : null;
      const pr = panel ? panel.getBoundingClientRect() : null;
      let surface = null;
      if (menu) {
        let probe = menu.parentElement;
        for (let depth = 0; probe && depth < 6; depth += 1) {
          const cs = getComputedStyle(probe);
          const r = probe.getBoundingClientRect();
          if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.width > 100 && r.height > 40) {
            surface = { tag: probe.tagName, cls: String(probe.className).slice(0, 80), bg: cs.backgroundColor, border: cs.border, radius: cs.borderRadius, shadow: cs.boxShadow, w: Math.round(r.width), h: Math.round(r.height), depth: depth + 1 };
            break;
          }
          probe = probe.parentElement;
        }
        if (surface === null) {
          const all = [menu, ...menu.querySelectorAll('*')];
          for (const node of all) {
            const cs = getComputedStyle(node);
            const r = node.getBoundingClientRect();
            if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.width > 100 && r.height > 40) {
              surface = { tag: node.tagName, cls: String(node.className).slice(0, 80), bg: cs.backgroundColor, border: cs.border, radius: cs.borderRadius, shadow: cs.boxShadow, w: Math.round(r.width), h: Math.round(r.height), depth: 0 };
              break;
            }
          }
        }
      }
      return {
        radioDisplay: radio ? getComputedStyle(radio).display : null,
        labelBottom: Math.round(l.bottom),
        trackTop: Math.round(t.top),
        labelAboveTrack: l.bottom <= t.top,
        track: { l: Math.round(t.left), r: Math.round(t.right), w: Math.round(t.width) },
        thumbRect: thumbRect ? { l: Math.round(thumbRect.left), r: Math.round(thumbRect.right), w: Math.round(thumbRect.width), h: Math.round(thumbRect.height) } : null,
        fillRect: fillRect ? { l: Math.round(fillRect.left), r: Math.round(fillRect.right), w: Math.round(fillRect.width) } : null,
        thumbRadius: thumb ? getComputedStyle(thumb).borderRadius : null,
        thumbTransition: thumb ? getComputedStyle(thumb).transitionProperty : null,
        trackClip: getComputedStyle(track).overflow,
        range: track.getAttribute('aria-valuemin') + '..' + track.getAttribute('aria-valuemax'),
        rootAnchor: menu ? menu.__dtkRootAnchor ?? null : null,
        panelRect: pr ? { l: Math.round(pr.left), r: Math.round(pr.right), w: Math.round(pr.width), h: Math.round(pr.height) } : null,
        native: nc ? { border: nc.border, bg: nc.backgroundColor, shadow: nc.boxShadow, radius: nc.borderRadius, backdrop: nc.backdropFilter, beforeBg: before?.backgroundColor, beforeImage: before?.backgroundImage, afterBg: after?.backgroundColor, afterImage: after?.backgroundImage } : null,
        nearSparks,
        stack,
        surface,
        panelStyle: pc ? { border: pc.border, bg: pc.backgroundColor, shadow: pc.boxShadow, radius: pc.borderRadius, backdrop: pc.backdropFilter } : null
      };
    })()`);
    console.log("diag:", JSON.stringify(diag));
    if (modeArg === "rapid") {
      const tap = async (x) => {
        await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y: slider.y, button: "left", clickCount: 1 });
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y: slider.y, button: "left", clickCount: 1 });
      };
      const read = () => ev(`(() => { const m = document.querySelector('div[role="menu"]'); const s = m?.__dtkSlider; const t = document.querySelector('.dtk-effort-thumb')?.getBoundingClientRect(); return { ratio: s ? Number(s.ratio.toFixed(3)) : null, snapping: s ? s.snapping : null, dragging: s ? s.dragging : null, center: t ? Math.round(t.left + t.width / 2) : null }; })()`);
      for (let cycle = 0; cycle < 14; cycle += 1) {
        const x = cycle % 2 === 0 ? slider.x + 6 : slider.x + slider.w - 6;
        await tap(x);
        console.log("tap", cycle, x < slider.x + slider.w / 2 ? "left" : "right");
        for (let frame = 0; frame < 1; frame += 1) {
          await sleep(25);
          console.log("rapid", cycle, frame, JSON.stringify(await read()));
        }
      }
    } else if (modeArg === "drag") {
      const startX = slider.x + slider.w * 0.1;
      const endX = slider.x + slider.w * ratio;
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: startX, y: slider.y, button: "left", clickCount: 1 });
      for (let step = 1; step <= 10; step += 1) {
        const x = startX + ((endX - startX) * step) / 10;
        await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: slider.y, button: "left", buttons: 1 });
        await sleep(40);
        const state = await ev(`(() => ({ label: document.querySelector('.dtk-effort-menu-label')?.textContent ?? null, thumb: document.querySelector('.dtk-effort-thumb')?.style.left ?? null }))()`);
        console.log("drag", step, JSON.stringify(state));
      }
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: endX, y: slider.y, button: "left", clickCount: 1 });
      for (let frame = 0; frame < 8; frame += 1) {
        await sleep(45);
        const snap = await ev(`(() => ({ thumb: document.querySelector('.dtk-effort-thumb')?.style.left ?? null, fill: document.querySelector('.dtk-effort-fill')?.style.width ?? null, label: document.querySelector('.dtk-effort-menu-label')?.textContent ?? null }))()`);
        console.log("snap", frame, JSON.stringify(snap));
      }
    } else {
      await clickAt(slider.x + slider.w * ratio, slider.y);
      await sleep(1500);
    }
  }
  const after = await ev(`(() => ({
    trigger: document.querySelector('[data-composer-card] button[aria-haspopup="menu"]')?.innerText ?? null,
    menuOpen: !!document.querySelector('[data-dtk-effort-menu]')
  }))()`);
  console.log("after:", JSON.stringify(after));
  if (shotArg) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(dirname(shotArg), { recursive: true });
    writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
    console.log(`screenshot: ${shotArg}`);
  }
  console.log("errors:", JSON.stringify(cdp.errors.slice(0, 3)));
  cdp.ws.close();
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { child.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch {} });
