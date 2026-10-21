/**
 * Open Settings with the keyboard shortcut and walk to the toolkit card.
 *
 * usage: node test/settings-probe.mjs <url-with-token> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, shotArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/settings-probe.mjs <url-with-token> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
const profile = mkdtempSync(join(tmpdir(), "dtk-settings-"));
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
      // Still starting.
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
        this.console.push(`[exception] ${message.params.exceptionDetails.text}`);
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
  await sleep(9000);

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  // Ctrl+Alt+Comma is the Windows Web default for settings.open.
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: ",",
    code: "Comma",
    windowsVirtualKeyCode: 188,
    nativeVirtualKeyCode: 188,
    modifiers: 3,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: ",",
    code: "Comma",
    windowsVirtualKeyCode: 188,
    nativeVirtualKeyCode: 188,
    modifiers: 3,
  });
  await sleep(3000);

  const opened = await evaluate(`(() => ({
    body: document.body.innerText.slice(0, 1200),
    dialogs: Array.from(document.querySelectorAll('[role="dialog"], [data-settings], [data-sheet]')).map((node) => node.innerText.slice(0, 400))
  }))()`);
  console.log(JSON.stringify(opened, null, 2));

  // Click the Plugins entry by visible text.
  const rect = await evaluate(`(() => {
    const candidates = Array.from(document.querySelectorAll("button, [role=tab], [role=menuitem], a"));
    const target = candidates.find((node) => {
      const text = node.innerText.trim();
      return text === "内置插件" || text === "Installed plugins" || text === "Plugins";
    });
    if (!target) return null;
    const box = target.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, text: target.innerText.trim() };
  })()`);
  console.log("plugins entry:", JSON.stringify(rect));
  if (rect) {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await sleep(2500);
  }

  const list = await evaluate(`(() => ({
    body: document.body.innerText.slice(0, 1800),
    toolkit: document.body.innerText.includes("DSH Goodies"),
    rows: Array.from(document.querySelectorAll("button, [role=button]")).filter((node) => node.innerText.includes("DSH Goodies")).map((node) => {
      const box = node.getBoundingClientRect();
      return { text: node.innerText.slice(0, 160), x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })
  }))()`);
  console.log(JSON.stringify(list, null, 2));

  if (list.rows.length > 0) {
    const row = list.rows[0];
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: row.x, y: row.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: row.x, y: row.y, button: "left", clickCount: 1 });
    await sleep(2500);
  }

  const page = await evaluate(`(() => ({
    body: document.body.innerText.slice(0, 1600),
    toolkit: document.body.innerText.includes("DSH Goodies"),
    switches: document.querySelectorAll(".dtk-switch").length,
    cards: document.querySelectorAll(".dtk-card").length
  }))()`);
  console.log(JSON.stringify(page, null, 2));

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
      // Ignore.
    }
  });
