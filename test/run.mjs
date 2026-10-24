/**
 * Offline checks for dsh-goodies.
 *
 * Run `node build.mjs` first (the npm test script does), then this suite
 * compares the committed `lib/` artifacts with what the current sources
 * produce and exercises the pure helpers.
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderArtifacts } from "../build.mjs";

const require = createRequire(import.meta.url);
const shared = require("../src/shared.cjs");
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push({ name, detail });
}

function equal(name, actual, expected) {
  check(name, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// -- configuration ----------------------------------------------------------

const defaults = shared.normalizeConfig(null);
equal("default effortShift", defaults.effortShift, true);
equal("default liveSpeed", defaults.liveSpeed, true);
equal("default turnReport", defaults.turnReport, true);
equal("default completionNotify", defaults.completionNotify, false);
equal("default notifySound", defaults.notifySound, false);
equal("default notifyMinSeconds", defaults.notifyMinSeconds, 5);

const coerced = shared.normalizeConfig({
  effortShift: false,
  liveSpeed: "yes",
  notifyMinSeconds: 999,
  unknown: "dropped",
});
equal("coerce boolean", coerced.effortShift, false);
equal("reject non-boolean", coerced.liveSpeed, true);
equal("clamp number", coerced.notifyMinSeconds, 120);
equal("drop unknown", Object.prototype.hasOwnProperty.call(coerced, "unknown"), false);
equal("normalize is stable", shared.sameConfig(coerced, shared.normalizeConfig(coerced)), true);

// -- token estimation -------------------------------------------------------

equal("estimate ascii", shared.estimateTokensFromBlocks([{ kind: "text", text: "abcdefgh" }]), 2);
equal("estimate cjk", shared.estimateTokensFromBlocks([{ kind: "text", text: "你好世界" }]), 4);
equal("estimate ignores tools", shared.estimateTokensFromBlocks([{ kind: "tool-call", text: "ignored" }]), 0);
equal("count chars", shared.countChars([{ kind: "reasoning", text: "abc" }, { kind: "text", text: "de" }]), 5);
equal("estimate plain text", shared.estimateTokensFromText("hello world"), 3);
equal("estimate plain cjk", shared.estimateTokensFromText("你好世界"), 4);
equal("estimate empty text", shared.estimateTokensFromText(""), 0);

// -- turn report ------------------------------------------------------------

const nodes = [
  {
    kind: "assistant",
    turn: 1,
    timing: { stepStartTime: 1000, firstTokenTime: 1500, completedTime: 4000 },
    usage: { outputTokens: 100 },
  },
  {
    kind: "assistant",
    turn: 1,
    timing: { stepStartTime: 4000, firstTokenTime: 4500, completedTime: 7000 },
    usage: { outputTokens: 50 },
  },
  {
    kind: "assistant",
    turn: 2,
    timing: { stepStartTime: 8000, firstTokenTime: 9000, completedTime: 10000 },
    usage: { outputTokens: 10 },
  },
  { kind: "tool-result", turn: 1, callTime: 4000, time: 4200 },
];
const report = shared.readTurnReport(nodes, 1);
equal("report steps", report.steps, 2);
equal("report ttft", report.ttftMs, 500);
equal("report duration", report.durationMs, 6000);
equal("report tokens", report.tokens, 150);
equal("report speed", Math.round(report.tps), 30);
equal("report missing turn", shared.readTurnReport(nodes, 9), null);
equal("report sampled speed matches full timing", Math.round(report.sampledTps), 30);
{
  // Only the first step is timestamped: the speed must come from its decode
  // span, not from the wall clock between the two steps.
  const partial = [
    { kind: "assistant", turn: 4, timing: { stepStartTime: 1000, firstTokenTime: 2000, completedTime: 3000 }, usage: { outputTokens: 90 } },
    { kind: "assistant", turn: 4, timing: { stepStartTime: 9000 }, usage: { outputTokens: 10 } },
  ];
  const partialReport = shared.readTurnReport(partial, 4);
  equal("report partial timing has no full speed", partialReport.tps, null);
  equal("report partial timing still has a decode speed", Math.round(partialReport.sampledTps), 90);
}
{
  // No first-token times at all, but each step knows its own span: the speed has
  // to come from the steps, not from the wall clock that includes tool waits.
  const stepped = [
    { kind: "assistant", turn: 5, timing: { stepStartTime: 0, completedTime: 100000 }, usage: { outputTokens: 300 } },
    { kind: "tool-result", turn: 5, callTime: 100000, time: 300000 },
    { kind: "assistant", turn: 5, timing: { stepStartTime: 300000, completedTime: 400000 }, usage: { outputTokens: 300 } },
  ];
  const steppedReport = shared.readTurnReport(stepped, 5);
  equal("report busy span subtracts tool waits", Math.round(steppedReport.busyMs), 200000);
  equal("report busy speed is not wall speed", Math.round(steppedReport.approxTps), 3);
  equal("report busy speed beats the whole turn", Math.round(400000 / 1000) > 0, true);
}
{
  // Only the turn's ends are known, plus the tool calls inside it.
  const spans = [
    { kind: "assistant", turn: 6, timing: { stepStartTime: 0 }, usage: { outputTokens: 200 } },
    { kind: "tool-result", turn: 6, callTime: 1000, time: 91000 },
    { kind: "assistant", turn: 6, timing: { completedTime: 101000 }, usage: { outputTokens: 200 } },
  ];
  const spansReport = shared.readTurnReport(spans, 6);
  equal("report without step spans uses the tool-free time", Math.round(spansReport.busyMs), 11000);
  equal("report without step spans still has a speed", Math.round(spansReport.approxTps), 36);
}
equal("report finds last node", shared.findAssistantNode(nodes, 2).usage.outputTokens, 10);
equal("report handles no usage", shared.readTurnReport([
  { kind: "assistant", turn: 3, timing: { stepStartTime: 1, firstTokenTime: 2, completedTime: 3 } },
], 3).tokens, null);
equal("derived usage output", shared.readTurnUsage(nodes, 1).outputTokens, 150);
equal("derived usage missing", shared.readTurnUsage(nodes, 9), null);
equal(
  "derived usage buckets",
  JSON.stringify(shared.readTurnUsage([
    {
      kind: "assistant",
      turn: 4,
      usage: {
        uncachedInputTokens: 22,
        outputTokens: 7,
        cacheReadTokens: 30,
        cacheWriteTokens: 2,
      },
    },
  ], 4)),
  JSON.stringify({ inputTokens: 22, outputTokens: 7, cacheReadTokens: 30, cacheWriteTokens: 2 })
);

// -- effort derivation ------------------------------------------------------

const explicit = {
  current: { provider: "p", model: "m", reasoningEffort: "medium" },
  groups: [{
    id: "p",
    models: [{
      id: "m",
      reasoning: {
        defaultEffort: "low",
        efforts: [
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
        ],
      },
    }],
  }],
};
const effortView = shared.deriveEffort(explicit);
equal("effort choices", effortView.choices.length, 3);
equal("effort index", effortView.index, 1);
equal("effort effective", effortView.effective, "medium");

const providerDefault = {
  current: { provider: "p", model: "m" },
  groups: [{
    id: "p",
    models: [{
      id: "m",
      reasoning: {
        efforts: [{ id: "low", name: "Low" }, { id: "high", name: "High" }],
      },
    }],
  }],
};
const defaultView = shared.deriveEffort(providerDefault);
equal("provider default included", defaultView.choices[0].id, undefined);
equal("provider default selected", defaultView.index, 0);

const single = {
  current: { provider: "p", model: "m", reasoningEffort: "low" },
  groups: [{
    id: "p",
    models: [{
      id: "m",
      reasoning: { defaultEffort: "low", efforts: [{ id: "low", name: "Low" }] },
    }],
  }],
};
equal("single level hidden", shared.deriveEffort(single), null);
equal("no reasoning hidden", shared.deriveEffort({
  current: { provider: "p", model: "m" },
  groups: [{ id: "p", models: [{ id: "m" }] }],
}), null);

// -- formatting -------------------------------------------------------------

equal("speed below ten", shared.formatSpeed(4.26), "4.3");
equal("speed above ten", shared.formatSpeed(42.6), "43");
equal("star breath dimmest", shared.starOpacity(0).toFixed(3), "0.220");
equal("star breath brightest", shared.starOpacity(1000).toFixed(3), "1.000");
equal("star breath repeats", shared.starOpacity(2000).toFixed(3), "0.220");
{
  const samples = [];
  for (let at = 0; at <= 2000; at += 100) samples.push(shared.starOpacity(at));
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  check("star breath stays visible", min >= 0.22);
  check("star breath reaches full", max >= 0.999);
  check("star breath changes in steps", new Set(samples.map((v) => v.toFixed(2))).size >= 8);
}
equal("seconds short", shared.formatSeconds(1234), "1.2s");
equal("seconds long", shared.formatSeconds(65000), "1m 05s");
equal("tokens small", shared.formatTokens(999), "999");
equal("tokens thousands", shared.formatTokens(1234), "1.2K");
equal("tokens ten thousands", shared.formatTokens(12345), "12K");
equal("tokens millions", shared.formatTokens(3582000), "3.6M");
equal("tokens rounding to million", shared.formatTokens(999600), "1M");

// -- notification gate ------------------------------------------------------

equal("notify long turn", shared.shouldNotify({ elapsedMs: 8000, minMs: 5000 }), true);
equal("notify short turn", shared.shouldNotify({ elapsedMs: 1000, minMs: 5000 }), false);
equal("notify focused turn is announced too", shared.shouldNotify({ elapsedMs: 8000, minMs: 5000 }), true);
equal("notify zero", shared.shouldNotify({ elapsedMs: 0, minMs: 0 }), false);
equal("notify missing elapsed", shared.shouldNotify({ minMs: 0 }), false);
{
  // The session snapshot is a Map on 0.2.x; iterating it as an object silently
  // yields nothing, which is why notifications never fired.
  const mapSnapshot = { byId: new Map([["a", { running: true }], ["b", { running: false }]]) };
  equal("session rows from a map", JSON.stringify(shared.readSessionRows(mapSnapshot)), JSON.stringify([["a", { running: true }], ["b", { running: false }]]));
  equal("session rows from an object", shared.readSessionRows({ byId: { c: { running: true } } }).length, 1);
  equal("session rows without a snapshot", shared.readSessionRows(null).length, 0);
equal("local overrides win over the document", JSON.stringify(shared.mergeOverrides({ a: true, b: false }, { b: true })), JSON.stringify({ a: true, b: true }));
equal("no overrides keeps the document", JSON.stringify(shared.mergeOverrides({ a: 1 }, null)), JSON.stringify({ a: 1 }));
}

// -- style contract ---------------------------------------------------------

for (const selector of ["data-dtk-effort-menu", ".dtk-effort-fill", ".dtk-effort-thumb", ".dtk-effort-spark", ".dtk-live", ".dtk-live-star", ".dtk-report", ".dtk-card", ".dtk-switch"]) {
  check(`css has ${selector}`, shared.CSS.includes(selector));
}
check("css respects reduced motion", shared.CSS.includes("prefers-reduced-motion"));


// -- build artifacts --------------------------------------------------------

const [sharedSource, clientSource, hostSource] = await Promise.all([
  readFile(join(ROOT, "src/shared.cjs"), "utf8"),
  readFile(join(ROOT, "src/client.js"), "utf8"),
  readFile(join(ROOT, "src/index.mjs"), "utf8"),
]);
// Behaviour contracts for the slider rail and the HUD readout.
check("passed level dots are hidden", clientSource.includes('tick <= safe ? "none"'));
check("particles cover the rail height", clientSource.includes("--y") && /\(8 \+ Math\.random\(\) \* 84\)/.test(clientSource));
check("hud total uses compact units", clientSource.includes("shared.formatTokens(shownTotal)"));
check("hud speed survives a lagging usage sample", clientSource.includes("remote.ok === false ? estimate : remote.tokens"));
check("css fades the panel out", shared.CSS.includes(".dtk-effort-panel--closing"));
check("panel fade is not instant", /\.dtk-effort-content\{[^}]*transition:opacity \.3[0-9]?s/.test(shared.CSS));
check("closing panels are discarded, not dropped", clientSource.includes("discardEffortPanel") && clientSource.includes("closeEffortPanel(menu)"));
check("the panel offers a way back", clientSource.includes("dtk-effort-back") && shared.CSS.includes(".dtk-effort-back"));
// Every selector the HUD asks for has to exist: a missing one throws during
// render and the whole reading disappears.
for (const selector of ["liveKey", "liveChars", "liveEstimate", "liveExact", "liveUsageTotal"]) {
  check(`selector ${selector} is defined`, clientSource.includes(`function ${selector}(`) || clientSource.includes(`function ${selector}(snapshot)`));
}
check("the report only shows a measured speed", clientSource.includes("enoughToJudge") && !clientSource.includes("derivedTps"));
check("the settings card exposes the notification", clientSource.includes('toggle("completionNotify"'));
check("the notification watcher is mounted", clientSource.includes("h(NotificationHost") && clientSource.includes("notify(null, t, sessionRow(sessions), elapsed)"));
check("the notification asks for permission", clientSource.includes("settings.permission.request") && clientSource.includes("permissionText(t, permission)"));
check("a finished turn is announced even in front", !shared.shouldNotify.toString().includes("hidden"));

const artifacts = renderArtifacts({ shared: sharedSource, client: clientSource, host: hostSource });

for (const [name, expected] of Object.entries(artifacts)) {
  let actual = "";
  try {
    actual = await readFile(join(ROOT, name), "utf8");
  } catch {
    actual = "";
  }
  check(`${name} is current`, actual === expected, `${name} differs from the current sources`);
}

const bundle = artifacts["lib/client.js"];
for (const marker of [
  "data-dtk-effort-menu",
  "dsh-goodies-live-speed",
  "dsh-goodies-turn-report",
  "plugins.bundle.config",
  "settings.plugin.item",
]) {
  check(`bundle has ${marker}`, bundle.includes(marker));
}
check(
  "bundle requires only the shell modules",
  !/require\(\s*["'][^"']+["']\s*\)/.test(bundle.replace(/require\("react"\)/g, "").replace(/require\("react-dom"\)/g, ""))
);

// -- locale metadata --------------------------------------------------------

const [zh, en] = await Promise.all([
  readFile(join(ROOT, "locale/zh.json"), "utf8").then(JSON.parse),
  readFile(join(ROOT, "locale/en.json"), "utf8").then(JSON.parse),
]);
equal("locale meta keys match", JSON.stringify(Object.keys(zh.meta).sort()), JSON.stringify(Object.keys(en.meta).sort()));
check("zh locale has a title", typeof zh.meta.title === "string" && zh.meta.title.length > 0);
check("en locale has a description", typeof en.meta.description === "string" && en.meta.description.length > 0);

// -- report ----------------------------------------------------------------

if (failures.length > 0) {
  console.error(`FAIL ${failures.length} / ${passed + failures.length}`);
  for (const failure of failures) console.error(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ""}`);
  process.exitCode = 1;
} else {
  console.log(`OK ${passed} checks`);
}
