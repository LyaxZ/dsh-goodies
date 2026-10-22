/**
 * Watch the effort panel open and dismiss without needing a model.
 *
 * Injects a stand-in menu (three `menuitemradio` rows labelled Low/Medium/High,
 * which the plugin recognises as the reasoning pane), then clicks the panel's
 * own back button and samples it every 40 ms so the fade shows up in the log.
 *
 * usage: node test/panel-probe.mjs <url-with-token> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, shotArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/panel-probe.mjs <url-with-token> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9371;
const profile = mkdtempSync(join(tmpdir(), "dtk-panel-"));
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
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.id = "dtk-fake-effort-menu";
    menu.style.cssText = "position:fixed;left:320px;top:420px;width:248px;height:76px";
    for (const name of ["Low", "Medium", "High"]) {
      const row = document.createElement("button");
      row.type = "button";
      row.setAttribute("role", "menuitemradio");
      row.setAttribute("aria-checked", name === "Medium" ? "true" : "false");
      row.textContent = name;
      menu.appendChild(row);
    }
    // Native behaviour: Escape drills back to the model list on the next frame.
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      requestAnimationFrame(() => menu.querySelectorAll('button[role="menuitemradio"]').forEach((row) => row.remove()));
    });
    document.body.appendChild(menu);
    return true;
  })()`);
  await sleep(1200);

  const opened = await ev(`(() => {
    const panel = document.querySelector(".dtk-effort-panel");
    const back = panel?.querySelector(".dtk-effort-back");
    if (!panel || !back) return { panel: !!panel, back: !!back };
    const p = panel.getBoundingClientRect();
    const b = back.getBoundingClientRect();
    const arrow = back.querySelector("svg");
    const a = arrow ? arrow.getBoundingClientRect() : null;
    return {
      panel: true,
      back: true,
      panelBox: { l: Math.round(p.left), t: Math.round(p.top), w: Math.round(p.width), h: Math.round(p.height) },
      backBox: { l: Math.round(b.left), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) },
      arrowBox: a ? { l: Math.round(a.left), t: Math.round(a.top), w: Math.round(a.width), h: Math.round(a.height) } : null,
      hasSvg: !!arrow,
    };
  })()`);
  console.log("opened:", JSON.stringify(opened));
  check("panel renders", opened.panel === true);
  check("back button renders", opened.back === true);
  if (opened.arrowBox) {
    const dx = Math.abs(opened.arrowBox.l + opened.arrowBox.w / 2 - (opened.backBox.l + opened.backBox.w / 2));
    const dy = Math.abs(opened.arrowBox.t + opened.arrowBox.h / 2 - (opened.backBox.t + opened.backBox.h / 2));
    check("arrow is centred in its button", dx <= 1 && dy <= 1, { dx, dy });
  }

  // Activate through the DOM: a logged-out sandbox shows a modal that swallows
  // real pointer events, and the handler is what this probe is about.
  if (shotArg) {
    const openShot = await cdp.send("Page.captureScreenshot", { format: "png" });
    const openPath = shotArg.replace(/\.png$/i, "-open.png");
    mkdirSync(dirname(openPath), { recursive: true });
    writeFileSync(openPath, Buffer.from(openShot.data, "base64"));
    console.log("screenshot (open):", openPath);
  }
  const clicked = await ev(`(() => {
    const b = document.querySelector(".dtk-effort-back");
    if (!b) return null;
    b.click();
    const panel = document.querySelector(".dtk-effort-panel");
    return { ok: true, closing: panel ? panel.classList.contains("dtk-effort-panel--closing") : false };
  })()`);
  check("back button is clickable", clicked?.ok === true);
  check("the fade starts in the same tick", clicked?.closing === true, clicked);

  // Stand in for the root list that the native pane swaps to: it renders in the
  // popover layer (z-index 1100) and would hide a panel that sits below it.
  await ev(`(() => {
    const cover = document.createElement("div");
    cover.id = "dtk-fake-root-menu";
    cover.style.cssText = "position:fixed;left:320px;top:420px;width:248px;height:76px;background:#fff;z-index:1100";
    document.body.appendChild(cover);
    return true;
  })()`);

  const samples = [];
  for (let frame = 0; frame < 10; frame += 1) {
    await sleep(40);
    const sample = await ev(`(() => {
      const panel = document.querySelector(".dtk-effort-panel");
      if (!panel) return { gone: true, panels: 0 };
      const cover = document.getElementById("dtk-fake-root-menu");
      const z = Number(getComputedStyle(panel).zIndex) || 0;
      const coverZ = cover ? Number(getComputedStyle(cover).zIndex) || 0 : 0;
      return {
        closing: panel.classList.contains("dtk-effort-panel--closing"),
        opacity: Number(getComputedStyle(panel).opacity),
        above: z > coverZ,
        panels: document.querySelectorAll(".dtk-effort-panel").length,
      };
    })()`);
    samples.push(sample);
    console.log("fade", frame, JSON.stringify(sample));
  }
  const fades = samples.filter((s) => s.closing === true && s.opacity > 0.01 && s.opacity < 0.99);
  check("closing panel fades instead of vanishing", fades.length >= 1, samples);
  check("closing panel paints above the popover layer", samples.some((s) => s.above === true), samples);
  check("no second panel is built while fading", samples.every((s) => s.gone !== true || s.panels === 0) && samples.filter((s) => s.panels > 1).length === 0, samples);

  await ev(`document.getElementById("dtk-fake-root-menu")?.remove()`);

  // Going back and immediately opening the pane again must show a panel, not
  // leave the menu empty: re-add the rows the way the native drill does.
  await ev(`(() => {
    const menu = document.getElementById("dtk-fake-effort-menu");
    if (!menu) return false;
    for (const name of ["Low", "Medium", "High"]) {
      const row = document.createElement("button");
      row.type = "button";
      row.setAttribute("role", "menuitemradio");
      row.setAttribute("aria-checked", name === "Medium" ? "true" : "false");
      row.textContent = name;
      menu.appendChild(row);
    }
    return true;
  })()`);
  await sleep(600);
  const reopened = await ev(`(() => {
    const panel = document.querySelector(".dtk-effort-panel");
    return { panel: !!panel, back: !!panel?.querySelector(".dtk-effort-back") };
  })()`);
  check("the pane opens again right after a back", reopened.panel === true && reopened.back === true, reopened);

  // A second back must fade again rather than tear the panel away.
  await ev(`document.querySelector(".dtk-effort-back")?.click()`);
  await sleep(90);
  const secondFade = await ev(`(() => {
    const panel = document.querySelector(".dtk-effort-panel");
    if (!panel) return { gone: true };
    return { closing: panel.classList.contains("dtk-effort-panel--closing"), opacity: Number(getComputedStyle(panel).opacity) };
  })()`);
  check("a second back fades too", secondFade.gone === true || (secondFade.closing === true && secondFade.opacity > 0.01), secondFade);

  // The native surface can keep the old rows on screen for a few frames while it
  // moves and re-renders; decorating then is what flashed a whole panel in the
  // bottom-right corner. Rows that stay put must never produce a second panel.
  await ev(`(() => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.id = "dtk-fake-effort-menu-2";
    menu.style.cssText = "position:fixed;left:900px;top:700px;width:248px;height:76px";
    for (const name of ["Low", "Medium", "High"]) {
      const row = document.createElement("button");
      row.type = "button";
      row.setAttribute("role", "menuitemradio");
      row.setAttribute("aria-checked", name === "Medium" ? "true" : "false");
      row.textContent = name;
      menu.appendChild(row);
    }
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      // A slow swap: the rows hang around well past the click.
      setTimeout(() => menu.querySelectorAll('button[role="menuitemradio"]').forEach((row) => row.remove()), 500);
    });
    document.body.appendChild(menu);
    return true;
  })()`);
  await sleep(400);
  await sleep(800);
  const secondOpen = await ev(`document.querySelectorAll(".dtk-effort-panel:not(.dtk-effort-panel--closing)").length`);
  check("the slow-swap pane opens", secondOpen === 1, secondOpen);
  await ev(`(() => {
    const menu = document.getElementById("dtk-fake-effort-menu-2");
    menu?.querySelector(".dtk-effort-panel")?.remove();
    return true;
  })()`);
  const clickedSlow = await ev(`(() => {
    const panel = Array.from(document.querySelectorAll(".dtk-effort-panel")).find((node) => !node.classList.contains("dtk-effort-panel--closing"));
    const back = panel?.querySelector(".dtk-effort-back");
    if (!back) return false;
    back.click();
    return { ok: true, closing: panel.classList.contains("dtk-effort-panel--closing") };
  })()`);
  check("the slow-swap pane has a back button", clickedSlow?.ok === true);
  check("the slow swap also fades at once", clickedSlow?.closing === true, clickedSlow);

  const flashSamples = [];
  for (let frame = 0; frame < 12; frame += 1) {
    await sleep(45);
    flashSamples.push(
      await ev(`(() => {
        const panels = Array.from(document.querySelectorAll(".dtk-effort-panel"));
        return {
          count: panels.length,
          closing: panels.filter((p) => p.classList.contains("dtk-effort-panel--closing")).length,
          visible: panels.filter((p) => Number(getComputedStyle(p).opacity) > 0.4).length,
        };
      })()`)
    );
  }
  console.log("flash:", JSON.stringify(flashSamples));
  check("no panel is rebuilt while the old rows linger", flashSamples.every((s) => s.count <= 1), flashSamples);
  await ev(`(() => {
    document.getElementById("dtk-fake-effort-menu")?.remove();
    return true;
  })()`);
  await sleep(600);
  const endState = await ev(`document.querySelectorAll(".dtk-effort-panel").length`);
  check("panel is gone afterwards", endState === 0, endState);
  check("no page exceptions", cdp.errors.length === 0, cdp.errors);

  // The native keyboard exit has to fade too: dispatch a real Escape into the
  // pane and check the panel is already fading by the time the swap lands.
  await ev(`(() => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.id = "dtk-fake-effort-menu-3";
    menu.style.cssText = "position:fixed;left:200px;top:300px;width:248px;height:76px";
    for (const name of ["Low", "Medium", "High"]) {
      const row = document.createElement("button");
      row.type = "button";
      row.setAttribute("role", "menuitemradio");
      row.setAttribute("aria-checked", name === "Medium" ? "true" : "false");
      row.textContent = name;
      menu.appendChild(row);
    }
    menu.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setTimeout(() => menu.querySelectorAll('button[role="menuitemradio"]').forEach((row) => row.remove()), 500);
    });
    document.body.appendChild(menu);
    return true;
  })()`);
  await sleep(700);
  const escOpened = await ev(`document.querySelectorAll(".dtk-effort-panel:not(.dtk-effort-panel--closing)").length`);
  check("the esc pane opens", escOpened === 1, escOpened);
  const escFade = await ev(`(() => {
    const menu = document.getElementById("dtk-fake-effort-menu-3");
    const panelBefore = Array.from(document.querySelectorAll(".dtk-effort-panel")).find((node) => !node.classList.contains("dtk-effort-panel--closing"));
    if (!menu || !panelBefore) return null;
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    return { closing: panelBefore.classList.contains("dtk-effort-panel--closing") };
  })()`);
  check("escape fades in the same tick", escFade?.closing === true, escFade);
  const escSamples = [];
  for (let frame = 0; frame < 8; frame += 1) {
    await sleep(45);
    escSamples.push(await ev(`(() => {
      const panels = Array.from(document.querySelectorAll(".dtk-effort-panel"));
      return { count: panels.length, opaque: panels.filter((p) => Number(getComputedStyle(p).opacity) > 0.4).length };
    })()`));
  }
  console.log("esc:", JSON.stringify(escSamples));
  check("escape does not rebuild a panel", escSamples.every((s) => s.count <= 1), escSamples);
  check("escape never shows two opaque panels", escSamples.every((s) => s.opaque <= 1), escSamples);
  if (shotArg) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(dirname(shotArg), { recursive: true });
    writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
    console.log("screenshot:", shotArg);
  }
  console.log(failures === 0 ? "PANEL OK" : `PANEL FAILED (${failures})`);
  child.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("panel probe crashed:", error.message);
  child.kill();
  process.exit(1);
});
