/**
 * dsh-goodies — host half.
 *
 * Registers one settings namespace so the four browser features can be turned
 * on and off from the profile. The features themselves run entirely in the
 * browser; this half never touches a model request, a session log, or a tool.
 *
 * @module dsh-goodies
 */
import { createRequire } from "node:module";
import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve the host's own schemastery before falling back to this package's
 * copy. A linked installation otherwise loads a second instance (and possibly
 * a newer dialect) than the running host, which makes the namespace disappear
 * from the settings service.
 * @returns {object} the schemastery export.
 */
function loadSchemastery() {
  const own = dirname(dirname(fileURLToPath(import.meta.url))) + sep;
  const bases = [process.argv[1], fileURLToPath(import.meta.url)];
  for (const base of bases) {
    if (typeof base !== "string" || base === "") continue;
    try {
      const from = createRequire(base);
      if (!from.resolve("@deepseek-ai/schemastery").startsWith(own)) {
        return from("@deepseek-ai/schemastery");
      }
    } catch {
      // Not resolvable from that anchor: try the next one.
    }
  }
  return createRequire(import.meta.url)("@deepseek-ai/schemastery");
}

const z = loadSchemastery();

/**
 * Mark a schema live-editable where the running schemastery knows the modifier.
 * Older hosts simply keep the plain schema; their settings page does not need
 * the marker.
 * @param {object} schema - the object schema.
 * @returns {object} the same schema, marked when supported.
 */
function volatileWhenSupported(schema) {
  return typeof schema.volatile === "function" ? schema.volatile() : schema;
}

/**
 * The durable settings section.
 *
 * Every feature defaults to on except the sound; turning one off leaves the
 * others untouched, and installing the plugin changes nothing about the model
 * request path.
 */
export const Config = volatileWhenSupported(
  z
    .object({
      effortShift: z
        .boolean()
        .default(true)
        .description("Show the reasoning-effort switch in the composer dock"),
      liveSpeed: z
        .boolean()
        .default(true)
        .description("Show an approximate live tokens/second reading while an answer streams"),
      turnReport: z
        .boolean()
        .default(true)
        .description("Show TTFT, wall time and speed at the end of each turn"),
      completionNotify: z
        .boolean()
        .default(false)
        .description("Notify when a turn finishes"),
      notifySound: z
        .boolean()
        .default(false)
        .description("Play a soft chime when a turn finishes, with or without the system notification"),
      notifyMinSeconds: z
        .number()
        .min(0)
        .max(120)
        .default(0)
        .description("Skip notifications for turns shorter than this many seconds"),
    })
    .description("DSH Goodies: small browser-side conveniences for the Web GUI")
);

const NAMESPACE = "dsh-goodies";

/**
 * Register the settings namespace with whichever settings dialect the host
 * speaks. The client half reads the same entry through `configForms`.
 * @param {object} ctx - host plugin context.
 * @param {unknown} config - the entry's composition config.
 */
export function apply(ctx, config) {
  ctx.inject(["settings"], (settingsCtx) => {
    const settings = settingsCtx.settings;
    if (!settings) return;
    if (typeof settings.installSection === "function") {
      settings.installSection(ctx, NAMESPACE, Config, config ?? {}, {
        setSource: () => {},
        onChange: () => {},
      });
      return;
    }
    if (typeof settings.configure === "function") {
      settingsCtx.effect(
        () => settings.configure({ auto: true }, ctx.fiber),
        "dsh-goodies: settings policy"
      );
    }
  });

  installLiveChannel(ctx);
}

/**
 * A per-session counter fed from the model stream itself.
 *
 * The browser only ever sees rendered text, which arrives in even batches and
 * makes any live reading look steady. The host sees the chunks: their size and
 * their arrival time, plus the provider's own usage counters, so the numbers it
 * publishes are the real ones.
 */
function createLiveState() {
  /** @type {Map<string, object>} */
  const sessions = new Map();
  const blank = () => ({
    streamId: 0,
    firstAt: 0,
    chars: 0,
    estimated: 0,
    usage: 0,
    startedAt: 0,
    lastAt: 0,
    active: false,
    /** Tool names already counted, so a repeated frame is not double-counted. */
    tools: new Map(),
  });
  const weight = (text) => {
    let total = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x2e80) total += 1;
      else if (cp > 0x7f) total += 0.6;
      else total += 0.25;
    }
    return total;
  };
  return {
    begin(id) {
      if (id === "") return;
      // One stream is one model call. Starting a fresh segment lets the client
      // add up the calls of a turn instead of reading a session-wide total. The
      // finished segment is kept as `previous` so the client banks the host's
      // final numbers instead of whatever the last poll happened to catch.
      const previous = sessions.get(id) ?? blank();
      const state = blank();
      state.streamId = previous.streamId + 1;
      state.previous = {
        streamId: previous.streamId,
        usage: previous.usage,
        estimated: Math.round(previous.estimated),
      };
      state.startedAt = Date.now();
      state.lastAt = state.startedAt;
      state.active = true;
      sessions.set(id, state);
    },
    fold(id, chunk, now) {
      if (id === "") return;
      const state = sessions.get(id) ?? blank();
      sessions.set(id, state);
      state.active = true;
      if (state.startedAt === 0) state.startedAt = now;
      if (chunk && chunk.type === "usage" && chunk.usage && typeof chunk.usage.outputTokens === "number") {
        state.usage = Math.max(state.usage, Math.round(chunk.usage.outputTokens));
        state.lastAt = now;
        return;
      }
      // Everything the model generates counts: prose, reasoning, and the
      // arguments of a tool call. The tool's own result does not.
      if (chunk && chunk.type === "tool-call-delta") {
        if (typeof chunk.name === "string" && chunk.name.length > 0) {
          const key = String(chunk.id ?? chunk.index ?? "");
          if (!state.tools.has(key)) {
            state.tools.set(key, true);
            state.estimated += weight(chunk.name);
          }
        }
        const args = typeof chunk.argumentsDelta === "string" ? chunk.argumentsDelta : "";
        if (args.length === 0) return;
        state.chars += args.length;
        state.estimated += weight(args);
        state.lastAt = now;
        return;
      }
      const text =
        chunk && (chunk.type === "text-delta" || chunk.type === "reasoning-delta") && typeof chunk.text === "string"
          ? chunk.text
          : "";
      if (text.length === 0) return;
      if (state.firstAt === 0) state.firstAt = now;
      state.chars += text.length;
      state.estimated += weight(text);
      state.lastAt = now;
    },
    end(id) {
      if (id === "") return;
      const state = sessions.get(id);
      if (state) state.active = false;
    },
    snapshot() {
      const out = {};
      for (const [id, state] of sessions) {
        out[id] = {
          streamId: state.streamId,
          chars: state.chars,
          estimated: Math.round(state.estimated),
          usage: state.usage,
          exact: state.usage > 0,
          previous: state.previous ?? null,
          startedAt: state.startedAt,
          firstAt: state.firstAt,
          lastAt: state.lastAt,
          active: state.active,
        };
      }
      return { at: Date.now(), sessions: out };
    },
  };
}

/** Expose the counter over the host's own HTTP surface, trusted origins only. */
function installLiveChannel(ctx) {
  ctx.inject(["connection", "webServer"], (scope) => {
    const connection = scope.connection;
    const webServer = scope.webServer;
    if (!connection || !webServer || typeof webServer.register !== "function") return;
    const live = createLiveState();
    scope.effect(
      () =>
        webServer.register({
          kind: "prefix",
          path: "/dsh-goodies/live",
          handler: (req, res) => {
            const rejection = typeof connection.requestRejection === "function" ? connection.requestRejection(req) : undefined;
            if (rejection !== undefined) {
              res.writeHead(rejection);
              res.end(rejection === 401 ? "unauthorized" : "forbidden");
              return;
            }
            res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
            res.end(JSON.stringify(live.snapshot()));
          },
        }),
      "dsh-goodies: live channel"
    );
    if (typeof ctx.on !== "function") return;
    const off = ctx.on(
      "llm/stream",
      (options, next) => {
        const id = options && options.sessionId !== undefined ? String(options.sessionId) : "";
        return (async function* () {
          try {
            live.begin(id);
          } catch {
            // A counter must never disturb the stream.
          }
          try {
            for await (const chunk of next()) {
              try {
                live.fold(id, chunk, Date.now());
              } catch {
                // Same: the request passes through untouched.
              }
              yield chunk;
            }
          } finally {
            try {
              live.end(id);
            } catch {
              // Ignore.
            }
          }
        })();
      },
      { global: true, prepend: true }
    );
    scope.effect(() => off, "dsh-goodies: stream tap");
  });
}

