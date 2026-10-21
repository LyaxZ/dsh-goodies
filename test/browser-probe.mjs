/**
 * Smoke-probe the toolkit in a real headless Edge.
 *
 * usage: node test/browser-probe.mjs <url-with-token> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , urlArg, shotArg, clickEffort] = process.argv;
if (!urlArg) {
  console.error("usage: node test/browser-probe.mjs <url-with-token> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const profile = mkdtempSync(join(tmpdir(), "dtk-edge-"));
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

  const probe = await evaluate(`(() => {
    const q = (selector) => document.querySelectorAll(selector).length;
    return {
      title: document.title,
      url: location.href,
      ready: document.readyState,
      style: q('style[data-plugin-css="dsh-goodies/styles"]'),
      effort: q("[data-goodies-effort]"),
      live: q("[data-goodies-live-speed]"),
      report: q("[data-goodies-turn-report]"),
      composer: q("[data-composer-card]"),
      stats: q("[data-composer-stat]"),
      slots: Array.from(document.querySelectorAll("[data-slot]"))
        .map((element) => element.getAttribute("data-slot"))
        .slice(0, 80),
      composerHtml: (document.querySelector("[data-composer-card]")?.outerHTML ?? "").slice(0, 1600),
      rightHtml: (document.querySelector('[data-slot="conversation.input.right"]')?.innerHTML ?? "").slice(0, 1200),
      leftHtml: (document.querySelector('[data-slot="conversation.input.left"]')?.innerHTML ?? "").slice(0, 800),
      body: document.body.innerText.slice(0, 700),
    };
  })()`);

  console.log(JSON.stringify(probe, null, 2));

  if (clickEffort) {
    const clicked = await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll('[data-goodies-effort] button[aria-label]'))
        .find((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(clickEffort)});
      if (!button) return "missing";
      button.click();
      return "clicked";
    })()`);
    console.log(`click ${clickEffort}: ${clicked}`);
    await sleep(2500);
    const after = await evaluate(`(() => {
      const control = document.querySelector("[data-goodies-effort]");
      const active = control?.querySelector('button[aria-checked="true"]');
      return {
        index: control?.getAttribute("data-index"),
        count: control?.getAttribute("data-count"),
        active: active?.getAttribute("aria-label") ?? null,
        label: control?.querySelector(".dtk-effort-menu-label")?.textContent ?? null,
        trigger: document.querySelector('[data-composer-card] button[aria-haspopup="menu"]')?.title ?? null,
        body: document.body.innerText.slice(0, 500),
      };
    })()`);
    console.log("after:", JSON.stringify(after, null, 2));
  }

  console.log("--- console ---");
  console.log(cdp.console.filter((line) => /error|exception|warn|dsh-goodies|toolkit/i.test(line)).join("\n") || "(none)");

  if (shotArg) {
    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(dirname(shotArg), { recursive: true });
    writeFileSync(shotArg, Buffer.from(shot.data, "base64"));
    console.log(`screenshot: ${shotArg}`);
  }

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
