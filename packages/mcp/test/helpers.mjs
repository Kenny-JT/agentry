// Shared by the suites: a temp project seeded from test/fixtures/, and an MCP client
// over stdio to the BUILT server (dist/agentry-mcp.mjs).
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/client"
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio"

const here = path.dirname(fileURLToPath(import.meta.url))
export const BUNDLE = path.join(here, "..", "dist", "agentry-mcp.mjs")
export const FIXTURES = path.join(here, "fixtures")

export function seedProject(files = ["hero.yaml", "code-review.yaml", "branching.yaml"]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentry-mcp-"))
  fs.mkdirSync(path.join(dir, "workflows"))
  for (const name of files) fs.copyFileSync(path.join(FIXTURES, name), path.join(dir, "workflows", name))
  return dir
}

export async function connect(projectDir, env = {}) {
  const client = new Client({ name: "agentry-mcp-test", version: "0.0.0" })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BUNDLE, "--dir", projectDir],
    env: { ...process.env, ...env },
    stderr: "pipe",
  })
  await client.connect(transport)
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args })
    const text = result.content.find((c) => c.type === "text")?.text ?? ""
    return { isError: result.isError === true, text, data: result.isError ? null : JSON.parse(text) }
  }
  return { client, call, close: () => client.close() }
}
