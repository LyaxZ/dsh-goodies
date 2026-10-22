window.__ModuleLoader__.load({
	id: "dsh-goodies",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		// ---- inlined from src/shared.cjs ----
var __dtkShared = (function () {
	var module = { exports: {} };
	var exports = module.exports;
/**
 * dsh-goodies �?shared, browser-safe helpers.
 *
 * Kept as CommonJS so Node can require it directly in the offline suite; the
 * build inlines this module into the browser bundle (the shell's module table
 * has no relative requires).
 *
 * @module dsh-goodies/shared
 */
"use strict";

var NAMESPACE = "dsh-goodies";
var PACKAGE_NAME = "dsh-goodies";
var ENTRY_ID = "dsh-goodies";
var STYLE_ID = "dsh-goodies/styles";

var DEFAULTS = Object.freeze({
  effortShift: true,
  liveSpeed: true,
  turnReport: true,
  completionNotify: false,
  notifySound: false,
  notifyMinSeconds: 5,
  reduceMotion: false,
});

var BOOLEAN_FIELDS = Object.freeze([
  "effortShift",
  "liveSpeed",
  "turnReport",
  "completionNotify",
  "notifySound",
  "reduceMotion",
]);

/** Clamp a number to a finite range, falling back when it is not a number. */
function clampNumber(value, min, max, fallback) {
  var number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Merge one stored configuration over the defaults.
 * Unknown fields are dropped; booleans and the one number are coerced.
 * @param {unknown} value - stored form value.
 * @returns {object} a complete configuration.
 */
function normalizeConfig(value) {
  var source = value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
  var out = {};
  for (var index = 0; index < BOOLEAN_FIELDS.length; index += 1) {
    var field = BOOLEAN_FIELDS[index];
    out[field] = typeof source[field] === "boolean" ? source[field] : DEFAULTS[field];
  }
  out.notifyMinSeconds = clampNumber(source.notifyMinSeconds, 0, 120, DEFAULTS.notifyMinSeconds);
  return out;
}

/** Compare two normalized configurations field by field. */
function sameConfig(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  for (var index = 0; index < BOOLEAN_FIELDS.length; index += 1) {
    if (left[BOOLEAN_FIELDS[index]] !== right[BOOLEAN_FIELDS[index]]) return false;
  }
  return left.notifyMinSeconds === right.notifyMinSeconds;
}

/** Whether a code point is normally one token (CJK, kana, hangul, fullwidth). */
function isCjk(cp) {
  return (
    (cp >= 0x2e80 && cp <= 0x9fff) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x3040 && cp <= 0x30ff) ||
    (cp >= 0xff00 && cp <= 0xffef) ||
    (cp >= 0x20000 && cp <= 0x2fa1f)
  );
}

/**
 * Rough provider-token estimate for live text.
 * CJK is about one token per character; Latin is about four characters per
 * token. This is deliberately labelled `≈` in the UI.
 * @param {Array<{kind?: string, text?: string}>} blocks - partial blocks.
 * @returns {number} estimated output tokens.
 */
function estimateTokensFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return 0;
  var total = 0;
  for (var index = 0; index < blocks.length; index += 1) {
    var block = blocks[index];
    if (!block || (block.kind !== "text" && block.kind !== "reasoning")) continue;
    var text = typeof block.text === "string" ? block.text : "";
    for (var at = 0; at < text.length; at += 1) {
      var cp = text.codePointAt(at);
      if (cp > 0xffff) at += 1;
      if (isCjk(cp)) total += 1;
      else if (cp > 0x7f) total += 0.6;
      else total += 0.25;
    }
  }
  return Math.ceil(total);
}

/** Count characters in the visible text and reasoning blocks. */
function countChars(blocks) {
  if (!Array.isArray(blocks)) return 0;
  var total = 0;
  for (var index = 0; index < blocks.length; index += 1) {
    var block = blocks[index];
    if (!block || (block.kind !== "text" && block.kind !== "reasoning")) continue;
    if (typeof block.text === "string") total += block.text.length;
  }
  return total;
}

/** Last settled assistant node of one turn, when the loaded window has it. */
function normalizeTurn(turn) {
  if (typeof turn === "number" && Number.isFinite(turn)) return turn;
  if (turn && typeof turn.turn === "number") return turn.turn;
  if (turn && typeof turn.value === "number") return turn.value;
  if (turn && typeof turn.number === "number") return turn.number;
  if (turn && typeof turn.id === "number") return turn.id;
  return null;
}

function findAssistantNode(nodes, turn) {
  if (!Array.isArray(nodes)) return null;
  var turnNumber = normalizeTurn(turn);
  if (turnNumber === null) return null;
  for (var index = nodes.length - 1; index >= 0; index -= 1) {
    var node = nodes[index];
    if (node && node.kind === "assistant" && node.turn === turnNumber) return node;
  }
  return null;
}

/**
 * Fold every settled assistant step of one turn into display readings.
 *
 * `durationMs` is the turn's first step start to its last completed step;
 * `ttftMs` is the first step's first token; tokens and decode time are summed
 * across steps so tool-using turns report the whole turn rather than the final
 * answer alone.
 * @param {Array<object>} nodes - settled chat nodes.
 * @param {number} turn - turn number.
 * @returns {object|null} readings, or null when the turn has no assistant node.
 */
function readTurnReport(nodes, turn) {
  if (!Array.isArray(nodes)) return null;
  var turnNumber = normalizeTurn(turn);
  if (turnNumber === null) return null;
  var steps = [];
  for (var index = 0; index < nodes.length; index += 1) {
    var node = nodes[index];
    if (node && node.kind === "assistant" && node.turn === turnNumber) steps.push(node);
  }
  if (steps.length === 0) return null;

  var firstTiming = steps[0] && steps[0].timing;
  var lastTiming = steps[steps.length - 1] && steps[steps.length - 1].timing;
  var start = firstTiming && typeof firstTiming.stepStartTime === "number" ? firstTiming.stepStartTime : null;
  var end = lastTiming && typeof lastTiming.completedTime === "number" ? lastTiming.completedTime : null;
  if (start === null || end === null) {
    for (var at = 0; at < steps.length; at += 1) {
      var timing = steps[at] && steps[at].timing;
      if (start === null && timing && typeof timing.stepStartTime === "number") start = timing.stepStartTime;
      if (timing && typeof timing.completedTime === "number" && (end === null || timing.completedTime > end)) end = timing.completedTime;
    }
  }

  var ttftMs = null;
  if (firstTiming && typeof firstTiming.stepStartTime === "number" && typeof firstTiming.firstTokenTime === "number") {
    ttftMs = Math.max(0, firstTiming.firstTokenTime - firstTiming.stepStartTime);
  }

  var tokens = null;
  var decodeMs = 0;
  var hasDecode = false;
  // Steps that carry both timestamps know their own decode time exactly; a turn
  // where only some steps do still yields a decode-only speed from that subset.
  var sampledTokens = 0;
  var untimedTokens = 0;
  var sampledMs = 0;
  for (var stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    var step = steps[stepIndex];
    var usage = step && step.usage;
    var stepTokens =
      usage && typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens)
        ? Math.max(0, usage.outputTokens)
        : 0;
    if (usage && typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens)) {
      tokens = (tokens === null ? 0 : tokens) + stepTokens;
    }
    var stepTiming = step && step.timing;
    if (stepTiming && typeof stepTiming.firstTokenTime === "number" && typeof stepTiming.completedTime === "number") {
      var stepMs = Math.max(0, stepTiming.completedTime - stepTiming.firstTokenTime);
      decodeMs += stepMs;
      hasDecode = true;
      if (stepTokens > 0 && stepMs > 0) {
        sampledTokens += stepTokens;
        sampledMs += stepMs;
      }
      if (stepTokens > 0 && stepMs <= 0) untimedTokens += stepTokens;
    } else {
      untimedTokens += stepTokens;
    }
  }

  var durationMs = start !== null && end !== null ? Math.max(0, end - start) : null;
  // A whole-turn speed is only exact when every counted step knows its decode
  // span; otherwise the subset speed stands in for it.
  var tps =
    tokens !== null && tokens > 0 && hasDecode && decodeMs > 0 && untimedTokens === 0 ? tokens / (decodeMs / 1000) : null;
  var sampledTps = sampledTokens > 0 && sampledMs > 0 ? sampledTokens / (sampledMs / 1000) : null;
  if (ttftMs === null && durationMs === null && tokens === null) return null;
  return {
    steps: steps.length,
    ttftMs: ttftMs,
    durationMs: durationMs,
    tokens: tokens,
    tps: tps,
    sampledTps: sampledTps,
  };
}

/**
 * Fold token buckets out of the settled assistant nodes.
 *
 * The turn-tail `tokenUsage` aggregate is missing on some compositions (and
 * for some turns); this is the fallback so the report can still show the three
 * prompt-side / output / cache buckets consistently.
 * @param {Array<object>} nodes - settled chat nodes.
 * @param {number} turn - turn number.
 * @returns {object|null} summed buckets, or null when no usage was recorded.
 */
function readTurnUsage(nodes, turn) {
  if (!Array.isArray(nodes)) return null;
  var turnNumber = normalizeTurn(turn);
  if (turnNumber === null) return null;
  var input = null;
  var output = null;
  var cacheRead = null;
  var cacheWrite = null;
  var found = false;
  for (var index = 0; index < nodes.length; index += 1) {
    var node = nodes[index];
    if (!node || node.kind !== "assistant" || node.turn !== turnNumber) continue;
    var usage = node.usage;
    if (!usage || typeof usage !== "object") continue;
    var stepInput =
      typeof usage.uncachedInputTokens === "number" && Number.isFinite(usage.uncachedInputTokens)
        ? usage.uncachedInputTokens
        : typeof usage.inputTokens === "number" && Number.isFinite(usage.inputTokens)
          ? usage.inputTokens
          : null;
    if (stepInput !== null) {
      input = (input === null ? 0 : input) + Math.max(0, stepInput);
      found = true;
    }
    if (typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens)) {
      output = (output === null ? 0 : output) + Math.max(0, usage.outputTokens);
      found = true;
    }
    if (typeof usage.cacheReadTokens === "number" && Number.isFinite(usage.cacheReadTokens)) {
      cacheRead = (cacheRead === null ? 0 : cacheRead) + Math.max(0, usage.cacheReadTokens);
      found = true;
    }
    if (typeof usage.cacheWriteTokens === "number" && Number.isFinite(usage.cacheWriteTokens)) {
      cacheWrite = (cacheWrite === null ? 0 : cacheWrite) + Math.max(0, usage.cacheWriteTokens);
      found = true;
    }
  }
  if (!found) return null;
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
  };
}

/**
 * Read the effort switch out of one model-directory snapshot.
 *
 * The native menu shows a "provider default" row when the adapter declares no
 * default effort; the compact control mirrors that, otherwise the first
 * explicit effort is its leftmost position.
 * @param {object} state - `ModelDirectory` store snapshot.
 * @returns {object|null} choices and current index, or null when there is nothing to switch.
 */
function deriveEffort(state) {
  if (!state || !state.current || !Array.isArray(state.groups)) return null;
  var current = state.current;
  var group = null;
  for (var index = 0; index < state.groups.length; index += 1) {
    if (state.groups[index] && state.groups[index].id === current.provider) {
      group = state.groups[index];
      break;
    }
  }
  if (group === null || !Array.isArray(group.models)) return null;
  var model = null;
  for (var modelIndex = 0; modelIndex < group.models.length; modelIndex += 1) {
    if (group.models[modelIndex] && group.models[modelIndex].id === current.model) {
      model = group.models[modelIndex];
      break;
    }
  }
  var reasoning = model && model.reasoning;
  if (!reasoning || !Array.isArray(reasoning.efforts) || reasoning.efforts.length === 0) return null;
  if (reasoning.efforts.length === 1 && reasoning.defaultEffort !== undefined) return null;

  var choices = [];
  if (reasoning.defaultEffort === undefined) {
    choices.push({ key: "provider-default", id: undefined, name: null });
  }
  for (var effortIndex = 0; effortIndex < reasoning.efforts.length; effortIndex += 1) {
    var effort = reasoning.efforts[effortIndex];
    if (!effort || typeof effort.id !== "string") continue;
    choices.push({ key: "effort:" + effort.id, id: effort.id, name: typeof effort.name === "string" ? effort.name : effort.id });
  }
  if (choices.length < 2) return null;

  var effective = current.reasoningEffort !== undefined ? current.reasoningEffort : reasoning.defaultEffort;
  var active = -1;
  for (var choiceIndex = 0; choiceIndex < choices.length; choiceIndex += 1) {
    if (choices[choiceIndex].id === effective) {
      active = choiceIndex;
      break;
    }
  }
  return {
    current: current,
    model: model,
    reasoning: reasoning,
    choices: choices,
    index: active,
    effective: effective,
    pending: state.pending || null,
  };
}

/** Compact speed text: one decimal below ten, whole numbers above. */
function formatSpeed(value) {
  var number = typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  return number >= 10 ? String(Math.round(number)) : String(Math.round(number * 10) / 10);
}

/**
 * Breathing opacity for the live star: 2 s period, never fully transparent.
 * Kept in shared code so the cycle can be asserted offline.
 * @param {number} atMs - wall clock in milliseconds.
 * @returns {number} opacity between 0.22 and 1.
 */
function starOpacity(atMs) {
  var period = 2000;
  var phase = ((Number.isFinite(atMs) ? atMs : 0) % period) / period;
  return 0.22 + 0.78 * (0.5 - 0.5 * Math.cos(phase * Math.PI * 2));
}

/** Compact duration: 0.8s, 12.3s, 2m 05s. */
function formatSeconds(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  var seconds = ms / 1000;
  if (seconds < 60) return (seconds < 10 ? Math.round(seconds * 10) / 10 : Math.round(seconds)) + "s";
  var whole = Math.round(seconds);
  var minutes = Math.floor(whole / 60);
  var rest = whole % 60;
  return minutes + "m " + (rest < 10 ? "0" : "") + rest + "s";
}

/** Compact token count: 999, 1.2k, 12k, 3.6M. */
function formatTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1000) return String(Math.round(value));
  if (value >= 1e9) {
    var billions = value / 1e9;
    return (billions < 10 ? Math.round(billions * 10) / 10 : Math.round(billions)) + "B";
  }
  if (value >= 1e6) {
    var millions = value / 1e6;
    return (millions < 10 ? Math.round(millions * 10) / 10 : Math.round(millions)) + "M";
  }
  if (value >= 999500) return "1M";
  var thousands = value / 1000;
  return (thousands < 10 ? Math.round(thousands * 10) / 10 : Math.round(thousands)) + "K";
}

/**
 * Decide whether a finished run deserves a background notification.
 * @param {object} options - focus, elapsed and minimum duration.
 * @returns {boolean} true when the user is away and the run was long enough.
 */
function shouldNotify(options) {
  if (!options || options.hidden !== true) return false;
  if (typeof options.elapsedMs !== "number" || !Number.isFinite(options.elapsedMs)) return false;
  if (options.elapsedMs <= 0) return false;
  return options.elapsedMs >= (typeof options.minMs === "number" ? Math.max(0, options.minMs) : 0);
}

var CSS = `
div[role="menu"]:has(> button[role="menuitemradio"]){opacity:0!important;pointer-events:none!important}
div[role="menu"][data-dtk-effort-menu]{position:fixed!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;min-width:0!important;max-width:none!important;max-height:none!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important;clip-path:inset(50%)!important}
.dtk-effort-panel{--dtk-tone:#3b82f6;--dtk-from:#7cc4ff;--dtk-to:#1d4ed8;--dtk-track:30px;--dtk-thumb:30px;position:fixed;z-index:1101;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;width:min(300px,calc(100vw - 24px));min-height:0;padding:8px 14px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);border-radius:16px;background:var(--dsw-alias-bg-elevated,#f7f8fa);box-shadow:0 20px 44px rgba(0,0,0,.24),0 2px 10px rgba(0,0,0,.12);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(12px));color:var(--dsw-alias-label-primary);font-family:inherit}
.dtk-effort-content{display:flex;flex-direction:column;justify-content:center;min-height:0;opacity:0;transition:opacity .36s cubic-bezier(.22,.9,.25,1)}
.dtk-effort-panel{transition:opacity .2s ease}
.dtk-effort-panel--closing{opacity:0;pointer-events:none}
.dtk-effort-panel .dtk-effort-back{position:absolute;left:8px;top:8px;z-index:4;display:flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);line-height:0;cursor:pointer;transition:background .15s ease,color .15s ease}
.dtk-effort-panel .dtk-effort-back svg{display:block;pointer-events:none}
.dtk-effort-panel .dtk-effort-back:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dtk-effort-panel .dtk-effort-back:focus-visible{outline:2px solid var(--dtk-tone);outline-offset:1px}
.dtk-effort-panel .dtk-effort-track .dtk-effort-fill{position:absolute;left:0;top:0;bottom:0;overflow:hidden;border-radius:calc(var(--dtk-track) / 2) 0 0 calc(var(--dtk-track) / 2);corner-shape:round;background:linear-gradient(94deg,var(--dtk-from) 0%,var(--dtk-to) 100%);box-shadow:inset 0 1px 0 var(--dtk-from);-webkit-mask-image:radial-gradient(circle calc(var(--dtk-thumb) / 2) at 100% 50%,transparent 0 14px,#000 15px);mask-image:radial-gradient(circle calc(var(--dtk-thumb) / 2) at 100% 50%,transparent 0 14px,#000 15px);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;transition:width .28s cubic-bezier(.2,1.35,.35,1);z-index:1}
.dtk-effort-panel .dtk-effort-menu-label{position:relative;text-align:center;font-size:15px;line-height:18px;font-weight:600;letter-spacing:.2px;color:var(--dtk-tone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:2;padding:0 0 4px;transition:color .2s ease,opacity .12s ease}
.dtk-effort-panel .dtk-effort-slider{position:relative;z-index:2;padding:2px 0;animation:dtk-slider-in .22s ease-out both}
.dtk-effort-panel .dtk-effort-track{position:relative;height:var(--dtk-track);border-radius:calc(var(--dtk-track) / 2);corner-shape:round;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 20%,transparent);cursor:grab;touch-action:none;outline:none;overflow:visible}
.dtk-effort-panel .dtk-effort-track[data-drag="true"]{cursor:grabbing}
.dtk-effort-panel .dtk-effort-track:focus-visible{outline:2px solid var(--dtk-tone);outline-offset:2px}
.dtk-effort-panel .dtk-effort-glow{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 62%);pointer-events:none;overflow:hidden}
.dtk-effort-panel .dtk-effort-glow::after{content:"";position:absolute;top:0;bottom:0;left:-45%;width:45%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);transform:skewX(-14deg);animation:dtk-fill-sheen 2.4s ease-in-out infinite}
.dtk-effort-panel .dtk-effort-sparks{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:2;clip-path:inset(0 100% 0 0)}
.dtk-effort-panel .dtk-effort-spark{position:absolute;left:var(--x);top:var(--y);width:var(--size,2px);height:var(--size,2px);border-radius:50%;background:#fff;box-shadow:0 0 3px rgba(219,234,254,.9);opacity:0;animation:dtk-spark-meteor calc(var(--spark-duration,2.4s) * var(--dur,1)) linear infinite;animation-delay:var(--delay,0s)}
@keyframes dtk-spark-meteor{0%{transform:translate3d(-6px,0,0) scale(.7);opacity:0}16%{opacity:.95}72%{opacity:.65}100%{transform:translate3d(var(--dx,36px),0,0) scale(1.15);opacity:0}}
.dtk-effort-panel .dtk-effort-tick{position:absolute;top:calc(50% - 1.5px);width:3px;height:3px;margin-left:-1.5px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 55%,transparent);z-index:1}
.dtk-effort-panel .dtk-effort-thumb{position:absolute;z-index:3;top:calc((var(--dtk-track) - var(--dtk-thumb)) / 2);width:var(--dtk-thumb);height:var(--dtk-thumb);box-sizing:border-box;aspect-ratio:1 / 1;margin-left:calc(var(--dtk-thumb) / -2);border:0;border-radius:50%!important;corner-shape:round;background:#fff;box-shadow:0 2px 6px rgba(10,20,40,.16);filter:drop-shadow(0 1px 1.5px rgba(10,20,40,.22)) drop-shadow(0 3px 8px rgba(10,20,40,.14)) drop-shadow(0 0 7px color-mix(in srgb,var(--dtk-tone) 65%,transparent));transition:left .3s cubic-bezier(.2,1.35,.35,1)}
.dtk-effort-panel .dtk-effort-track[data-drag="true"] .dtk-effort-fill,.dtk-effort-panel .dtk-effort-track[data-drag="true"] .dtk-effort-thumb{transition:none}
.dtk-effort-panel .dtk-effort-track[data-anim="true"] .dtk-effort-fill,.dtk-effort-panel .dtk-effort-track[data-anim="true"] .dtk-effort-thumb,.dtk-effort-panel .dtk-effort-track[data-anim="true"] .dtk-effort-halo{transition:none!important}
@keyframes dtk-slider-in{from{opacity:.35;transform:translateY(4px) scale(.985)}to{opacity:1;transform:none}}
@keyframes dtk-fill-sheen{0%{left:-45%}55%{left:110%}100%{left:110%}}
html[data-dtk-reduce-motion] .dtk-effort-panel,.html-reduced .dtk-effort-panel{animation:none}
html[data-dtk-reduce-motion] .dtk-effort-panel .dtk-effort-slider{animation:none}
html[data-dtk-reduce-motion] .dtk-effort-panel .dtk-effort-fill,html[data-dtk-reduce-motion] .dtk-effort-panel .dtk-effort-thumb{transition:none}
html[data-dtk-reduce-motion] .dtk-effort-panel .dtk-effort-glow::after{animation:none;opacity:0}
@media (prefers-reduced-motion:reduce){.dtk-effort-panel,.dtk-effort-panel .dtk-effort-slider{animation:none}.dtk-effort-panel .dtk-effort-fill,.dtk-effort-panel .dtk-effort-thumb{transition:none}.dtk-effort-panel .dtk-effort-glow::after{animation:none;opacity:0}}
.dtk-live{display:inline-flex;align-items:center;gap:5px;margin-left:auto;flex:none;padding:0;border:0;background:none;min-width:0;color:#2563eb;font:inherit;font-variant-numeric:tabular-nums;white-space:nowrap;user-select:none}
.dtk-live-star{flex:none;width:13px;height:13px;background:#2563eb;clip-path:polygon(50% 0,64.5% 35.5%,100% 50%,64.5% 64.5%,50% 100%,35.5% 64.5%,0 50%,35.5% 35.5%)}
.dtk-live-metric{display:inline-flex;align-items:center;gap:5px;min-width:0;line-height:inherit}
.dtk-live-value{color:#2563eb;font-weight:600;font-size:inherit;line-height:inherit;min-width:0;text-align:left;transition:color .2s ease}
.dtk-live-unit{font-size:inherit;line-height:inherit;color:#2563eb;opacity:.75}
.dtk-live-dot-sep{flex:none;font-size:inherit;line-height:inherit;color:#2563eb;opacity:.5}

.dtk-slot{display:inline-flex;align-items:center;min-width:0}
.dtk-report{display:inline-flex;align-items:center;gap:0;margin:0;padding:0;color:inherit;font:inherit;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(24px + var(--dsh-content-font-delta,0px));font-variant-numeric:tabular-nums;opacity:1;white-space:nowrap}
.dtk-report-part{white-space:nowrap}
.dtk-report-part + .dtk-report-part::before{content:"·";margin:0 6px;color:var(--dsw-alias-separator-primary)}
.dtk-report[data-goodies-turn-report]{max-width:100%}
.dtk-card{display:flex;flex-direction:column;gap:0;padding:2px 2px 10px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}
.dtk-card-head{display:flex;flex-direction:column;gap:2px;padding:2px 0 12px}
.dtk-card-title{font-size:15px;font-weight:600;line-height:22px}
.dtk-card-sub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dtk-card-intro{margin:0 0 6px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:19px}
.dtk-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:10px 0;border-top:.5px solid var(--dsw-alias-border-l1)}
.dtk-row:first-of-type{border-top:0}
.dtk-row-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.dtk-row-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:19px}
.dtk-row-desc{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}
.dtk-row-control{flex:none;display:flex;align-items:center;gap:8px;padding-top:1px}
.dtk-switch{position:relative;box-sizing:border-box;width:34px;height:20px;padding:0;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);cursor:pointer;transition:background-color .18s,border-color .18s}
.dtk-switch:after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-bg-base);box-shadow:0 1px 2px rgba(0,0,0,.16);transition:transform .18s cubic-bezier(.2,.9,.25,1.1)}
.dtk-switch[aria-checked="true"]{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#3b82f6) 80%,transparent);border-color:transparent}
.dtk-switch[aria-checked="true"]:after{transform:translateX(14px)}
.dtk-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#3b82f6);outline-offset:2px}
.dtk-switch:disabled{opacity:.45;cursor:not-allowed}
.dtk-number{box-sizing:border-box;width:58px;height:26px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-variant-numeric:tabular-nums;text-align:right}
.dtk-number:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#3b82f6);outline-offset:1px}
.dtk-unit{color:var(--dsw-alias-label-tertiary);font-size:12px}
.dtk-perm{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dtk-perm-text{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}
.dtk-link{border:0;background:0 0;padding:0;color:var(--dsw-alias-brand-primary,#3b82f6);font:inherit;font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.dtk-link:disabled{color:var(--dsw-alias-label-tertiary);cursor:default;text-decoration:none}
.dtk-card-foot{padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}
.dtk-warn{color:var(--dsw-alias-state-warning-primary,#b7791f);font-size:11px;line-height:17px}
html[data-dtk-reduce-motion] .dtk-switch:after{transition:none}
@media (prefers-reduced-motion: reduce){
.dtk-switch:after{transition:none}

}
@media (max-width:720px){}
`;

module.exports = {
  NAMESPACE: NAMESPACE,
  PACKAGE_NAME: PACKAGE_NAME,
  ENTRY_ID: ENTRY_ID,
  STYLE_ID: STYLE_ID,
  DEFAULTS: DEFAULTS,
  BOOLEAN_FIELDS: BOOLEAN_FIELDS,
  normalizeConfig: normalizeConfig,
  sameConfig: sameConfig,
  estimateTokensFromBlocks: estimateTokensFromBlocks,
  countChars: countChars,
  normalizeTurn: normalizeTurn,
  findAssistantNode: findAssistantNode,
  readTurnReport: readTurnReport,
  readTurnUsage: readTurnUsage,
  deriveEffort: deriveEffort,
  formatSpeed: formatSpeed,
  starOpacity: starOpacity,
  formatSeconds: formatSeconds,
  formatTokens: formatTokens,
  shouldNotify: shouldNotify,
  CSS: CSS,
};

	return module.exports;
})();
		// ---- src/client.js ----
/**
 * dsh-goodies — browser half.
 *
 * A small collection of independent conveniences for the DSH Web GUI:
 *
 *  * a horizontal effort rail inside the native reasoning-level menu;
 *  * a live tokens/second reading beside the running status;
 *  * a one-line report at the end of each turn (TTFT, wall time, speed).
 *
 * Module scope stays side-effect free: the loader materializes the factory only
 * when the plugin activates, and every DOM touch lives inside `apply`.
 *
 * @module dsh-goodies/client
 */

var React = require("react");
var createPortal = require("react-dom").createPortal;
var h = React.createElement;
var useEffect = React.useEffect;
var useMemo = React.useMemo;
var useRef = React.useRef;
var useState = React.useState;
var useSyncExternalStore = React.useSyncExternalStore;

var shared = __dtkShared;
var NAMESPACE = shared.NAMESPACE;
var PACKAGE_NAME = shared.PACKAGE_NAME;
var ENTRY_ID = shared.ENTRY_ID;

/** Services every DSH Web composition provides; everything else is optional. */
var inject = ["slots", "locale"];

/** Simplified Chinese copy. The key set is the source of truth. */
var zh = {
  "effort.title": "思考强度：{name}",
  "effort.aria": "思考强度，当前 {name}",
  "effort.default": "Default",
  "effort.defaultMarked": "{name} (Default)",
  "effort.busy": "正在切换思考强度…",
  "effort.back": "返回模型列表",
  "live.title": "实时 {speed} tok/s · 合计 {tokens} tokens · 用时 {seconds}",
  "report.ttft": "首字 {value}",
  "report.input": "输入 {value}",
  "report.output": "输出 {value}",
  "report.cached": "缓存 {value}",
  "report.cachedUnknown": "缓存 —",
  "report.total": "总用时 {value}",
  "report.speed": "{value} tok/s",
  "report.speedApprox": "≈ {value} tok/s",
  "report.tokens": "{value} tok",
  "notify.title": "本轮完成",
  "notify.body": "「{title}」已完成 · {duration}",
  "notify.generic": "当前会话",
  "settings.title": "DSH Goodies",
  "settings.subtitle": "小功能合集",
  "settings.intro": "按需开启，所有功能都在浏览器里运行，不改模型请求。",
  "settings.effort": "思考强度滑块",
  "settings.effortDesc": "把模型菜单里的推理等级改成横向粗滑块，拖动或点按切换，当前档位名显示在上方，真实默认档会标出。",
  "settings.live": "实时 tok/s",
  "settings.liveDesc": "在回答下方的运行状态旁显示实时速度、累计速度、动态柱条和折线。",
  "settings.report": "每条回答成绩单",
  "settings.reportDesc": "用量右边显示输入·输出·缓存，时间右边显示总用时和输出速度。",
  "settings.notify": "完成通知",
  "settings.notifyDesc": "页面在后台时，本轮结束发系统通知并闪烁标题。",
  "settings.sound": "通知提示音",
  "settings.soundDesc": "完成时播放一声轻提示音；默认关闭。",
  "settings.min": "最短通知时长",
  "settings.minDesc": "短于这个秒数的回答不通知，避免刷屏。",
  "settings.reduce": "减少动效",
  "settings.reduceDesc": "关闭换挡、流光和粒子动画，保留功能。",
  "settings.permission": "系统通知权限",
  "settings.permission.granted": "已授权",
  "settings.permission.denied": "浏览器已拒绝，请在站点设置里恢复",
  "settings.permission.default": "未授权",
  "settings.permission.request": "请求权限",
  "settings.permission.unsupported": "当前浏览器不支持",
  "settings.saved": "设置保存在当前 profile。",
  "settings.unavailable": "设置服务未就绪，当前改动只在本次页面生效。",
  "settings.seconds": "{value} 秒",
};

/** English copy, checked against the Chinese key set. */
var en = {
  "effort.title": "Reasoning effort: {name}",
  "effort.aria": "Reasoning effort, currently {name}",
  "effort.default": "Default",
  "effort.defaultMarked": "{name} (Default)",
  "effort.busy": "Switching reasoning effort…",
  "effort.back": "Back to the model list",
  "live.title": "Now {speed} tok/s · Total {tokens} tokens · {seconds} elapsed",
  "report.ttft": "TTFT {value}",
  "report.input": "in {value}",
  "report.output": "out {value}",
  "report.cached": "cached {value}",
  "report.cachedUnknown": "cached —",
  "report.total": "total {value}",
  "report.speed": "{value} tok/s",
  "report.speedApprox": "≈ {value} tok/s",
  "report.tokens": "{value} tok",
  "notify.title": "Turn complete",
  "notify.body": "\"{title}\" finished · {duration}",
  "notify.generic": "Current session",
  "settings.title": "DSH Goodies",
  "settings.subtitle": "A collection of small conveniences",
  "settings.intro": "Turn on what you want. Everything runs in the browser and never changes a model request.",
  "settings.effort": "Effort slider",
  "settings.effortDesc": "Turns the model menu's reasoning levels into a wide slider; drag or tap to switch, with the current name above and the real default marked.",
  "settings.live": "Live tok/s",
  "settings.liveDesc": "Shows live and cumulative speed, animated bars, and a sparkline beside the running status under the answer.",
  "settings.report": "Per-answer report",
  "settings.reportDesc": "Shows input · output · cached next to usage, and total time plus output speed next to the answer's time.",
  "settings.notify": "Completion notification",
  "settings.notifyDesc": "When the page is in the background, notify and flash the title after a turn.",
  "settings.sound": "Notification sound",
  "settings.soundDesc": "A soft two-tone chime on completion; off by default.",
  "settings.min": "Minimum notification length",
  "settings.minDesc": "Replies shorter than this many seconds stay silent.",
  "settings.reduce": "Reduce motion",
  "settings.reduceDesc": "Turns off the shift, glow and particle animations, keeping the features.",
  "settings.permission": "System notification permission",
  "settings.permission.granted": "Granted",
  "settings.permission.denied": "Blocked by the browser; restore it in the site settings",
  "settings.permission.default": "Not granted",
  "settings.permission.request": "Request permission",
  "settings.permission.unsupported": "Not supported by this browser",
  "settings.saved": "Settings are saved in the current profile.",
  "settings.unavailable": "The settings service is not ready; changes apply to this page only.",
  "settings.seconds": "{value} s",
};

/** Replace `{name}` placeholders in one dictionary string. */
function translate(locale, key, params) {
  var table = String(locale || "").toLowerCase().indexOf("zh") === 0 ? zh : en;
  var text = table[key] !== undefined ? table[key] : en[key] !== undefined ? en[key] : key;
  if (params !== undefined && params !== null) {
    for (var name in params) {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        text = text.replace(new RegExp("\\{" + name + "\\}", "g"), String(params[name]));
      }
    }
  }
  return text;
}

/** English fallback for seats that hand a component no translator. */
function fallbackT(key, params) {
  return translate("en", key, params);
}

/** Read the active locale without assuming the service is present. */
function activeLocale(ctx) {
  try {
    var value = ctx.locale.getLocale();
    return value && typeof value.active === "string" ? value.active : "en";
  } catch (error) {
    return "en";
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

var config = shared.DEFAULTS;
var configListeners = new Set();
var scopeTarget = null;
var scopeListeners = [];
var writeDepth = 0;
var sessionsService = null;
var workspaceService = null;
var remoteSession = null;
var activeSessionId = null;
var liveTurnSpeeds = new Map();

function getConfig() {
  return config;
}

function subscribeConfig(listener) {
  configListeners.add(listener);
  return function () {
    configListeners.delete(listener);
  };
}

function emitConfig() {
  configListeners.forEach(function (listener) {
    try {
      listener();
    } catch (error) {
      // One broken feature listener must not stop the others.
    }
  });
}

function setConfig(next) {
  var normalized = shared.normalizeConfig(next);
  if (shared.sameConfig(config, normalized)) return;
  config = normalized;
  emitConfig();
  if (typeof scheduleEffortMenuScan === "function") scheduleEffortMenuScan();
}

/** Current settings snapshot, or a loading stand-in before the service arrives. */
function scopeSnapshot() {
  if (scopeTarget !== null) {
    try {
      return scopeTarget.getSnapshot();
    } catch (error) {
      // Fall through to the local stand-in.
    }
  }
  return { status: "loading", value: config, writable: false };
}

function subscribeScope(listener) {
  if (scopeTarget !== null) {
    try {
      return scopeTarget.subscribe(listener);
    } catch (error) {
      return function () {};
    }
  }
  scopeListeners.push(listener);
  return function () {
    var at = scopeListeners.indexOf(listener);
    if (at >= 0) scopeListeners.splice(at, 1);
  };
}

/** Adopt the real form once the host serves it; later reads update the store. */
function readScope() {
  if (writeDepth > 0) return;
  var snapshot = scopeSnapshot();
  if (snapshot && snapshot.status === "ready") setConfig(snapshot.value);
}

function adoptScope(target) {
  if (scopeTarget !== null || target === null || target === undefined) return;
  if (typeof target.getSnapshot !== "function" || typeof target.subscribe !== "function") return;
  scopeTarget = target;
  var listeners = scopeListeners.slice();
  scopeListeners.length = 0;
  for (var index = 0; index < listeners.length; index += 1) {
    try {
      target.subscribe(listeners[index]);
    } catch (error) {
      // A listener that cannot resubscribe simply loses the first update.
    }
  }
  target.subscribe(readScope);
  readScope();
}

function bindSettings(ctx) {
  try {
    var legacy = ctx.get("settingsScope");
    if (legacy && typeof legacy.bind === "function") {
      var bound = legacy.bind({ namespace: NAMESPACE });
      if (bound) adoptScope(bound);
    }
  } catch (error) {
    // The legacy service is optional; configForms is the current dialect.
  }
  ctx.inject(["configForms"], function (scope) {
    var forms = scope.configForms;
    if (!forms || typeof forms.get !== "function") return;
    var form = null;
    try {
      form = forms.get(ENTRY_ID);
    } catch (error) {
      form = null;
    }
    if (form !== null) adoptScope(form);
  });
}

/** Write one field optimistically, then reconcile with the host's answer. */
function writeField(field, value) {
  var normalized = value;
  if (shared.BOOLEAN_FIELDS.indexOf(field) >= 0) normalized = value === true;
  else if (field === "notifyMinSeconds") normalized = Math.min(120, Math.max(0, Math.round(Number(value) || 0)));
  var before = config[field];
  var patch = {};
  patch[field] = normalized;
  setConfig(Object.assign({}, config, patch));
  if (scopeTarget === null || typeof scopeTarget.set !== "function") return;
  writeDepth += 1;
  var finish = function (accepted) {
    writeDepth = Math.max(0, writeDepth - 1);
    if (accepted === false) {
      var revert = {};
      revert[field] = before;
      setConfig(Object.assign({}, config, revert));
      return;
    }
    readScope();
  };
  try {
    var result = scopeTarget.set(field, normalized);
    if (result && typeof result.then === "function") result.then(finish, function () { finish(false); });
    else finish(result !== false);
  } catch (error) {
    finish(false);
  }
}

function useConfig() {
  return useSyncExternalStore(subscribeConfig, getConfig, getConfig);
}

function useScopeReady() {
  return useSyncExternalStore(
    subscribeScope,
    function () {
      var snapshot = scopeSnapshot();
      return snapshot !== null && snapshot.status === "ready";
    },
    function () {
      return false;
    }
  );
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function installStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-plugin-css="' + shared.STYLE_ID + '"]') !== null) return;
  var style = document.createElement("style");
  style.dataset.plugin = NAMESPACE;
  style.dataset.pluginCss = shared.STYLE_ID;
  style.textContent = shared.CSS;
  document.head.appendChild(style);
}

function applyMotionPreference() {
  if (typeof document === "undefined" || !document.documentElement) return;
  try {
    if (getConfig().reduceMotion) document.documentElement.setAttribute("data-dtk-reduce-motion", "");
    else document.documentElement.removeAttribute("data-dtk-reduce-motion");
  } catch (error) {
    // The document may be tearing down.
  }
}

// ---------------------------------------------------------------------------
// Completion notification
// ---------------------------------------------------------------------------

var titleFlash = null;

function stopTitleFlash() {
  if (titleFlash === null) return;
  clearInterval(titleFlash.timer);
  try {
    document.title = titleFlash.base;
  } catch (error) {
    // The page may be unloading.
  }
  titleFlash = null;
}

function flashTitle(text) {
  if (typeof document === "undefined") return;
  if (titleFlash !== null) {
    titleFlash.text = text;
    return;
  }
  var base = document.title;
  var ticks = 0;
  var on = false;
  var timer = setInterval(function () {
    if (titleFlash === null) return;
    ticks += 1;
    on = !on;
    try {
      document.title = on ? "● " + titleFlash.text : titleFlash.base;
    } catch (error) {
      stopTitleFlash();
      return;
    }
    if (ticks >= 16 || (!document.hidden && document.hasFocus())) stopTitleFlash();
  }, 750);
  titleFlash = { base: base, text: text, timer: timer };
}

var audioContext = null;

function unlockAudio() {
  if (typeof window === "undefined") return;
  var Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return;
  if (audioContext === null) {
    try {
      audioContext = new Ctor();
    } catch (error) {
      return;
    }
  }
  if (audioContext.state === "suspended") {
    try {
      audioContext.resume();
    } catch (error) {
      // A blocked context simply stays silent.
    }
  }
}

function playChime() {
  if (audioContext === null) return;
  var start = audioContext.currentTime;
  var tones = [880, 1320];
  for (var index = 0; index < tones.length; index += 1) {
    var at = start + index * 0.12;
    var oscillator = audioContext.createOscillator();
    var gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tones[index];
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.06, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.26);
  }
}

function notifyCompletion(ctx, t, row, elapsedMs) {
  var title = row && typeof row.title === "string" && row.title.trim() !== "" ? row.title : t("notify.generic");
  var body = t("notify.body", {
    title: title,
    duration: shared.formatSeconds(elapsedMs) || "0s",
  });
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      var notice = new Notification(t("notify.title"), {
        body: body,
        tag: "dsh-goodies-" + String(row && row.id ? row.id : "session"),
        silent: !getConfig().notifySound,
      });
      notice.onclick = function () {
        try {
          window.focus();
        } catch (error) {
          // Ignore a browser that refuses focus.
        }
        var workspace = workspaceService;
        if (row && row.id && workspace && typeof workspace.openSession === "function") {
          try {
            workspace.openSession(row.id);
          } catch (error) {
            // The session may have disappeared.
          }
        }
        notice.close();
      };
    } catch (error) {
      // Construction can fail in strict browser modes; the title flash remains.
    }
  }
  flashTitle(t("notify.title"));
  if (getConfig().notifySound) playChime();
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Native reasoning-effort pane: catalog metadata (no renaming happens here)
// ---------------------------------------------------------------------------

/** Host-generation model catalog, loaded lazily when the menu is first used. */
var catalogState = { status: "idle", value: null, error: null, promise: null };

/** Translate seat captured by `installEffortMenu`, for labels it writes itself. */
var effortT = fallbackT;

/** A microtask-coalesced scan of the open menus. */
var effortMenuScanScheduled = false;

function scheduleEffortMenuScan() {
  if (effortMenuScanScheduled) return;
  effortMenuScanScheduled = true;
  Promise.resolve().then(function () {
    effortMenuScanScheduled = false;
    scanEffortMenus();
  });
}

function loadCatalog() {
  if (catalogState.status === "ready" && catalogState.value !== null) return Promise.resolve(catalogState.value);
  if (catalogState.promise !== null) return catalogState.promise;
  if (remoteSession === null || typeof remoteSession.modelCatalog !== "function") return Promise.resolve(null);
  catalogState.status = "loading";
  catalogState.promise = Promise.resolve()
    .then(function () {
      return remoteSession.modelCatalog();
    })
    .then(
      function (response) {
        if (!response || response.ok !== true) {
          throw new Error(
            response && response.error
              ? response.error.code + ": " + response.error.message
              : "model catalog failed"
          );
        }
        catalogState.value = response.value;
        catalogState.status = "ready";
        catalogState.error = null;
        catalogState.promise = null;
        scheduleEffortMenuScan();
        return response.value;
      },
      function (error) {
        catalogState.status = "error";
        catalogState.error = error && error.message ? error.message : String(error);
        catalogState.promise = null;
        return null;
      }
    );
  return catalogState.promise;
}

/** The model currently selected in the composer, read from its own label. */
function currentModelMeta() {
  var catalog = catalogState.value;
  if (catalog === null || typeof document === "undefined") return null;
  var label = document.querySelector("[data-composer-card] [data-model-id]");
  if (label === null) return null;
  var provider = label.getAttribute("data-provider-id");
  var model = label.getAttribute("data-model-id");
  if (provider === null || model === null) return null;
  var groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  var reasoning = null;
  for (var groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    var group = groups[groupIndex];
    if (!group || group.id !== provider || !Array.isArray(group.models)) continue;
    for (var modelIndex = 0; modelIndex < group.models.length; modelIndex += 1) {
      if (group.models[modelIndex] && group.models[modelIndex].id === model) {
        reasoning = group.models[modelIndex].reasoning || null;
        break;
      }
    }
    break;
  }
  var defaultEffort;
  if (reasoning !== null && reasoning.defaultEffort !== undefined) {
    defaultEffort = reasoning.defaultEffort;
  }
  return {
    provider: provider,
    model: model,
    reasoning: reasoning,
    defaultEffort: defaultEffort,
  };
}

/** Map an effort id to the label the native menu prints. */
function levelNameFor(meta, effort) {
  if (!meta || !meta.reasoning || effort === undefined) return null;
  var efforts = Array.isArray(meta.reasoning.efforts) ? meta.reasoning.efforts : [];
  for (var index = 0; index < efforts.length; index += 1) {
    if (efforts[index] && efforts[index].id === effort) {
      return typeof efforts[index].name === "string" ? efforts[index].name : String(effort);
    }
  }
  return null;
}

/** The original label of one effort button, captured before it is hidden. */
function effortOptionLabel(button) {
  var stored = button.getAttribute("data-dtk-label");
  if (stored !== null) return stored;
  var text = (button.textContent || "").trim();
  button.setAttribute("data-dtk-label", text);
  return text;
}

function isDefaultOptionLabel(text) {
  return text === effortT("effort.default") || /^default$/i.test(text) || text === "默认";
}

/**
 * Let one panel fade out, then drop it. A panel that never became visible is
 * removed at once, and one that is already fading is left alone.
 */
function discardEffortPanel(panel) {
  if (!panel) return;
  if (!panel.isConnected) {
    panel.remove();
    return;
  }
  if (panel.classList.contains("dtk-effort-panel--closing")) return;
  if (panel.style.visibility === "hidden") {
    panel.remove();
    return;
  }
  panel.__menu = null;
  panel.__dtkContent = null;
  panel.classList.add("dtk-effort-panel--closing");
  setTimeout(function () {
    panel.remove();
  }, 220);
}

function closeEffortPanel(menu) {
  var panel = menu.__dtkPanel;
  if (!panel) return;
  menu.__dtkPanel = null;
  // Remember which rows were on screen: the same rows coming back mean the
  // native surface is still mid-swap, not that the pane was reopened.
  panel.__dtkOwner = menu;
  panel.__dtkRadios = effortButtons(menu);
  discardEffortPanel(panel);
}

/** True when both lists hold the very same rows. */
function sameRadios(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  for (var index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function scanEffortMenus() {
  if (typeof document === "undefined") return;
  var panels = document.querySelectorAll(".dtk-effort-panel");
  for (var panelIndex = 0; panelIndex < panels.length; panelIndex += 1) {
    var panel = panels[panelIndex];
    if (!panel.__menu || !panel.__menu.isConnected) discardEffortPanel(panel);
  }
  var menus = document.querySelectorAll('div[role="menu"]');
  for (var index = 0; index < menus.length; index += 1) decorateEffortMenu(menus[index]);
}
// ---------------------------------------------------------------------------
// Native reasoning-effort pane: Codex-style thick slider
//
// The native pane is a menu whose direct children are `menuitemradio` buttons.
// We keep those buttons in the DOM (their click handlers do the real work)
// but hide them visually and render a thick capsule track with a white thumb:
// drag or click the track to preview, release to commit by clicking the
// matching native button. Level names are always the native labels; nothing
// is renamed. A concrete "(Default)" marker is only added when the catalog
// tells us the model's real default level.
// ---------------------------------------------------------------------------

/** Slider geometry, mirroring the Codex-style reference. */
var EFFORT_TRACK = 30;
var EFFORT_THUMB = 30;
var EFFORT_HALF = EFFORT_THUMB / 2;

function effortTrackPos(ratio) {
  var safe = Math.max(0, Math.min(1, ratio));
  return "calc((100% - " + EFFORT_THUMB + "px) * " + safe + " + " + EFFORT_HALF + "px)";
}


function effortButtons(menu) {
  var out = [];
  for (var childIndex = 0; childIndex < menu.children.length; childIndex += 1) {
    var child = menu.children[childIndex];
    if (child.tagName === "BUTTON" && child.getAttribute("role") === "menuitemradio") out.push(child);
  }
  return out;
}

/** Generic effort-name pattern for when the catalog has not loaded yet. */
function looksLikeEffortPane(radios) {
  for (var index = 0; index < radios.length; index += 1) {
    var text = (radios[index].textContent || "").trim();
    if (!/^(default|minimal|low|medium|high|max|xhigh|off|none|默认)$/i.test(text)) return false;
  }
  return true;
}

/**
 * Decide whether this open menu is the effort pane (not the model list).
 * @param {Array} radios - native option buttons.
 * @param {object|null} meta - current model metadata.
 * @returns {boolean} true for the effort pane.
 */
function isEffortPane(radios, meta) {
  if (!radios || radios.length < 2) return false;
  if (meta !== null && meta.reasoning && Array.isArray(meta.reasoning.efforts) && meta.reasoning.efforts.length > 0) {
    var names = {};
    for (var index = 0; index < meta.reasoning.efforts.length; index += 1) {
      var effort = meta.reasoning.efforts[index];
      if (effort && typeof effort.name === "string") names[effort.name] = true;
    }
    for (var check = 0; check < radios.length; check += 1) {
      var text = (radios[check].textContent || "").trim();
      if (text === "" || names[text]) continue;
      if (isDefaultOptionLabel(text)) continue;
      return false;
    }
    return true;
  }
  return looksLikeEffortPane(radios);
}

/**
 * Resolve the model's real default level without renaming anything.
 *
 * Order: the model's own `defaultEffort` first; when the current model is the
 * workspace default model, its `reasoningEffort` explains what the Default row
 * stands for; otherwise the Default row (if present) is itself the default.
 */
function resolveEffortDefault(radios, meta) {
  var result = { defaultId: undefined, defaultName: null, defaultButton: null, defaultLevelButton: null };
  var defaultButton = null;
  for (var index = 0; index < radios.length; index += 1) {
    radios[index].removeAttribute("data-dtk-hidden");
    if (isDefaultOptionLabel(effortOptionLabel(radios[index]))) defaultButton = radios[index];
  }
  // Only the model's own declaration is trustworthy here. The workspace
  // selection can equal whatever level was last picked, so using it would
  // label the current level as the default; an opaque Default row stays
  // opaque instead.
  var defaultId;
  if (meta !== null && meta.reasoning && meta.defaultEffort !== undefined) {
    defaultId = meta.defaultEffort;
  }
  var defaultName = defaultId !== undefined ? levelNameFor(meta, defaultId) : null;
  var defaultLevelButton = null;
  for (var levelIndex = 0; levelIndex < radios.length; levelIndex += 1) {
    if (defaultName !== null && effortOptionLabel(radios[levelIndex]) === defaultName) {
      defaultLevelButton = radios[levelIndex];
      break;
    }
  }
  result.defaultId = defaultId;
  result.defaultName = defaultName;
  result.defaultButton = defaultButton;
  result.defaultLevelButton = defaultLevelButton;
  return result;
}

function stopEffortSlider(menu) {
  var slider = menu.__dtkSlider || null;
  if (slider !== null) {
    try {
      if (slider.frame) cancelAnimationFrame(slider.frame);
      if (slider.snapFrame) cancelAnimationFrame(slider.snapFrame);
      if (slider.track) {
        slider.track.onpointerdown = null;
        slider.track.onpointermove = null;
        slider.track.onpointerup = null;
        slider.track.onpointercancel = null;
        slider.track.onkeydown = null;
      }
    } catch (error) {}
    menu.__dtkSlider = null;
  }
}

/**
 * The slider is an overlay, not a child of the React-owned menu: inserting
 * nodes into that menu makes React reconciliation drop the whole pane.
 */
function ensureEffortPanel(menu) {
  var panel = menu.__dtkPanel;
  if (panel && panel.isConnected) return panel;
  // A panel still fading from the previous open would otherwise sit behind the
  // new one for a moment.
  var closing = document.querySelectorAll(".dtk-effort-panel--closing");
  for (var closingIndex = 0; closingIndex < closing.length; closingIndex += 1) {
    closing[closingIndex].remove();
  }
  panel = document.createElement("div");
  panel.className = "dtk-effort-panel";
  panel.setAttribute("data-tone", menu.getAttribute("data-tone") || "0");
  panel.style.visibility = "hidden";
  panel.style.left = "-9999px";
  panel.style.top = "-9999px";
  panel.__menu = menu;
  var nativeStyle = window.getComputedStyle(menu);
  panel.style.border = nativeStyle.border;
  panel.style.borderRadius = nativeStyle.borderRadius || "16px";
  if (nativeStyle.boxShadow && nativeStyle.boxShadow !== "none") panel.style.boxShadow = nativeStyle.boxShadow;
  panel.style.backdropFilter = nativeStyle.backdropFilter;
  if (nativeStyle.filter && nativeStyle.filter !== "none") panel.style.filter = nativeStyle.filter;
  var content = document.createElement("div");
  content.className = "dtk-effort-content";
  panel.appendChild(content);
  panel.__dtkContent = content;
  // The native menu has no clickable way back from the effort pane (Escape and
  // Shift+Tab only), and the panel covers the menu anyway, so the panel owns
  // one: it replays the key the native handler already listens for.
  var backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "dtk-effort-back";
  backButton.setAttribute("aria-label", effortT("effort.back"));
  backButton.setAttribute("title", effortT("effort.back"));
  var backArrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  backArrow.setAttribute("viewBox", "0 0 16 16");
  backArrow.setAttribute("width", "14");
  backArrow.setAttribute("height", "14");
  backArrow.setAttribute("aria-hidden", "true");
  var backPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  backPath.setAttribute("d", "M10 3 L5 8 L10 13");
  backPath.setAttribute("fill", "none");
  backPath.setAttribute("stroke", "currentColor");
  backPath.setAttribute("stroke-width", "1.8");
  backPath.setAttribute("stroke-linecap", "round");
  backPath.setAttribute("stroke-linejoin", "round");
  backArrow.appendChild(backPath);
  backButton.appendChild(backArrow);
  backButton.addEventListener("mousedown", function (event) {
    event.preventDefault();
    event.stopPropagation();
  });
  backButton.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    // Fade out now rather than after the native swap: waiting even one frame
    // paints the still-opaque panel over the model list that just appeared.
    menu.__dtkBackRadios = effortButtons(menu).slice();
    menu.__dtkBackAt = Date.now();
    menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    undecorateEffortMenu(menu);
  });
  content.appendChild(backButton);
  // The native menu closes on a document mousedown outside itself; the panel
  // is outside by design, so keep that event from reaching the menu.
  panel.addEventListener("mousedown", function (event) {
    event.stopPropagation();
  });
  panel.addEventListener("pointerdown", function (event) {
    event.stopPropagation();
  });
  document.body.appendChild(panel);
  menu.__dtkPanel = panel;
  return panel;
}

function placeEffortPanel(menu, anchor) {
  var panel = menu.__dtkPanel;
  if (!panel) return;
  var wantedWidth = typeof anchor.width === "number" ? anchor.width : 300;
  var width = Math.min(wantedWidth, window.innerWidth - 24);
  var wantedHeight = typeof anchor.height === "number" ? anchor.height : 104;
  panel.style.width = Math.round(width) + "px";
  panel.style.height = Math.round(wantedHeight) + "px";
  var left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  var height = panel.offsetHeight || wantedHeight;
  var top = anchor.top;
  if (top + height > window.innerHeight - 8) top = Math.max(8, anchor.bottom - height);
  if (top < 8) top = 8;
  panel.style.left = Math.round(left) + "px";
  panel.style.top = Math.round(top) + "px";
  panel.style.visibility = "visible";
  requestAnimationFrame(function () {
    if (panel.isConnected && panel.__dtkContent) panel.__dtkContent.style.opacity = "1";
  });
}

function undecorateEffortMenu(menu) {
  stopEffortSlider(menu);
  closeEffortPanel(menu);
  menu.removeAttribute("data-dtk-effort-menu");
  menu.removeAttribute("data-tone");
  menu.style.removeProperty("--dtk-menu-count");
  menu.style.removeProperty("--dtk-menu-index");
  var label = menu.querySelector(":scope > .dtk-effort-menu-label");
  if (label !== null) label.remove();
  var slider = menu.querySelector(":scope > .dtk-effort-slider");
  if (slider !== null) slider.remove();
  for (var index = 0; index < menu.children.length; index += 1) {
    var child = menu.children[index];
    if (child.tagName === "BUTTON" && child.getAttribute("role") === "menuitemradio") {
      child.removeAttribute("data-dtk-hidden");
      child.removeAttribute("data-dtk-active");
      child.removeAttribute("data-dtk-default");
      if (child.getAttribute("title") === "") child.removeAttribute("title");
    }
  }
}

/**
 * Position the slider visuals for one level index (preview or committed).
 */
function paintEffortSlider(menu, count, index, ratioOverride) {
  var slider = menu.__dtkSlider;
  if (!slider) return;
  var safe = Math.max(0, Math.min(count - 1, index));
  slider.active = safe;
  var ratio =
    typeof ratioOverride === "number"
      ? Math.max(0, Math.min(1, ratioOverride))
      : count <= 1
        ? 0
        : safe / (count - 1);
  var pos = effortTrackPos(ratio);
  if (slider.thumb) slider.thumb.style.left = pos;
  if (slider.fill) {
    var trackWidth = slider.track ? slider.track.clientWidth : 0;
    var fillPx = Math.max(0, (trackWidth - EFFORT_THUMB) * ratio + EFFORT_HALF);
    slider.fill.style.width = fillPx + "px";
    slider.fill.style.opacity = ratio <= 0.0001 ? "0" : "1";
  }
  if (slider.sparks) {
    slider.sparks.style.clipPath = "inset(0 " + (100 - ratio * 100).toFixed(2) + "% 0 0)";
    slider.sparks.style.setProperty("--spark-duration", (3.2 - ratio * 2.6).toFixed(2) + "s");
  }
  if (slider.sparkNodes) {
    var sparkCount = 6 + Math.round(ratio * 50);
    for (var sparkAt = 0; sparkAt < slider.sparkNodes.length; sparkAt += 1) {
      slider.sparkNodes[sparkAt].style.display = sparkAt < sparkCount ? "" : "none";
    }
  }
  // Levels already behind the thumb live on the filled part of the rail, so
  // their dots are hidden instead of tinted.
  var ticks = slider.ticks || [];
  for (var tick = 0; tick < ticks.length; tick += 1) {
    if (ticks[tick].style) ticks[tick].style.display = tick <= safe ? "none" : "";
  }
  menu.style.setProperty("--dtk-menu-index", String(safe));
  var color = effortColorAt(ratio);
  if (menu.__dtkPanel) {
    menu.__dtkPanel.style.setProperty("--dtk-tone", "rgb(" + effortRgb(color) + ")");
    menu.__dtkPanel.style.setProperty("--dtk-from", "rgb(" + effortRgb(EFFORT_BLUE_FROM) + ")");
    menu.__dtkPanel.style.setProperty("--dtk-to", "rgb(" + effortRgb(EFFORT_BLUE_TO) + ")");
  }

  var tone = Math.min(3, count <= 1 ? 0 : Math.round(ratio * 3));
  menu.setAttribute("data-tone", String(tone));
  if (menu.__dtkPanel) menu.__dtkPanel.setAttribute("data-tone", String(tone));
}

/**
 * Swap the level name with a short fade instead of changing the glyphs in
 * place. Repeated changes always land on the latest name.
 */
function setEffortLabel(node, text) {
  if (!node) return;
  if (node.textContent === text) {
    if (node.style.opacity === "0") node.style.opacity = "1";
    return;
  }
  if (!node.textContent) {
    node.textContent = text;
    node.style.opacity = "1";
    return;
  }
  if (node.__dtkFadeTimer) clearTimeout(node.__dtkFadeTimer);
  node.style.opacity = "0";
  node.__dtkFadeTimer = setTimeout(function () {
    node.textContent = text;
    if (!node.isConnected) return;
    requestAnimationFrame(function () {
      node.style.opacity = "1";
    });
  }, 110);
}

/**
 * Turn one open effort pane into a thick Codex-style slider.
 *
 * The native buttons stay in the DOM and their click handlers perform the
 * real switch; the slider only previews positions and forwards commits.
 */
function decorateEffortMenu(menu) {
  if (!menu || menu.getAttribute("role") !== "menu") return;
  if (!getConfig().effortShift) {
    undecorateEffortMenu(menu);
    return;
  }
  var liveSlider = menu.__dtkSlider;
  if (liveSlider && (liveSlider.dragging || liveSlider.committing || liveSlider.snapping)) return;
  var radios = effortButtons(menu);
  if (radios.length < 2) {
    // Remember the root menu (model + effort rows) before it drills into the
    // effort pane; that is the box the slider should visually replace.
    if (menu.querySelector('[role="menuitem"]') !== null) {
      var rootLeft = parseFloat(menu.style.left);
      var rootTop = parseFloat(menu.style.top);
      if (Number.isFinite(rootLeft) && Number.isFinite(rootTop) && menu.offsetWidth > 2) {
        menu.__dtkRootAnchor = {
          left: rootLeft,
          top: rootTop,
          width: menu.offsetWidth,
          height: menu.offsetHeight,
        };
      }
    }
    // The same surface is reused for the model list when the user goes back.
    undecorateEffortMenu(menu);
    return;
  }
  // The native surface keeps the old rows on screen for a frame or two after
  // a back while it swaps panes; decorating then builds a whole panel at the
  // model list's position, which reads as a flash. The same rows coming back
  // mean that swap is still in flight; new rows mean a real reopen.
  if (menu.__dtkBackRadios !== undefined) {
    if (sameRadios(menu.__dtkBackRadios, radios) && Date.now() - menu.__dtkBackAt < 1200) {
      setTimeout(scheduleEffortMenuScan, 200);
      return;
    }
    menu.__dtkBackRadios = undefined;
  }
  var meta = currentModelMeta();
  if (!isEffortPane(radios, meta)) {
    undecorateEffortMenu(menu);
    return;
  }

  var measured = menu.getBoundingClientRect();
  var styledLeft = parseFloat(menu.style.left);
  var styledTop = parseFloat(menu.style.top);
  if (Number.isFinite(styledLeft) && Number.isFinite(styledTop) && menu.offsetHeight > 2) {
    menu.__dtkAnchor = { left: styledLeft, top: styledTop, bottom: styledTop + menu.offsetHeight };
  } else if (measured.width > 2 && measured.height > 2) {
    menu.__dtkAnchor = { left: measured.left, top: measured.top, bottom: measured.bottom };
  }
  var anchor =
    menu.__dtkRootAnchor ||
    menu.__dtkAnchor ||
    { left: measured.left, top: measured.top, bottom: measured.bottom, width: measured.width, height: measured.height };
  var panel = ensureEffortPanel(menu);
  menu.setAttribute("data-dtk-effort-menu", "");
  // Escape and Shift+Tab are the native ways back; they swap the pane before
  // anything else runs, so start the fade from inside the same key event.
  if (!menu.__dtkKeyGuard) {
    menu.__dtkKeyGuard = function (event) {
      if (event.key !== "Escape" && !(event.key === "Tab" && event.shiftKey)) return;
      var rows = effortButtons(menu);
      if (rows.length < 2 || !menu.__dtkPanel) return;
      menu.__dtkBackRadios = rows.slice();
      menu.__dtkBackAt = Date.now();
      undecorateEffortMenu(menu);
    };
    menu.addEventListener("keydown", menu.__dtkKeyGuard);
  }

  var resolved = resolveEffortDefault(radios, meta);
  var defaultName = resolved.defaultName;
  var defaultButton = resolved.defaultButton;
  var defaultLevelButton = resolved.defaultLevelButton;
  var defaultVisible = defaultLevelButton !== null ? defaultLevelButton : null;

  // Every native row stays addressable; the slider forwards to it.
  var visible = radios.slice();
  if (visible.length < 2) {
    undecorateEffortMenu(menu);
    return;
  }

  var active = null;
  for (var checkedIndex = 0; checkedIndex < visible.length; checkedIndex += 1) {
    if (visible[checkedIndex].getAttribute("aria-checked") === "true") {
      active = visible[checkedIndex];
      break;
    }
  }
  if (active === null) active = defaultVisible;

  var activeIndex = active === null ? 0 : visible.indexOf(active);
  if (activeIndex < 0) activeIndex = 0;
  menu.style.setProperty("--dtk-menu-count", String(visible.length));
  menu.style.setProperty("--dtk-menu-index", String(activeIndex));
  var tone = Math.min(3, visible.length <= 1 ? 0 : Math.round((activeIndex / (visible.length - 1)) * 3));
  menu.setAttribute("data-tone", String(tone));
  panel.setAttribute("data-tone", String(tone));

  for (var markIndex = 0; markIndex < visible.length; markIndex += 1) {
    var button = visible[markIndex];
    button.removeAttribute("data-dtk-active");
    button.removeAttribute("data-dtk-default");
    if (button === active) button.setAttribute("data-dtk-active", "true");
    if (button === defaultVisible) button.setAttribute("data-dtk-default", "true");
  }

  var activeLabel = active === null ? defaultName || "" : effortOptionLabel(active);
  var activeIsDefault = active !== null && defaultVisible !== null && active === defaultVisible;
  // When the checked row IS the Default row and the catalog names the level
  // behind it, the title names that level instead of parroting "Default".
  if (active !== null && active === defaultButton && defaultName !== null) {
    activeLabel = defaultName;
    activeIsDefault = true;
  }
  var text = activeIsDefault ? effortT("effort.defaultMarked", { name: activeLabel }) : activeLabel;

  var content = panel.__dtkContent || panel;
  var labelNode = content.querySelector(".dtk-effort-menu-label");
  if (labelNode === null) {
    labelNode = document.createElement("div");
    labelNode.className = "dtk-effort-menu-label";
    labelNode.setAttribute("aria-hidden", "true");
    content.appendChild(labelNode);
  }
  setEffortLabel(labelNode, text);

  // Build (or reuse) the slider below the label.
  var sliderBox = content.querySelector(".dtk-effort-slider");
  var stored = menu.__dtkSlider || null;
  var createdSlider = false;
  if (sliderBox === null || stored === null || stored.count !== visible.length) {
    createdSlider = true;
    stopEffortSlider(menu);
    if (sliderBox !== null) sliderBox.remove();
    sliderBox = document.createElement("div");
    sliderBox.className = "dtk-effort-slider";
    var track = document.createElement("div");
    track.className = "dtk-effort-track";
    track.setAttribute("role", "slider");
    track.setAttribute("tabindex", "0");
    var fill = document.createElement("div");
    fill.className = "dtk-effort-fill";
    var glow = document.createElement("div");
    glow.className = "dtk-effort-glow";
    glow.setAttribute("aria-hidden", "true");
    fill.appendChild(glow);
    var sparks = document.createElement("div");
    sparks.className = "dtk-effort-sparks";
    sparks.setAttribute("aria-hidden", "true");
    var sparkNodes = [];
    for (var sparkIndex = 0; sparkIndex < 56; sparkIndex += 1) {
      var spark = document.createElement("span");
      spark.className = "dtk-effort-spark";
      spark.style.setProperty("--x", (4 + Math.random() * 86).toFixed(1) + "%");
      spark.style.setProperty("--y", (8 + Math.random() * 84).toFixed(1) + "%");
      spark.style.setProperty("--dx", (18 + Math.random() * 58).toFixed(0) + "px");
      spark.style.setProperty("--delay", (-Math.random() * 2.6).toFixed(2) + "s");
      spark.style.setProperty("--size", (1.2 + Math.random() * 1.6).toFixed(1) + "px");
      spark.style.setProperty("--dur", (0.7 + Math.random() * 0.8).toFixed(2));
      sparks.appendChild(spark);
      sparkNodes.push(spark);
    }
    sparkNodes.sort(function (first, second) {
      return (
        parseFloat(first.style.getPropertyValue("--x")) -
        parseFloat(second.style.getPropertyValue("--x"))
      );
    });
    for (var orderIndex = 0; orderIndex < sparkNodes.length; orderIndex += 1) {
      sparks.appendChild(sparkNodes[orderIndex]);
    }
    track.appendChild(fill);
    track.appendChild(sparks);
    var ticks = [];
    for (var tickIndex = 0; tickIndex < visible.length; tickIndex += 1) {
      var tick = document.createElement("span");
      tick.className = "dtk-effort-tick";
      tick.setAttribute("aria-hidden", "true");
      var tickRatio = visible.length <= 1 ? 0 : tickIndex / (visible.length - 1);
      tick.style.left = effortTrackPos(tickRatio);
      track.appendChild(tick);
      ticks.push(tick);
    }
    var thumb = document.createElement("span");
    thumb.className = "dtk-effort-thumb";
    thumb.setAttribute("aria-hidden", "true");
    track.appendChild(thumb);
    sliderBox.appendChild(track);
    content.appendChild(sliderBox);

    var state = {
      count: visible.length,
      track: track,
      fill: fill,
      sparks: sparks,
      sparkNodes: sparkNodes,
      thumb: thumb,
      ticks: ticks,
      dragging: false,
      committing: false,
      snapping: false,
      snapFrame: 0,
      animFrom: 0,
      animTo: 0,
      animIndex: -1,
      animStart: 0,
      moved: false,
      dragStartRatio: 0,
      dragStartX: 0,
      preview: -1,
      ratio: visible.length <= 1 ? 0 : activeIndex / (visible.length - 1),
      pendingX: null,
      frame: 0,
    };
    menu.__dtkSlider = state;

    var ratioForEvent = function (clientX) {
      var box = track.getBoundingClientRect();
      var travel = box.width - EFFORT_THUMB;
      if (!(travel > 0)) return 0;
      return Math.max(0, Math.min(1, (clientX - box.left - EFFORT_HALF) / travel));
    };
    var posForEvent = function (clientX) {
      return Math.round(ratioForEvent(clientX) * (state.count - 1));
    };
    var visualRatio = function () {
      var box = track.getBoundingClientRect();
      var thumbBox = thumb.getBoundingClientRect();
      var travel = box.width - thumbBox.width;
      if (!(travel > 0)) return Math.max(0, Math.min(1, state.ratio));
      var center = thumbBox.left + thumbBox.width / 2;
      return Math.max(0, Math.min(1, (center - box.left - thumbBox.width / 2) / travel));
    };
    var showIndex = function (index, ratioOverride) {
      var safe = Math.max(0, Math.min(state.count - 1, index));
      state.preview = safe;
      state.ratio =
        typeof ratioOverride === "number"
          ? Math.max(0, Math.min(1, ratioOverride))
          : state.count <= 1
            ? 0
            : safe / (state.count - 1);
      paintEffortSlider(menu, state.count, safe, state.ratio);
      var name = effortOptionLabel(visible[safe]);
      var isDefault = defaultVisible !== null && visible[safe] === defaultVisible;
      if (visible[safe] === defaultButton && defaultName !== null) {
        name = defaultName;
        isDefault = true;
      }
      var title = isDefault ? effortT("effort.defaultMarked", { name: name }) : name;
      setEffortLabel(labelNode, title);
      track.setAttribute("aria-valuenow", String(safe));
      track.setAttribute("aria-valuetext", title);
    };
    var previewForEvent = function (clientX) {
      var ratio = ratioForEvent(clientX);
      showIndex(Math.round(ratio * (state.count - 1)), ratio);
    };
    var schedulePreview = function (clientX) {
      state.pendingX = clientX;
      if (state.frame) return;
      state.frame = requestAnimationFrame(function () {
        state.frame = 0;
        var x = state.pendingX;
        state.pendingX = null;
        if (x !== null && state.dragging) previewForEvent(x);
      });
    };
    var cancelPreviewFrame = function () {
      if (state.frame) {
        cancelAnimationFrame(state.frame);
        state.frame = 0;
      }
      state.pendingX = null;
    };
    var commitIndex = function (index) {
      var safe = Math.max(0, Math.min(state.count - 1, index));
      var chosen = visible[safe];
      if (!chosen) return;
      showIndex(safe);
      state.preview = safe;
      var isDefault = chosen === defaultButton;
      var effortId = null;
      if (!isDefault && meta && meta.reasoning && Array.isArray(meta.reasoning.efforts)) {
        var chosenName = effortOptionLabel(chosen);
        for (var effortIndex = 0; effortIndex < meta.reasoning.efforts.length; effortIndex += 1) {
          if (meta.reasoning.efforts[effortIndex] && meta.reasoning.efforts[effortIndex].name === chosenName) {
            effortId = meta.reasoning.efforts[effortIndex].id;
            break;
          }
        }
      }
      if (remoteSession && typeof remoteSession.selectModel === "function" && activeSessionId !== null && meta !== null) {
        var selection = { sessionId: activeSessionId, provider: meta.provider, model: meta.model };
        if (effortId !== null) selection.reasoningEffort = effortId;
        state.committing = true;
        var settle = function () {
          setTimeout(function () {
            state.committing = false;
            scheduleEffortMenuScan();
          }, 700);
        };
        Promise.resolve(remoteSession.selectModel(selection)).then(settle, settle);
        return;
      }
      // Fallback for compositions without the session model RPC: let the
      // native handler commit (it also closes the menu).
      if (typeof chosen.click === "function") chosen.click();
    };

    track.onpointerdown = function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      cancelPreviewFrame();
      if (!state.snapping && state.snapFrame) {
        cancelAnimationFrame(state.snapFrame);
        state.snapFrame = 0;
      }
      state.committing = false;
      if (!state.snapping) track.removeAttribute("data-anim");
      state.dragging = true;
      state.moved = false;
      state.ratio = visualRatio();
      state.dragStartRatio = state.ratio;
      state.dragStartX = event.clientX;
      track.setAttribute("data-drag", "true");
      try {
        if (track.setPointerCapture) track.setPointerCapture(event.pointerId);
      } catch (captureError) {}
    };
    track.onpointermove = function (event) {
      if (!state.dragging) return;
      if (!state.moved) {
        if (Math.abs(event.clientX - state.dragStartX) < 4) return;
        state.moved = true;
        if (state.snapping) {
          state.snapping = false;
          if (state.snapFrame) cancelAnimationFrame(state.snapFrame);
          state.snapFrame = 0;
          track.removeAttribute("data-anim");
        }
      }
      schedulePreview(event.clientX);
    };
    var animateSnap = function (fromRatio, targetRatio, targetIndex) {
      state.animFrom = state.snapping ? visualRatio() : fromRatio;
      state.animTo = targetRatio;
      state.animIndex = targetIndex;
      state.animStart = performance.now();
      state.snapping = true;
      state.committing = true;
      track.setAttribute("data-anim", "true");
      if (state.snapFrame) return;
      var duration = 320;
      var step = function (now) {
        if (!state.snapping) return;
        var progress = Math.min(1, (now - state.animStart) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        var ratio = state.animFrom + (state.animTo - state.animFrom) * eased;
        state.ratio = ratio;
        paintEffortSlider(menu, state.count, state.animIndex, ratio);
        if (progress < 1) {
          state.snapFrame = requestAnimationFrame(step);
        } else {
          state.snapping = false;
          state.snapFrame = 0;
          track.removeAttribute("data-anim");
          commitIndex(state.animIndex);
        }
      };
      state.snapFrame = requestAnimationFrame(step);
    };
    var release = function (event) {
      if (!state.dragging) return;
      state.dragging = false;
      track.removeAttribute("data-drag");
      cancelPreviewFrame();
      var index = Math.round(ratioForEvent(event.clientX) * (state.count - 1));
      var targetRatio = state.count <= 1 ? 0 : index / (state.count - 1);
      var fromRatio = visualRatio();
      // Let the transition switch on before the snapped position lands.
      try {
        void track.offsetWidth;
      } catch (layoutError) {}
      animateSnap(fromRatio, targetRatio, index);
    };
    track.onpointerup = release;
    track.onpointercancel = function () {
      state.dragging = false;
      state.preview = -1;
      cancelPreviewFrame();
      track.removeAttribute("data-drag");
    };
    track.onkeydown = function (event) {
      var current = visible.indexOf(active);
      if (current < 0) current = activeIndex;
      var next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(state.count - 1, current + 1);
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, current - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = state.count - 1;
      if (next < 0 || next === current) return;
      event.preventDefault();
      commitIndex(next);
    };
    stored = state;
  } else {
    stored.count = visible.length;
  }

  // Only initialise the rail from the native active row when it is created.
  // Later scans must not repaint it: the user's local choice is the truth for
  // this open panel, and the native row can lag behind by a render.
  var sliderState = menu.__dtkSlider;
  if (createdSlider && sliderState) {
    sliderState.track.setAttribute("aria-label", effortT("effort.title", { name: activeLabel }));
    sliderState.track.setAttribute("aria-valuemin", "0");
    sliderState.track.setAttribute("aria-valuemax", String(visible.length - 1));
    sliderState.track.setAttribute("aria-valuenow", String(activeIndex));
    sliderState.track.setAttribute("aria-valuetext", text);
    }

  placeEffortPanel(menu, anchor);
  if (createdSlider && sliderState && !sliderState.dragging) {
    paintEffortSlider(menu, visible.length, activeIndex);
  }
}

// ---------------------------------------------------------------------------
// Effort palette
// ---------------------------------------------------------------------------

var EFFORT_BLUE_FROM = [124, 196, 255];
var EFFORT_BLUE_TO = [29, 78, 216];


function effortColorAt(ratio) {
  var t = Math.max(0, Math.min(1, ratio));
  return [
    Math.round(EFFORT_BLUE_FROM[0] + (EFFORT_BLUE_TO[0] - EFFORT_BLUE_FROM[0]) * t),
    Math.round(EFFORT_BLUE_FROM[1] + (EFFORT_BLUE_TO[1] - EFFORT_BLUE_FROM[1]) * t),
    Math.round(EFFORT_BLUE_FROM[2] + (EFFORT_BLUE_TO[2] - EFFORT_BLUE_FROM[2]) * t),
  ];
}

function effortRgb(color) {
  return color[0] + "," + color[1] + "," + color[2];
}

/**
 * Watch for the native effort pane opening and decorate it.
 * @param {Function} t - translator for the labels written here.
 * @returns {Function} disposer.
 */
function installEffortMenu(t) {
  effortT = typeof t === "function" ? t : fallbackT;
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return function () {};
  var observer = new MutationObserver(function () {
    scheduleEffortMenuScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  var reposition = function () {
    scheduleEffortMenuScan();
  };
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);
  scheduleEffortMenuScan();
  return function () {
    observer.disconnect();
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  };
}

// ---------------------------------------------------------------------------
// Live tokens per second
// ---------------------------------------------------------------------------

function liveKey(snapshot) {
  var partial = snapshot && snapshot.legacy ? snapshot.legacy.partial : null;
  return partial ? String(partial.turn) + ":" + String(partial.step) : "";
}

function liveChars(snapshot) {
  var partial = snapshot && snapshot.legacy ? snapshot.legacy.partial : null;
  return partial ? shared.countChars(partial.blocks) : 0;
}

function liveEstimate(snapshot) {
  var partial = snapshot && snapshot.legacy ? snapshot.legacy.partial : null;
  return partial ? shared.estimateTokensFromBlocks(partial.blocks) : 0;
}

function liveExact(snapshot) {
  var nodes = snapshot && snapshot.nodes;
  if (!nodes || typeof nodes.values !== "function") return 0;
  var values = nodes.values();
  for (var index = values.length - 1; index >= 0; index -= 1) {
    var node = values[index];
    if (node && node.kind === "assistant-step" && node.data && node.data.status === "running") {
      var usage = node.data.usage;
      return usage && typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens) ? usage.outputTokens : 0;
    }
  }
  return 0;
}

function usageTotalOf(usage) {
  if (!usage || typeof usage !== "object") return 0;
  var input = null;
  if (typeof usage.uncachedInputTokens === "number" && Number.isFinite(usage.uncachedInputTokens)) {
    input = usage.uncachedInputTokens;
  } else if (typeof usage.inputTokens === "number" && Number.isFinite(usage.inputTokens)) {
    input = usage.inputTokens;
  }
  var total = 0;
  if (input !== null) total += Math.max(0, input);
  if (typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens)) total += Math.max(0, usage.outputTokens);
  if (typeof usage.cacheReadTokens === "number" && Number.isFinite(usage.cacheReadTokens)) total += Math.max(0, usage.cacheReadTokens);
  if (typeof usage.cacheWriteTokens === "number" && Number.isFinite(usage.cacheWriteTokens)) total += Math.max(0, usage.cacheWriteTokens);
  return total;
}

function liveUsageTotal(snapshot) {
  var legacy = snapshot && snapshot.legacy;
  var list = legacy && Array.isArray(legacy.nodes) ? legacy.nodes : null;
  var partial = legacy && legacy.partial ? legacy.partial : null;
  var turn = partial ? shared.normalizeTurn(partial.turn) : null;

  if (list !== null && turn !== null) {
    for (var tailIndex = list.length - 1; tailIndex >= 0; tailIndex -= 1) {
      var tail = list[tailIndex];
      if (!tail || tail.kind !== "turn-tail" || shared.normalizeTurn(tail.turn) !== turn || !tail.data || !tail.data.tokenUsage) continue;
      return usageTotalOf(tail.data.tokenUsage);
    }
    var aggregated = shared.readTurnUsage(list, turn);
    if (aggregated !== null) return usageTotalOf(aggregated);
  }

  var nodes = snapshot && snapshot.nodes;
  if (!nodes || typeof nodes.values !== "function") return 0;
  var values = nodes.values();
  for (var index = values.length - 1; index >= 0; index -= 1) {
    var node = values[index];
    if (node && node.kind === "assistant-step" && node.data && node.data.status === "running") {
      return usageTotalOf(node.data.usage);
    }
  }
  return 0;
}

function LiveSpeed(props) {
  if (typeof props.useChat !== "function") return null;
  return h(LiveSpeedBody, props);
}

function LiveSpeedBody(props) {
  var cfg = useConfig();
  var t = typeof props.t === "function" ? props.t : fallbackT;
  var useChat = props.useChat;
  var key = useChat(liveKey);
  var chars = useChat(liveChars);
  var estimate = useChat(liveEstimate);
  var exact = useChat(liveExact);
  var usageTotal = useChat(liveUsageTotal);
  var nowState = useState(Date.now());
  var now = nowState[0];
  var setNow = nowState[1];
  var startedAt = useRef(0);
  var lastSpeed = useRef(0);
  var lastTokenCount = useRef(0);
  var lastTokenAt = useRef(0);
  var lastTokenSeenAt = useRef(0);
  useEffect(
    function () {
      if (props.sessionId !== undefined) activeSessionId = String(props.sessionId);
    },
    [props.sessionId]
  );
  var displayState = useState(0);
  var display = displayState[0];
  var setDisplay = displayState[1];
  var targetState = useState(null);
  var target = targetState[0];
  var setTarget = targetState[1];
  var runningState = useState(false);
  var running = runningState[0];
  var setRunning = runningState[1];
  var totalState = useState(0);
  var totalTokens = totalState[0];
  var setTotalTokens = totalState[1];
  var totalRef = useRef(0);

  useEffect(
    function () {
      if (!cfg.liveSpeed) {
        setRunning(false);
        return undefined;
      }
      var check = function () {
        setRunning(document.querySelector("[data-chat-running]") !== null);
      };
      check();
      var timer = setInterval(check, 200);
      return function () {
        clearInterval(timer);
      };
    },
    [cfg.liveSpeed]
  );

  useEffect(
    function () {
      if (!running) {
        startedAt.current = 0;
        lastSpeed.current = 0;
        lastTokenCount.current = 0;
        lastTokenAt.current = 0;
        lastTokenSeenAt.current = 0;
        setDisplay(0);
        totalRef.current = 0;
        setTotalTokens(0);
        return;
      }
      if (!cfg.liveSpeed) {
        setDisplay(0);
        return;
      }
      if (startedAt.current === 0) startedAt.current = Date.now();
      // Tick once when text starts flowing so the first reading is immediate.
      if (chars > 0) setNow(Date.now());
    },
    [running, key, chars, cfg.liveSpeed]
  );

  useEffect(
    function () {
      if (!running || !cfg.liveSpeed) return undefined;
      var timer = setInterval(function () {
        setNow(Date.now());
      }, 100);
      return function () {
        clearInterval(timer);
      };
    },
    [running, cfg.liveSpeed]
  );

  // Provider usage is authoritative but can lag behind the stream; the char
  // estimate keeps the reading alive until the first usage sample lands.
  var tokens = Math.max(exact, estimate);

  useEffect(
    function () {
      if (!running || !cfg.liveSpeed) return;
      var count = Math.round(tokens);
      if (count <= 0) return;
      var lastCount = lastTokenCount.current;
      if (lastCount === 0) {
        lastTokenCount.current = count;
        lastTokenAt.current = now;
        lastTokenSeenAt.current = now;
        return;
      }
      if (count < lastCount) {
        lastTokenCount.current = count;
        lastTokenAt.current = now;
        lastTokenSeenAt.current = now;
        lastSpeed.current = 0;
        setDisplay(0);
        return;
      }
      if (count > lastCount) {
        var delta = count - lastCount;
        var gap = lastTokenAt.current > 0 ? now - lastTokenAt.current : 100;
        // Time spent waiting for tools / the next chunk is not decode time.
        // Cap one gap so a late burst is not diluted by the whole pause.
        var activeGap = Math.max(40, Math.min(gap, 800));
        var instant = delta / (activeGap / 1000);
        var next = lastSpeed.current > 0 ? lastSpeed.current * 0.55 + instant * 0.45 : instant;
        lastSpeed.current = next;
        lastTokenCount.current = count;
        lastTokenAt.current = now;
        lastTokenSeenAt.current = now;
        setDisplay(next);
        return;
      }
      if (lastTokenSeenAt.current > 0 && now - lastTokenSeenAt.current > 800) {
        lastSpeed.current = 0;
        setDisplay(0);
      }
    },
    [running, now, tokens, cfg.liveSpeed]
  );

  useEffect(
    function () {
      if (!running) {
        totalRef.current = 0;
        setTotalTokens(0);
        return;
      }
      var reported = Math.round(usageTotal || 0);
      var candidate = reported > 0 ? reported : Math.min(Math.round(tokens), 10000000);
      var next = Math.max(totalRef.current, candidate);
      if (next !== totalRef.current) {
        totalRef.current = next;
        setTotalTokens(next);
      }
    },
    [running, tokens, usageTotal]
  );

  useEffect(
    function () {
      if (!key || !cfg.liveSpeed || display <= 0) return;
      var turn = key.split(":")[0];
      var id = props.sessionId === undefined ? "" : String(props.sessionId);
      // Decode speed (token-producing intervals only), not wall-clock average.
      liveTurnSpeeds.set(id + ":" + turn, display);
      if (liveTurnSpeeds.size > 200) {
        var oldest = liveTurnSpeeds.keys().next().value;
        if (oldest !== undefined) liveTurnSpeeds.delete(oldest);
      }
    },
    [key, display, props.sessionId, cfg.liveSpeed]
  );

  useEffect(
    function () {
      if (!cfg.liveSpeed || !running) {
        setTarget(null);
        return;
      }
      var runningRow = document.querySelector("[data-chat-running]");
      if (runningRow === null) {
        setTarget(null);
        return;
      }
      var content = runningRow.querySelector('[class*="_runningContent"]') || runningRow;
      content.style.display = "flex";
      content.style.width = "100%";
      content.style.alignItems = "center";
      setTarget(content);
    },
    [cfg.liveSpeed, running, now]
  );

  if (!cfg.liveSpeed || !running) return null;
  var speed = display > 0 ? display : 0;
  var shownTotal = Math.max(totalTokens, Math.round(tokens));
  var totalElapsed = startedAt.current > 0 ? now - startedAt.current : 0;

  var pill = h(
    "span",
    {
      className: "dtk-live",
      "data-goodies-live-speed": "",
      "data-live-now": shared.formatSpeed(speed),
      "data-live-total": String(shownTotal),
      title: t("live.title", {
        speed: shared.formatSpeed(speed),
        tokens: String(shownTotal),
        seconds: shared.formatSeconds(totalElapsed) || "0s",
      }),
    },
    h("span", {
      className: "dtk-live-star",
      "aria-hidden": "true",
      // Driven from JS: some environments force `animation: none` on reduced
      // motion, which used to make the breathing invisible.
      style: { opacity: shared.starOpacity(now).toFixed(3) },
    }),
    h(
      "span",
      { className: "dtk-live-metric is-now" },
      h("span", { className: "dtk-live-value" }, shared.formatSpeed(speed)),
      h("span", { className: "dtk-live-unit" }, "tok/s")
    ),
    h("span", { className: "dtk-live-dot-sep", "aria-hidden": "true" }, "·"),
    h(
      "span",
      { className: "dtk-live-metric is-total" },
      h("span", { className: "dtk-live-value" }, shared.formatTokens(shownTotal)),
      h("span", { className: "dtk-live-unit" }, "tokens")
    )
  );
  return target === null ? null : createPortal(pill, target);
}

// ---------------------------------------------------------------------------
// Per-turn report
// ---------------------------------------------------------------------------

function TurnReport(props) {
  if (typeof props.useChat !== "function") return null;
  return h(TurnReportBody, props);
}

function TurnReportBody(props) {
  var cfg = useConfig();
  var t = typeof props.t === "function" ? props.t : fallbackT;
  var turn = props.turn;
  var turnNumber = shared.normalizeTurn(turn);
  var nodes = props.useChat(function (snapshot) {
    return snapshot && snapshot.legacy ? snapshot.legacy.nodes : null;
  });
  var usage = props.useChat(function (snapshot) {
    try {
      var number = shared.normalizeTurn(turn);
      if (number === null || !snapshot || !snapshot.locations || typeof snapshot.locations.getTurn !== "function") return null;
      if (!snapshot.nodes || typeof snapshot.nodes.get !== "function") return null;
      var keys = snapshot.locations.getTurn(number);
      if (!Array.isArray(keys)) return null;
      for (var index = keys.length - 1; index >= 0; index -= 1) {
        var node = snapshot.nodes.get(keys[index]);
        if (node && node.kind === "turn-tail" && node.data && node.data.tokenUsage) return node.data.tokenUsage;
      }
      return null;
    } catch (error) {
      return null;
    }
  });
  var report = useMemo(
    function () {
      return shared.readTurnReport(nodes, turn);
    },
    [nodes, turn]
  );
  var usageTargetState = useState(null);
  var usageTarget = usageTargetState[0];
  var setUsageTarget = usageTargetState[1];
  var timeTargetState = useState(null);
  var timeTarget = timeTargetState[0];
  var setTimeTarget = timeTargetState[1];

  useEffect(
    function () {
      if (!cfg.turnReport || turnNumber === null) {
        setUsageTarget(null);
        setTimeTarget(null);
        return;
      }
      var root = document.querySelector('[data-turn-tail="' + turnNumber + '"] [data-clock="end"]');
      if (root === null) {
        setUsageTarget(null);
        setTimeTarget(null);
        return;
      }
      var info = root.querySelector('[class*="_endInfo"]') || root;
      var usageButton = info.querySelector('[class*="_trigger"]');
      var timeEl = info.querySelector('[class*="_timeEnd"]');
      var makeSlot = function (name) {
        var slot = info.querySelector(':scope > [data-dtk-slot="' + name + '"]');
        if (slot === null) {
          slot = document.createElement("span");
          slot.setAttribute("data-dtk-slot", name);
          slot.className = "dtk-slot";
          info.appendChild(slot);
        }
        return slot;
      };
      if (usageButton !== null && timeEl !== null && info.contains(usageButton) && info.contains(timeEl)) {
        var beforeUsage = makeSlot("usage");
        var afterTime = makeSlot("time");
        try {
          if (beforeUsage.nextSibling !== timeEl) info.insertBefore(beforeUsage, timeEl);
          if (timeEl.nextSibling !== afterTime) {
            if (timeEl.nextSibling !== null) info.insertBefore(afterTime, timeEl.nextSibling);
            else info.appendChild(afterTime);
          }
        } catch (orderError) {}
        setUsageTarget(beforeUsage);
        setTimeTarget(afterTime);
      } else {
        var fallback = makeSlot("time");
        setUsageTarget(null);
        setTimeTarget(fallback);
      }
    },
    [cfg.turnReport, report, usage, turnNumber]
  );

  if (!cfg.turnReport || turnNumber === null) return null;
  var sessionKey = (props.sessionId === undefined ? "" : String(props.sessionId)) + ":" + String(turnNumber);
  var liveTps = liveTurnSpeeds.has(sessionKey) ? liveTurnSpeeds.get(sessionKey) : null;

  var breakdown = [];
  var derived = shared.readTurnUsage(nodes, turn);
  var inputValue = null;
  var outputValue = null;
  var cached = 0;
  var hasCache = false;
  if (usage && typeof usage === "object") {
    if (typeof usage.uncachedInputTokens === "number" && Number.isFinite(usage.uncachedInputTokens)) {
      inputValue = usage.uncachedInputTokens;
    }
    if (typeof usage.outputTokens === "number" && Number.isFinite(usage.outputTokens)) {
      outputValue = usage.outputTokens;
    }
    if (typeof usage.cacheReadTokens === "number" && Number.isFinite(usage.cacheReadTokens)) {
      cached += Math.max(0, usage.cacheReadTokens);
      hasCache = true;
    }
    if (typeof usage.cacheWriteTokens === "number" && Number.isFinite(usage.cacheWriteTokens)) {
      cached += Math.max(0, usage.cacheWriteTokens);
      hasCache = true;
    }
  }
  if (inputValue === null && derived && typeof derived.inputTokens === "number") inputValue = derived.inputTokens;
  if (outputValue === null && derived && typeof derived.outputTokens === "number") outputValue = derived.outputTokens;
  if (outputValue === null && report && report.tokens !== null) outputValue = report.tokens;
  if (!hasCache && derived) {
    if (typeof derived.cacheReadTokens === "number") {
      cached += Math.max(0, derived.cacheReadTokens);
      hasCache = true;
    }
    if (typeof derived.cacheWriteTokens === "number") {
      cached += Math.max(0, derived.cacheWriteTokens);
      hasCache = true;
    }
  }
  var valueText = function (value) {
    return value === null ? "—" : shared.formatTokens(value);
  };
  breakdown.push({ key: "in", text: t("report.input", { value: valueText(inputValue) }) });
  breakdown.push({ key: "out", text: t("report.output", { value: valueText(outputValue) }) });
  breakdown.push({
    key: "cache",
    text: hasCache ? t("report.cached", { value: shared.formatTokens(cached) }) : t("report.cachedUnknown"),
  });

  var timing = [];
  if (report && report.ttftMs !== null) {
    timing.push({ key: "ttft", text: t("report.ttft", { value: shared.formatSeconds(report.ttftMs) }) });
  }
  if (report && report.durationMs !== null) {
    timing.push({ key: "total", text: t("report.total", { value: shared.formatSeconds(report.durationMs) }) });
  }
  // Speed is measured when the turn carries decode timings; otherwise it is
  // derived from the output tokens and the time the answer took, so the field
  // does not silently disappear.
  // Prefer a measured decode speed; only fall back to wall-clock time when the
  // turn carries no decode timings at all and the live reading is gone.
  var measuredTps =
    report && report.tps !== null ? report.tps : report && report.sampledTps !== null ? report.sampledTps : null;
  var derivedTps = null;
  if (
    measuredTps === null &&
    liveTps === null &&
    outputValue !== null &&
    outputValue > 0 &&
    report &&
    report.durationMs !== null &&
    report.durationMs > 0
  ) {
    var decodeSpan =
      report.ttftMs !== null && report.ttftMs < report.durationMs ? report.durationMs - report.ttftMs : report.durationMs;
    if (decodeSpan > 0) derivedTps = outputValue / (decodeSpan / 1000);
  }
  var speedTps = measuredTps !== null ? measuredTps : liveTps !== null ? liveTps : derivedTps;
  if (speedTps !== null && speedTps > 0) {
    var speedText =
      measuredTps !== null
        ? t("report.speed", { value: shared.formatSpeed(speedTps) })
        : t("report.speedApprox", { value: shared.formatSpeed(speedTps) });
    timing.push({ key: "speed", text: speedText });
  }
  if ((breakdown.length === 0 && timing.length === 0) || (usageTarget === null && timeTarget === null)) return null;

  return h(
    React.Fragment,
    null,
    breakdown.length > 0 && usageTarget !== null
      ? createPortal(
          h(
            "span",
            {
              className: "dtk-report",
              "data-goodies-turn-report": "usage",
              "data-turn": String(turnNumber),
            },
            breakdown.map(function (part) {
              return h("span", { key: part.key, className: "dtk-report-part" }, part.text);
            })
          ),
          usageTarget
        )
      : null,
    timing.length > 0 && timeTarget !== null
      ? createPortal(
          h(
            "span",
            {
              className: "dtk-report",
              "data-goodies-turn-report": "timing",
              "data-turn": String(turnNumber),
            },
            timing.map(function (part) {
              return h("span", { key: part.key, className: "dtk-report-part" }, part.text);
            })
          ),
          timeTarget
        )
      : null
  );
}

// ---------------------------------------------------------------------------
// Completion notification watcher
// ---------------------------------------------------------------------------

function NotificationHost(props) {
  var cfg = useConfig();
  var sessions = props.sessions;
  var notify = props.notify;

  useEffect(
    function () {
      if (!cfg.completionNotify || !sessions || !sessions.list || typeof sessions.list.subscribe !== "function") {
        return undefined;
      }
      var previous = new Map();
      var read = function () {
        var snapshot = null;
        try {
          snapshot = sessions.list.getSnapshot();
        } catch (error) {
          return;
        }
        var byId = snapshot && snapshot.byId ? snapshot.byId : {};
        var now = Date.now();
        for (var id in byId) {
          if (!Object.prototype.hasOwnProperty.call(byId, id)) continue;
          var row = byId[id];
          var before = previous.get(id);
          var running = row && row.running === true;
          if (before && before.running && !running) {
            var elapsed = before.since ? now - before.since : 0;
            if (
              shared.shouldNotify({
                hidden: !document.hasFocus(),
                elapsedMs: elapsed,
                minMs: cfg.notifyMinSeconds * 1000,
              })
            ) {
              notify(row, elapsed);
            }
          }
          previous.set(id, {
            running: running,
            since: running ? (before && before.running ? before.since : now) : 0,
          });
        }
      };
      var unsubscribe = sessions.list.subscribe(read);
      read();
      return function () {
        unsubscribe();
      };
    },
    [cfg.completionNotify, cfg.notifyMinSeconds, cfg.notifySound, sessions, notify]
  );

  return null;
}

// ---------------------------------------------------------------------------
// Settings card
// ---------------------------------------------------------------------------

function permissionState() {
  try {
    return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  } catch (error) {
    return "unsupported";
  }
}

function permissionText(t, permission) {
  if (permission === "granted") return t("settings.permission.granted");
  if (permission === "denied") return t("settings.permission.denied");
  if (permission === "unsupported") return t("settings.permission.unsupported");
  return t("settings.permission.default");
}

function Toggle(props) {
  return h("button", {
    type: "button",
    role: "switch",
    "aria-checked": props.checked === true,
    "aria-label": props.label,
    disabled: props.disabled === true,
    className: "dtk-switch",
    onClick: function () {
      if (props.disabled === true) return;
      props.onChange(props.checked !== true);
    },
  });
}

function CardRow(props) {
  return h(
    "div",
    { className: "dtk-row" },
    h(
      "div",
      { className: "dtk-row-copy" },
      h("div", { className: "dtk-row-label" }, props.label),
      props.description ? h("div", { className: "dtk-row-desc" }, props.description) : null
    ),
    h("div", { className: "dtk-row-control" }, props.children)
  );
}

function SettingsCard(props) {
  var cfg = useConfig();
  var ready = useScopeReady();
  var t = typeof props.t === "function" ? props.t : fallbackT;
  var write = typeof props.write === "function" ? props.write : writeField;
  var permissionStore = useState(permissionState);
  var permission = permissionStore[0];
  var setPermission = permissionStore[1];

  function requestPermission() {
    if (typeof Notification === "undefined" || typeof Notification.requestPermission !== "function") return;
    try {
      Promise.resolve(Notification.requestPermission()).then(
        function (value) {
          setPermission(value || permissionState());
        },
        function () {
          setPermission(permissionState());
        }
      );
    } catch (error) {
      setPermission(permissionState());
    }
  }

  function toggle(field, label, description, disabled) {
    return h(
      CardRow,
      { key: field, label: label, description: description },
      h(Toggle, {
        checked: cfg[field] === true,
        label: label,
        disabled: disabled === true,
        onChange: function (value) {
          write(field, value);
        },
      })
    );
  }

  return h(
    "div",
    { className: "dtk-card" },
    h(
      "div",
      { className: "dtk-card-head" },
      h("div", { className: "dtk-card-title" }, t("settings.title")),
      h("div", { className: "dtk-card-sub" }, t("settings.subtitle"))
    ),
    h("p", { className: "dtk-card-intro" }, t("settings.intro")),
    toggle("effortShift", t("settings.effort"), t("settings.effortDesc")),
    toggle("liveSpeed", t("settings.live"), t("settings.liveDesc")),
    toggle("turnReport", t("settings.report"), t("settings.reportDesc")),
    toggle("reduceMotion", t("settings.reduce"), t("settings.reduceDesc")),
    h("div", { className: "dtk-card-foot" }, ready ? t("settings.saved") : t("settings.unavailable"))
  );
}

// ---------------------------------------------------------------------------
// Plugin body
// ---------------------------------------------------------------------------

/**
 * Activate the toolkit in one Web client.
 * @param {object} ctx - client plugin context.
 */
function apply(ctx) {
  installStyles();

  var t = function (key, params) {
    return translate(activeLocale(ctx), key, params);
  };
  try {
    var bound = ctx.locale.bind(NAMESPACE);
    if (typeof bound === "function") t = bound;
  } catch (error) {
    // The fallback dictionary still renders usable copy.
  }

  ctx.effect(
    function () {
      return ctx.locale.register(NAMESPACE, { zh: zh, en: en });
    },
    "dsh-goodies: dictionaries"
  );

  bindSettings(ctx);

  ctx.inject(["remote", "remote.session"], function (scope) {
    remoteSession = scope.remote && scope.remote.session ? scope.remote.session : null;
    loadCatalog().then(scheduleEffortMenuScan, scheduleEffortMenuScan);
  });
  ctx.inject(["sessions"], function (scope) {
    sessionsService = scope.sessions || null;
  });
  ctx.inject(["uiWorkspace"], function (scope) {
    workspaceService = scope.uiWorkspace || null;
  });

  var stopConfig = subscribeConfig(applyMotionPreference);
  applyMotionPreference();
  ctx.effect(
    function () {
      return function () {
        stopConfig();
      };
    },
    "dsh-goodies: motion preference"
  );

  ctx.effect(
    function () {
      if (typeof document === "undefined") return undefined;
      document.addEventListener("pointerdown", unlockAudio, { capture: true });
      return function () {
        document.removeEventListener("pointerdown", unlockAudio, { capture: true });
      };
    },
    "dsh-goodies: audio unlock"
  );

  ctx.effect(
    function () {
      return installEffortMenu(t);
    },
    "dsh-goodies: effort menu"
  );

  ctx.slots.inject("conversation.input.left", function () {
    return ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "dsh-goodies-live-speed",
        order: 20,
        locale: NAMESPACE,
      },
      LiveSpeed
    );
  });

  ctx.slots.inject("conversation.chat.turnTail", function () {
    return ctx.slots.register(
      {
        name: "conversation.chat.turnTail",
        id: "dsh-goodies-turn-report",
        order: 30,
        locale: NAMESPACE,
      },
      TurnReport
    );
  });

  var cardInject = function () {
    return { t: t, write: writeField };
  };
  ctx.slots.inject("plugins.bundle.config", function () {
    return ctx.slots.register(
      {
        name: "plugins.bundle.config",
        key: PACKAGE_NAME,
        locale: NAMESPACE,
        inject: cardInject,
      },
      SettingsCard
    );
  });
  ctx.slots.inject("settings.plugin.item", function () {
    return ctx.slots.register(
      {
        name: "settings.plugin.item",
        key: NAMESPACE,
        locale: NAMESPACE,
        inject: cardInject,
      },
      SettingsCard
    );
  });
}

exports.apply = apply;
exports.inject = inject;

		return module.exports;
	}
});
