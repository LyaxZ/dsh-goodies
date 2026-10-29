/**
 * dsh-goodies — shared, browser-safe helpers.
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
  notifyMinSeconds: 0,
});

var BOOLEAN_FIELDS = Object.freeze([
  "effortShift",
  "liveSpeed",
  "turnReport",
  "completionNotify",
  "notifySound",
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

/**
 * Same estimate, from plain text already on screen.
 * @param {string} text - rendered text of the streaming answer.
 * @returns {number} estimated output tokens.
 */
function estimateTokensFromText(text) {
  if (typeof text !== "string" || text.length === 0) return 0;
  var total = 0;
  for (var at = 0; at < text.length; at += 1) {
    var cp = text.codePointAt(at);
    if (cp > 0xffff) at += 1;
    if (isCjk(cp)) total += 1;
    else if (cp > 0x7f) total += 0.6;
    else total += 0.25;
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

  // When a step carries no first-token time, the time spent waiting is still
  // separable: a step's own span, or the whole turn minus the tool calls in it.
  var stepMs = 0;
  for (var spanIndex = 0; spanIndex < steps.length; spanIndex += 1) {
    var spanTiming = steps[spanIndex] && steps[spanIndex].timing;
    if (
      spanTiming &&
      typeof spanTiming.stepStartTime === "number" &&
      typeof spanTiming.completedTime === "number" &&
      spanTiming.completedTime > spanTiming.stepStartTime
    ) {
      stepMs += spanTiming.completedTime - spanTiming.stepStartTime;
    }
  }
  var toolMs = 0;
  for (var toolIndex = 0; toolIndex < nodes.length; toolIndex += 1) {
    var toolNode = nodes[toolIndex];
    if (!toolNode || toolNode.kind !== "tool-result" || toolNode.turn !== turnNumber) continue;
    if (typeof toolNode.callTime === "number" && typeof toolNode.time === "number" && toolNode.time > toolNode.callTime) {
      toolMs += toolNode.time - toolNode.callTime;
    }
  }
  var busyMs = stepMs > 0 ? stepMs : durationMs !== null ? Math.max(0, durationMs - toolMs) : 0;
  var approxTps = tps === null && sampledTps === null && tokens !== null && tokens > 0 && busyMs > 0 ? tokens / (busyMs / 1000) : null;
  if (ttftMs === null && durationMs === null && tokens === null) return null;
  return {
    steps: steps.length,
    ttftMs: ttftMs,
    durationMs: durationMs,
    tokens: tokens,
    tps: tps,
    sampledTps: sampledTps,
    busyMs: busyMs,
    approxTps: approxTps,
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
 * Decide whether a finished run deserves a notification.
 *
 * The page does not have to be in the background: a long turn is worth a ping
 * even while it is being watched. Only the minimum duration filters it out.
 * @param {object} options - elapsed and minimum duration.
 * @returns {boolean} true when the run was long enough to announce.
 */
/**
 * Flatten the session list snapshot into `[id, row]` pairs.
 *
 * The snapshot keeps its rows in a Map; an older shape used a plain object,
 * and iterating the wrong one silently yields nothing.
 * @param {object} snapshot - the sessions.list snapshot.
 * @returns {Array<Array>} id/row pairs.
 */
/**
 * Lay local overrides over a settings document.

 * A host that refuses a write leaves the toggle with nowhere to live; the
 * client keeps those fields locally so the switch still means something.
 * @param {object} base - the document value.
 * @param {object} overrides - fields the host did not accept.
 * @returns {object} the merged value.
 */
function mergeOverrides(base, overrides) {
  var merged = Object.assign({}, base || {});
  if (!overrides || typeof overrides !== "object") return merged;
  for (var key in overrides) {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) continue;
    merged[key] = overrides[key];
  }
  return merged;
}

function readSessionRows(snapshot) {
  var byId = snapshot && snapshot.byId ? snapshot.byId : null;
  if (byId === null) return [];
  var rows = [];
  if (typeof byId.forEach === "function" && typeof byId.get === "function") {
    byId.forEach(function (row, id) {
      rows.push([id, row]);
    });
    return rows;
  }
  for (var id in byId) {
    if (!Object.prototype.hasOwnProperty.call(byId, id)) continue;
    rows.push([id, byId[id]]);
  }
  return rows;
}

function shouldNotify(options) {
  if (!options) return false;
  if (typeof options.elapsedMs !== "number" || !Number.isFinite(options.elapsedMs)) return false;
  if (options.elapsedMs <= 0) return false;
  return options.elapsedMs >= (typeof options.minMs === "number" ? Math.max(0, options.minMs) : 0);
}

var CSS = `
div[role="menu"][data-dtk-effort-menu]:has(> button[role="menuitemradio"]){opacity:0!important;pointer-events:none!important}
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
body[data-ds-dark-theme] .dtk-effort-panel{background:var(--dsw-alias-bg-elevated,#26282e);border-color:color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent);box-shadow:0 20px 44px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.4)}
body[data-ds-dark-theme] .dtk-effort-panel .dtk-effort-track{background:color-mix(in srgb,var(--dsw-alias-label-primary) 16%,transparent)}
body[data-ds-dark-theme] .dtk-effort-panel .dtk-effort-glow{background:linear-gradient(180deg,rgba(255,255,255,.08),rgba(255,255,255,0) 62%)}
body[data-ds-dark-theme] .dtk-effort-panel .dtk-effort-thumb{background:#e9edf5;box-shadow:0 2px 6px rgba(0,0,0,.5);filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.55)) drop-shadow(0 0 8px color-mix(in srgb,var(--dtk-tone) 70%,transparent))}
body[data-ds-dark-theme] .dtk-effort-panel .dtk-effort-spark{background:#dbeafe}
@keyframes dtk-fill-sheen{0%{left:-45%}55%{left:110%}100%{left:110%}}
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
.dtk-card{list-style:none;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;transition:border-color .16s,background .16s}
.dtk-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.dtk-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dtk-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.dtk-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dtk-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.dtk-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}
.dtk-description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}
.dtk-chevron{color:var(--dsw-alias-label-tertiary);flex:none;display:block;transition:transform .16s}
.dtk-chevronOpen{transform:rotate(180deg)}
.dtk-body{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
.dtk-section{border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dtk-sectionLast{border-bottom:0}
.dtk-sectionHead{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:8px;padding:12px 0;display:flex}
.dtk-sectionHead:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dtk-sectionTitle{flex:none;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:22px}
.dtk-sectionSummary{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.dtk-sectionSpacer{flex:1;min-width:0}
.dtk-sectionBody{padding:0 0 12px}
.dtk-sectionBody>.dtk-field:first-child{padding-top:10px}
.dtk-sectionBody>.dtk-field:last-child{border-bottom:0}
.dtk-field{padding:14px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dtk-fieldLast{border-bottom:0}
.dtk-fieldHead{align-items:center;gap:8px;display:flex}
.dtk-fieldLabel{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dtk-inline{flex:1;justify-content:flex-end;align-items:center;gap:10px;display:flex}
.dtk-hint{color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:12px;line-height:18px}
.dtk-footer{border-top:.5px solid var(--dsw-alias-border-l2);justify-content:flex-start;align-items:center;gap:8px;margin:0 16px;padding:12px 0 14px;display:flex}
.dtk-seg{flex:none;display:inline-flex;overflow:hidden;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l3);border-radius:8px}
.dtk-segBtn{appearance:none;font:inherit;cursor:pointer;height:28px;padding:0 14px;color:var(--dsw-alias-label-secondary);background:0 0;border:0;border-left:.5px solid var(--dsw-alias-border-l3);font-size:13px;line-height:18px}
.dtk-segBtn:first-child{border-left:0}
.dtk-segBtn:disabled{opacity:.4;cursor:default}
.dtk-segOn{color:var(--dsw-alias-label-primary);background:var(--dsw-specific-sidebar-nav-item-active)}
.dtk-fieldAction{flex:none;appearance:none;font:inherit;cursor:pointer;background:0 0;border:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:0}
.dtk-fieldAction:hover:not(:disabled){color:var(--dsw-alias-label-primary)}
.dtk-fieldAction:disabled{opacity:.4;cursor:default}
@media (prefers-reduced-motion: reduce){

}
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
  estimateTokensFromText: estimateTokensFromText,
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
  readSessionRows: readSessionRows,
  mergeOverrides: mergeOverrides,
  CSS: CSS,
};

