/**
 * Open an existing session from the sidebar and read the per-turn report.
 *
 * usage: node test/report-probe.mjs <url-with-token> <session-title> [screenshot.png]
 */
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const [, , urlArg, titleArg, shotArg] = process.argv;
if (!urlArg || !titleArg) {
  console.error("usage: node test/report-probe.mjs <url-with-token> <session-title> [screenshot.png]");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const profile = mkdtempSync(join(tmpdir(), "dtk-report-"));
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
  await sleep(10000);

  const evaluate = async (expression) => {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };

  const rect = await evaluate(`(() => {
    // Session rows carry data-row-key; the tree row and hover card share the
    // same text, so only these are safe to click.
    const rows = Array.from(document.querySelectorAll('[data-row-key^="session:"]'));
    const row = rows.find((candidate) => candidate.innerText.includes(${JSON.stringify(titleArg)}));
    if (!row) return null;
    const box = row.getBoundingClientRect();
    return { x: box.left + Math.min(80, box.width / 2), y: box.top + box.height / 2 };
  })()`);
  console.log("row:", JSON.stringify(rect));
  if (!rect) throw new Error("session row not found");

  // Click through the element: a synthetic mouse event lands on whatever hover
  // card is drawn above the row, which opened nothing.
  const opened = await evaluate(`(() => {
    const rows = Array.from(document.querySelectorAll('[data-row-key^="session:"]'));
    const row = rows.find((candidate) => candidate.innerText.includes(${JSON.stringify(titleArg)}));
    if (!row) return false;
    row.click();
    return true;
  })()`);
  if (!opened) throw new Error("session row not clickable");
  await sleep(4000);

  const result = await evaluate(`(() => ({
    title: document.title,
    reports: Array.from(document.querySelectorAll("[data-goodies-turn-report]")).map((node) => ({
      text: node.innerText,
      turn: node.getAttribute("data-turn"),
      state: node.getAttribute("data-goodies-turn-report"),
      nodes: node.getAttribute("data-nodes"),
      visible: getComputedStyle(node).display !== "none"
    })),
    body: document.body.innerText.slice(0, 900)
  }))()`);
  console.log(JSON.stringify(result, null, 2));

  // A seat that crashed shows an empty data-slot-error and no report at all.
  // That is how a broken report looked in a real session, so it is a failure.
  const seatErrors = await evaluate(
    'Array.from(document.querySelectorAll("[data-slot-error]")).filter((n) => n.getAttribute("data-slot-error") === "conversation.chat.turnTail").length'
  );
  const shown = Array.isArray(result.reports) ? result.reports.length : 0;
  console.log(`seat errors: ${seatErrors}`);
  console.log(`reports: ${shown}`);
  if (seatErrors > 0) {
    console.error("REPORT FAILED: the turn tail seat crashed");
    process.exitCode = 1;
  } else if (shown === 0) {
    console.error("REPORT FAILED: no report rendered for this session");
    process.exitCode = 1;
  } else {
    console.log("REPORT OK");
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
