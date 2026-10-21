/**
 * Open the sidebar Plugins page, find the toolkit bundle, and inspect its card.
 *
 * usage: node test/plugin-page-probe.mjs <url-with-token> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, shotArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/plugin-page-probe.mjs <url-with-token> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9338;
const profile = mkdtempSync(join(tmpdir(), "dtk-plugins-"));
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

  async function clickText(text, selector = "button, a, [role=tab], [role=menuitem]") {
    const rect = await evaluate(`(() => {
      const candidates = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const target = candidates.find((node) => node.innerText.trim() === ${JSON.stringify(text)} || node.innerText.trim().startsWith(${JSON.stringify(text)}));
      if (!target) return null;
      const box = target.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, text: target.innerText.trim().slice(0, 80) };
    })()`);
    if (!rect) return null;
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
    await sleep(2000);
    return rect;
  }

  const nav = await clickText("插件");
  console.log("sidebar plugin:", JSON.stringify(nav));
  await sleep(2500);

  let page = await evaluate(`(() => ({
    body: document.body.innerText.slice(0, 2200),
    toolkit: document.body.innerText.includes("DSH Goodies") || document.body.innerText.includes("dsh-goodies"),
    cards: document.querySelectorAll(".dtk-card").length,
    switches: document.querySelectorAll(".dtk-switch").length
  }))()`);
  console.log(JSON.stringify(page, null, 2));

  if (!page.toolkit) {
    // Try the Installed tab if the page opened on Market/Official.
    const installed = await clickText("已安装");
    console.log("installed tab:", JSON.stringify(installed));
    await sleep(2000);
    page = await evaluate(`(() => ({
      body: document.body.innerText.slice(0, 2200),
      toolkit: document.body.innerText.includes("DSH Goodies") || document.body.innerText.includes("dsh-goodies"),
      cards: document.querySelectorAll(".dtk-card").length,
      switches: document.querySelectorAll(".dtk-switch").length
    }))()`);
    console.log(JSON.stringify(page, null, 2));
  }

  if (page.toolkit) {
    await evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll("button, [role=button], [role=treeitem]"));
      const target = nodes.find((node) => node.innerText.includes("DSH Goodies") || node.innerText.includes("dsh-goodies"));
      if (target) target.scrollIntoView({ block: "center" });
      return true;
    })()`);
    await sleep(800);
    const row = await evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll("button, [role=button], [role=treeitem]"));
      const target = nodes.find((node) => node.innerText.includes("DSH Goodies") || node.innerText.includes("dsh-goodies"));
      if (!target) return null;
      const box = target.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, tag: target.tagName, cls: target.className };
    })()`);
    console.log("toolkit row:", JSON.stringify(row));
    if (row) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: row.x, y: row.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: row.x, y: row.y, button: "left", clickCount: 1 });
      await sleep(2500);
    }
  }

  const final = await evaluate(`(() => ({
    body: document.body.innerText.slice(0, 2200),
    cards: document.querySelectorAll(".dtk-card").length,
    switches: document.querySelectorAll(".dtk-switch").length,
    cardText: Array.from(document.querySelectorAll(".dtk-card")).map((node) => node.innerText.slice(0, 700))
  }))()`);
  console.log(JSON.stringify(final, null, 2));

  if (final.switches > 0) {
    const toggleRect = await evaluate(`(() => {
      const button = document.querySelector(".dtk-switch");
      if (!button) return null;
      const box = button.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, checked: button.getAttribute("aria-checked") };
    })()`);
    console.log("first switch:", JSON.stringify(toggleRect));
    if (toggleRect) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: toggleRect.x, y: toggleRect.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: toggleRect.x, y: toggleRect.y, button: "left", clickCount: 1 });
      await sleep(3000);
      const toggled = await evaluate(`(() => ({
        states: Array.from(document.querySelectorAll(".dtk-switch")).map((node) => node.getAttribute("aria-checked")),
        firstLabel: document.querySelector(".dtk-row-label")?.innerText ?? null
      }))()`);
      console.log("after toggle:", JSON.stringify(toggled));
      // Restore so the sandbox keeps its defaults.
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: toggleRect.x, y: toggleRect.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: toggleRect.x, y: toggleRect.y, button: "left", clickCount: 1 });
      await sleep(2500);
    }
  }

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
