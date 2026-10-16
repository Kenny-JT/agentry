#!/usr/bin/env node
// gen-panel-tokens.mjs — generate the plugin panel's design-token CSS from
// packages/design/src/tokens.css (the single source of truth) instead of hand-copying
// values into the plugin, which is how they drifted.
//
// The editor's theming is DUAL-AXIS (data-theme x data-mode) and tokens do NOT all live
// in :root — each palette has its own :root[data-theme='...'] block. The whole file is
// parsed into a generic "selector -> token table" and every :root-scoped block is
// emitted, so the panel carries all editor palettes (decision D13) and a palette added
// to tokens.css reaches the panel on the next build with no change here.
//
// Output: packages/plugin/src/panelTokens.ts (the plugin build runs this script first).
// Usage:  node scripts/gen-panel-tokens.mjs          (rewrite the module)
//         node scripts/gen-panel-tokens.mjs --check  (exit 1 if it is stale)

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const TOKENS_CSS = path.join(repoRoot, "packages", "design", "src", "tokens.css")
const OUT_TS = path.join(repoRoot, "packages", "plugin", "src", "panelTokens.ts")

const emitted = (selector) => selector === ":root" || selector.startsWith(":root[")

/** Parse CSS into an ordered selector -> [prop, value][] table (custom props only). */
function parseCssTokenTable(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "")
  const table = new Map()
  const blockRe = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = blockRe.exec(noComments)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, " ")
    const decls = []
    for (const raw of m[2].split(";")) {
      const colon = raw.indexOf(":")
      if (colon < 0) continue
      const prop = raw.slice(0, colon).trim()
      const value = raw.slice(colon + 1).trim().replace(/\s+/g, " ")
      if (prop.startsWith("--")) decls.push([prop, value])
    }
    if (decls.length === 0) continue
    table.set(selector, (table.get(selector) ?? []).concat(decls))
  }
  return table
}

const table = parseCssTokenTable(fs.readFileSync(TOKENS_CSS, "utf-8"))
const selectors = [...table.keys()].filter(emitted)
if (!selectors.includes(":root")) {
  console.error(`[gen-panel-tokens] no :root block found in ${TOKENS_CSS}`)
  process.exit(1)
}
const css = selectors
  .map((sel) => `${sel} {\n${table.get(sel).map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`)
  .join("\n")
const literal = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")

const next =
  "// GENERATED from packages/design/src/tokens.css by scripts/gen-panel-tokens.mjs — DO NOT EDIT BY HAND.\n" +
  "// Regenerate: node scripts/gen-panel-tokens.mjs (the plugin build runs it first).\n" +
  `export const PANEL_TOKENS_CSS = \`${literal}\`\n`

const current = fs.existsSync(OUT_TS) ? fs.readFileSync(OUT_TS, "utf-8").replace(/\r\n/g, "\n") : null

if (process.argv.includes("--check")) {
  if (current !== next) {
    console.error("[gen-panel-tokens] STALE: packages/plugin/src/panelTokens.ts does not match tokens.css — run: node scripts/gen-panel-tokens.mjs")
    process.exit(1)
  }
  console.log("[gen-panel-tokens] up to date")
} else if (current !== next) {
  fs.writeFileSync(OUT_TS, next)
  console.log(`[gen-panel-tokens] wrote ${selectors.length} selector block(s) into packages/plugin/src/panelTokens.ts`)
} else {
  console.log("[gen-panel-tokens] already up to date")
}
