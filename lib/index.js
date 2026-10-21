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
        .description("Notify when a turn finishes while the page is in the background (paused for now)"),
      notifySound: z
        .boolean()
        .default(false)
        .description("Play a soft chime with a completion notification"),
      notifyMinSeconds: z
        .number()
        .min(0)
        .max(120)
        .default(5)
        .description("Skip notifications for turns shorter than this many seconds"),
      reduceMotion: z
        .boolean()
        .default(false)
        .description("Disable the shift and completion animations while keeping the features"),
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
}
