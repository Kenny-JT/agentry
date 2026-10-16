#!/usr/bin/env node
// Build the single-file opencode plugin: bundle src/agentry.ts together
// with @agentry/core + @agentry/design (and yaml) into .opencode/plugins/agentry.js, so
// the runner executes the SAME contract code the editor typechecks against instead of a
// hand-kept parallel copy. @opencode-ai/plugin stays external: opencode installs it into
// .opencode/node_modules and its zod instance must stay the host's own.
//
// Usage:  node build.mjs          regenerate panel tokens + write the bundle
//         node build.mjs --check  exit 1 if tokens or bundle are stale (CI / pre-commit)

import { build } from "esbuild"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "..", "..")
const OUT = path.join(repoRoot, ".opencode", "plugins", "agentry.js")
const check = process.argv.includes("--check")

const tokens = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "gen-panel-tokens.mjs"), ...(check ? ["--check"] : [])], { stdio: "inherit" })
if (tokens.status !== 0) process.exit(tokens.status ?? 1)

const result = await build({
  entryPoints: [path.join(here, "src", "agentry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["@opencode-ai/plugin"],
  charset: "utf8",
  legalComments: "none",
  write: false,
  banner: {
    // The bundled yaml is CommonJS and require()s node builtins; give the ESM bundle a real
    // require so esbuild's interop shim works under Node as well as Bun.
    js: [
      "// GENERATED from packages/plugin/src by packages/plugin/build.mjs — DO NOT EDIT.",
      "// Edit the source, then run: pnpm --filter @agentry/plugin build",
      'import { createRequire as __agentryCreateRequire } from "node:module";',
      "const require = __agentryCreateRequire(import.meta.url);",
    ].join("\n"),
  },
})

const code = result.outputFiles[0].text
const normalize = (text) => text.replace(/\r\n/g, "\n")
const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf-8") : null

if (check) {
  if (current === null || normalize(current) !== normalize(code)) {
    console.error("[plugin build] STALE: .opencode/plugins/agentry.js does not match packages/plugin/src — run: pnpm --filter @agentry/plugin build")
    process.exit(1)
  }
  console.log("[plugin build] .opencode/plugins/agentry.js is up to date")
} else {
  fs.writeFileSync(OUT, code)
  console.log(`[plugin build] wrote .opencode/plugins/agentry.js (${(code.length / 1024).toFixed(1)} KB)`)
}
