#!/usr/bin/env node
// Bundle agentry-watch (src/cli.ts + @agentry/core + yaml) into one runnable file:
//   node packages/trigger/dist/agentry-watch.mjs --dir <project>
import { build } from "esbuild"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

await build({
  entryPoints: [path.join(here, "src", "cli.ts")],
  outfile: path.join(here, "dist", "agentry-watch.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  charset: "utf8",
  legalComments: "none",
  banner: {
    // yaml is CommonJS and require()s node builtins: give the ESM bundle a real require
    js: [
      "#!/usr/bin/env node",
      "// GENERATED from packages/trigger/src by packages/trigger/build.mjs — DO NOT EDIT.",
      'import { createRequire as __agentryCreateRequire } from "node:module";',
      "const require = __agentryCreateRequire(import.meta.url);",
    ].join("\n"),
  },
})
console.log("[trigger build] wrote packages/trigger/dist/agentry-watch.mjs")
