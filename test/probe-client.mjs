/**
 * Load the built browser bundle in a bare VM and activate it against a fake
 * client context. This catches a broken factory, a forbidden require, and a
 * registration that throws before a real DSH page is involved.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const source = await readFile(join(ROOT, "lib/client.js"), "utf8");

let factory = null;
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(options) {
        factory = options.factory;
      },
    },
  },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Promise,
  Set,
  Map,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  RegExp,
  Error,
};
vm.runInNewContext(source, sandbox, { filename: "lib/client.js" });
if (typeof factory !== "function") throw new Error("the bundle did not register a factory");

function createElement(type, props) {
  return { type, props: props || {} };
}

const React = {
  createElement,
  useEffect() {},
  useMemo(fn) {
    return fn();
  },
  useRef(value) {
    return { current: value };
  },
  useState(value) {
    return [typeof value === "function" ? value() : value, function () {}];
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    return getSnapshot();
  },
};

const ReactDom = {
  createPortal(element) {
    return element;
  },
};

const module = factory(function (specifier) {
  if (specifier === "react") return React;
  if (specifier === "react-dom") return ReactDom;
  throw new Error(`unexpected require: ${specifier}`);
});

if (typeof module.apply !== "function") throw new Error("the bundle does not export apply");
if (!Array.isArray(module.inject)) throw new Error("the bundle does not export an inject array");

const seats = [];
const registered = [];
const ctx = {
  locale: {
    register() {
      return function () {};
    },
    bind() {
      return function (key) {
        return key;
      };
    },
    getLocale() {
      return { active: "zh" };
    },
  },
  effect(fn) {
    const dispose = fn();
    return typeof dispose === "function" ? dispose : function () {};
  },
  inject(deps, callback) {
    if (deps.includes("configForms")) {
      callback({
        configForms: {
          get() {
            return null;
          },
        },
      });
    }
  },
  get() {
    return undefined;
  },
  slots: {
    inject(seat, callback) {
      seats.push(seat);
      callback();
    },
    register(options, component) {
      registered.push({ options, component });
      return function () {};
    },
  },
  sessions: {
    list: {
      subscribe() {
        return function () {};
      },
      getSnapshot() {
        return { byId: {} };
      },
    },
  },
};

module.apply(ctx);

const expected = [
  "conversation.input.left",
  "conversation.chat.turnTail",
  "plugins.bundle.config",
  "settings.plugin.item",
];
for (const seat of expected) {
  if (!seats.includes(seat)) throw new Error(`apply did not register into ${seat}`);
}
if (registered.length < 4) throw new Error(`expected at least 4 registrations, got ${registered.length}`);
for (const entry of registered) {
  if (typeof entry.options.name !== "string") throw new Error("a registration has no seat name");
}

console.log(`OK client probe: ${registered.length} registrations across ${new Set(seats).size} seats`);
