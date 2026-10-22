/**
 * Does a finished run actually raise a notification?
 *
 * Stubs `Notification`, injects the running row the chat uses, lets go of it,
 * and checks what the plugin tried to show. The chime is audio, so only the
 * notification itself is asserted.
 *
 * usage: node test/notify-probe.mjs <url-with-token>
 */
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , urlArg] = process.argv;
if (!urlArg) {
  console.error("usage: node test/notify-probe.mjs <url-with-token>");
  process.exit(2);
}

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9374;
const profile = mkdtempSync(join(tmpdir(), "dtk-notify-"));
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
    window.__notes = [];
    const RealNotification = window.Notification;
    function FakeNotification(title, options) {
      window.__notes.push({ title: title, body: options && options.body });
      this.close = function () {};
    }
    FakeNotification.permission = "granted";
    FakeNotification.requestPermission = function () { return Promise.resolve("granted"); };
    window.Notification = FakeNotification;
    return typeof FakeNotification;
  })()`);

  await ev(`(() => {
    const row = document.createElement("div");
    row.setAttribute("data-chat-running", "");
    row.id = "dtk-fake-run";
    row.textContent = "深度求索中";
    document.body.appendChild(row);
    return true;
  })()`);
  await sleep(1200);
  await ev(`document.getElementById("dtk-fake-run")?.remove()`);
  await sleep(900);

  const notes = await ev(`window.__notes`);
  console.log("notifications:", JSON.stringify(notes));
  check("a finished run raises a notification", Array.isArray(notes) && notes.length >= 1, notes);
  if (Array.isArray(notes) && notes[0]) {
    check("the notification has a body", typeof notes[0].body === "string" && notes[0].body.length > 0, notes[0]);
  }

  // A second run is announced again: the watcher must not latch on the first.
  await ev(`window.__notes.length = 0`);
  await ev(`(() => {
    const row = document.createElement("div");
    row.setAttribute("data-chat-running", "");
    row.id = "dtk-fake-run-2";
    document.body.appendChild(row);
    return true;
  })()`);
  await sleep(700);
  await ev(`document.getElementById("dtk-fake-run-2")?.remove()`);
  await sleep(800);
  const shortNotes = await ev(`window.__notes`);
  check("a second run is announced again", Array.isArray(shortNotes) && shortNotes.length === 1, shortNotes);
  check("no page exceptions", cdp.errors.length === 0, cdp.errors);

  console.log(failures === 0 ? "NOTIFY OK" : `NOTIFY FAILED (${failures})`);
  child.kill();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("notify probe crashed:", error.message);
  child.kill();
  process.exit(1);
});
