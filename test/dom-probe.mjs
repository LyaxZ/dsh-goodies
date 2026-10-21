/**
 * Dump the native model-effort pane or a completed turn footer for DOM work.
 *
 * usage: node test/dom-probe.mjs <url-with-token> menu|footer [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, modeArg, shotArg, flowArg] = process.argv;
if (!urlArg || !modeArg) {
  console.error("usage: node test/dom-probe.mjs <url-with-token> menu|footer [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9339;
const profile = mkdtempSync(join(tmpdir(), "dtk-dom-"));
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
    } catch {}
    await sleep(300);
  }
  throw new Error("no CDP target");
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
      if (message.method === "Runtime.exceptionThrown") this.console.push(`[exception] ${message.params.exceptionDetails.text}`);
      if (message.method === "Log.entryAdded") this.console.push(`[${message.params.entry.level}] ${message.params.entry.text}`);
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
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  const clickAt = async (x, y) => {
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    await sleep(700);
  };

  if (modeArg === "menu") {
    const trigger = await evaluate(`(() => {
      const button = document.querySelector('[data-composer-card] button[aria-haspopup="menu"]');
      if (!button) return null;
      const box = button.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, text: button.innerText, title: button.title };
    })()`);
    console.log("trigger:", JSON.stringify(trigger));
    if (trigger) await clickAt(trigger.x, trigger.y);

    const root = await evaluate(`(() => ({
      menus: Array.from(document.querySelectorAll('[role="menu"], [role="group"]')).map((node) => ({
        role: node.getAttribute("role"),
        cls: node.className,
        text: node.innerText.slice(0, 500),
        html: node.outerHTML.slice(0, 2500)
      }))
    }))()`);
    console.log("root menu:", JSON.stringify(root, null, 2));

    const effortCell = await evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const target = nodes.find((node) => /推理等级|Reasoning effort/i.test(node.innerText));
      if (!target) return null;
      const box = target.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, text: target.innerText };
    })()`);
    console.log("effort cell:", JSON.stringify(effortCell));
    if (effortCell) {
      const clicked = await evaluate(`(() => {
        const nodes = Array.from(document.querySelectorAll('[role="menuitem"]'));
        const target = nodes.find((node) => /推理等级|Reasoning effort/i.test(node.innerText));
        if (!target) return false;
        target.click();
        return true;
      })()`);
      console.log("effort cell clicked:", clicked);
      await sleep(60);
      const immediate = await evaluate(`(() => ({
        menus: document.querySelectorAll('[role="menu"]').length,
        debug: Array.from(document.querySelectorAll('[role="menu"]')).map((m) => m.getAttribute('data-dtk-debug')),
        text: Array.from(document.querySelectorAll('[role="menu"]')).map((m) => m.innerText.slice(0, 120))
      }))()`);
      console.log("immediate:", JSON.stringify(immediate));
      await sleep(900);
    }

    const pane = await evaluate(`(() => {
      const radios = Array.from(document.querySelectorAll('[role="menuitemradio"]'));
      const decorated = document.querySelector('[data-dtk-effort-menu]');
      return {
        decorated: decorated?.outerHTML.slice(0, 3500) ?? null,
        label: decorated?.querySelector('.dtk-effort-menu-label')?.textContent ?? null,
        hidden: Array.from(document.querySelectorAll('[data-dtk-hidden="true"]')).map((node) => node.innerText),
        radios: radios.map((radio) => ({
          text: radio.innerText,
          checked: radio.getAttribute("aria-checked"),
          cls: radio.className,
          html: radio.outerHTML.slice(0, 1400),
          parentCls: radio.parentElement?.className ?? null,
          parentRole: radio.parentElement?.getAttribute("role") ?? null,
          parentHtml: radio.parentElement?.outerHTML.slice(0, 2500) ?? null
        })),
        groups: Array.from(document.querySelectorAll('[role="group"]')).map((node) => ({
          cls: node.className,
          text: node.innerText.slice(0, 500),
          html: node.outerHTML.slice(0, 3000)
        }))
      };
    })()`);
    console.log("pane:", JSON.stringify(pane, null, 2));

    if (flowArg === "default") {
      await evaluate(`document.querySelectorAll('[role="menuitemradio"]')[0]?.click()`);
      await sleep(1400);
      const trigger2 = await evaluate(`(() => {
        const button = document.querySelector('[data-composer-card] button[aria-haspopup="menu"]');
        if (!button) return null;
        const box = button.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2, text: button.innerText };
      })()`);
      if (trigger2) await clickAt(trigger2.x, trigger2.y);
      const effortCell2 = await evaluate(`(() => {
        const nodes = Array.from(document.querySelectorAll('[role="menuitem"]'));
        const target = nodes.find((node) => /推理等级|Reasoning effort/i.test(node.innerText));
        if (!target) return null;
        const box = target.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      })()`);
      if (effortCell2) await clickAt(effortCell2.x, effortCell2.y);
      const after = await evaluate(`(() => {
        const menu = document.querySelector('[data-dtk-effort-menu]');
        const radios = Array.from(menu?.querySelectorAll(':scope > button[role="menuitemradio"]') ?? []);
        return {
          label: menu?.querySelector('.dtk-effort-menu-label')?.textContent ?? null,
          count: menu?.getAttribute('data-dtk-menu-count') ?? null,
          hidden: radios.filter((radio) => radio.getAttribute('data-dtk-hidden') === 'true').map((radio) => radio.innerText),
          checked: radios.filter((radio) => radio.getAttribute('aria-checked') === 'true').map((radio) => radio.innerText),
          trigger: document.querySelector('[data-composer-card] button[aria-haspopup="menu"]')?.innerText ?? null
        };
      })()`);
      console.log("after default:", JSON.stringify(after, null, 2));
    }
  }

  if (modeArg === "footer") {
    const row = await evaluate(`(() => {
      const nodes = Array.from(document.querySelectorAll("[data-row-key]"));
      const target = nodes.find((node) => node.innerText.includes("160-Word Paragraph About the Ocean"));
      if (!target) return null;
      target.scrollIntoView({ block: "center" });
      const box = target.getBoundingClientRect();
      return { x: box.left + Math.min(100, box.width / 2), y: box.top + box.height / 2, text: target.innerText.slice(0, 80) };
    })()`);
    console.log("row:", JSON.stringify(row));
    if (row) await clickAt(row.x, row.y);
    await sleep(3000);

    const footer = await evaluate(`(() => {
      const tails = Array.from(document.querySelectorAll("[data-turn-tail]"));
      const tail = tails[tails.length - 1];
      const clocks = Array.from(document.querySelectorAll("[data-clock]"));
      return {
        tails: tails.length,
        lastTailHtml: tail?.outerHTML.slice(0, 6000) ?? null,
        clocks: clocks.slice(-3).map((clock) => ({
          tag: clock.tagName,
          cls: clock.className,
          text: clock.innerText,
          parentHtml: clock.parentElement?.outerHTML.slice(0, 3000) ?? null,
          grandparentHtml: clock.parentElement?.parentElement?.outerHTML.slice(0, 4000) ?? null
        }))
      };
    })()`);
    console.log(JSON.stringify(footer, null, 2));
  }

  if (shotArg) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(dirname(shotArg), { recursive: true });
    writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
    console.log(`screenshot: ${shotArg}`);
  }
  console.log("--- console ---");
  console.log(cdp.console.filter((line) => /error|exception|warn/i.test(line)).join("\n") || "(none)");
  cdp.ws.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    child.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  });
