#!/usr/bin/env node
// Bundle agentry-mcp (src/cli.ts + the MCP SDK + zod + yaml + @agentry/core + the dispatcher
// from @agentry/trigger) into one file that plain node runs:
//   node packages/mcp/dist/agentry-mcp.mjs --dir <project>
import { build } from "esbuild"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

await build({
  entryPoints: [path.join(here, "src", "cli.ts")],
  outfile: path.join(here, "dist", "agentry-mcp.mjs"),
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
      "// GENERATED from packages/mcp/src by packages/mcp/build.mjs — DO NOT EDIT.",
      'import { createRequire as __agentryCreateRequire } from "node:module";',
      "const require = __agentryCreateRequire(import.meta.url);",
    ].join("\n"),
  },
})
console.log("[mcp build] wrote packages/mcp/dist/agentry-mcp.mjs")
