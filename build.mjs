/**
 * dsh-goodies build — zero dependencies, no bundler.
 *
 * The browser half is a lazy-CJS bundle registered with
 * `window.__ModuleLoader__.load({ id, factory })`; its factory may only require
 * modules the shell already holds. This script inlines `src/shared.cjs`,
 * rewrites the relative require, wraps the client body, and copies the host
 * half to `lib/index.js`.
 *
 * Usage: node build.mjs
 *
 * @module dsh-goodies/build
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MODULE_ID = "dsh-goodies";

/** Modules the shell provides to the browser factory. */
const ALLOWED_REQUIRES = ["react", "react/jsx-runtime", "react-dom"];

/** Packages the host half may import from the DSH installation. */
const HOST_IMPORTS = ["@deepseek-ai/schemastery"];

/** Node builtins the host half may import. */
const HOST_BUILTINS = ["node:module", "node:path", "node:url"];

const SHARED_SPECIFIER = "./shared.cjs";

const HEAD = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(MODULE_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
`;

const TAIL = `
\t\treturn module.exports;
\t}
});
`;

/** Normalize one artifact to LF so every checkout builds the same bytes. */
export function toLf(text) {
  return text.replace(/\r\n/g, "\n");
}

/** Replace the one relative require with the inlined shared binding. */
function rewriteSharedRequire(source, binding) {
  const pattern = /require\(\s*["']\.\/shared\.cjs["']\s*\)/g;
  const rewritten = source.replace(pattern, binding);
  if (rewritten.includes(SHARED_SPECIFIER)) {
    throw new Error(`client source mentions ${SHARED_SPECIFIER} outside a require() call`);
  }
  return rewritten;
}

/** Fail the build when the browser bundle could not load in the shell. */
export function verifyClient(body) {
  const required = new Set(
    [...body.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1])
  );
  for (const specifier of required) {
    if (!ALLOWED_REQUIRES.includes(specifier)) {
      throw new Error(
        `the browser bundle requires "${specifier}", which the shell does not provide; ` +
          `allowed: ${ALLOWED_REQUIRES.join(", ")}`
      );
    }
  }
  if (!/\bexports\.apply\s*=/.test(body)) throw new Error("the browser bundle does not export apply");
  if (!/\bexports\.inject\s*=/.test(body)) throw new Error("the browser bundle does not export inject");
  if (/^\s*export\s/m.test(body)) throw new Error("the browser bundle still contains an ESM export");
  if (!body.includes(`id: ${JSON.stringify(MODULE_ID)}`)) {
    throw new Error(`the loader registration does not use the id ${MODULE_ID}`);
  }
}

/** Fail the build when the host half imports a package Node cannot supply. */
export function verifyHost(source) {
  const imports = [...source.matchAll(/^import[\s\S]*?from\s+["']([^"']+)["']/gm)].map(
    (match) => match[1]
  );
  for (const specifier of imports) {
    if (specifier.startsWith(".")) continue;
    if (HOST_BUILTINS.includes(specifier)) continue;
    if (!HOST_IMPORTS.includes(specifier)) {
      throw new Error(
        `the host half imports "${specifier}"; only these resolve from the DSH installation: ` +
          HOST_IMPORTS.join(", ")
      );
    }
  }
  if (!/export\s+const\s+Config\s*=/.test(source)) {
    throw new Error("the host half does not export Config");
  }
  if (!/export\s+function\s+apply\s*\(/.test(source)) {
    throw new Error("the host half does not export apply");
  }
}

/** Render the browser bundle from the current sources. */
export function renderClient(sharedSource, clientSource) {
  const stripped = clientSource.replace(/\bexport function apply\(/, "function apply(");
  if (stripped === clientSource) {
    throw new Error("client source must declare `export function apply(`");
  }
  const rewritten = rewriteSharedRequire(stripped, "__dtkShared");
  const body = [
    HEAD,
    "\t\t// ---- inlined from src/shared.cjs ----\n",
    "var __dtkShared = (function () {\n",
    "\tvar module = { exports: {} };\n",
    "\tvar exports = module.exports;\n",
    sharedSource,
    "\n\treturn module.exports;\n",
    "})();\n",
    "\t\t// ---- src/client.js ----\n",
    rewritten,
    "\nexports.apply = apply;\nexports.inject = inject;\n",
    TAIL,
  ].join("");
  verifyClient(body);
  return body;
}

/** Render every artifact without touching the disk. */
export function renderArtifacts(sources) {
  verifyHost(sources.host);
  return {
    "lib/client.js": toLf(renderClient(sources.shared, sources.client)),
    "lib/shared.cjs": toLf(sources.shared),
    "lib/index.js": toLf(sources.host),
  };
}

/** Read the three sources. */
async function readSources() {
  const [shared, client, host] = await Promise.all([
    readFile(join(ROOT, "src/shared.cjs"), "utf8"),
    readFile(join(ROOT, "src/client.js"), "utf8"),
    readFile(join(ROOT, "src/index.mjs"), "utf8"),
  ]);
  return { shared, client, host };
}

/** Build once. */
async function main() {
  const artifacts = renderArtifacts(await readSources());
  await mkdir(join(ROOT, "lib"), { recursive: true });
  for (const [name, text] of Object.entries(artifacts)) {
    await writeFile(join(ROOT, name), text, "utf8");
    console.log(`wrote ${name} (${Buffer.byteLength(text, "utf8")} B)`);
  }
}

const executedDirectly =
  typeof process.argv[1] === "string" && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}