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
  reportMotion: true,
  popoverMotion: true,
  hudMotion: true,
  sendMotion: true,
  hudWave: true,
  portableWindow: false,
  completionNotify: false,
  notifySound: false,
  notifyMinSeconds: 0,
});

var BOOLEAN_FIELDS = Object.freeze([
  "effortShift",
  "liveSpeed",
  "turnReport",
  "reportMotion",
  "popoverMotion",
  "hudMotion",
  "sendMotion",
  "hudWave",
  "portableWindow",
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

/**
 * Ledger key for one turn of one session.
 *
 * The HUD gates on a turn:step key that changes at every model call, while the
 * reading belongs to the whole answer. This keeps the same key for every step
 * of a turn and a distinct key for every other session, so two sessions can
 * never share a total.
 * @param {string|undefined} sessionId - the session the reading belongs to.
 * @param {string} gateKey - turn:step key, or a session-qualified variant.
 * @returns {string} session-scoped turn key, or "" before the turn is known.
 */
/**
 * Which step this session is generating, as `turn:step`, or "" before one exists.
 *
 * The visible partial opens the reading for a normal answer. Reasoning streams
 * before that step is visible, so the running step node is used instead: it is
 * already there and carries the same turn and step. Without this the reading
 * sat at zero through the whole thinking phase, though tokens were flowing.
 * @param {object} snapshot - chat store snapshot.
 * @returns {string} the step key, or "" when nothing is generating.
 */
function stepKey(snapshot) {
  var partial = snapshot && snapshot.legacy ? snapshot.legacy.partial : null;
  if (partial) return String(partial.turn) + ":" + String(partial.step);
  var nodes = snapshot && snapshot.nodes;
  if (!nodes || typeof nodes.values !== "function") return "";
  var values;
  try {
    values = nodes.values();
  } catch (error) {
    return "";
  }
  for (var index = values.length - 1; index >= 0; index -= 1) {
    var node = values[index];
    if (node && node.kind === "assistant-step" && node.data && node.data.status === "running") {
      return String(node.data.turn) + ":" + String(node.data.step);
    }
  }
  return "";
}

function turnLedgerKey(sessionId, gateKey) {
  if (gateKey === "" || gateKey === undefined || gateKey === null) return "";
  var session = String(sessionId);
  var rest = String(gateKey);
  if (rest.indexOf(session + ":") === 0) rest = rest.slice(session.length + 1);
  return session + ":" + rest.split(":")[0];
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
  // Tool results carry no turn of their own, so the turn's seq window stands in
  // for it: every tool call of the turn sits between its first and last step.
  var minSeq = null;
  var maxSeq = null;
  for (var index = 0; index < nodes.length; index += 1) {
    var node = nodes[index];
    if (node && node.kind === "assistant" && node.turn === turnNumber) {
      steps.push(node);
      if (typeof node.seq === "number") {
        if (minSeq === null || node.seq < minSeq) minSeq = node.seq;
        if (maxSeq === null || node.seq > maxSeq) maxSeq = node.seq;
      }
    }
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
  var toolBreakdown = [];
  for (var toolIndex = 0; toolIndex < nodes.length; toolIndex += 1) {
    var toolNode = nodes[toolIndex];
    if (!toolNode || toolNode.kind !== "tool-result") continue;
    var inTurn =
      toolNode.turn === turnNumber ||
      (typeof toolNode.seq === "number" && minSeq !== null && maxSeq !== null && toolNode.seq >= minSeq && toolNode.seq <= maxSeq) ||
      (typeof toolNode.time === "number" &&
        start !== null &&
        end !== null &&
        toolNode.time >= start - 500 &&
        toolNode.time <= end + 500);
    if (!inTurn) continue;
    if (typeof toolNode.callTime === "number" && typeof toolNode.time === "number" && toolNode.time > toolNode.callTime) {
      var spent = toolNode.time - toolNode.callTime;
      toolMs += spent;
      var toolName = typeof toolNode.name === "string" && toolNode.name.length > 0 ? toolNode.name : "tool";
      var known = null;
      for (var listIndex = 0; listIndex < toolBreakdown.length; listIndex += 1) {
        if (toolBreakdown[listIndex].name === toolName) known = toolBreakdown[listIndex];
      }
      if (known === null) toolBreakdown.push({ name: toolName, ms: spent });
      else known.ms += spent;
    }
  }
  toolBreakdown.sort(function (left, right) {
    return right.ms - left.ms;
  });
  // Split the same span the report already measures into the three phases the
  // popover draws: waiting for the first token, running tools, and writing.
  var thinkingMs = 0;
  var headsMs = 0;
  var firstHeadMs2 = null;
  var generationMs = 0;
  // The node carries the message blocks but no per-block timestamps; their
  // lengths are the only evidence of how much of the span each kind took.
  var blockThinkingMs = 0;
  var blockReplyMs = 0;
  var blockReasoningChars = 0;
  var blockReplyChars = 0;
  var hasBlockSplit = false;
  for (var phaseIndex = 0; phaseIndex < steps.length; phaseIndex += 1) {
    var phaseTiming = steps[phaseIndex] && steps[phaseIndex].timing;
    if (!phaseTiming) continue;
    if (typeof phaseTiming.stepStartTime === "number" && typeof phaseTiming.firstTokenTime === "number") {
      var headMs = Math.max(0, phaseTiming.firstTokenTime - phaseTiming.stepStartTime);
      thinkingMs += headMs;
      headsMs += headMs;
      if (firstHeadMs2 === null) firstHeadMs2 = headMs;
    }
    if (typeof phaseTiming.completedTime === "number") {
      // Without a first-token stamp the whole step span is all we have; the
      // block lengths still split it into thinking and writing.
      var spanBase =
        typeof phaseTiming.firstTokenTime === "number" ? phaseTiming.firstTokenTime : phaseTiming.stepStartTime;
      var spanMs =
        typeof spanBase === "number" ? Math.max(0, phaseTiming.completedTime - spanBase) : 0;
      if (typeof phaseTiming.firstTokenTime === "number") generationMs += spanMs;
      var reasoningChars = 0;
      var replyChars = 0;
      var blocks = steps[phaseIndex] && Array.isArray(steps[phaseIndex].blocks) ? steps[phaseIndex].blocks : [];
      for (var blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
        var block = blocks[blockIndex];
        if (!block || typeof block.text !== "string") continue;
        var blockKind = block.kind || block.type;
        if (blockKind === "reasoning") reasoningChars += block.text.length;
        else if (blockKind === "text") replyChars += block.text.length;
      }
      if (reasoningChars + replyChars > 0) {
        hasBlockSplit = true;
        blockReasoningChars += reasoningChars;
        blockReplyChars += replyChars;
        blockThinkingMs += (spanMs * reasoningChars) / (reasoningChars + replyChars);
        blockReplyMs += (spanMs * replyChars) / (reasoningChars + replyChars);
      }
    }
  }
  var otherMs = durationMs !== null ? Math.max(0, durationMs - thinkingMs - generationMs - toolMs) : 0;
  // A turn recorded without a first-token or finish stamp cannot be split; the
  // part that is not tools is still writing, so it must not read as "other".
  if (durationMs !== null && generationMs === 0 && durationMs > 0) {
    generationMs = Math.max(0, durationMs - thinkingMs - toolMs);
    otherMs = Math.max(0, durationMs - thinkingMs - generationMs - toolMs);
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
    thinkingMs: thinkingMs,
    headsMs: headsMs,
    firstHeadMs: firstHeadMs2,
    blockThinkingMs: Math.round(blockThinkingMs),
    blockReplyMs: Math.round(blockReplyMs),
    hasBlockSplit: hasBlockSplit,
    blockReasoningChars: blockReasoningChars,
    blockReplyChars: blockReplyChars,
    toolMs: toolMs,
    toolBreakdown: toolBreakdown,
    generationMs: generationMs,
    otherMs: otherMs,
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
.dtk-effort-panel{--dtk-tone:#3b82f6;--dtk-from:#7cc4ff;--dtk-to:#1d4ed8;--dtk-track:30px;--dtk-thumb:30px;position:fixed;z-index:1101;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;width:min(300px,calc(100vw - 24px));min-height:0;padding:6px 14px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);border-radius:16px;background:var(--dsw-alias-bg-elevated,#f7f8fa);box-shadow:0 20px 44px rgba(0,0,0,.24),0 2px 10px rgba(0,0,0,.12);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(12px));color:var(--dsw-alias-label-primary);font-family:inherit}
.dtk-effort-content{display:flex;flex-direction:column;justify-content:center;height:100%;padding-top:0;padding-bottom:8px;min-height:0;opacity:0;transition:opacity .36s cubic-bezier(.22,.9,.25,1)}
.dtk-effort-panel{transition:opacity .2s ease}
.dtk-effort-panel--closing{opacity:0;pointer-events:none}
.dtk-effort-panel .dtk-effort-back{position:absolute;left:8px;top:8px;z-index:4;display:flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);line-height:0;cursor:pointer;transition:background .15s ease,color .15s ease}
.dtk-effort-panel .dtk-effort-back svg{display:block;pointer-events:none}
.dtk-effort-panel .dtk-effort-back:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.dtk-effort-panel .dtk-effort-back:focus-visible{outline:2px solid var(--dtk-tone);outline-offset:1px}
.dtk-effort-panel .dtk-effort-track .dtk-effort-fill{position:absolute;left:0;top:0;bottom:0;overflow:hidden;border-radius:calc(var(--dtk-track) / 2) 0 0 calc(var(--dtk-track) / 2);corner-shape:round;background:linear-gradient(94deg,var(--dtk-from) 0%,var(--dtk-to) 100%);box-shadow:inset 0 1px 0 var(--dtk-from);-webkit-mask-image:radial-gradient(circle calc(var(--dtk-thumb) / 2) at 100% 50%,transparent 0 14px,#000 15px);mask-image:radial-gradient(circle calc(var(--dtk-thumb) / 2) at 100% 50%,transparent 0 14px,#000 15px);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;transition:width .28s cubic-bezier(.2,1.35,.35,1);z-index:1}
.dtk-effort-panel .dtk-effort-menu-label{position:relative;text-align:center;font-size:15px;line-height:18px;font-weight:600;letter-spacing:.2px;color:var(--dtk-tone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:2;padding:0;transition:color .2s ease,opacity .12s ease}
.dtk-effort-panel .dtk-effort-model{margin-top:1px;text-align:center;font-size:12px;line-height:14px;font-weight:500;letter-spacing:.1px;color:#1f2328;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:2}
.dtk-effort-slider{position:relative;z-index:2;padding:2px 0;margin-top:14px;margin-bottom:0;animation:dtk-slider-in .22s ease-out both}
.dtk-effort-panel .dtk-effort-track{position:relative;height:var(--dtk-track);border-radius:calc(var(--dtk-track) / 2);corner-shape:round;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 20%,transparent);cursor:grab;touch-action:none;outline:none;overflow:visible}
.dtk-effort-panel .dtk-effort-track[data-drag="true"]{cursor:grabbing}
.dtk-effort-panel .dtk-effort-track:focus-visible{outline:2px solid var(--dtk-tone);outline-offset:2px}
.dtk-effort-panel .dtk-effort-glow{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 62%);pointer-events:none}
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
/* The footer's flexible spacer is what opens a big blank in the row; with
   every child fixed, the figures stay compact and the clock follows them. */
.dtk-live{display:inline-flex;align-items:center;gap:5px;width:18em;margin-left:auto;flex:none;padding:0;border:0;background:none;min-width:0;color:#2563eb;font:inherit;font-variant-numeric:tabular-nums;white-space:nowrap;user-select:none}
.dtk-live-star{flex:none;width:13px;height:13px;background:#2563eb;clip-path:polygon(50% 0,64.5% 35.5%,100% 50%,64.5% 64.5%,50% 100%,35.5% 64.5%,0 50%,35.5% 35.5%)}
.dtk-live-metric{display:inline-flex;align-items:center;gap:5px;min-width:0;line-height:inherit;flex:none}
.dtk-live-metric.is-now .dtk-live-value{display:inline-flex;justify-content:flex-end;text-align:right;transition:width .16s ease-out}
.dtk-live{position:relative}

@keyframes dtk-demo-breathe{0%,100%{transform:scaleY(.35);opacity:.45}50%{transform:scaleY(1);opacity:1}}
.dtk-live-value{display:inline-block;flex:none;white-space:nowrap}
@media (max-width:1200px){.dtk-live{width:16em}.dtk-live-wave{max-width:4.5em}}
@media (max-width:960px){.dtk-live{width:14em}.dtk-live-wave{max-width:3em}}
@media (max-width:760px){.dtk-live{width:11em}.dtk-live-wave{max-width:1.5em}}
.dtk-live-unit{font-size:inherit;line-height:inherit;color:#2563eb;opacity:.75}
.dtk-live-dot-sep{flex:none;font-size:inherit;line-height:inherit;color:#2563eb;opacity:.5}

.dtk-slot{display:inline-flex;align-items:center;min-width:0;flex:0 1 auto;height:28px;box-sizing:border-box;padding:0 8px;margin:0;border-radius:8px;overflow:hidden}
.dtk-slot:not([data-dtk-open="1"]):hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-l2,#ececf0))}
.dtk-slot[data-dtk-open="1"]{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-l2,#ececf0))}
html.dtk-portable-open [data-dtk-portable-pane]{position:fixed;z-index:1300;right:24px;bottom:24px;width:min(460px,calc(100vw - 32px));height:min(620px,calc(100vh - 110px));display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:var(--dsw-alias-bg-base,#fff);box-shadow:0 18px 60px rgba(0,0,0,.28);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08))}
html.dtk-portable-open [data-dtk-portable-pane] [data-conversation-scroll]{max-height:none}
.dtk-portable-scrim{position:fixed;z-index:1290;inset:0;background:rgba(20,24,32,.28);backdrop-filter:blur(1px)}
@media (max-width:900px){html.dtk-portable-open [data-dtk-portable-pane]{right:8px;bottom:8px;width:calc(100vw - 16px);height:min(560px,calc(100vh - 90px))}}
@media (max-width:560px){html.dtk-portable-open [data-dtk-portable-pane]{right:0;bottom:0;width:100vw;height:calc(100vh - 56px);border-radius:12px 12px 0 0}}
.dtk-portable-btn{flex:none;height:24px;padding:0 8px;border:1px solid currentColor;border-radius:6px;background:none;color:inherit;font:inherit;font-size:11px;opacity:.7;cursor:pointer}
.dtk-portable-btn:hover{opacity:1}
.dtk-portable-bar{position:fixed;z-index:1200;top:56px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px);padding:6px 10px;border-radius:8px;background:var(--dsw-specific-menu,#f5f6f7);box-shadow:var(--dsw-elevation-prominent,0 4px 16px rgba(0,0,0,.12));font-size:12px;color:var(--dsw-alias-label-secondary,#555)}
.dtk-portable-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtk-portable-bar button{flex:none;height:24px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,#ddd);background:none;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.dtk-portable-bar button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
@media (max-width:640px){.dtk-portable-bar{top:auto;bottom:80px;font-size:11px}.dtk-portable-label{max-width:40vw}}
.dtk-report{display:inline-flex;user-select:none;-webkit-user-select:none;align-items:center;gap:0;margin:0;padding:0;color:inherit;font:inherit;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(24px + var(--dsh-content-font-delta,0px));font-variant-numeric:tabular-nums;opacity:1;white-space:nowrap;flex:0 1 auto;min-width:0;overflow:hidden}
/* The report settles in when its turn finishes: a short rise with a fade, each
   figure a beat after the one before it. Only opacity and transform animate, so
   the fit pass still measures the final size. */
@keyframes dtk-report-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
@keyframes dtk-figure-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}
.dtk-report-sep{animation:none}

.dtk-report-part{white-space:nowrap}
.dtk-report-part.is-clickable{cursor:pointer}
/* The hover pill is a fixed layer under the figures: the report itself clips
   its content for the fit pass, so a background there would be cut square. */
.dtk-halo{position:fixed;z-index:6;border-radius:8px;background:rgba(127,127,127,.10);pointer-events:none}
.dtk-report[data-goodies-turn-report="usage"]{cursor:pointer}
.dtk-report[data-goodies-turn-report="timing"] .dtk-report-part.is-clickable{cursor:pointer}
.dtk-report-part.is-clickable:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
@keyframes dtk-pop-in{from{opacity:0;transform:translateY(4px) scale(.985)}to{opacity:1;transform:none}}
@keyframes dtk-panel-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.dtk-pop{position:fixed;z-index:1100;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1,rgba(0,0,0,.08));box-sizing:border-box;padding:16px;border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-specific-menu,#f5f6f7);backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px));-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px));box-shadow:var(--dsw-elevation-prominent,0 16px 40px rgba(0,0,0,.18));color:var(--dsw-alias-label-secondary,#4b5563);border:0;font:inherit;font-size:13px;line-height:18px;text-align:left;white-space:normal}
.dtk-pop-title{font-weight:600;font-size:14px;margin-bottom:8px}
.dtk-pop-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dtk-pop-row b{font-weight:600;font-variant-numeric:tabular-nums}
.dtk-pop-caption{margin-top:8px;color:var(--dsw-alias-label-tertiary,#7a8394);font-size:11px}
.dtk-pop-hint{color:var(--dsw-alias-label-tertiary,#7a8394);font-size:11px}
.dtk-pop-curve{display:block;height:32px;margin-top:6px;padding:0 4px;box-sizing:border-box;overflow:hidden}
.dtk-pop-curve-bar{flex:1 1 0;min-width:1px;border-radius:1px;background:#2563eb;opacity:.75}
.dtk-pop-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 8px;background:rgba(0,0,0,.06)}
.dtk-pop-seg{height:100%}
.dtk-pop-legend{display:flex;flex-direction:column;gap:3px}
.dtk-pop-dot{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:6px;vertical-align:middle}
.dtk-report-sep{margin:0 6px;color:var(--dsw-alias-separator-primary)}
.dtk-report[data-goodies-turn-report]{max-width:100%}
/* The figures themselves give way: the report measures the room it has been left
   and drops the least useful ones until it fits, so no width rule is needed. */
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

@keyframes dtk-bump{0%{transform:scale(1.14)}60%{transform:scale(.98)}100%{transform:scale(1)}}
/* The send button: a soft coloured shadow rather than a hard ring, and the
   depth follows the button's own enabled state. */
html[data-dtk-send-motion="on"] button[aria-label*="发送"],button[aria-label*="Send"],button.uV2eYG_primary{filter:drop-shadow(0 0 0 rgba(29,78,216,0));transition:transform .16s cubic-bezier(.2,.8,.3,1),box-shadow .18s ease,filter .2s ease}
html[data-dtk-send-motion="on"] button[aria-label*="发送"]:not(:disabled):hover,button[aria-label*="Send"]:not(:disabled):hover,button.uV2eYG_primary:not(:disabled):hover{filter:drop-shadow(0 0 5px rgba(29,78,216,.75)) !important;box-shadow:none !important}
html[data-dtk-send-motion="on"] button[aria-label*="发送"]:disabled:hover,button[aria-label*="Send"]:disabled:hover,button.uV2eYG_primary:disabled:hover{filter:drop-shadow(0 0 5px rgba(96,165,250,.85)) !important;box-shadow:none !important}
html[data-dtk-send-motion="on"] button[aria-label*="发送"]:not(:disabled):hover:active,button[aria-label*="Send"]:not(:disabled):hover:active,button.uV2eYG_primary:not(:disabled):hover:active{transform:scale(.95) !important;filter:drop-shadow(0 0 4px rgba(29,78,216,.6)) !important;box-shadow:none !important}
html[data-dtk-send-motion="on"] button[aria-label*="发送"]:disabled:hover:active,button[aria-label*="Send"]:disabled:hover:active,button.uV2eYG_primary:disabled:hover:active{transform:scale(.97) !important;filter:drop-shadow(0 0 4px rgba(96,165,250,.7)) !important;box-shadow:none !important}
.dtk-live-wave2{min-width:44px;max-width:78px;box-sizing:border-box}
.dtk-live-wave{display:inline-flex;align-items:flex-end;justify-content:flex-start;gap:2px;height:14px;margin-left:6px;margin-right:2px;overflow:hidden;font-weight:600;min-width:0;flex:1 1 0px;max-width:6em}
@keyframes dtk-bar-grow{from{transform:scaleY(.35);opacity:.5}to{transform:scaleY(1)}}
.dtk-live-bar{flex:none;width:2px;min-height:2px;border-radius:1px;background:#1d4ed8;opacity:.9}
.dtk-live-bar.is-empty{opacity:.2}
.dtk-live-bar.is-last:not(.is-empty){opacity:1}
@media (prefers-reduced-motion: reduce){
.dtk-live-bar{transition:height .3s cubic-bezier(.2,.8,.3,1),opacity .3s ease}
.dtk-live:not(.dtk-live-motion) .dtk-live-bar{transition:none}
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
  turnLedgerKey: turnLedgerKey,
  stepKey: stepKey,
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
 *  * a one-line report at the end of each turn;
 *  * a completion notification with its own chime.
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
var useLayoutEffect = React.useLayoutEffect || React.useEffect;
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
  "live.title": "实时 {speed} tok/s · 本轮生成 {tokens} tokens · 用时 {seconds}",
  "report.ttft": "首字 {value}",
  "report.input": "输入 {value}",
  "report.output": "输出 {value}",
  "report.cached": "缓存 {value}",
  "report.cachedUnknown": "缓存 —",
  "report.total": "总用时 {value}",
  "report.speed": "{value} tok/s",
  "report.peak": "峰值",
  "report.average": "平均",
  "report.perSecond": "每秒速度",
  "report.speedTitle": "速度",
  "report.timeTitle": "时间构成",
  "report.waiting": "首 token 时间",
  "report.reasoning": "模型思考",
  "report.reply": "模型回复",
  "report.modelWait": "模型等待",
  "report.toolArgs": "工具参数",
  "report.thinking": "思考",
  "report.tool": "工具执行",
  "report.toolDetail": "工具明细",
  "report.generate": "生成",
  "report.other": "其他",
  "report.noSeries": "这一回合没有逐秒记录",
  "report.noPhases": "没有可拆分的时间",
  "report.openHint": "点击查看详情",
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
  "settings.liveDesc": "在回答下方的运行状态旁显示实时速度、累计速度与柱条。",
  "settings.hudWave": "token 速度波形",
  "settings.hudWaveDesc": "在实时读数旁显示每秒输出速度的柱状波形。",
  "settings.report": "每条回答成绩单",
  "settings.motionFeature": "界面动画增强",
  "settings.motion": "行动画",
  "settings.motionDesc": "回合结束时让成绩单淡入并轻微上移。开启后始终生效，不受系统「减少动态效果」影响。",
  "settings.cardMotion": "卡片动效",
  "settings.hudMotion": "HUD 波形动效",
  "settings.sendMotion": "发送按钮反馈",
  "settings.sendMotionDesc": "悬停时出现柔和光晕，按下时轻微回弹。",
  "settings.hudMotionDesc": "实时速度波形在数据变化时平滑涨落，而不是瞬间跳变。",
  "settings.cardMotionDesc": "打开或关闭速度、时间卡片时淡入淡出。",
  "settings.reportDesc": "用量右边显示输入·输出·缓存，时间右边显示总用时和输出速度。",
  "settings.notify": "完成通知",
  "settings.notifyDesc": "每一轮结束时发系统通知并闪烁标题，页面在前台也会提醒。",
  "settings.sound": "通知提示音",
  "settings.soundDesc": "每一轮结束播放一声轻提示音，与系统通知互不影响；默认关闭。",
  "settings.min": "最短通知时长",
  "settings.minDesc": "短于这个秒数的回答不通知，避免刷屏。",
  "settings.permission": "系统通知权限",
  "settings.permission.granted": "已授权",
  "settings.permission.denied": "浏览器已拒绝，请在站点设置里恢复",
  "settings.permission.default": "未授权",
  "settings.permission.request": "请求权限",
  "settings.permission.hint": "授权后才会弹系统通知，被拒时只闪烁标题。",
  "settings.notify.watching": "正在监听 {total} 个会话 · 当前页面{page}",
  "settings.notify.pageRunning": "正在运行",
  "settings.notify.pageIdle": "空闲",
  "settings.effortFeature": "思考强度滑块",
  "settings.liveFeature": "实时HUD",
  "settings.reportFeature": "每条回答成绩单",
  "settings.notifyFeature": "完成通知",
  "settings.notifySummary": "通知 {notify} · 提示音{sound}",
  "settings.on": "开启",
  "settings.off": "关闭",
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
  "live.title": "Now {speed} tok/s · {tokens} tokens generated · {seconds} elapsed",
  "report.ttft": "TTFT {value}",
  "report.input": "in {value}",
  "report.output": "out {value}",
  "report.cached": "cached {value}",
  "report.cachedUnknown": "cached —",
  "report.total": "total {value}",
  "report.speed": "{value} tok/s",
  "report.peak": "peak",
  "report.average": "average",
  "report.perSecond": "per second",
  "report.speedTitle": "Speed",
  "report.timeTitle": "Time split",
  "report.waiting": "first token",
  "report.reasoning": "thinking",
  "report.reply": "writing",
  "report.modelWait": "model wait",
  "report.toolArgs": "tool args",
  "report.thinking": "thinking",
  "report.tool": "tools",
  "report.toolDetail": "breakdown",
  "report.generate": "writing",
  "report.other": "other",
  "report.noSeries": "No per-second record for this turn",
  "report.noPhases": "Nothing to split",
  "report.openHint": "Click for details",
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
  "settings.liveDesc": "Shows live and cumulative speed and bars beside the running status under the answer.",
  "settings.hudWave": "token speed waveform",
  "settings.hudWaveDesc": "Draws the per-second output-speed bars next to the live reading.",
  "settings.report": "Per-answer report",
  "settings.motionFeature": "Motion enhancements",
  "settings.motion": "row motion",
  "settings.motionDesc": "Fade the report in with a short rise when a turn ends. This always runs while enabled, regardless of the system reduce-motion setting.",
  "settings.cardMotion": "card motion",
  "settings.hudMotion": "HUD motion",
  "settings.sendMotion": "send button feedback",
  "settings.sendMotionDesc": "A soft glow on hover and a small press response.",
  "settings.hudMotionDesc": "The live speed bars rise and fall smoothly instead of jumping.",
  "settings.cardMotionDesc": "Fade the speed and time cards in and out.",
  "settings.reportDesc": "Shows input · output · cached next to usage, and total time plus output speed next to the answer's time.",
  "settings.notify": "Completion notification",
  "settings.notifyDesc": "Notify and flash the title when a turn finishes, even while the page is in front.",
  "settings.sound": "Notification sound",
  "settings.soundDesc": "A soft two-tone chime when a turn ends, independent of the system notification; off by default.",
  "settings.min": "Minimum notification length",
  "settings.minDesc": "Replies shorter than this many seconds stay silent.",
  "settings.permission": "System notification permission",
  "settings.permission.granted": "Granted",
  "settings.permission.denied": "Blocked by the browser; restore it in the site settings",
  "settings.permission.default": "Not granted",
  "settings.permission.request": "Request permission",
  "settings.permission.hint": "granted, the browser can raise a system notification; otherwise only the title flashes",
  "settings.notify.watching": "Watching {total} sessions · this page is {page}",
  "settings.notify.pageRunning": "running",
  "settings.notify.pageIdle": "idle",
  "settings.effortFeature": "Effort slider",
  "settings.liveFeature": "Live HUD",
  "settings.reportFeature": "Per-answer report",
  "settings.notifyFeature": "Completion notification",
  "settings.notifySummary": "notice {notify} · chime {sound}",
  "settings.on": "On",
  "settings.off": "Off",
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
var portableSessionId = null;
var portablePreviousId = null;
var portableReturn = null;
var portablePending = false;
var popoverCloseTimer = null;

var remoteSession = null;
var activeSessionId = null;
var liveTurnSpeeds = new Map();
/** Per turn: the last seconds of speed, for the report's popover. */
var enteredTurns = new Set();
var latestRowMotion = true;
var rowHoverInstalled = false;
var enteredRows = new Set();
function installRowHoverMotion() {
  if (rowHoverInstalled) return;
  rowHoverInstalled = true;
  document.addEventListener(
    "pointerover",
    function (event) {
      if (!latestRowMotion || !event.target || !event.target.closest) return;
      var container = event.target.closest('[data-actions-reveal="hover"]');
      if (container === null) return;
      if (event.relatedTarget && container.contains(event.relatedTarget)) return;
      var row = container.querySelector('[class*="_actions"]');
      if (row && typeof row.animate === "function") {
        // A reused row may still hold the end state of its last exit.
        if (typeof row.getAnimations === "function") {
          row.getAnimations().forEach(function (animation) {
            animation.cancel();
          });
        }
        row.animate(
          [
            { opacity: 0, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 190, easing: "cubic-bezier(.2,.8,.3,1)" }
        );
      }
    },
    true
  );
  document.addEventListener(
    "pointerout",
    function (event) {
      if (!latestRowMotion || !event.target || !event.target.closest) return;
      var container = event.target.closest('[data-actions-reveal="hover"]');
      if (container === null) return;
      if (event.relatedTarget && container.contains(event.relatedTarget)) return;
      var row = container.querySelector('[class*="_actions"]');
      if (row && typeof row.animate === "function") {
        if (typeof row.getAnimations === "function") {
          row.getAnimations().forEach(function (animation) {
            animation.cancel();
          });
        }
        row.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(5px)" },
          ],
          { duration: 150, easing: "ease-in", fill: "forwards" }
        );
      }
    },
    true
  );
}
/** Open a scratch session in the current workspace and remember where to return. */
function openPortableSession() {
  try {
    if (portableSessionId !== null) return;
    if (!workspaceService || typeof workspaceService.startSession !== "function") {
      console.warn("[dsh-goodies] portable: no workspace service");
      return;
    }
    portablePreviousId = activeSessionId;
    portablePending = true;
    workspaceService.startSession();
    // The pane may not exist until the session view mounts; retry a few times.
    [0, 150, 400, 900].forEach(function (delay) {
      setTimeout(enterPortableMode, delay);
    });
    setTimeout(showPortableBar, 200);
  } catch (error) {
    console.warn("[dsh-goodies] portable session failed:", error);
  }
}

/** Close the scratch session: archive it, then return to where the user was. */
function closePortableSession() {
  exitPortableMode();
  var id = portableSessionId;
  var back = portablePreviousId;
  portableSessionId = null;
  portablePreviousId = null;
  removePortableBar();
  try {
    if (id !== null && workspaceService && typeof workspaceService.archiveSession === "function") {
      workspaceService.archiveSession(id).catch(function (error) {
        console.warn("[dsh-goodies] portable archive failed:", error);
      });
    }
    if (back !== null && workspaceService && typeof workspaceService.openSession === "function") {
      setTimeout(function () {
        workspaceService.openSession(back);
      }, 60);
    }
  } catch (error) {
    console.warn("[dsh-goodies] portable close failed:", error);
  }
}

/** Keep the session but stop treating it as scratch. */
function keepPortableSession() {
  exitPortableMode();
  portableSessionId = null;
  portablePreviousId = null;
  removePortableBar();
}

function findConversationPane() {
  var scroll = document.querySelector("[data-conversation-scroll]");
  if (scroll === null) return null;
  var node = scroll;
  for (var depth = 0; depth < 8 && node !== null && node !== document.body; depth += 1) {
    var rect = node.getBoundingClientRect();
    if (rect.width > 520 && rect.height > 320) return node;
    node = node.parentElement;
  }
  return scroll.parentElement;
}

function enterPortableMode() {
  var pane = findConversationPane();
  console.info("[dsh-goodies] portable pane:", pane === null ? "not found" : pane.tagName + "." + String(pane.className).slice(0, 60));
  if (pane === null) return;
  pane.setAttribute("data-dtk-portable-pane", "1");
  document.documentElement.classList.add("dtk-portable-open");
  if (document.querySelector(".dtk-portable-scrim") === null) {
    var scrim = document.createElement("div");
    scrim.className = "dtk-portable-scrim";
    scrim.addEventListener("click", closePortableSession);
    document.body.appendChild(scrim);
  }
}

function exitPortableMode() {
  var pane = document.querySelector("[data-dtk-portable-pane]");
  if (pane !== null) pane.removeAttribute("data-dtk-portable-pane");
  document.documentElement.classList.remove("dtk-portable-open");
  var scrim = document.querySelector(".dtk-portable-scrim");
  if (scrim !== null) scrim.remove();
}

function removePortableBar() {
  var bar = document.querySelector(".dtk-portable-bar");
  if (bar !== null) bar.remove();
}

function showPortableBar() {
  removePortableBar();
  var bar = document.createElement("div");
  bar.className = "dtk-portable-bar";
  var label = document.createElement("span");
  label.className = "dtk-portable-label";
  label.textContent = "便携会话 · 不进工作区";
  var keep = document.createElement("button");
  keep.type = "button";
  keep.className = "dtk-portable-keep";
  keep.textContent = "转为正式会话";
  keep.addEventListener("click", keepPortableSession);
  var close = document.createElement("button");
  close.type = "button";
  close.className = "dtk-portable-close";
  close.textContent = "关闭并归档";
  close.addEventListener("click", closePortableSession);
  bar.appendChild(label);
  bar.appendChild(keep);
  bar.appendChild(close);
  document.body.appendChild(bar);
}

var liveTurnSeries = new Map();
/** Per turn: what the host measured, which survives a throttled page. */
var liveTurnStats = new Map();
/** Where the per-stream stats survive a page reload. */
var TIMED_STORE_KEY = "dtk-goodies/timed";
/** Per turn and stream: the chunk-kind timings, summed when the report opens. */
var liveTurnTimed = new Map();

/** Remember one stream's timings for its turn; returns nothing. */
function rememberTurnTimed(ledgerKey, streamId, entry) {
  if (!entry || !entry.timed || typeof entry.timed !== "object") return;
  var table = liveTurnTimed.get(ledgerKey);
  if (!table) {
    table = new Map();
    liveTurnTimed.set(ledgerKey, table);
  }
  if (table.has(streamId)) return;
  table.set(streamId, {
    reasoning: Number(entry.timed.reasoning) || 0,
    text: Number(entry.timed.text) || 0,
    toolArgs: Number(entry.timed.toolArgs) || 0,
    startedAt: Number(entry.startedAt) || 0,
    firstAt: Number(entry.firstAt) || 0,
    lastAt: Number(entry.lastAt) || 0,
    usage: Number(entry.usage) || 0,
    series: Array.isArray(entry.series) ? entry.series.slice() : [],
  });
  try {
    var store = JSON.parse(window.localStorage.getItem(TIMED_STORE_KEY) || "{}");
    store[ledgerKey] = store[ledgerKey] || {};
    store[ledgerKey][streamId] = {
      reasoning: Number(entry.timed.reasoning) || 0,
      text: Number(entry.timed.text) || 0,
      toolArgs: Number(entry.timed.toolArgs) || 0,
      startedAt: Number(entry.startedAt) || 0,
      firstAt: Number(entry.firstAt) || 0,
      lastAt: Number(entry.lastAt) || 0,
      usage: Number(entry.usage) || 0,
      series: Array.isArray(entry.series) ? entry.series.slice() : [],
    };
    var keys = Object.keys(store);
    while (keys.length > 30) {
      delete store[keys[0]];
      keys.shift();
    }
    window.localStorage.setItem(TIMED_STORE_KEY, JSON.stringify(store));
  } catch (error) {
    // Storage can be unavailable; the live map still works.
  }
  if (liveTurnTimed.size > 200) {
    var oldest = liveTurnTimed.keys().next().value;
    if (oldest !== undefined) liveTurnTimed.delete(oldest);
  }
}

/** Sum the streams of one turn, so a tool step cannot erase earlier thinking. */
function aggregateTurnTimed(ledgerKey) {
  var table = liveTurnTimed.get(ledgerKey);
  if (!table || table.size === 0) {
    try {
      var stored = JSON.parse(window.localStorage.getItem(TIMED_STORE_KEY) || "{}")[ledgerKey];
      if (stored) {
        table = new Map();
        Object.keys(stored).forEach(function (streamId) {
          table.set(Number(streamId), stored[streamId]);
        });
        liveTurnTimed.set(ledgerKey, table);
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }
  if (!table || table.size === 0) return null;
  var out = { reasoning: 0, text: 0, toolArgs: 0, modelWait: 0, usage: 0, firstHead: 0, startedAt: 0, firstAt: 0, lastAt: 0, series: [] };
  var streams = [];
  table.forEach(function (entry) {
    streams.push(entry);
    out.reasoning += entry.reasoning;
    out.usage += entry.usage || 0;
    if (entry.startedAt > 0 && entry.firstAt > entry.startedAt) {
      var head = entry.firstAt - entry.startedAt;
      if (out.firstHead === 0 || entry.startedAt < out.startedAt) out.firstHead = head;
    }
    // Each model call thinks (and queues) before its first token; that head is
    // the honest "thinking" share, since the reasoning stream itself is short.
    if (entry.startedAt > 0 && entry.firstAt > entry.startedAt) out.modelWait += entry.firstAt - entry.startedAt;
    out.text += entry.text;
    out.toolArgs += entry.toolArgs;
    if (entry.startedAt > 0 && (out.startedAt === 0 || entry.startedAt < out.startedAt)) out.startedAt = entry.startedAt;
    if (entry.firstAt > 0 && (out.firstAt === 0 || entry.firstAt < out.firstAt)) out.firstAt = entry.firstAt;
    if (entry.lastAt > out.lastAt) out.lastAt = entry.lastAt;
  });
  // Lay every stream on one timeline: each model call contributes its own
  // seconds, so a long turn shows several groups of bars, not just the last.
  streams.sort(function (left, right) {
    return (left.startedAt || 0) - (right.startedAt || 0);
  });
  var turnStart = 0;
  for (var streamIndex = 0; streamIndex < streams.length; streamIndex += 1) {
    var started = streams[streamIndex].startedAt || 0;
    if (started > 0 && (turnStart === 0 || started < turnStart)) turnStart = started;
  }
  var combined = [];
  for (var streamIndex2 = 0; streamIndex2 < streams.length; streamIndex2 += 1) {
    var stream = streams[streamIndex2];
    var series = Array.isArray(stream.series) ? stream.series : [];
    if (series.length === 0) continue;
    var offset = turnStart > 0 && stream.startedAt > 0 ? Math.max(0, Math.round((stream.startedAt - turnStart) / 1000)) : combined.length;
    for (var second = 0; second < series.length; second += 1) {
      var bucket = offset + second;
      while (combined.length <= bucket && combined.length < 300) combined.push(0);
      if (bucket < combined.length) combined[bucket] += Number(series[second]) || 0;
    }
  }
  while (combined.length > 0 && combined[combined.length - 1] === 0) combined.pop();
  out.series = combined;
  // The host's per-second buckets follow the chunk sizes, which makes one tall
  // spike and long flat runs. Spreading each call's tokens over its own span
  // gives the shape a reader expects: a rise, a wavy plateau, a fall.
  var chart = [];
  var streamedMs = 0;
  for (var streamIndex3 = 0; streamIndex3 < streams.length; streamIndex3 += 1) {
    var item = streams[streamIndex3];
    var usedTokens = Number(item.usage) || 0;
    if (!(item.lastAt > item.firstAt)) continue;
    // A block response arrives in one tick, so its wall span says nothing about
    // how long it took to write; the host's streamed time does.
    var timedMs = (Number(item.reasoning) || 0) + (Number(item.text) || 0) + (Number(item.toolArgs) || 0);
    var spanMs = Math.max(item.lastAt - item.firstAt, timedMs);
    var seconds2 = Math.max(1, Math.round(spanMs / 1000));
    streamedMs += seconds2 * 1000;
    if (usedTokens <= 0) continue;
    var rate = usedTokens / seconds2;
    var offset2 = turnStart > 0 && item.startedAt > 0 ? Math.max(0, Math.round((item.startedAt - turnStart) / 1000)) : chart.length;
    for (var slot = 0; slot < seconds2; slot += 1) {
      var at = offset2 + slot;
      while (chart.length <= at && chart.length < 300) chart.push(0);
      if (at < chart.length) chart[at] = Math.max(chart[at], rate);
    }
  }
  while (chart.length > 0 && chart[chart.length - 1] === 0) chart.pop();
  out.chart = chart;
  out.streamedMs = streamedMs;
  return out;
}
/** Per turn: the highest total shown so far, and when its clock started. */
var liveTurnStart = new Map();

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

/** Local fields the host refused to store, kept so a switch still means something. */
var OVERRIDE_KEY = "dsh-goodies.overrides";

function readOverrides() {
  try {
    var raw = window.localStorage.getItem(OVERRIDE_KEY);
    var parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeOverrides(next) {
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
  } catch (error) {
    // A browser that forbids storage simply keeps the value for this session.
  }
}

/** Adopt the real form once the host serves it; later reads update the store. */
function readScope() {
  if (writeDepth > 0) return;
  var snapshot = scopeSnapshot();
  if (snapshot && snapshot.status === "ready") setConfig(shared.mergeOverrides(snapshot.value, readOverrides()));
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
      // The host refused this field (a read-only document, or an entry it does
      // not own). Keep the choice locally instead of flipping the switch back.
      var overrides = readOverrides();
      overrides[field] = normalized;
      writeOverrides(overrides);
      setConfig(Object.assign({}, config, patch));
      return;
    }
    var stored = readOverrides();
    if (Object.prototype.hasOwnProperty.call(stored, field)) {
      delete stored[field];
      writeOverrides(stored);
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

/**
 * Add this plugin's stylesheet, replacing a stale copy left by an earlier build.
 *
 * Returns a disposer so unloading the plugin also removes the sheet: leaving
 * it behind kept the menu-hiding rule alive after the feature was gone.
 * @returns {Function} disposer.
 */
function installStyles() {
  if (typeof document === "undefined") return function () {};
  var tag = 'style[data-plugin-css="' + shared.STYLE_ID + '"]';
  var existing = document.querySelector(tag);
  if (existing !== null) {
    // A rebuilt bundle may carry newer rules; refresh the text in place.
    if (existing.textContent !== shared.CSS) existing.textContent = shared.CSS;
    return function () {
      var live = document.querySelector(tag);
      if (live !== null) live.remove();
    };
  }
  var style = document.createElement("style");
  style.dataset.plugin = NAMESPACE;
  style.dataset.pluginCss = shared.STYLE_ID;
  style.textContent = shared.CSS;
  document.head.appendChild(style);
  return function () {
    var live = document.querySelector(tag);
    if (live !== null && live === style) live.remove();
  };
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
    var foreground = !document.hidden && document.hasFocus();
    // In front of the user the marker should be readable rather than blink:
    // hold it for one beat, then restore. A background tab keeps blinking.
    on = foreground ? true : !on;
    try {
      document.title = on ? "● " + titleFlash.text : titleFlash.base;
    } catch (error) {
      stopTitleFlash();
      return;
    }
    if (foreground ? ticks >= 2 : ticks >= 16) stopTitleFlash();
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
  // Try to open the output here as well: a user who only ever presses Enter has
  // never triggered the pointer listener, and the first chime used to be lost.
  if (audioContext === null) unlockAudio();
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
  var cfg = getConfig();
  var title = row && typeof row.title === "string" && row.title.trim() !== "" ? row.title : t("notify.generic");
  var body = t("notify.body", {
    title: title,
    duration: shared.formatSeconds(elapsedMs) || "0s",
  });
  // The notice and the chime are separate switches: a machine in do-not-disturb
  // swallows the notification, and the chime is the only signal left.
  if (cfg.completionNotify && typeof Notification !== "undefined" && Notification.permission === "granted") {
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
  if (cfg.completionNotify) flashTitle(t("notify.title"));
  if (cfg.notifySound) playChime();
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Native reasoning-effort pane: catalog metadata (no renaming happens here)
// ---------------------------------------------------------------------------

/** Host-generation model catalog, loaded lazily when the menu is first used. */
var catalogState = { status: "idle", value: null, error: null, promise: null, failedAt: 0 };

/** Translate seat captured by `installEffortMenu`, for labels it writes itself. */
var effortT = fallbackT;

/** A microtask-coalesced scan of the open menus. */
/**
 * Did a batch of mutations change the element tree rather than only text?
 *
 * Streaming text arrives as text nodes, which cannot open a menu; skipping
 * those keeps the observers off the hot path of a running answer.
 * @param {MutationRecord[]} records - the batch the observer delivered.
 * @returns {boolean} whether any element or attribute changed.
 */
/**
 * Announce element-level DOM changes so a report can find a footer that
 * appeared after it mounted. Text-only batches (streaming) are ignored.
 */
function installFooterWatch() {
  if (typeof document === "undefined" || typeof MutationObserver !== "function") return function () {};
  var scheduled = false;
  var observer = new MutationObserver(function (records) {
    if (scheduled || !hasElementMutation(records)) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      window.dispatchEvent(new CustomEvent("dtk:footer"));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return function () {
    observer.disconnect();
  };
}

function hasElementMutation(records) {
  for (var index = 0; index < records.length; index += 1) {
    var record = records[index];
    if (record.type === "attributes") return true;
    for (var side = 0; side < 2; side += 1) {
      var nodes = side === 0 ? record.addedNodes : record.removedNodes;
      for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
        if (nodes[nodeIndex].nodeType === 1) return true;
      }
    }
  }
  return false;
}

var effortMenuScanScheduled = false;

function scheduleEffortMenuScan() {
  if (effortMenuScanScheduled) return;
  effortMenuScanScheduled = true;
  // One scan per frame: scroll and resize fire far more often than the menu
  // can move, and a microtask per event meant several scans per frame.
  var run = function () {
    effortMenuScanScheduled = false;
    scanEffortMenus();
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else Promise.resolve().then(run);
}

function loadCatalog() {
  if (catalogState.status === "ready" && catalogState.value !== null) return Promise.resolve(catalogState.value);
  if (catalogState.promise !== null) return catalogState.promise;
  // A failed attempt is retried after a short pause rather than leaving the
  // panel without default markers for the rest of the page load.
  if (catalogState.status === "error" && Date.now() - catalogState.failedAt < 15000) return Promise.resolve(null);
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
        catalogState.failedAt = Date.now();
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
  // Items may sit directly under the menu or inside a group wrapper.
  var out = [];
  var direct = menu.querySelectorAll('button[role="menuitemradio"]');
  for (var index = 0; index < direct.length; index += 1) {
    var button = direct[index];
    if (button.disabled) continue;
    out.push(button);
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
    // The rail follows the same direction as the label: on a dark surface the
    // strongest setting is the lightest end of the gradient.
    var railFrom = effortDarkSurface() ? EFFORT_BLUE_TO : EFFORT_BLUE_FROM;
    var railTo = effortDarkSurface() ? EFFORT_BLUE_FROM : EFFORT_BLUE_TO;
    menu.__dtkPanel.style.setProperty("--dtk-from", "rgb(" + effortRgb(railFrom) + ")");
    menu.__dtkPanel.style.setProperty("--dtk-to", "rgb(" + effortRgb(railTo) + ")");
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
      var rootRect = menu.getBoundingClientRect();
      if (rootRect.width > 2 && rootRect.height > 2) {
        menu.__dtkRootAnchor = {
          left: rootRect.left,
          top: rootRect.top,
          width: rootRect.width,
          height: rootRect.height,
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
  if (measured.width > 2 && measured.height > 2) {
    menu.__dtkAnchor = {
      left: measured.left,
      top: measured.top,
      bottom: measured.bottom,
      width: measured.width,
      height: measured.height,
    };
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

  // Between the level name and the track: the model this level belongs to.
  var modelNode = content.querySelector(".dtk-effort-model");
  if (modelNode === null) {
    modelNode = document.createElement("div");
    modelNode.className = "dtk-effort-model";
    modelNode.setAttribute("aria-hidden", "true");
    content.appendChild(modelNode);
  }
  var source = document.querySelector("[data-composer-card] [data-model-id]");
  var modelName = source === null ? "" : (source.textContent || "").trim();
  if (modelName !== "" && text !== "" && modelName.endsWith(text)) {
    modelName = modelName.slice(0, -text.length).trim();
  }
  if (modelName !== "" && modelName !== modelNode.textContent) modelNode.textContent = modelName;

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
      dragStartX: 0,
      preview: -1,
      // The rows this rail was built from; refreshed on every scan so the
      // keyboard never commits a level the native pane has since moved past.
      visible: visible,
      active: active,
      activeIndex: activeIndex,
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
      var rows = state.visible || visible;
      var currentRow = state.active || active;
      var current = rows.indexOf(currentRow);
      if (current < 0) current = state.activeIndex;
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
  if (sliderState) {
    // The rows can change while the panel stays open; keep the rail's idea
    // of them current so the keyboard never commits a stale level.
    sliderState.visible = visible;
    sliderState.active = active;
    sliderState.activeIndex = activeIndex;
  }
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

/** Whether the surface under the panel is dark, so the ramp can be flipped. */
function effortDarkSurface() {
  if (typeof document === "undefined" || !document.body) return false;
  return document.body.hasAttribute("data-ds-dark-theme");
}

/**
 * Tint for the level name and the rail.
 *
 * On a light surface the ramp deepens as effort rises. On a dark one a deep
 * blue would vanish into the background, so the ramp runs the other way and
 * the strongest setting is the lightest tone.
 */
function effortColorAt(ratio) {
  var t = Math.max(0, Math.min(1, ratio));
  var dark = effortDarkSurface();
  var from = dark ? EFFORT_BLUE_TO : EFFORT_BLUE_FROM;
  var to = dark ? EFFORT_BLUE_FROM : EFFORT_BLUE_TO;
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
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
  var observer = new MutationObserver(function (records) {
    // Only an element change can open or close a menu; text-only batches,
    // which is what streaming produces, are ignored outright.
    if (hasElementMutation(records)) scheduleEffortMenuScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  var reposition = function () {
    scheduleEffortMenuScan();
  };
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, { capture: true, passive: true });
  scheduleEffortMenuScan();
  return function () {
    observer.disconnect();
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, { capture: true, passive: true });
  };
}

// ---------------------------------------------------------------------------
// Live tokens per second
// ---------------------------------------------------------------------------

function liveKey(snapshot) {
  return shared.stepKey(snapshot);
}

function liveChars(snapshot) {
  var partial = snapshot && snapshot.legacy ? snapshot.legacy.partial : null;
  return partial ? shared.countChars(partial.blocks) : 0;
}

function liveEstimate(snapshot) {
  var partial = snapshot && snapshot.legacy ? snapshot.legacy.partial : null;
  return partial ? shared.estimateTokensFromBlocks(partial.blocks) : 0;
}

/**
 * The host's own count for this session, refreshed while a turn runs.
 *
 * The host sees the model chunks as they arrive; the page only sees rendered
 * text, which the smooth-stream pass spreads out evenly. Each host stream is
 * one model call, so a turn is the sum of its calls. Nothing is counted
 * before this turn has a step of its own, so the reading opens at zero.
 */
/**
 * Decode time per stream, kept for the report.
 *
 * The HUD only needs the totals; the report needs a denominator that is the
 * generation window itself. The host stamps the first and last delta of every
 * stream, so this keeps the widest span seen and the largest count, per turn
 * and per stream, and lets the report read the sum back.
 */
var liveTurnDecode = new Map();

function rememberStreamDecode(turnKey, streamId, tokens, spanMs, series, timed) {
  if (turnKey === "" || !(streamId > 0)) return;
  var table = liveTurnDecode.get(turnKey);
  if (!table) {
    table = new Map();
    liveTurnDecode.set(turnKey, table);
    if (liveTurnDecode.size > 40) {
      var oldest = liveTurnDecode.keys().next().value;
      if (oldest !== undefined) liveTurnDecode.delete(oldest);
    }
  }
  var seen = table.get(streamId) || { tokens: 0, ms: 0 };
  if (tokens > seen.tokens) seen.tokens = tokens;
  // Speed is tokens over the seconds that produced tokens, not over the wall
  // span (which counts every pause and every tool call).
  var activeMs = spanMs;
  if (timed && typeof timed === "object") {
    var streamedMs = (Number(timed.reasoning) || 0) + (Number(timed.text) || 0) + (Number(timed.toolArgs) || 0);
    if (streamedMs > 0) activeMs = streamedMs;
  } else if (Array.isArray(series)) {
    var active = 0;
    for (var seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) if (series[seriesIndex] > 0) active += 1;
    if (active > 0) activeMs = active * 1000;
  }
  // An early poll can only see the wall span; once the per-second series is
  // known it replaces that span instead of losing to it.
  var fromSeries = activeMs !== spanMs;
  if (fromSeries) seen.ms = activeMs;
  else if (activeMs > seen.ms) seen.ms = activeMs;
  table.set(streamId, seen);
}

/** Tokens generated so far in one turn, from the same per-stream ledger. */
/**
 * Ledger key for a turn, from the turn:step key the HUD gates on.
 *
 * The gate key changes with every step, but the reading belongs to the whole
 * answer: a tool call between two model calls must not restart the count.
 * @returns {string} session-scoped turn key, or "" before the turn is known.
 */
function liveTurnTokens(turnKey) {
  var table = liveTurnDecode.get(turnKey);
  if (!table) return 0;
  var tokens = 0;
  table.forEach(function (entry) {
    tokens += entry.tokens;
  });
  return tokens;
}

/** Generation speed of one finished turn, from the stream spans it produced. */
function liveDecodeSpeed(turnKey) {
  var table = liveTurnDecode.get(turnKey);
  if (!table) return null;
  var tokens = 0;
  var ms = 0;
  table.forEach(function (entry) {
    tokens += entry.tokens;
    ms += entry.ms;
  });
  if (tokens <= 0 || ms <= 0) return null;
  return tokens / (ms / 1000);
}

function useRemoteLive(sessionId, turnKey, enabled) {
  // The turn tail does not always carry a session id; the live session is the
  // same one the report uses, so both keys must resolve the same way.
  if (sessionId === undefined || sessionId === null || String(sessionId) === "") sessionId = activeSessionId;
  sessionId = String(sessionId);
  var state = useState({ tokens: 0, startedAt: 0, ok: null });
  var live = state[0];
  var setLive = state[1];
  // The per-turn ledger lives at module scope: a remount (switching pages,
  // opening settings) must show the same total, not start from zero.
  var turnRef = useRef(turnKey);
  turnRef.current = turnKey;
  useEffect(
    function () {
      if (!enabled || typeof fetch !== "function") return undefined;
      var stopped = false;
      // One poll at a time: a slow answer from an earlier turn must not
      // overwrite the totals of the turn that is running now.
      var inFlight = false;
      var missed = 0;
      var read = function () {
        if (inFlight) return;
        inFlight = true;
        fetch("/dsh-goodies/live?sessionId=" + encodeURIComponent(String(sessionId)), {
          credentials: "same-origin",
          cache: "no-store",
        })
          .then(function (response) {
            return response.ok ? response.json() : null;
          })
          .then(function (body) {
            inFlight = false;
            if (stopped) return;
            // Nothing counts before this turn has a step of its own.
            if (turnRef.current === "") return;
            if (!body || !body.sessions) {
              setLive({ tokens: 0, startedAt: 0, ok: false });
              return;
            }
            var entry = body.sessions[String(sessionId)];
            if (!entry) {
              // No entry yet is normal for a moment; a lasting absence means the
              // host cannot name this session, so the local estimate takes over.
              missed += 1;
              if (missed > 8) setLive({ tokens: 0, startedAt: 0, ok: false });
              return;
            }
            missed = 0;
            var streamId = Number(entry.streamId) || 0;
            var current =
              Number(entry.usage) > 0 ? Math.round(entry.usage) : Math.round(entry.estimated || 0);
            // Decode time of this stream: from its first delta to the last, so
            // waiting for the first token or for a tool never inflates it.
            var firstAt = Number(entry.firstAt) || 0;
            var lastAt = Number(entry.lastAt) || 0;
            var span = firstAt > 0 && lastAt > firstAt ? lastAt - firstAt : 0;
            // The ledger is keyed by turn, not by step: the model calls of one
            // answer add up, so a tool step in between cannot drop the total.
            var ledgerKey = shared.turnLedgerKey(sessionId, turnRef.current);
            // The host's own per-second series and timestamps; they keep
            // arriving even if the page was hidden while the turn ran.
            var hostSeries = Array.isArray(entry.series) ? entry.series.slice() : [];
            rememberStreamDecode(ledgerKey, streamId, current, span, hostSeries, entry.timed);
            rememberTurnTimed(ledgerKey, streamId, entry);
            if (hostSeries.length > 0 || firstAt > 0 || lastAt > 0) {
              liveTurnStats.set(ledgerKey, {
                series: hostSeries,
                startedAt: entry.startedAt || 0,
                firstAt: firstAt,
                lastAt: lastAt,
                timed: entry.timed && typeof entry.timed === "object" ? entry.timed : null,
              });
              if (liveTurnStats.size > 200) {
                var oldestStats = liveTurnStats.keys().next().value;
                if (oldestStats !== undefined) liveTurnStats.delete(oldestStats);
              }
            }
            var total = liveTurnTokens(ledgerKey);
            // Publishing an identical object would re-render the HUD on every
            // poll while nothing grows, which is most of a tool call.
            setLive(function (previous) {
              if (
                previous.ok === true &&
                previous.tokens === total &&
                previous.startedAt === (entry.startedAt || 0)
              ) {
                return previous;
              }
              return { tokens: total, startedAt: entry.startedAt || 0, ok: true };
            });
          })
          .catch(function () {
            inFlight = false;
            if (!stopped) setLive({ tokens: 0, startedAt: 0, ok: false });
          });
      };
      read();
      var timer = setInterval(read, 120);
      return function () {
        stopped = true;
        clearInterval(timer);
      };
    },
    [enabled, sessionId]
  );
  return live;
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

function PortableButton() {
  return h(
    "button",
    {
      type: "button",
      className: "dtk-portable-btn",
      title: "打开便携会话",
      onClick: openPortableSession,
    },
    "便携"
  );
}

function LiveSpeed(props) {
  if (typeof props.useChat !== "function") return null;
  // The composer slot stays mounted while a session is open, so the completion
  // watcher rides along with it instead of needing a seat of its own.
  return h(
    React.Fragment,
    null,
    h(NotificationHost, { sessions: sessionsService, notify: notifyCompletion, t: props.t }),
    h(LiveSpeedBody, props)
  );
}

function LiveSpeedBody(props) {
  var cfg = useConfig();
  var t = typeof props.t === "function" ? props.t : fallbackT;
  var useChat = props.useChat;
  var key = useChat(liveKey);
  var chars = useChat(liveChars);
  var estimate = useChat(liveEstimate);
  var turnKey = key === "" ? "" : (props.sessionId === undefined ? "" : String(props.sessionId) + ":") + String(key).split(":")[0];
  var nowState = useState(Date.now());
  var now = nowState[0];
  var setNow = nowState[1];
  var startedAt = useRef(0);
  var lastSpeed = useRef(0);
  var lastTokenCount = useRef(0);
  var latestCount = useRef(0);
  var completedTokens = useRef(0);
  var lastSeenCount = useRef(0);
  var bucketAt = useRef(0);
  var bucketCount = useRef(0);
  var lastTokenSeenAt = useRef(0);
  var samplesRef = useRef([]);
  // One reading per second for the little waveform beside the reading.
  var seriesRef = useRef([]);
  var seriesBucket = useRef(0);
  var wasRunning = useRef(false);
  // When the run row last disappeared. A short gap inside one answer (a tool
  // call, a repaint) must not blank the total the way a finished turn does.
  var stoppedAt = useRef(0);
  var seenTurn = useRef(false);
  useEffect(
    function () {
      if (props.sessionId !== undefined) {
    var nextSessionId = String(props.sessionId);
    if (portablePending && nextSessionId !== portablePreviousId) {
      portablePending = false;
      portableSessionId = nextSessionId;
      console.info("[dsh-goodies] portable session:", nextSessionId);
      enterPortableMode();
      showPortableBar();
    }
    activeSessionId = nextSessionId;
  }
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
  // Last turn this HUD had a key for. The store drops the key between two
  // steps, and the reading must survive that gap.
  var lastTurnKey = useRef("");

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
      var timer = setInterval(check, 120);
      return function () {
        clearInterval(timer);
      };
    },
    [cfg.liveSpeed]
  );

  useEffect(
    function () {
      if (!running) {
        stoppedAt.current = Date.now();
        lastSpeed.current = 0;
        lastTokenCount.current = 0;
        lastTokenSeenAt.current = 0;
        samplesRef.current.length = 0;
        seriesRef.current.length = 0;
    bucketAt.current = 0;
    bucketCount.current = 0;
    completedTokens.current = 0;
    lastSeenCount.current = 0;
        seriesBucket.current = 0;
        wasRunning.current = false;
        setDisplay(0);
        return;
      }
      if (!cfg.liveSpeed) {
        setDisplay(0);
        return;
      }
      // A fresh run starts from nothing. The gap between two turns can be too
      // short for the row to disappear, so the transition is tracked here as
      // well; without it the previous total sat on screen until text arrived.
      if (!wasRunning.current) {
        wasRunning.current = true;
        // A new answer after a real pause starts from nothing; a gap of a few
        // hundred milliseconds is the same run and keeps its numbers.
        if (Date.now() - stoppedAt.current > 1500) {
          startedAt.current = 0;
          seenTurn.current = false;
        }
      }
      if (turnKey !== "") {
        seenTurn.current = true;
        if (startedAt.current === 0) {
          startedAt.current = liveTurnStart.get(turnKey) || Date.now();
          liveTurnStart.set(turnKey, startedAt.current);
        }
      }
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
      }, 80);
      return function () {
        clearInterval(timer);
      };
    },
    [running, cfg.liveSpeed]
  );

  // Two sources, both about the text this turn is generating: the host's
  // count of the chunks as they arrive, and this step's own partial text used
  // until the first chunk lands. The prompt and cache are never involved, and
  // neither is the rendered page — it still shows the previous answer.
  // Nothing here counts until this turn has an answer of its own. Right after
  // sending, the host may already be counting another call on the session — a
  // title draft, say — and those numbers looked like a phantom reply.
  // Counting starts only once this turn has a step of its own. Before that the
  // host may already be counting a side call on the session (a title draft),
  // and those numbers looked like a phantom reply ahead of the real one.
  var gateKey = (typeof window !== "undefined" && window.__dtkTestTurn) || turnKey;
  // Between two steps the key is briefly empty. That gap must not look like a
  // fresh turn, or the total would fall back to zero in the middle of a run.
  if (gateKey !== "") seenTurn.current = true;
  var remote = useRemoteLive(props.sessionId, gateKey, running && cfg.liveSpeed);
  if (remote.startedAt > 0 && startedAt.current === 0) startedAt.current = remote.startedAt;
  // The host count is authoritative once the channel answers: it starts at
  // zero and only moves on real chunks. The partial text is the fallback for a
  // host without the channel, where the store's numbers are all there is.
  var tokens = remote.ok === false ? estimate : remote.tokens;

  useEffect(
    function () {
      if (!running || !cfg.liveSpeed) return;
      var count = Math.round(tokens);
  if (count < lastSeenCount.current) {
    completedTokens.current += lastSeenCount.current;
  }
  lastSeenCount.current = count;
  latestCount.current = completedTokens.current + count;
      if (count <= 0) return;
      var nowMs = now;
      // A short rolling window over the real deltas: it follows the stream the
      // way it actually arrives instead of settling into a steady average.
      var samples = samplesRef.current;
      if (lastTokenCount.current !== 0 && count < lastTokenCount.current) {
        samples.length = 0;
        lastSpeed.current = 0;
        setDisplay(0);
      }
      var grew = count > lastTokenCount.current;
      lastTokenCount.current = count;
      // Keep only the moments the count moved: a window full of identical
      // readings would otherwise hide the resume after a tool call.
      if (grew || samples.length === 0) samples.push({ at: nowMs, count: count });
      while (samples.length > 1 && nowMs - samples[0].at > 1200) samples.shift();
      var first = samples[0];
      var span = nowMs - first.at;
      // Only real growth counts as activity: during a tool call the count stands
      // still, and refreshing the stamp there kept the last speed on screen
      // instead of letting the reading fall to zero.
      if (grew) lastTokenSeenAt.current = nowMs;
      if (span >= 120 && count > first.count) {
        var next = (count - first.count) / (span / 1000);
        lastSpeed.current = next;
        setDisplay(next);
      }
      if (lastTokenSeenAt.current > 0 && nowMs - lastTokenSeenAt.current > 900) {
        lastSpeed.current = 0;
        setDisplay(0);
      }
    },
    [running, now, tokens, cfg.liveSpeed]
  );

  // One bar per second: the reading is bucketed so a quick stream still draws a
  // readable shape, and the series is kept for the report that opens later.
  useEffect(
    function () {
      if (!running || !cfg.liveSpeed) return;
      var bucket = Math.floor(now / 1000);
      if (bucket === seriesBucket.current) return;
      seriesBucket.current = bucket;
      var series = seriesRef.current;
      // Back to the instantaneous reading: the interval average depended on a
      // token counter that resets per step, which swallowed whole segments.
      var countNow = latestCount.current;
      if (bucketAt.current === 0) {
        bucketAt.current = now;
        bucketCount.current = countNow;
        return;
      }
      var elapsed = (now - bucketAt.current) / 1000;
      var delta = countNow - bucketCount.current;
      bucketAt.current = now;
      bucketCount.current = countNow;
      var bucketSpeed = delta > 0 && elapsed > 0 ? delta / elapsed : 0;
      if (bucketSpeed > 400) bucketSpeed = 400;
      series.push(bucketSpeed);

      while (series.length > 60) series.shift();
      if (key !== "") {
        var id = props.sessionId === undefined ? "" : String(props.sessionId);
        var ledgerKey = shared.turnLedgerKey(id, key.split(":")[0]);
        liveTurnSeries.set(ledgerKey, series.slice());
    try {
      var storedSeries = JSON.parse(window.localStorage.getItem("dtk-goodies/series") || "{}");
      storedSeries[ledgerKey] = series.slice();
      var seriesKeys = Object.keys(storedSeries);
      while (seriesKeys.length > 30) {
        delete storedSeries[seriesKeys[0]];
        seriesKeys.shift();
      }
      window.localStorage.setItem("dtk-goodies/series", JSON.stringify(storedSeries));
    } catch (error) {
      // Storage can be unavailable; the in-memory samples still work.
    }
        if (liveTurnSeries.size > 200) {
          var oldestSeries = liveTurnSeries.keys().next().value;
          if (oldestSeries !== undefined) liveTurnSeries.delete(oldestSeries);
        }
      }
    },
    [running, now, display, cfg.liveSpeed, key, props.sessionId]
  );

  // The reading is read from the per-turn ledger while rendering, so a switch
  // of session or turn can never show the previous one for even a frame.
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
  // Until this turn has a step of its own there is nothing to report, so the
  // reading is empty rather than the previous turn's last value.
  if (gateKey !== "") lastTurnKey.current = shared.turnLedgerKey(props.sessionId, gateKey);
  // Read straight from the turn ledger: a switch of session or turn shows
  // the new one numbers, never the previous one.
  var shownTotal = seenTurn.current ? Math.min(liveTurnTokens(lastTurnKey.current), 10000000) : 0;
  var totalElapsed = startedAt.current > 0 ? now - startedAt.current : 0;

  var speedText = shared.formatSpeed(speed);
  var totalText = shared.formatTokens(shownTotal) || "";
  var series = seriesRef.current;
  var seriesMax = 1;
  var slots = 15;
  var padded = [];
  var padCount = Math.max(0, slots - series.length);
  for (var padIndex = 0; padIndex < padCount; padIndex += 1) padded.push(0);
  for (var seriesIndex = 0; seriesIndex < series.length; seriesIndex += 1) {
    var reading = series[seriesIndex];
    padded.push(reading);
    if (reading > seriesMax) seriesMax = reading;
  }
  // The newest reading enters on the left and drifts right as the seconds pass.
  // Both readings grow leftwards into the wave: every character they gain is one
  // cell the wave gives up, so the row keeps its width and the star never moves.
  var slots = 20;
  var extra = Math.max(0, speedText.length - 1) + Math.max(0, totalText.length - 1);
  var newestFirst = series.slice().reverse().slice(0, 20);
  var visible = newestFirst.slice();
  while (visible.length < slots) visible.push(0);
  var bars = cfg.hudWave === false ? null : h(
    "span",
    {
      className: "dtk-live-wave dtk-live-wave2",
      "aria-hidden": "true",
      style: { flex: "1 1 0px", minWidth: "0px", maxWidth: "78px" },
    },
    visible.map(function (value, index) {
      var height = value > 0 ? Math.max(2, Math.round((value / seriesMax) * 14)) : 2;
      var classes = "dtk-live-bar" + (value > 0 ? "" : " is-empty") + (index === 0 ? " is-last" : "");
      return h("span", {
        key: String(index),
        className: classes,
        style: {
          height: height + "px",
          transition: "height .3s cubic-bezier(.2,.8,.3,1), opacity .3s ease",
        },
      });
    })
  );
  var pill = h(
    "span",
    {
      className: "dtk-live" + (cfg.hudMotion === false ? "" : " dtk-live-motion"),
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
    bars,
    h(
      "span",
      { className: "dtk-live-metric is-now" },
      h("span", { className: "dtk-live-value" }, speedText),
      h("span", { className: "dtk-live-unit" }, "tok/s")
    ),
    h("span", { className: "dtk-live-dot-sep", "aria-hidden": "true" }, "·"),
    h(
      "span",
      { className: "dtk-live-metric is-total" },
      h("span", { className: "dtk-live-value" }, totalText),
      h("span", { className: "dtk-live-unit" }, "tokens")
    )
  );
  return target === null ? null : createPortal(pill, target);
}

// ---------------------------------------------------------------------------
// Per-turn report
// ---------------------------------------------------------------------------

/**
 * The order the figures give way in when the footer runs out of room.
 * Cached first, then the input count, then the output count: after that only the
 * native usage pill is left. Then the turn duration, and finally the speed, so
 * the row ends up holding nothing but what DSH itself draws.
 */
// The usage figures describe one block: they leave together, never one by one.
var REPORT_USAGE_GROUP = ["in", "out", "cache"];
// Every figure keeps its place: when the row is tight the blocks share the width
  // evenly instead of hiding one by one, and the pill stays clickable.
var REPORT_DROP_ORDER = [];

/**
 * Hide figures until this turn's footer fits the room it has been given.
 *
 * The room is not a function of the window: the sidebar can be dragged, the
 * session title changes and the clock grows. So the fit runs on the drawn row
 * and is repeated whenever that row changes width, which is what makes the
 * figures go away one by one while the sidebar is being dragged.
 * @param {Element} row - the footer row of one finished turn.
 */
var lastFitAt = 0;
var pendingFitRow = null;
var pendingFitTimer = null;
function fitTurnReport(row) {
  if (row === null || row === undefined) return;
  // Coalesce bursts: a skipped call is replayed once, never dropped, or the row
  // would stay unmeasured and nothing would give way.
  var fitNow = Date.now();
  if (fitNow - lastFitAt < 120) {
    pendingFitRow = row;
    if (pendingFitTimer === null) {
      pendingFitTimer = setTimeout(function () {
        pendingFitTimer = null;
        var next = pendingFitRow;
        pendingFitRow = null;
        if (next !== null) fitTurnReport(next);
      }, 120 - (fitNow - lastFitAt) + 1);
    }
    return;
  }
  lastFitAt = fitNow;
  runFit(row);
}
function runFit(row) {
  if (row === null || row === undefined) return;
  var reports = row.querySelectorAll("[data-goodies-turn-report]");
  var parts = row.querySelectorAll("[data-goodies-turn-report] [data-dtk-part]");
  var seps = row.querySelectorAll("[data-goodies-turn-report] [data-dtk-sep-for]");
  if (parts.length === 0) return;
  var index;
  var slotOf = function (report) {
    var parent = report.parentElement;
    return parent !== null && parent.hasAttribute("data-dtk-slot") ? parent : null;
  };
  for (index = 0; index < reports.length; index += 1) {
    reports[index].style.display = "";
    var slot = slotOf(reports[index]);
    if (slot !== null) slot.style.display = "";
  }
  for (index = 0; index < parts.length; index += 1) parts[index].style.display = "";
  for (index = 0; index < seps.length; index += 1) seps[index].style.display = "";
  // The row itself shrinks to fit, so it never reports an overflow; a report
  // whose content is wider than its own box is the one being cut, and that is
  // what has to be relieved. Two pixels absorb sub-pixel rounding.
  var crowded = function () {
    var drawn = row.querySelectorAll("[data-goodies-turn-report]");
    for (var reportIndex = 0; reportIndex < drawn.length; reportIndex += 1) {
      var report = drawn[reportIndex];
      if (report.style.display === "none") continue;
      // The hover pill overhangs the text by design; measure without it.
      report.classList.add("dtk-measuring");
      var scroll = report.scrollWidth;
      var client = report.clientWidth;
      report.classList.remove("dtk-measuring");
      if (scroll > client + 2) return true;
    }
    return false;
  };
  // A report with nothing left in it is put away together with its slot: an
  // empty slot still costs the row's gap on both sides, which pushed the usage
  // pill and the clock apart for no reason.
  var restartEntrance = function (report) {
    var motion = report.getAttribute("data-dtk-motion");
    if (motion !== "on" || typeof report.classList === "undefined") return;
    report.classList.remove("dtk-enter");
    // A forced reflow makes the animation start again on the next frame.
    void report.offsetWidth;
    report.classList.add("dtk-enter");
  };
  var tidy = function () {
    var drawn = row.querySelectorAll("[data-goodies-turn-report]");
    for (var reportIndex = 0; reportIndex < drawn.length; reportIndex += 1) {
      var report = drawn[reportIndex];
      var figures = report.querySelectorAll("[data-dtk-part]");
      var alive = false;
      for (var figureIndex = 0; figureIndex < figures.length; figureIndex += 1) {
        if (figures[figureIndex].style.display !== "none") alive = true;
      }
      var wasHidden = report.style.display === "none";
      report.style.display = alive ? "" : "none";
      if (alive && wasHidden) restartEntrance(report);
      var reportSlot = slotOf(report);
      if (reportSlot !== null) reportSlot.style.display = alive ? "" : "none";
    }
  };
  var overflowing = crowded();
  for (index = 0; index < REPORT_DROP_ORDER.length && overflowing; index += 1) {
    var key = REPORT_DROP_ORDER[index];
    var part = row.querySelector('[data-goodies-turn-report] [data-dtk-part="' + key + '"]');
    if (part === null) continue;
    // The usage figures give way last, but they do give way: a very narrow row
    // should still show what it can instead of clipping the block.
    var sep = row.querySelector('[data-goodies-turn-report] [data-dtk-sep-for="' + key + '"]');
    part.style.display = "none";
    if (sep !== null) sep.style.display = "none";
    tidy();
    overflowing = crowded();
  }
  tidy();
  // A dot only makes sense between two figures that are both still there.
  var shown = row.querySelectorAll("[data-goodies-turn-report]");
  for (var shownIndex = 0; shownIndex < shown.length; shownIndex += 1) {
    var kids = shown[shownIndex].children;
    var shownBefore = false;
    var child;
    for (child = 0; child < kids.length; child += 1) {
      var kid = kids[child];
      if (kid.hasAttribute("data-dtk-part")) {
        if (kid.style.display !== "none") shownBefore = true;
      } else if (!shownBefore) {
        kid.style.display = "none";
      }
    }
    var shownAfter = false;
    for (child = kids.length - 1; child >= 0; child -= 1) {
      var tail = kids[child];
      if (tail.hasAttribute("data-dtk-part")) {
        if (tail.style.display !== "none") shownAfter = true;
      } else if (!shownAfter) {
        tail.style.display = "none";
      }
    }
  }
  // Putting the empty slots away frees room the first pass could not use; the
  // remaining figures get another chance to fit, never a figure back.
  while (crowded() && index < REPORT_DROP_ORDER.length) {
    var nextKey = REPORT_DROP_ORDER[index];
    index += 1;
    var nextPart = row.querySelector('[data-goodies-turn-report] [data-dtk-part="' + nextKey + '"]');
    if (nextPart === null) continue;
    var nextSep = row.querySelector('[data-goodies-turn-report] [data-dtk-sep-for="' + nextKey + '"]');
    nextPart.style.display = "none";
    if (nextSep !== null) nextSep.style.display = "none";
    tidy();
  }
}

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
  // Every mounted turn tail renders on every store update while a reply
  // streams; walking the whole node list per tail per update is the cost.
  var derived = useMemo(
    function () {
      return shared.readTurnUsage(nodes, turn);
    },
    [nodes, turn]
  );
  // A resize makes DSH re-render the footer, which can drop the slots we put
  // there; bumping this re-attaches them once the layout settles.
  var slotEpochState = useState(0);
  var slotEpoch = slotEpochState[0];
  var bumpSlotEpoch = slotEpochState[1];
  var slotRetry = useRef(0);
  useEffect(
    function () {
      var timer = null;
      var onResize = function () {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(function () {
          timer = null;
          bumpSlotEpoch(function (value) { return value + 1; });
        }, 180);
      };
      window.addEventListener("resize", onResize);
      return function () {
        window.removeEventListener("resize", onResize);
        if (timer !== null) clearTimeout(timer);
      };
    },
    []
  );

  // The host nodes are created once and moved between footers, so a rebuilt
  // tail never unmounts the report.
  var usageHostRef = useRef(null);
  var timeHostRef = useRef(null);
  var hostFor = function (name, ref) {
    if (ref.current === null) {
      var node = document.createElement("span");
      node.className = "dtk-slot";
      node.setAttribute("data-dtk-slot", name);
      ref.current = node;
    }
    return ref.current;
  };
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-dtk-send-motion", cfg.sendMotion === false ? "off" : "on");
  }
  latestRowMotion = cfg.reportMotion !== false;
  installRowHoverMotion();
  var usageHost = hostFor("usage", usageHostRef);
  var timeHost = hostFor("time", timeHostRef);
  // Clicks on the padded edge of the pill used to land on the slot itself,
  // where no figure handler existed: the card closed and nothing reopened.
  // A report figure opens a small card: the speed curve, or the time split.
  var popoverState = useState(null);
  // Mirrors the state for click bursts: two clicks can arrive before React
  // re-renders, and both would otherwise think the card is still closed.
  var popoverRef = useRef(null);
  var popover = popoverState[0];
  var setPopover = popoverState[1];
  // The hover pill is painted in a fixed layer: the figure box clips its own
  // content, so a background inside it would be cut at the text.
  var haloState = useState(null);
  var halo = haloState[0];
  var setHalo = haloState[1];
  // Bumped when a late host fetch fills in the turn's stats.
  var statsEpochState = useState(0);
  var statsEpoch = statsEpochState[0];
  var bumpStatsEpoch = statsEpochState[1];
  void statsEpoch;
  var haloNode = null;
  // The deferred paint must not bring the pill back after the pointer has left.
  var haloInside = false;
  var haloRetimers = [];
  var repositionHalo = function () {
    if (!haloInside || haloNode === null || !haloNode.isConnected) return;
    var rect = haloNode.getBoundingClientRect();
    var leading = haloNode.getAttribute && haloNode.getAttribute("data-dtk-part") === "speed" ? 3 : 6;
    setHalo({
      left: rect.left - leading,
      top: rect.top - 2,
      width: rect.width + leading + 6,
      height: rect.height + 4,
      pinned: false,
    });
  };
  // The hover pill is CSS on the figure block (see .dtk-pill-hover); keeping
  // the old fixed-layer painters as no-ops avoids two pills at once.
  var showHalo = function () {};
  var hideHalo = function () {};
  // The card rises in through the script, not CSS: a CSS entrance on the panel
  // changed its hit box while it was being positioned.
  

  useLayoutEffect(
    function () {
      if (!cfg.turnReport || turnNumber === null) return;
      var root = document.querySelector('[data-turn-tail="' + turnNumber + '"] [data-clock="end"]');
      if (root === null) return;
      var info = root.querySelector('[class*="_endInfo"]') || root;
      var timeEl = info.querySelector('[class*="_timeEnd"]');
      var usageButton = info.querySelector('[class*="_trigger"]') || info.querySelector('[class*="_root"]');
      try {
        // Sit right after the native usage pill: anywhere later leaves a flex
        // spacer between the pill and our figures, and that gap grows. The
        // trigger is not always a direct child of the row, so follow it wherever
        // it is; when it is missing, take the front seat instead of the back.
        if (usageButton !== null) {
          if (usageHost.previousSibling !== usageButton) usageButton.after(usageHost);
        } else if (info.firstChild !== null && info.firstChild !== usageHost) {
          info.insertBefore(usageHost, info.firstChild);
        } else if (timeEl !== null && usageHost.nextSibling !== timeEl) {
          info.insertBefore(usageHost, timeEl);
        } else if (usageHost.parentElement !== info) {
          info.appendChild(usageHost);
        }
        // Keep our two blocks together: the host may put a flexible spacer
        // between the usage pill and the clock, and sitting across it made the
        // gap look enormous.
        if (usageHost.parentElement !== null) {
          if (usageHost.nextSibling !== timeHost) usageHost.after(timeHost);
        } else if (timeEl !== null) {
          if (timeHost.parentElement !== info || timeHost.nextSibling !== timeEl) info.insertBefore(timeHost, timeEl);
        } else if (timeHost.parentElement !== info) {
          info.appendChild(timeHost);
        }
      } catch (orderError) {
        // A moving tail is fine; the next tick tries again.
      }
      // Neutralise only the flexible spacer, not every child: the figures still
      // need to shrink so the fit pass can see what has to give way.
      // Once per row: getComputedStyle forces a style pass, and this effect runs
      // on every report update, which made the page hitch during a turn.
      if (info.getAttribute("data-dtk-compact") !== "1") {
        info.setAttribute("data-dtk-compact", "1");
        var children = info.children;
        for (var childIndex = 0; childIndex < children.length; childIndex += 1) {
          var child = children[childIndex];
          if (child === usageHost || child === timeHost) continue;
          if (child.hasAttribute && child.hasAttribute("data-dtk-slot")) continue;
          var styles = window.getComputedStyle(child);
          if (styles.flexGrow !== "0" || styles.marginLeft === "auto") {
            child.style.flexGrow = "0";
            child.style.flexBasis = "0";
            child.style.minWidth = "0";
            child.style.marginLeft = "0";
          }
        }
      }
      var bindEmptySlot = function (host, kind) {
        if (host.getAttribute("data-dtk-empty-click") === "1") return;
        host.setAttribute("data-dtk-empty-click", "1");
        host.addEventListener("click", function (event) {
          if (!event.target || !event.target.closest) return;
          if (event.target.closest("[data-dtk-part]")) return;
          var resolved = kind;
          if (kind === "timing") {
            var speedPart = host.querySelector('[data-dtk-part="speed"]');
            if (speedPart !== null) {
              var rect = speedPart.getBoundingClientRect();
              if (event.clientX >= rect.left - 2) resolved = "speed";
            }
          }
          openPopover(resolved, host);
        });
      };
      bindEmptySlot(usageHost, "usage");
      bindEmptySlot(timeHost, "timing");
      if (latestRowMotion) {
        var newest = -1;
        var tails = document.querySelectorAll("[data-turn-tail]");
        for (var tailIndex = 0; tailIndex < tails.length; tailIndex += 1) {
          var value = Number(tails[tailIndex].getAttribute("data-turn-tail"));
          if (value > newest) newest = value;
        }
        var rowNode = document.querySelector('[data-turn-tail="' + turnNumber + '"] [class*="_actions"]');
        var rowKey = String(turnNumber);
        if (rowNode !== null && turnNumber >= newest && !enteredRows.has(rowKey) && typeof rowNode.animate === "function") {
          enteredRows.add(rowKey);
          rowNode.animate(
            [
              { opacity: 0, transform: "translateY(6px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" }
          );
        }
      }
      // The pill covers padding and separators too: a press anywhere inside it
      // opens the slot's card, so the hit area matches the grey box.
      var bindSlot = function (host, kind) {
        if (host.getAttribute("data-dtk-slot-press") === "1") return;
        host.setAttribute("data-dtk-slot-press", "1");
        host.addEventListener("click", function (event) {
          if (!event.target || !event.target.closest) return;
          if (event.target.closest("[data-dtk-part]")) return;
          // Padded clicks and the dot between figures: pick the card by side,
          // so a click on the speed end never falls back to the time card.
          var resolved = kind;
          if (kind === "timing") {
            var speedPart = host.querySelector('[data-dtk-part="speed"]');
            if (speedPart !== null) {
              var speedRect = speedPart.getBoundingClientRect();
              if (event.clientX >= speedRect.left - 2) resolved = "speed";
            }
          }
          openPopover(resolved, host);
        });
      };
      bindSlot(usageHost, "usage");
      bindSlot(timeHost, "timing");
    },
    [cfg.turnReport, report, usage, turnNumber, slotEpoch]
  );

  // Footers come and go with scrolling and re-renders; move the hosts back
  // whenever they are out of the document.
  useEffect(
    function () {
      var timer = setInterval(function () {
        if (!usageHost.isConnected || !timeHost.isConnected) {
          bumpSlotEpoch(function (value) {
            return value + 1;
          });
        }
      }, 600);
      return function () {
        clearInterval(timer);
      };
    },
    []
  );

  useEffect(
    function () {
      if (popover === null && halo !== null && halo.pinned === true) setHalo(null);
    },
    [popover]
  );

  useEffect(
    function () {
      if (halo === null) return undefined;
      var clear = function () {
        setHalo(null);
      };
      window.addEventListener("scroll", clear, true);
      window.addEventListener("resize", clear);
      return function () {
        window.removeEventListener("scroll", clear, true);
        window.removeEventListener("resize", clear);
      };
    },
    [halo]
  );

  useEffect(
    function () {
      if (popover === null) return undefined;
      var onPointerDown = function (event) {
    if (event.target && event.target.closest && event.target.closest("[data-dtk-slot]")) return;
        var card = document.querySelector("[data-goodies-report-pop]");
        if (card !== null && card.contains(event.target)) return;
        var anchor = event.target && event.target.closest ? event.target.closest("[data-dtk-part]") : null;
        if (anchor !== null) return;
        closePopover();
        setHalo(null);
      };
      var onKeyDown = function (event) {
        if (event.key === "Escape") {
          closePopover();
          setHalo(null);
        }
      };
      var onScroll = function () {
        closePopover();
        setHalo(null);
      };
      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("scroll", onScroll, true);
      return function () {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("scroll", onScroll, true);
      };
    },
    [popover]
  );

  if (!cfg.turnReport || turnNumber === null) return null;
  var sessionKey = (props.sessionId === undefined ? "" : String(props.sessionId)) + ":" + String(turnNumber);
  var liveTps = liveTurnSpeeds.has(sessionKey) ? liveTurnSpeeds.get(sessionKey) : null;

  var breakdown = [];
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
  var openUsage = function (node) { openPopover("usage", node); };
  breakdown.push({ key: "in", text: t("report.input", { value: valueText(inputValue) }), open: openUsage });
  breakdown.push({ key: "out", text: t("report.output", { value: valueText(outputValue) }), open: openUsage });
  breakdown.push({
    key: "cache",
    text: hasCache ? t("report.cached", { value: shared.formatTokens(cached) }) : t("report.cachedUnknown"),
    open: openUsage,
  });

  var timing = [];
  if (report && report.ttftMs !== null) {
    timing.push({ key: "ttft", text: t("report.ttft", { value: shared.formatSeconds(report.ttftMs) }) });
  }
  if (report && report.durationMs !== null) {
    timing.push({
      key: "total",
      text: t("report.total", { value: shared.formatSeconds(report.durationMs) }),
      open: function (node) { openPopover("timing", node); },
    });
  }
  // The stream ledger knows exactly when generation started and stopped, so
  // its figure wins over anything derived from the whole-turn bounds.
  // The turn tail seat does not always carry a session id, so the live one is
  // used when it is missing; the ledger is keyed exactly like the HUD does.
  var speedSession = props.sessionId === undefined ? activeSessionId : String(props.sessionId);
  var streamTps = liveDecodeSpeed(speedSession + ":" + String(turnNumber));
  var footerKey = speedSession + ":" + String(turnNumber);
  var footerSamples = liveTurnSeries.get(footerKey);
  if (footerSamples === undefined || footerSamples === null) {
    try {
      var storedFooterSamples = JSON.parse(window.localStorage.getItem("dtk-goodies/series") || "{}")[footerKey];
      if (Array.isArray(storedFooterSamples) && storedFooterSamples.length > 1) {
        liveTurnSeries.set(footerKey, storedFooterSamples);
        footerSamples = storedFooterSamples;
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }
  var footerAverage = null;
  if (footerSamples !== null && footerSamples !== undefined && footerSamples.length > 1) {
    var footerSum = 0;
    var footerCount = 0;
    for (var footerIndex = 0; footerIndex < footerSamples.length; footerIndex += 1) {
      if (footerSamples[footerIndex] > 0) {
        footerSum += footerSamples[footerIndex];
        footerCount += 1;
      }
    }
    if (footerCount > 0) footerAverage = footerSum / footerCount;
  }
  var footerGeneration = report && typeof report.generationMs === "number" ? report.generationMs : 0;
  var footerTokens = report && typeof report.tokens === "number" ? report.tokens : 0;
  if (footerGeneration >= 50 && footerGeneration < 1500 && footerTokens > 0) {
    footerAverage = footerTokens / (footerGeneration / 1000);
  }
  var measuredTps =
    footerAverage !== null
      ? footerAverage
      : report && typeof report.tokens === "number" && report.tokens > 0 && typeof report.generationMs === "number" && report.generationMs > 0
        ? report.tokens / (report.generationMs / 1000)
        : report && report.tps !== null
          ? report.tps
          : report && report.sampledTps !== null
            ? report.sampledTps
            : streamTps;
  var busyTps = report && report.approxTps !== null ? report.approxTps : null;
  var speedTps = measuredTps !== null ? measuredTps : busyTps !== null ? busyTps : liveTps !== null ? liveTps : null;
  var enoughToJudge = outputValue === null || outputValue >= 24;
  if (speedTps !== null && speedTps > 0 && (measuredTps !== null || enoughToJudge)) {
    timing.push({
      key: "speed",
      text: t("report.speed", { value: shared.formatSpeed(speedTps) }),
      open: function (node) { openPopover("speed", node); },
      halo: true,
    });
  }

  // The figures give way when the row runs out of room. The room depends on the
  // session title, the action icons and the clock, so it is measured here rather
  // than guessed from the window: every figure is drawn, then the least useful
  // ones are hidden until the row fits. The order is the one agreed for this:
  // cache, input, output, then the duration, and the speed last.
  // The figures fit the room they are given, and the room changes while the
  // sidebar is dragged, so the row is watched rather than the window.
  useLayoutEffect(
    function () {
      if (!cfg.turnReport || turnNumber === null) return undefined;
      // The card floats above the row; opening it must not re-run the fit pass
      // (a transient width change would hide figures behind the user's click).
      if (popover !== null) return undefined;
      var selector = '[data-turn-tail="' + turnNumber + '"] [data-clock="end"]';
      var row = document.querySelector(selector);
      if (row === null) return undefined;
      fitTurnReport(row);
      // The tail settles a moment after the turn closes (fonts, the clock, the
      // native usage pill); without a second look the first measurement can
      // hide every figure and nothing would bring it back.
      var settle = setTimeout(function () {
        var current = document.querySelector(selector);
        if (current !== null) fitTurnReport(current);
      }, 400);
      var settleLate = setTimeout(function () {
        var current = document.querySelector(selector);
        if (current !== null) fitTurnReport(current);
      }, 1500);
      if (typeof ResizeObserver !== "function") {
        return function () {
          clearTimeout(settle);
          clearTimeout(settleLate);
        };
      }
      var frame = 0;
      var lastWidth = row.clientWidth;
      var observer = new ResizeObserver(function () {
        if (frame !== 0) return;
        frame = requestAnimationFrame(function () {
          frame = 0;
          var current = document.querySelector(selector);
          if (current === null) return;
          if (current.clientWidth === lastWidth) return;
          lastWidth = current.clientWidth;
          fitTurnReport(current);
        });
      });
      observer.observe(row);
      return function () {
        observer.disconnect();
        clearTimeout(settle);
        clearTimeout(settleLate);
        if (frame !== 0) cancelAnimationFrame(frame);
      };
    },
    [cfg.turnReport, slotEpoch, turnNumber, report, usage, popover]
  );

  var seriesKey = speedSession + ":" + String(turnNumber);
  var hostStats = liveTurnStats.has(seriesKey) ? liveTurnStats.get(seriesKey) : null;
  var localSeries = liveTurnSeries.has(seriesKey) ? liveTurnSeries.get(seriesKey) : null;
  if (localSeries === null) {
    try {
      var storedSamples = JSON.parse(window.localStorage.getItem("dtk-goodies/series") || "{}")[seriesKey];
      if (Array.isArray(storedSamples) && storedSamples.length > 1) {
        liveTurnSeries.set(seriesKey, storedSamples);
        localSeries = storedSamples;
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }
  // The live HUD already samples the real speed every second; the card shows
  // those samples instead of inventing a shape from chunk sizes.
  var sampled = liveTurnSeries.get(seriesKey);
  if (sampled === undefined || sampled === null) {
    try {
      var storedSamplesEarly = JSON.parse(window.localStorage.getItem("dtk-goodies/series") || "{}")[seriesKey];
      if (Array.isArray(storedSamplesEarly) && storedSamplesEarly.length > 1) {
        liveTurnSeries.set(seriesKey, storedSamplesEarly);
        sampled = storedSamplesEarly;
      }
    } catch (error) {
      // Ignore storage failures.
    }
  }
  var sampledSeries = sampled !== null && sampled !== undefined && sampled.length > 1 ? sampled.slice() : null;
  var generationMs = report !== null && typeof report.generationMs === "number" ? report.generationMs : 0;
  var outputTokens = report !== null && typeof report.tokens === "number" ? report.tokens : 0;
  var averageTps = null;
  var peakTps = null;
  var speedSeries = null;
  if (sampledSeries !== null) {
    var sampleSum = 0;
    var sampleCount = 0;
    for (var sampleIndex = 0; sampleIndex < sampledSeries.length; sampleIndex += 1) {
      if (sampledSeries[sampleIndex] > 0) {
        sampleSum += sampledSeries[sampleIndex];
        sampleCount += 1;
      }
    }
    speedSeries = sampledSeries.slice();
    // The card average must come from the same samples the footer averages; the
    // fallback below (mean of the plotted series) includes the appended fall.
    averageTps = sampleCount > 0 ? sampleSum / sampleCount : null;
    peakTps = Math.max.apply(null, sampledSeries);
    var realSampleCount = sampledSeries.length;
    var chartSeconds = report !== null && typeof report.durationMs === "number" ? report.durationMs / 1000 : 0;
    // Work on the data, not on the drawing: cut everything after the final
    // peak (including a partial real descent) and append the reversed rise, so
    // the samples themselves form the fall. The fitted curve then has the same
    // shape as the middle peaks without any second bump.
    var lastActive = -1;
    for (var activeIndex = 0; activeIndex < sampledSeries.length; activeIndex += 1) {
      if (sampledSeries[activeIndex] > 0) lastActive = activeIndex;
    }
    if (lastActive >= 0) {
      var active = sampledSeries.slice(0, lastActive + 1);
      // Only the last burst matters for the fall: find the final run of non-zero
      // seconds and its own maximum. Using the global maximum would cut away
      // every earlier peak.
      var runStart = lastActive;
      while (runStart > 0 && active[runStart - 1] > 0) runStart -= 1;
      var peakAt = runStart;
      for (var runIndex = runStart; runIndex <= lastActive; runIndex += 1) {
        if (active[runIndex] >= active[peakAt]) peakAt = runIndex;
      }
      var body = active.slice(0, peakAt + 1);
      // Take the last few seconds before the peak, drop any leading zeros, and
      // mirror what remains. A peak that rose straight from zero still gets a
      // short fall instead of none.
      var riseSlice = body.slice(Math.max(0, peakAt - 4), peakAt + 1);
      while (riseSlice.length > 0 && riseSlice[0] <= 0) riseSlice.shift();
      var fallValues = [];
      if (riseSlice.length >= 2) {
        for (var mirror = riseSlice.length - 2; mirror >= 0; mirror -= 1) {
          fallValues.push(riseSlice[mirror]);
        }
      } else {
        fallValues = [riseSlice[0] * 0.5, 0];
      }
      speedSeries = body.slice();
      realSampleCount = body.length;
      if (fallValues.length > 0 && fallValues[fallValues.length - 1] > 0) fallValues.push(0);
      for (var fallIndex = 0; fallIndex < fallValues.length; fallIndex += 1) {
        speedSeries.push(fallValues[fallIndex]);
      }
    }
  } else if (generationMs > 0 && outputTokens > 0) {
    averageTps = outputTokens / (generationMs / 1000);
    peakTps = averageTps * 1.35;
    speedSeries = [];
    for (var pointIndex = 0; pointIndex < 56; pointIndex += 1) {
      var ratio = pointIndex / 55;
      var shape = ratio < 0.12 ? ratio / 0.12 : ratio > 0.85 ? (1 - ratio) / 0.15 : 1;
      speedSeries.push(Math.max(0, averageTps * Math.max(0, shape) * (1 + 0.06 * Math.sin(pointIndex * 1.3))));
    }
  } else {
    averageTps = speedTps;
    speedSeries = hostStats !== null && hostStats.series.length > 0 ? hostStats.series : localSeries;
    peakTps = speedSeries !== null && speedSeries.length > 0 ? Math.max.apply(null, speedSeries) : null;
  }
  if (averageTps === null && speedSeries !== null && speedSeries.length > 0) {
    var fallbackSum = 0;
    var fallbackCount = 0;
    for (var fallbackIndex = 0; fallbackIndex < speedSeries.length; fallbackIndex += 1) {
      if (speedSeries[fallbackIndex] > 0) {
        fallbackSum += speedSeries[fallbackIndex];
        fallbackCount += 1;
      }
    }
    if (fallbackCount > 0) averageTps = fallbackSum / fallbackCount;
  }
  if (averageTps !== null && (peakTps === null || peakTps < averageTps)) peakTps = averageTps;
  var ensureHostStats = function (key) {
    if (liveTurnStats.has(key) || typeof fetch !== "function") return;
    var session = key.slice(0, key.lastIndexOf(":"));
    if (session === "") return;
    fetch("/dsh-goodies/live?sessionId=" + encodeURIComponent(session), {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (body) {
        var entry = body && body.sessions ? body.sessions[session] : null;
        if (!entry || !(Number(entry.firstAt) > 0)) return;
        liveTurnStats.set(key, {
          series: Array.isArray(entry.series) ? entry.series.slice() : [],
          startedAt: Number(entry.startedAt) || 0,
          firstAt: Number(entry.firstAt) || 0,
          lastAt: Number(entry.lastAt) || 0,
          timed: entry.timed && typeof entry.timed === "object" ? entry.timed : null,
        });
        rememberTurnTimed(key, Number(entry.streamId) || 0, entry);
        bumpStatsEpoch(function (value) {
          return value + 1;
        });
      })
      .catch(function () {});
  };
  var openPopover = function (kind, node) {
    if (popoverCloseTimer !== null) {
      clearTimeout(popoverCloseTimer);
      popoverCloseTimer = null;
    }
    var staleCard = document.querySelector(".dtk-pop");
    if (staleCard !== null) {
      if (typeof staleCard.getAnimations === "function") {
        staleCard.getAnimations().forEach(function (animation) {
          animation.cancel();
        });
      }
      staleCard.removeAttribute("data-dtk-closing");
      staleCard.removeAttribute("data-dtk-animated");
    }
    // Toggle by the pill that owns the click, not by the DOM node: React may
    // replace the span, and a padded-area click has the slot as its anchor.
    var slotOf = function (candidate) {
      return candidate && candidate.closest ? candidate.closest("[data-dtk-slot]") : null;
    };
    var current = popoverRef.current;
    var sameAnchor = current !== null && current.kind === kind && slotOf(current.anchor) !== null && slotOf(current.anchor) === slotOf(node);
    // Any close still animating is stale once another card opens.
    closeSeq.current += 1;
    if (usageHostRef.current) usageHostRef.current.removeAttribute("data-dtk-open");
    if (timeHostRef.current) timeHostRef.current.removeAttribute("data-dtk-open");
    // The usage card belongs to the whole block: frame it, not the figure that
    // happened to be under the pointer.
    var anchor = node;
    if (kind === "usage" && node.closest) {
      var block = node.closest('[data-goodies-turn-report="usage"]');
      if (block !== null) anchor = block;
    }
    if (sameAnchor) {
      closePopover();
      return;
    }
    ensureHostStats(seriesKey);
    var rect = anchor.getBoundingClientRect();
    var slotHost = kind === "usage" ? usageHostRef.current : timeHostRef.current;
    if (slotHost !== null && slotHost !== undefined) {
      var slotRect = slotHost.getBoundingClientRect();
      if (slotRect.width > 0) rect = { left: slotRect.left, right: slotRect.right, top: rect.top, width: slotRect.width };
    }
    var leading = 0;
    // The slot keeps the darker background while its card is open, exactly like
    // the native usage pill: one owner, never two layers.
    if (kind === "usage" || kind === "speed" || kind === "timing") {
      var openHost = kind === "usage" ? usageHostRef.current : timeHostRef.current;
      if (openHost) openHost.setAttribute("data-dtk-open", "1");
    }
    // The card lines up with the hover pill, not with the text under it.
    var opened = { kind: kind, anchor: node, left: rect.left - leading - 2, top: rect.top + 1, right: rect.right };
    popoverRef.current = opened;
    setPopover(opened);
  };
  var closeSeq = useRef(0);
  var closePopover = function () {
    if (popoverCloseTimer !== null) {
      clearTimeout(popoverCloseTimer);
      popoverCloseTimer = null;
    }
    popoverRef.current = null;
    if (usageHostRef.current) usageHostRef.current.removeAttribute("data-dtk-open");
    if (timeHostRef.current) timeHostRef.current.removeAttribute("data-dtk-open");
    var seq = closeSeq.current + 1;
    closeSeq.current = seq;
    var card = document.querySelector(".dtk-pop");
    if (card === null || cfg.popoverMotion === false || typeof card.animate !== "function") {
      setPopover(null);
      return;
    }
    var finish = function () {
      if (closeSeq.current !== seq) return;
      if (card.isConnected) card.remove();
      setPopover(null);
    };
    popoverCloseTimer = setTimeout(finish, 220);
    if (card.getAttribute("data-dtk-closing") === "1") return;
    card.setAttribute("data-dtk-closing", "1");
    var closing = card.animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: "translateY(3px) scale(.99)" },
      ],
      { duration: 130, easing: "ease-in", fill: "forwards" }
    );
    closing.finished
      .then(function () {
        if (closeSeq.current === seq) setPopover(null);
      })
      .catch(function () {
        if (closeSeq.current === seq) setPopover(null);
      });
  };
  // The separator belongs to the figure it introduces: dropping that figure has
  // to drop its dot too, which CSS sibling rules cannot express.
  var withSeparators = function (parts, side) {
    var nodes = [];
    for (var item = 0; item < parts.length; item += 1) {
      if (item > 0) {
        nodes.push(
          h(
            "span",
            {
              key: side + "-sep-" + parts[item].key,
              className: "dtk-report-sep",
              "data-dtk-sep-for": parts[item].key,
              "aria-hidden": "true",
            },
            "·"
          )
        );
      }
      var part = parts[item];
      var opens = typeof part.open === "function" ? part.open : null;
      nodes.push(
        h(
          "span",
          {
            key: side + "-" + part.key,
            className: "dtk-report-part" + (opens !== null ? " is-clickable" : ""),
            "data-dtk-part": part.key,
            role: opens !== null ? "button" : undefined,
            tabIndex: opens !== null ? 0 : undefined,
            title: opens !== null ? t("report.openHint") : undefined,
            onClick: opens !== null ? function (event) {
    event.stopPropagation();
    opens(event.currentTarget);
  } : undefined,
            onKeyDown: opens !== null ? function (event) {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                opens(event.currentTarget);
              }
            } : undefined,
            onMouseEnter: part.halo === true ? showHalo : undefined,
            onMouseLeave: part.halo === true ? hideHalo : undefined,
          },
          part.text
        )
      );
    }
    return nodes;
  };

  var popoverNode = null;
  if (popover !== null && typeof document !== "undefined") {
    var cardWidth = 238;
    var cardLeft = Math.min(Math.max(8, popover.left), Math.max(8, window.innerWidth - cardWidth - 8));
    var cardStyle = {
      left: cardLeft + "px",
      bottom: Math.max(8, window.innerHeight - popover.top + 12) + "px",
      width: cardWidth + "px",
    };
    var card = [];
    if (popover.kind === "speed") {
      card.push(h("div", { key: "title", className: "dtk-pop-title" }, t("report.speedTitle")));
      card.push(
        h(
          "div",
          { key: "peak", className: "dtk-pop-row" },
          h("span", null, t("report.peak")),
          h("b", null, peakTps === null ? "—" : t("report.speed", { value: shared.formatSpeed(peakTps) }))
        )
      );
      card.push(
        h(
          "div",
          { key: "avg", className: "dtk-pop-row" },
          h("span", null, t("report.average")),
          h("b", null, averageTps === null ? "—" : t("report.speed", { value: shared.formatSpeed(averageTps) }))
        )
      );
      // Idle seconds stay in the curve as flat gaps: they are where the tools
      // and the waiting happened, which is the point of a timeline.
      var curveSeries = speedSeries;
      if (curveSeries !== null && curveSeries.length > 0) {
        var curveMax = 1;
        for (var curveIndex = 0; curveIndex < curveSeries.length; curveIndex += 1) {
          if (curveSeries[curveIndex] > curveMax) curveMax = curveSeries[curveIndex];
        }
        card.push(h("div", { key: "caption", className: "dtk-pop-caption" }, t("report.perSecond")));
        card.push(
          h(
            "div",
            { key: "curve", className: "dtk-pop-curve" },
            h(
              "svg",
              { viewBox: "0 0 100 32", preserveAspectRatio: "none", width: "100%", height: "32", role: "img" },
              h("path", {
                d:           (function () {
            // One evenly spaced sample list; the decay is already in the data.
            // Dense resample first: with only a handful of seconds, smoothing the
            // sparse list would round the fall away.
            var values = curveSeries.slice();
            for (var pass = 0; pass < 1; pass += 1) {
              var smoothedValues = values.slice();
              for (var index = 1; index < values.length - 1; index += 1) {
                smoothedValues[index] = values[index - 1] * 0.2 + values[index] * 0.6 + values[index + 1] * 0.2;
              }
              values = smoothedValues;
            }
            // The axis is time: one sample is one second. The fall therefore
            // occupies the width of a single second, however long the turn is.
            var bodyCount =
              typeof realSampleCount === "number" && realSampleCount > 0 && realSampleCount <= values.length
                ? realSampleCount
                : values.length;
            var tailCount = values.length - bodyCount;
            var axisSeconds = chartSeconds > 1 ? chartSeconds : bodyCount;
            var tailWidth = axisSeconds > 1 ? 99 / (axisSeconds - 1) : 99;
            if (tailCount > 0) tailWidth = (99 * tailCount) / (bodyCount + tailCount);
            var tailStartX = tailCount > 0 ? 99 - tailWidth : 99;
            var points = [];
            for (var pointIndex = 0; pointIndex < values.length; pointIndex += 1) {
              var x;
              if (pointIndex < bodyCount) {
                x = bodyCount > 1 ? (pointIndex / (bodyCount - 1)) * tailStartX : 0;
              } else {
                var tailSlot = pointIndex - bodyCount + 1;
                x = tailStartX + (tailSlot / tailCount) * tailWidth;
              }
              var plotted = 29 - (values[pointIndex] / curveMax) * 25;
              points.push([x, plotted > 29 ? 29 : plotted]);
            }
            var slopes = [];
            for (var segIndex = 0; segIndex < points.length - 1; segIndex += 1) {
              slopes.push((points[segIndex + 1][1] - points[segIndex][1]) / (points[segIndex + 1][0] - points[segIndex][0]));
            }
            var tangents = [];
            for (var tangentIndex = 0; tangentIndex < points.length; tangentIndex += 1) {
              if (tangentIndex === 0) tangents.push(slopes[0]);
              else if (tangentIndex === points.length - 1) tangents.push(slopes[slopes.length - 1]);
              else {
                var before = slopes[tangentIndex - 1];
                var after = slopes[tangentIndex];
                if (before * after <= 0) tangents.push(0);
                else {
                  var tangent = (before + after) / 2;
                  var limit = 3 * Math.min(Math.abs(before), Math.abs(after));
                  if (Math.abs(tangent) > limit) tangent = (tangent > 0 ? 1 : -1) * limit;
                  tangents.push(tangent);
                }
              }
            }
            var d = "M" + points[0][0].toFixed(2) + " " + points[0][1].toFixed(2);
            for (var seg = 0; seg < points.length - 1; seg += 1) {
              var x1 = points[seg][0];
              var y1 = points[seg][1];
              var x2 = points[seg + 1][0];
              var y2 = points[seg + 1][1];
              var span = x2 - x1;
              var c1x = x1 + span / 3;
              var c1y = y1 + (tangents[seg] * span) / 3;
              var c2x = x2 - span / 3;
              var c2y = y2 - (tangents[seg + 1] * span) / 3;
              d += " C" + c1x.toFixed(2) + " " + c1y.toFixed(2) + " " + c2x.toFixed(2) + " " + c2y.toFixed(2) + " " + x2.toFixed(2) + " " + y2.toFixed(2);
            }
            return d;
          })(),
                fill: "none",
                stroke: "#2563eb",
                strokeWidth: 1.5,
                strokeLinejoin: "round",
                strokeLinecap: "round",
                vectorEffect: "non-scaling-stroke",
              })
            )
          )
        );
      } else {
        card.push(h("div", { key: "hint", className: "dtk-pop-hint" }, t("report.noSeries")));
      }
    } else {
      var totalMs = report !== null && report.durationMs !== null ? report.durationMs : 0;
      var thinkingMs = report !== null && report.thinkingMs ? report.thinkingMs : 0;
      var toolMs = report !== null && report.toolMs ? report.toolMs : 0;
      var generationMs = report !== null && report.generationMs ? report.generationMs : 0;
      // Turns recorded without a first-token stamp cannot be split between
      // waiting and writing; the part that is not tools is still writing.
      if (totalMs > 0 && thinkingMs === 0 && hostStats !== null && hostStats.startedAt > 0 && hostStats.firstAt > 0) {
        // The host knows exactly when the first token arrived; the node timing
        // often does not, which left the whole turn looking like writing.
        thinkingMs = Math.min(totalMs, Math.max(0, hostStats.firstAt - hostStats.startedAt));
        var hostGeneration = Math.max(0, (hostStats.lastAt || hostStats.firstAt) - hostStats.firstAt);
        generationMs = Math.min(hostGeneration, Math.max(0, totalMs - thinkingMs));
      }
      if (totalMs > 0 && thinkingMs === 0 && generationMs === 0) {
        generationMs = Math.max(0, totalMs - toolMs);
      }
      // Recompute the remainder from the values actually drawn: the node's own
      // split can disagree with the host's first-token time.
      var otherMs = report !== null && report.otherMs ? report.otherMs : 0;
      if (totalMs > 0) {
        otherMs = Math.max(0, totalMs - thinkingMs - toolMs - generationMs);
      }
      // Same split as the context plugin: waiting for the first token, model
      // reasoning, model prose, tool-call arguments, tool execution, overhead.
      var aggregatedTimed = aggregateTurnTimed(seriesKey);
      var timed = hostStats !== null && hostStats.timed ? hostStats.timed : null;
      // First token: only the first model call, from sending to its first chunk.
      var firstHeadMs = report !== null && report.ttftMs !== null ? report.ttftMs : report !== null && report.firstHeadMs ? report.firstHeadMs : 0;
      if (aggregatedTimed !== null && aggregatedTimed.firstHead > 0) firstHeadMs = aggregatedTimed.firstHead;
      // Later calls each wait before speaking; that wait is its own slice.
      var headsMs = report !== null && typeof report.headsMs === "number" ? report.headsMs : 0;
      var modelWaitMs = Math.max(0, headsMs - firstHeadMs);
      if (aggregatedTimed !== null) modelWaitMs = Math.max(0, aggregatedTimed.modelWait - firstHeadMs);
      // Block lengths split what is left of each step: thinking vs writing.
      var toolRunMs = toolMs;
      var toolArgsMs = timed !== null ? timed.toolArgs || 0 : 0;
      var reasoningMs = 0;
      var replyMs = 0;
      var splitChars =
        report !== null && report.hasBlockSplit === true
          ? (report.blockReasoningChars || 0) + (report.blockReplyChars || 0)
          : 0;
      if (splitChars > 0 && totalMs > 0) {
        // Split only the time that is not already a head or a tool call, so the
        // same seconds cannot be counted twice.
        var bodyMs = Math.max(0, totalMs - toolRunMs - modelWaitMs - firstHeadMs);
        reasoningMs = (bodyMs * (report.blockReasoningChars || 0)) / splitChars;
        replyMs = (bodyMs * (report.blockReplyChars || 0)) / splitChars;
      } else {
        var usageTokens = hostStats !== null ? Number(hostStats.usage) || 0 : 0;
        if (replyMs === 0 && usageTokens > 0) replyMs = Math.round((usageTokens / 120) * 1000);
        if (replyMs === 0) replyMs = generationMs;
      }
      var drawnMs = firstHeadMs + reasoningMs + replyMs + toolArgsMs + toolRunMs;
      var otherMs = totalMs > 0 ? Math.max(0, totalMs - drawnMs) : otherMs;
      var phases = [
        { key: "first", label: t("report.waiting"), ms: firstHeadMs, color: "#d7dbe3" },
        { key: "reasoning", label: t("report.reasoning"), ms: reasoningMs, color: "#8ab4ff" },
        { key: "modelWait", label: t("report.modelWait"), ms: modelWaitMs, color: "#b9c6e8" },
        { key: "reply", label: t("report.reply"), ms: replyMs, color: "#2563eb" },
        { key: "toolArgs", label: t("report.toolArgs"), ms: toolArgsMs, color: "#ffd27a" },
        { key: "toolRun", label: t("report.tool"), ms: toolRunMs, color: "#ffb020" },
        { key: "other", label: t("report.other"), ms: otherMs, color: "#e5e7eb" },
      ].filter(function (phase) {
        return phase.ms > 0;
      });
      var phaseBase = 0;
      for (var baseIndex = 0; baseIndex < phases.length; baseIndex += 1) phaseBase += phases[baseIndex].ms;
      if (phaseBase <= 0) phaseBase = 1;      if (phaseBase <= 0) phaseBase = 1;
      card.push(h("div", { key: "title", className: "dtk-pop-title" }, t("report.timeTitle")));
      var toolRows = report !== null && Array.isArray(report.toolBreakdown) ? report.toolBreakdown.slice(0, 4) : [];
      if (phases.length === 0 || totalMs <= 0) {
        card.push(h("div", { key: "hint", className: "dtk-pop-hint" }, t("report.noPhases")));
      } else {
        card.push(
          h(
            "div",
            { key: "bar", className: "dtk-pop-bar" },
            phases.map(function (phase) {
              return h("span", {
                key: phase.key,
                className: "dtk-pop-seg",
                style: { width: (phase.ms / phaseBase) * 100 + "%", background: phase.color },
              });
            })
          )
        );
        card.push(
          h(
            "div",
            { key: "rows", className: "dtk-pop-legend" },
            phases.map(function (phase) {
              return h(
                "div",
                { key: phase.key, className: "dtk-pop-row" },
                h("span", null, h("i", { className: "dtk-pop-dot", style: { background: phase.color } }), phase.label),
                h("b", null, shared.formatSeconds(phase.ms) + " · " + Math.round((phase.ms / phaseBase) * 100) + "%")
              );
            })
          )
        );
        if (toolRows.length > 1) {
          card.push(h("div", { key: "toolDetail", className: "dtk-pop-caption" }, t("report.toolDetail")));
          card.push(
            h(
              "div",
              { key: "toolDetailRows", className: "dtk-pop-legend" },
              toolRows.map(function (item) {
                return h(
                  "div",
                  { key: "tool-" + item.name, className: "dtk-pop-row" },
                  h("span", null, item.name),
                  h("b", null, shared.formatSeconds(item.ms))
                );
              })
            )
          );
        }
      }
    }
    popoverNode = createPortal(
      h(
        "div",
        {
          className: "dtk-pop",
          "data-goodies-report-pop": "",
        ref: function (node) {
          if (node === null || cfg.popoverMotion === false || node.getAttribute("data-dtk-animated") === "1") return;
          node.setAttribute("data-dtk-animated", "1");
          if (typeof node.animate === "function") {
            node.animate(
              [
                { opacity: 0, transform: "translateY(4px) scale(.985)" },
                { opacity: 1, transform: "none" },
              ],
              { duration: 160, easing: "ease-out" }
            );
          }
        },
          style: cardStyle,
          onPointerDown: function (event) {
            event.stopPropagation();
          },
        },
        card
      ),
      document.body
    );
  }

  var haloNode =
    halo !== null && typeof document !== "undefined"
      ? createPortal(
          h("div", {
            className: "dtk-halo",
            "data-goodies-halo": "",
            style: { left: halo.left + "px", top: halo.top + "px", width: halo.width + "px", height: halo.height + "px" },
          }),
          document.body
        )
      : null;

  return h(
    React.Fragment,
    null,
    haloNode,
    popoverNode,
    breakdown.length > 0
      ? createPortal(
          h(
            "span",
            {
              className: "dtk-report dtk-enter",
              "data-goodies-turn-report": "usage",
              "data-dtk-motion": cfg.popoverMotion === false ? "off" : "on",
              "data-turn": String(turnNumber),
              onMouseEnter: showHalo,
              onMouseLeave: hideHalo,
              // The dots and the gaps belong to the same block: a click anywhere
              // in it opens the card, not only on a figure.
              onClick: function (event) {
                if (event.target && event.target.closest && event.target.closest("[data-dtk-part]") !== null) return;
                openPopover("usage", event.currentTarget);
              },
            },
            withSeparators(breakdown, "usage")
          ),
          usageHost
        )
      : null,
    timing.length > 0
      ? createPortal(
          h(
            "span",
            {
              className: "dtk-report dtk-enter",
              "data-goodies-turn-report": "timing",
              "data-dtk-motion": cfg.popoverMotion === false ? "off" : "on",
              "data-turn": String(turnNumber),
            },
            withSeparators(timing, "timing")
          ),
          timeHost
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
  var t = typeof props.t === "function" ? props.t : fallbackT;
  // The run clock lives outside the effect: editing a setting mid-run used to
  // rebuild the effect, restart the timer and lose that run's notice.
  var runStartedAt = useRef(0);

  useEffect(
    function () {
      // Either half alone is enough to watch: the notification can be silenced
      // by the system while the chime still reaches headphones.
      if (!cfg.completionNotify && !cfg.notifySound) return undefined;
      // The session list keeps its own `running` bookkeeping, and a list that
      // never flips it leaves the watcher blind. The running row in the chat is
      // the state the user actually sees, so the run is timed from that.
      var check = function () {
        var running = document.querySelector("[data-chat-running]") !== null;
        if (running) {
          if (runStartedAt.current === 0) runStartedAt.current = Date.now();
          return;
        }
        if (runStartedAt.current === 0) return;
        var elapsed = Date.now() - runStartedAt.current;
        runStartedAt.current = 0;
        if (shared.shouldNotify({ elapsedMs: elapsed, minMs: cfg.notifyMinSeconds * 1000 })) {
          notify(null, t, sessionRow(sessions), elapsed);
        }
      };
      var timer = setInterval(check, 400);
      // A background tab throttles that timer hard, so the DOM changes are
      // watched as well: the run row appearing or leaving is the same signal
      // without waiting for the next tick.
      var observer = null;
      if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(function (records) {
          // The run row coming and going is an element change; streaming text
          // is not, so the hot path costs nothing here.
          if (hasElementMutation(records)) check();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
      check();
      return function () {
        clearInterval(timer);
        if (observer !== null) observer.disconnect();
      };
    },
    [cfg.completionNotify, cfg.notifyMinSeconds, cfg.notifySound, sessions, notify, t]
  );

  return null;
}

/** The row of the session on screen, for the notification's title. */
function sessionRow(sessions) {
  var id = activeSessionId;
  if (!id || !sessions || !sessions.list) return null;
  try {
    var rows = shared.readSessionRows(sessions.list.getSnapshot());
    for (var index = 0; index < rows.length; index += 1) {
      if (String(rows[index][0]) === String(id)) return rows[index][1];
    }
  } catch (error) {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Settings card
// ---------------------------------------------------------------------------

/** How many sessions the notification watcher can see right now. */
function useSessionCounts() {
  var countsState = useState({ total: 0, pageRunning: false });
  var counts = countsState[0];
  var setCounts = countsState[1];
  useEffect(
    function () {
      var total = 0;
      var unsubscribe = null;
      var subscribed = null;
      var measure = function () {
        // Read the service on every tick: it may be injected after this card
        // mounts, and a one-shot read left the count at zero forever.
        var service = sessionsService;
        if (service && service.list && typeof service.list.subscribe === "function") {
          if (subscribed !== service.list) {
            if (unsubscribe !== null) unsubscribe();
            subscribed = service.list;
            unsubscribe = service.list.subscribe(measure);
          }
          try {
            total = shared.readSessionRows(service.list.getSnapshot()).length;
          } catch (error) {
            total = 0;
          }
        }
        var next = {
          total: total,
          pageRunning: document.querySelector("[data-chat-running]") !== null,
        };
        // Same values, same object: the card does not re-render while idle.
        setCounts(function (previous) {
          return previous.total === next.total && previous.pageRunning === next.pageRunning
            ? previous
            : next;
        });
      };
      measure();
      var timer = setInterval(measure, 500);
      return function () {
        clearInterval(timer);
        if (unsubscribe !== null) unsubscribe();
      };
    },
    []
  );
  return counts;
}

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

function SettingsCard(props) {
  var cfg = useConfig();
  var ready = useScopeReady();
  var t = typeof props.t === "function" ? props.t : fallbackT;
  var write = typeof props.write === "function" ? props.write : writeField;
  var permissionStore = useState(permissionState);
  var permission = permissionStore[0];
  var setPermission = permissionStore[1];
  var counts = useSessionCounts();
  var openState = useState(props && (props.defaultOpen === true || props.view === "page"));
  var open = openState[0];
  var setOpen = openState[1];
  // Each feature opens on its own, so the options that belong to it sit together
  // and more of them can be added later without touching the others.
  var sectionsState = useState({});
  var opened = sectionsState[0];
  var setOpened = sectionsState[1];

  function toggleSection(id) {
    setOpened(function (previous) {
      var next = {};
      for (var key in previous) next[key] = previous[key];
      next[id] = !previous[id];
      return next;
    });
  }

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

  // The boolean rows are joined segments (开启/关闭), the same control shape the
  // other two cards use; a switch here would be the odd one out.
  function seg(fieldName) {
    var on = cfg[fieldName] === true;
    return h(
      "div",
      { className: "dtk-seg" },
      h(
        "button",
        {
          type: "button",
          className: "dtk-segBtn" + (on ? " dtk-segOn" : ""),
          "aria-pressed": on,
          onClick: function () {
            write(fieldName, true);
          },
        },
        t("settings.on")
      ),
      h(
        "button",
        {
          type: "button",
          className: "dtk-segBtn" + (on ? "" : " dtk-segOn"),
          "aria-pressed": !on,
          onClick: function () {
            write(fieldName, false);
          },
        },
        t("settings.off")
      )
    );
  }

  function field(label, hint, control) {
    return h(
      "div",
      { className: "dtk-field", key: label },
      h(
        "div",
        { className: "dtk-fieldHead" },
        h("span", { className: "dtk-fieldLabel" }, label),
        h("div", { className: "dtk-inline" }, control)
      ),
      hint === null || hint === undefined ? null : h("p", { className: "dtk-hint" }, hint)
    );
  }

  function stateWord(on) {
    return on ? t("settings.on") : t("settings.off");
  }

  var sections = [
    {
      id: "effort",
      title: t("settings.effortFeature"),
      summary: stateWord(cfg.effortShift === true),
      fields: [field(t("settings.effort"), t("settings.effortDesc"), seg("effortShift"))],
    },
    {
      id: "live",
      title: t("settings.liveFeature"),
      summary: stateWord(cfg.liveSpeed === true),
      fields: [
        field(t("settings.live"), t("settings.liveDesc"), seg("liveSpeed")),
        field(t("settings.hudWave"), t("settings.hudWaveDesc"), seg("hudWave")),
      ],
    },
    {
      id: "report",
      title: t("settings.reportFeature"),
      summary: stateWord(cfg.turnReport === true),
      fields: [field(t("settings.report"), t("settings.reportDesc"), seg("turnReport"))],
    },
    {
      id: "motion",
      title: t("settings.motionFeature"),
      summary: stateWord(cfg.reportMotion !== false),
      fields: [
        field(t("settings.motion"), t("settings.motionDesc"), seg("reportMotion")),
        field(t("settings.cardMotion"), t("settings.cardMotionDesc"), seg("popoverMotion")),
        field(t("settings.hudMotion"), t("settings.hudMotionDesc"), seg("hudMotion")),
        field(t("settings.sendMotion"), t("settings.sendMotionDesc"), seg("sendMotion")),
      ],
    },
    {
      id: "notify",
      title: t("settings.notifyFeature"),
      summary: t("settings.notifySummary", {
        notify: stateWord(cfg.completionNotify === true),
        sound: stateWord(cfg.notifySound === true),
      }),
      fields: [
        field(t("settings.notify"), t("settings.notifyDesc"), seg("completionNotify")),
        field(t("settings.sound"), t("settings.soundDesc"), seg("notifySound")),
        field(
          t("settings.permission"),
          permissionText(t, permission) +
            " · " +
            t("settings.notify.watching", {
              total: String(counts.total),
              page: counts.pageRunning ? t("settings.notify.pageRunning") : t("settings.notify.pageIdle"),
            }),
          h(
            "button",
            {
              type: "button",
              className: "dtk-fieldAction",
              disabled: permission !== "default",
              onClick: requestPermission,
            },
            t("settings.permission.request")
          )
        ),
      ],
    },
  ];

  function chevron(up) {
    return h(
      "svg",
      {
        className: "dtk-chevron" + (up ? " dtk-chevronOpen" : ""),
        width: 14,
        height: 14,
        viewBox: "0 0 16 16",
        fill: "none",
        "aria-hidden": "true",
      },
      h("path", {
        d: "M4 6.5 8 10.5 12 6.5",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      })
    );
  }

  return h(
    "div",
    { className: "dtk-card" + (open ? " dtk-cardOpen" : ""), "data-goodies-card": "" },
    h(
      "button",
      {
        type: "button",
        className: "dtk-header",
        "aria-expanded": open,
        onClick: function () {
          setOpen(!open);
        },
      },
      h(
        "span",
        { className: "dtk-headText" },
        h("span", { className: "dtk-name" }, t("settings.title")),
        h("span", { className: "dtk-description" }, t("settings.subtitle"))
      ),
      chevron(open)
    ),
    open
      ? h(
          "div",
          { className: "dtk-body" },
          sections.map(function (section, index) {
            var isOpen = opened[section.id] === true;
            var last = index === sections.length - 1;
            return h(
              "div",
              { className: "dtk-section" + (last ? " dtk-sectionLast" : ""), key: section.id },
              h(
                "button",
                {
                  type: "button",
                  className: "dtk-sectionHead",
                  "aria-expanded": isOpen,
                  "data-goodies-section": section.id,
                  onClick: function () {
                    toggleSection(section.id);
                  },
                },
                h("span", { className: "dtk-sectionTitle" }, section.title),
                isOpen
                  ? h("span", { className: "dtk-sectionSpacer" })
                  : h("span", { className: "dtk-sectionSummary" }, section.summary),
                chevron(isOpen)
              ),
              isOpen ? h("div", { className: "dtk-sectionBody" }, section.fields) : null
            );
          }),
          h(
            "div",
            { className: "dtk-footer" },
            h("span", { className: "dtk-hint" }, ready ? t("settings.saved") : t("settings.unavailable"))
          )
        )
      : null
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
  try {
    window.__DSH_GOODIES_BUILD__ = "2026-11-12T16:45";
    console.info("[dsh-goodies] build", window.__DSH_GOODIES_BUILD__);
  } catch (error) {
    // A read-only window is fine.
  }
  ctx.effect(installStyles, "dsh-goodies: styles");
  ctx.effect(installFooterWatch, "dsh-goodies: footer watch");

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
      // A composition without the locale service must not throw during apply;
      // the fallback dictionary still renders every label.
      if (!ctx.locale || typeof ctx.locale.register !== "function") return undefined;
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

  if (config.portableWindow === true) {
  ctx.slots.inject("conversation.input.left", function () {
    return ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "dsh-goodies-portable",
        order: 10,
        locale: NAMESPACE,
      },
      PortableButton
    );
  });
  }
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
