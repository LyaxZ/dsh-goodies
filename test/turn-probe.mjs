/**
 * Send one short turn through the real composer and watch the two data
 * features: the live speed reading while streaming, and the per-turn report
 * after the turn settles.
 *
 * usage: node test/turn-probe.mjs <url-with-token> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, shotArg, promptArg, notifyArg] = process.argv;
const prompt = promptArg || "Write a 120-word paragraph about the ocean.";
const notify = notifyArg === "notify";
if (!urlArg) {
  console.error("usage: node test/turn-probe.mjs <url-with-token> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), "dtk-turn-"));
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
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page" && target.url?.startsWith("about:blank"));
      if (page) return page;
    } catch {
      // The browser is still starting.
    }
    await sleep(300);
  }
  throw new Error("headless Edge did not expose a CDP target");
}

class Cdp {
  constructor() {
    this.pending = new Map();
    this.console = [];
    this.seq = 0;
    this.ws = null;
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
      if (message.method === "Runtime.consoleAPICalled") {
        const text = (message.params.args ?? [])
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ");
        this.console.push(`[console.${message.params.type}] ${text}`);
      } else if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        this.console.push(`[exception] ${details.text} ${details.exception?.description ?? ""}`);
      } else if (message.method === "Log.entryAdded") {
        this.console.push(`[${message.params.entry.level}] ${message.params.entry.text}`);
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

async function main() {
  const target = await findTarget();
  const cdp = new Cdp();
  await cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: urlArg });
  await sleep(10000);

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text + " " + (result.exceptionDetails.exception?.description ?? ""));
    }
    return result.result.value;
  };

  const before = await evaluate(`(() => ({
    composer: !!document.querySelector("[data-composer-input]"),
    sendDisabled: document.querySelector('[data-composer-card] button[aria-label]')?.disabled ?? null,
    model: document.querySelector('[data-composer-card] button[aria-haspopup="menu"]')?.title ?? null
  }))()`);
  console.log("before:", JSON.stringify(before));

  await evaluate(`(() => {
    const editor = document.querySelector("[data-composer-input]");
    if (!editor) return false;
    editor.focus();
    return true;
  })()`);
  if (notify) {
    const focused = await evaluate(`(() => {
      Object.defineProperty(document, "hasFocus", { value: () => false, configurable: true });
      return { hasFocus: document.hasFocus(), hidden: document.hidden };
    })()`);
    console.log("focus override:", JSON.stringify(focused));
  }
  await cdp.send("Input.insertText", { text: prompt });
  await sleep(400);
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
    text: "\r",
    unmodifiedText: "\r",
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });

  let sawLive = false;
  let maxSpeed = 0;
  let midShot = false;
  let sawRunning = false;
  let sawTitleFlash = false;
  for (let tick = 0; tick < 200; tick += 1) {
    await sleep(100);
    const state = await evaluate(`(() => {
      const live = document.querySelector("[data-goodies-live-speed]");
      const running = document.querySelector("[data-chat-running]");
      const value = live?.querySelector(".dtk-live-value")?.textContent ?? null;
      const numeric = value === null ? null : Number(value.replace(/[^0-9.]/g, ""));
      return {
        live: live?.getAttribute("data-goodies-live-speed") ?? null,
        speed: numeric,
        now: live?.getAttribute("data-live-now") ?? null,
        total: live?.getAttribute("data-live-total") ?? null,
        running: !!running,
        runningHtml: running ? running.innerHTML.slice(-900) : null,
        liveParent: live?.parentElement?.className ?? null,
        title: document.title,
        reports: document.querySelectorAll("[data-goodies-turn-report]").length,
        text: document.body.innerText.slice(0, 260)
      };
    })()`);
    if (state.live !== null) {
      sawLive = true;
      if (typeof state.speed === "number" && state.speed > maxSpeed) maxSpeed = state.speed;
      console.log("live", tick, JSON.stringify({ live: state.live, speed: state.speed, now: state.now, total: state.total, parent: state.liveParent }));
      if (shotArg && !midShot) {
        midShot = true;
        const liveShot = await cdp.send("Page.captureScreenshot", { format: "png" });
        const livePath = shotArg.replace(/\.png$/i, "-live.png");
        mkdirSync(dirname(livePath), { recursive: true });
        writeFileSync(livePath, Buffer.from(liveShot.data, "base64"));
        console.log(`live screenshot: ${livePath}`);
      }
    }
    if (state.running && tick % 20 === 0) {
      console.log("run", tick, JSON.stringify({ live: state.live, parent: state.liveParent, html: state.runningHtml?.slice(-220) }));
    }
    if (state.running) sawRunning = true;
    if (typeof state.title === "string" && state.title.includes("●")) sawTitleFlash = true;
    if (typeof state.speed === "number" && state.speed > maxSpeed) maxSpeed = state.speed;
    if (state.reports > 0 && !state.running) {
      console.log("settled:", JSON.stringify(state));
      break;
    }
    if (tick % 10 === 0) console.log("tick", tick, JSON.stringify(state));
  }

  await sleep(2200);

  const after = await evaluate(`(() => ({
    reports: Array.from(document.querySelectorAll("[data-goodies-turn-report]")).map((node) => node.innerText),
    live: document.querySelectorAll("[data-goodies-live-speed]").length,
    text: document.body.innerText.slice(0, 700)
  }))()`);
  console.log("after:", JSON.stringify(after, null, 2));
  const debug = await evaluate(`(() => {
    const d = window.__dshGoodiesDebug;
    return d ? {
      sessions: !!d.sessions(),
      notifyCalls: d.notifyCalls,
      lastGate: d.lastGate,
      title: document.title,
      hasFocus: document.hasFocus()
    } : null;
  })()`);
  console.log("debug:", JSON.stringify(debug));
  console.log("--- summary ---");
  console.log(JSON.stringify({ sawRunning, sawLive, maxSpeed, sawTitleFlash }));

  if (shotArg) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(dirname(shotArg), { recursive: true });
    writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
    console.log(`screenshot: ${shotArg}`);
  }

  console.log("--- console ---");
  console.log(cdp.console.filter((line) => /error|exception|warn|toolkit/i.test(line)).join("\n") || "(none)");
  cdp.ws.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    child.kill();
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // The browser may still hold a file briefly.
    }
  });
