/**
}
  });
  var perStream = useRef(new Map());
  var turnRef = useRef(turnKey);
  var ledgerTurn = useRef("");
  turnRef.current = turnKey;
  useEffect(
    function () {
      // The key goes empty between two steps. Only a different, non-empty key
      // is a new turn; clearing on the way back would wipe the finished step.
      if (turnKey === "" || ledgerTurn.current === turnKey) return;
      ledgerTurn.current = turnKey;
      perStream.current.clear();
      setLive({ tokens: 0, startedAt: 0, ok: null });
    },
    [turnKey]
  );
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

var shared = require("./shared.cjs");
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
  "settings.permission.hint": "授权后才会弹系统通知，被拒时只闪烁标题",
  "settings.notify.watching": "正在监听 {total} 个会话 · 当前页面{page}",
  "settings.notify.pageRunning": "正在运行",
  "settings.notify.pageIdle": "空闲",
  "settings.effortFeature": "思考强度滑块",
  "settings.liveFeature": "实时读数",
  "settings.reportFeature": "每条回答成绩单",
  "settings.notifyFeature": "完成通知",
  "settings.notifySummary": "通知 {notify} · 提示音 {sound}",
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
  "settings.liveFeature": "Live reading",
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
var remoteSession = null;
var activeSessionId = null;
var liveTurnSpeeds = new Map();
/** Per turn: the highest total shown so far, and when its clock started. */
var liveTurnTotals = new Map();
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

function installStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector('style[data-plugin-css="' + shared.STYLE_ID + '"]') !== null) return;
  var style = document.createElement("style");
  style.dataset.plugin = NAMESPACE;
  style.dataset.pluginCss = shared.STYLE_ID;
  style.textContent = shared.CSS;
  document.head.appendChild(style);
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

function rememberStreamDecode(turnKey, streamId, tokens, spanMs) {
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
  if (spanMs > seen.ms) seen.ms = spanMs;
  table.set(streamId, seen);
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
  var state = useState({ tokens: 0, startedAt: 0, ok: null });
  var live = state[0];
  var setLive = state[1];
  // One host stream is one model call, and a turn is the sum of its calls.
  // Keeping every stream's own maximum and adding them up is order-free: a
  // transition can be missed without losing a step.
  var perStream = useRef(new Map());
  var turnRef = useRef(turnKey);
  var ledgerTurn = useRef("");
  turnRef.current = turnKey;
  useEffect(
    function () {
      // The key goes empty between two steps. Only a different, non-empty key
      // is a new turn; clearing on the way back wiped the finished step.
      if (turnKey === "" || ledgerTurn.current === turnKey) return;
      ledgerTurn.current = turnKey;
      perStream.current.clear();
      setLive({ tokens: 0, startedAt: 0, ok: null });
    },
    [turnKey]
  );
  useEffect(
    function () {
      if (!enabled || typeof fetch !== "function") return undefined;
      var stopped = false;
      var read = function () {
        fetch("/dsh-goodies/live", { credentials: "same-origin", cache: "no-store" })
          .then(function (response) {
            return response.ok ? response.json() : null;
          })
          .then(function (body) {
            if (stopped) return;
            // Nothing counts before this turn has a step of its own.
            if (turnRef.current === "") return;
            if (!body || !body.sessions) {
              setLive({ tokens: 0, startedAt: 0, ok: false });
              return;
            }
            var entry = body.sessions[String(sessionId)];
            if (!entry) return;
            var streamId = Number(entry.streamId) || 0;
            var current =
              Number(entry.usage) > 0 ? Math.round(entry.usage) : Math.round(entry.estimated || 0);
            // Decode time of this stream: from its first delta to the last, so
            // waiting for the first token or for a tool never inflates it.
            var firstAt = Number(entry.firstAt) || 0;
            var lastAt = Number(entry.lastAt) || 0;
            var span = firstAt > 0 && lastAt > firstAt ? lastAt - firstAt : 0;
            rememberStreamDecode(turnRef.current, streamId, current, span);
            var previous = perStream.current.get(streamId) || 0;
            if (current > previous) perStream.current.set(streamId, current);
            var total = 0;
            perStream.current.forEach(function (value) {
              total += value;
            });
            setLive({ tokens: total, startedAt: entry.startedAt || 0, ok: true });
          })
          .catch(function () {
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
  var exact = useChat(liveExact);
  var turnKey = key === "" ? "" : (props.sessionId === undefined ? "" : String(props.sessionId) + ":") + String(key).split(":")[0];
  var nowState = useState(Date.now());
  var now = nowState[0];
  var setNow = nowState[1];
  var startedAt = useRef(0);
  var lastSpeed = useRef(0);
  var lastTokenCount = useRef(0);
  var lastTokenAt = useRef(0);
  var lastTokenSeenAt = useRef(0);
  var samplesRef = useRef([]);
  var turnKeyRef = useRef("");
  var wasRunning = useRef(false);
  var answerBase = useRef(-1);
  var seenTurn = useRef(false);
  var quietTimer = useRef(null);
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
        lastSpeed.current = 0;
        lastTokenCount.current = 0;
        lastTokenAt.current = 0;
        lastTokenSeenAt.current = 0;
        samplesRef.current.length = 0;
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
        startedAt.current = 0;
        // A run without any step of its own within a moment is a new turn,
        // so the old total goes. A short gap inside one turn keeps the ledger,
        // because the step arrives before this fires.
        seenTurn.current = false;
        if (quietTimer.current) clearTimeout(quietTimer.current);
        quietTimer.current = setTimeout(function () {
          if (!seenTurn.current) {
            totalRef.current = 0;
            setTotalTokens(0);
          }
        }, 700);
      }
      // Resume the turn's own clock and total: switching sessions and coming
      // back must not restart the reading from zero. A key only exists once the
      // turn is identified, so nothing is restored before that — otherwise the
      // previous turn's total would open the new one at its last value.
      if (turnKey !== "") {
        // A different turn means a different ledger: the previous total must not
        // carry over even if the HUD never saw the gap between the two runs.
        if (turnKeyRef.current !== "" && turnKeyRef.current !== turnKey) {
          totalRef.current = 0;
          setTotalTokens(0);
        }
        turnKeyRef.current = turnKey;
        if (startedAt.current === 0) {
          startedAt.current = liveTurnStart.get(turnKey) || Date.now();
          liveTurnStart.set(turnKey, startedAt.current);
        }
        var stored = liveTurnTotals.get(turnKey) || 0;
        if (stored > totalRef.current) {
          totalRef.current = stored;
          setTotalTokens(stored);
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

  useEffect(
    function () {
      if (!running) {
        if (turnKeyRef.current !== "") liveTurnTotals.set(turnKeyRef.current, totalRef.current);
        startedAt.current = 0;
        return;
      }
      // This reading counts the text being generated, never the prompt or the
      // cache: those are settled before the first token, and folding them in
      // turned the counter into millions the moment a turn began.
      var candidate = Math.min(Math.round(tokens), 10000000);
      // A new turn restarts the host count at zero. When the count falls far
      // below what is on screen, this is a new turn and not a small wobble,
      // so the ledger starts over instead of holding the old maximum.
      if (candidate < totalRef.current / 2 && totalRef.current - candidate > 20) {
        totalRef.current = 0;
        setTotalTokens(0);
      }
      var next = Math.max(totalRef.current, candidate);
      if (next !== totalRef.current) {
        totalRef.current = next;
        if (turnKeyRef.current !== "") {
          liveTurnTotals.set(turnKeyRef.current, next);
          if (liveTurnTotals.size > 200) {
            var oldestTotal = liveTurnTotals.keys().next().value;
            if (oldestTotal !== undefined) liveTurnTotals.delete(oldestTotal);
          }
        }
        setTotalTokens(next);
      }
    },
    [running, tokens]
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
  // Until this turn has a step of its own there is nothing to report, so the
  // reading is empty rather than the previous turn's last value.
  var shownTotal = seenTurn.current ? Math.max(totalTokens, Math.round(tokens)) : 0;
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
  // The stream ledger knows exactly when generation started and stopped, so
  // its figure wins over anything derived from the whole-turn bounds.
  // The turn tail seat does not always carry a session id, so the live one is
  // used when it is missing; the ledger is keyed exactly like the HUD does.
  var speedSession = props.sessionId === undefined ? activeSessionId : String(props.sessionId);
  var streamTps = liveDecodeSpeed(speedSession + ":" + String(turnNumber));
  var measuredTps =
    streamTps !== null
      ? streamTps
      : report && report.tps !== null
        ? report.tps
        : report && report.sampledTps !== null
          ? report.sampledTps
          : null;
  var busyTps = report && report.approxTps !== null ? report.approxTps : null;
  var speedTps = measuredTps !== null ? measuredTps : busyTps !== null ? busyTps : liveTps !== null ? liveTps : null;
  var enoughToJudge = outputValue === null || outputValue >= 24;
  if (speedTps !== null && speedTps > 0 && (measuredTps !== null || enoughToJudge)) {
    timing.push({ key: "speed", text: t("report.speed", { value: shared.formatSpeed(speedTps) }) });
  }

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
  var t = typeof props.t === "function" ? props.t : fallbackT;

  useEffect(
    function () {
      // Either half alone is enough to watch: the notification can be silenced
      // by the system while the chime still reaches headphones.
      if (!cfg.completionNotify && !cfg.notifySound) return undefined;
      // The session list keeps its own `running` bookkeeping, and a list that
      // never flips it leaves the watcher blind. The running row in the chat is
      // the state the user actually sees, so the run is timed from that.
      var startedAt = 0;
      var check = function () {
        var running = document.querySelector("[data-chat-running]") !== null;
        if (running) {
          if (startedAt === 0) startedAt = Date.now();
          return;
        }
        if (startedAt === 0) return;
        var elapsed = Date.now() - startedAt;
        startedAt = 0;
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
        observer = new MutationObserver(check);
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
      var measure = function () {
        setCounts({ total: total, pageRunning: document.querySelector("[data-chat-running]") !== null });
      };
      var service = sessionsService;
      var unsubscribe = function () {};
      if (service && service.list && typeof service.list.subscribe === "function") {
        var read = function () {
          var rows = [];
          try {
            rows = shared.readSessionRows(service.list.getSnapshot());
          } catch (error) {
            rows = [];
          }
          total = rows.length;
          measure();
        };
        unsubscribe = service.list.subscribe(read);
        read();
      } else {
        measure();
      }
      var timer = setInterval(measure, 500);
      return function () {
        clearInterval(timer);
        unsubscribe();
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
      fields: [field(t("settings.live"), t("settings.liveDesc"), seg("liveSpeed"))],
    },
    {
      id: "report",
      title: t("settings.reportFeature"),
      summary: stateWord(cfg.turnReport === true),
      fields: [field(t("settings.report"), t("settings.reportDesc"), seg("turnReport"))],
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
export function apply(ctx) {
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
