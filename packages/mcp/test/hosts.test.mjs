// Runs on a CLI host: run_workflow with runtime claude / codex executes inside the server, one
// CLI process per step. Fake CLIs stand in for claude and codex: they record their arguments,
// stdin and working directory, then answer the way the real ones do.
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { BUNDLE, connect, seedProject } from "./helpers.mjs"

const WORKFLOW = `introduction: hosts
type: pipeline
input: { description: "" }
output: { description: "" }
agents:
  look:
    prompt: Look around and say what you see.
    agent_mapping: { opencode: explore, claude_code: scout, codex: careful }
    output: { schema: { summary: string } }
  write:
    input: { from: look }
    prompt: "Write it down: {look.summary}"
    agent_mapping: { opencode: build }
    output: { schema: { summary: string } }
workflow: [look, write]
`

const FAKE = `import fs from "node:fs"
const args = process.argv.slice(2)
let stdin = ""
process.stdin.setEncoding("utf8")
for await (const chunk of process.stdin) stdin += chunk
fs.appendFileSync(process.env.FAKE_HOST_LOG, JSON.stringify({ host: process.env.FAKE_HOST, args, stdin, cwd: process.cwd() }) + "\\n")
if (process.env.FAKE_FAIL) {
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: process.env.FAKE_FAIL }))
  process.exit(1)
}
const reply = JSON.stringify({ summary: "seen by " + process.env.FAKE_HOST })
if (process.env.FAKE_HOST === "codex") {
  fs.writeFileSync(args[args.indexOf("--output-last-message") + 1], reply)
  process.stdout.write("codex progress line\\n")
} else {
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: reply, session_id: "fake", total_cost_usd: 0.0012 }))
}
`

let dir
let bin

before(() => {
  dir = seedProject([])
  fs.writeFileSync(path.join(dir, "workflows", "hosts.yaml"), WORKFLOW)
  // a space on purpose: on Windows the .cmd shim starts through cmd.exe, which mangles unguarded quotes
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "agentry hosts "))
  fs.writeFileSync(path.join(bin, "fake-host.mjs"), FAKE)
})
after(() => {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.rmSync(bin, { recursive: true, force: true })
})

/** A fake CLI the adapter starts like the real one: a .cmd shim on Windows, a sh script elsewhere. */
function fakeCli(name) {
  const script = path.join(bin, "fake-host.mjs")
  if (process.platform === "win32") {
    const file = path.join(bin, `${name}.cmd`)
    fs.writeFileSync(file, `@echo off\r\nset FAKE_HOST=${name}\r\n"${process.execPath}" "${script}" %*\r\n`)
    return file
  }
  const file = path.join(bin, name)
  fs.writeFileSync(file, `#!/bin/sh\nFAKE_HOST=${name} exec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 })
  return file
}

async function runOn(runtime, { clientName, env = {} } = {}) {
  const log = path.join(bin, "calls.jsonl")
  fs.rmSync(log, { force: true })
  const mcp = await connect(dir, {
    AGENTRY_NO_BROWSER: "1", AGENTRY_RUNTIME: "", AGENTRY_OPENCODE_URL: "http://127.0.0.1:9", AGENTRY_OPENCODE_AUTOSTART: "0",
    AGENTRY_CLAUDE_BIN: fakeCli("claude"), AGENTRY_CODEX_BIN: fakeCli("codex"), FAKE_HOST_LOG: log, ...env,
  }, clientName)
  try {
    const started = await mcp.call("run_workflow", { file: "hosts.yaml", ...(runtime ? { runtime } : {}) })
    assert.equal(started.isError, false, started.text)
    const done = await mcp.call("wait_for_run", { run_id: started.data.run_id, timeout_s: 30 })
    const calls = fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []
    return { started: started.data, done: done.data, calls }
  } finally {
    await mcp.close()
  }
}

const flag = (args, name) => args[args.indexOf(name) + 1]

test("runtime claude: one `claude -p` per step, the prompt on stdin, read-only roles get only the read tools, the subagent passed on", async () => {
  const { started, done, calls } = await runOn("claude")
  assert.equal(started.runtime, "claude")
  assert.equal(done.status, "done", JSON.stringify(done))
  assert.deepEqual(done.nodes.map((n) => [n.id, n.state, n.agent]), [["look", "done", "scout"], ["write", "done", "claude_code default"]])
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.host, "claude")
    assert.equal(fs.realpathSync(call.cwd), fs.realpathSync(dir))
    assert.deepEqual(call.args.slice(0, 3), ["-p", "--output-format", "json"])
    assert.ok(call.args.includes("--strict-mcp-config"))
    assert.equal(flag(call.args, "--mcp-config"), '{"mcpServers":{}}')
  }
  const [look, write] = calls
  assert.equal(flag(look.args, "--permission-mode"), "dontAsk")
  assert.equal(flag(look.args, "--tools"), "Read,Glob,Grep,WebFetch,WebSearch")
  assert.equal(flag(look.args, "--agent"), "scout")
  assert.match(look.stdin, /Look around and say what you see\./)
  assert.equal(flag(write.args, "--permission-mode"), "acceptEdits")
  assert.ok(!write.args.includes("--tools"))
  assert.ok(!write.args.includes("--agent"))
  assert.match(write.stdin, /seen by claude/)
})

test("runtime codex: `codex exec` reads the prompt from stdin; the answer is the --output-last-message file", async () => {
  const { started, done, calls } = await runOn("codex")
  assert.equal(started.runtime, "codex")
  assert.equal(done.status, "done", JSON.stringify(done))
  assert.deepEqual(done.nodes.map((n) => [n.id, n.agent]), [["look", "careful"], ["write", "codex default"]])
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.equal(call.args[0], "exec")
    assert.equal(call.args.at(-1), "-")
    assert.ok(call.args.includes("--skip-git-repo-check"))
    assert.equal(fs.realpathSync(flag(call.args, "--cd")), fs.realpathSync(dir))
  }
  const [look, write] = calls
  assert.equal(flag(look.args, "--sandbox"), "read-only")
  assert.equal(flag(look.args, "--profile"), "careful")
  assert.equal(flag(write.args, "--sandbox"), "workspace-write")
  assert.match(write.stdin, /seen by codex/)
})

test("auto: Claude Code as the MCP client runs on claude; AGENTRY_RUNTIME wins over the client", async () => {
  const viaClient = await runOn(undefined, { clientName: "claude-code" })
  assert.equal(viaClient.started.runtime, "claude")
  assert.equal(viaClient.done.status, "done")
  const viaEnv = await runOn(undefined, { clientName: "claude-code", env: { AGENTRY_RUNTIME: "codex" } })
  assert.equal(viaEnv.started.runtime, "codex")
  assert.equal(viaEnv.done.status, "done")
})

test("a step the CLI refuses fails the run, and get_run says why", async () => {
  const { done, calls } = await runOn("claude", { env: { FAKE_FAIL: "You've hit your weekly limit" } })
  assert.equal(done.status, "failed")
  assert.equal(calls.length, 1)
  const [look] = done.nodes
  assert.equal(look.state, "failed")
  assert.equal(look.error, "claude reported an error: You've hit your weekly limit")
})

test("agentry-mcp run: one run from a terminal, waited for; the exit code says whether it ended done", () => {
  const env = { ...process.env, AGENTRY_NO_BROWSER: "1", AGENTRY_RUNTIME: "", AGENTRY_CLAUDE_BIN: fakeCli("claude"), FAKE_HOST_LOG: path.join(bin, "cli.jsonl") }
  const run = (extraEnv = {}, ...args) => spawnSync(process.execPath, [BUNDLE, "run", "hosts.yaml", "--dir", dir, "--runtime", "claude", ...args], { env: { ...env, ...extraEnv }, encoding: "utf8", timeout: 60_000 })
  const ok = run()
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /^run_\d+ {2}done {2}\(claude\)/)
  assert.match(ok.stdout, /\n {2}look {2}done {2}scout {2}[\d.]+ s {2}\{"summary":"seen by claude"\}/)
  assert.equal(JSON.parse(run({}, "--json").stdout).status, "done")
  const failed = run({ FAKE_FAIL: "You've hit your weekly limit" })
  assert.equal(failed.status, 1)
  assert.match(failed.stdout, /\n {2}look {2}failed .*claude reported an error: You've hit your weekly limit/)
})

/** A client on the 2026-07-28 protocol, the way Claude Code 2.1.3xx speaks it: no initialize, every request names the client in its `_meta` envelope. */
function modernClient(env) {
  const child = spawn(process.execPath, [BUNDLE, "--dir", dir], { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "ignore"] })
  const meta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": { name: "claude-code", version: "2.1.306" },
    "io.modelcontextprotocol/clientCapabilities": {},
  }
  const waiting = new Map()
  let buf = ""
  let next = 0
  child.stdout.setEncoding("utf8")
  child.stdout.on("data", (chunk) => {
    buf += chunk
    for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
      const msg = JSON.parse(buf.slice(0, i))
      buf = buf.slice(i + 1)
      waiting.get(msg.id)?.(msg)
      waiting.delete(msg.id)
    }
  })
  const request = (method, params) => new Promise((resolve) => {
    const id = next++
    waiting.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, _meta: meta } }) + "\n")
  })
  return {
    discover: () => request("server/discover", {}),
    call: async (name, args) => {
      const { result } = await request("tools/call", { name, arguments: args })
      const body = result.content.map((c) => c.text).join("")
      return { isError: result.isError === true, text: body, data: result.isError ? null : JSON.parse(body) }
    },
    close: () => { child.stdin.end(); child.kill() },
  }
}

test("auto: Claude Code on the 2026-07-28 protocol (no initialize, client named per request) still runs on claude", async () => {
  const log = path.join(bin, "calls.jsonl")
  fs.rmSync(log, { force: true })
  const mcp = modernClient({
    AGENTRY_NO_BROWSER: "1", AGENTRY_RUNTIME: "", AGENTRY_OPENCODE_URL: "http://127.0.0.1:9", AGENTRY_OPENCODE_AUTOSTART: "0",
    AGENTRY_CLAUDE_BIN: fakeCli("claude"), FAKE_HOST_LOG: log,
  })
  try {
    assert.ok((await mcp.discover()).result)
    const started = await mcp.call("run_workflow", { file: "hosts.yaml" })
    assert.equal(started.isError, false, started.text)
    assert.equal(started.data.runtime, "claude")
    const done = await mcp.call("wait_for_run", { run_id: started.data.run_id, timeout_s: 30 })
    assert.equal(done.data.status, "done", done.text)
  } finally {
    mcp.close()
  }
})

test("auto: a project set up for opencode stays on opencode even from Claude Code", async () => {
  const project = seedProject([])
  fs.writeFileSync(path.join(project, "workflows", "hosts.yaml"), WORKFLOW)
  fs.mkdirSync(path.join(project, ".opencode", "plugins"), { recursive: true })
  fs.writeFileSync(path.join(project, ".opencode", "plugins", "agentry.js"), "export default {}\n")
  const mcp = await connect(project, { AGENTRY_NO_BROWSER: "1", AGENTRY_RUNTIME: "", AGENTRY_OPENCODE_URL: "http://127.0.0.1:9", AGENTRY_OPENCODE_AUTOSTART: "0" }, "claude-code")
  try {
    const refused = await mcp.call("run_workflow", { file: "hosts.yaml" })
    assert.equal(refused.isError, true)
    assert.match(refused.text, /opencode server: http:\/\/127\.0\.0\.1:9/)
  } finally {
    await mcp.close()
    fs.rmSync(project, { recursive: true, force: true })
  }
})

test("auto from any other host stays on opencode, and its failure says how to pick claude or codex; a bad AGENTRY_RUNTIME is named", async () => {
  const env = { AGENTRY_NO_BROWSER: "1", AGENTRY_RUNTIME: "", AGENTRY_OPENCODE_URL: "http://127.0.0.1:9", AGENTRY_OPENCODE_AUTOSTART: "0" }
  const mcp = await connect(dir, env)
  try {
    const refused = await mcp.call("run_workflow", { file: "hosts.yaml" })
    assert.equal(refused.isError, true)
    assert.match(refused.text, /could not start the run/)
    assert.match(refused.text, /runtime "claude" or "codex"/)
  } finally {
    await mcp.close()
  }
  const bad = await connect(dir, { ...env, AGENTRY_RUNTIME: "gpt" })
  try {
    const refused = await bad.call("run_workflow", { file: "hosts.yaml" })
    assert.equal(refused.isError, true)
    assert.match(refused.text, /AGENTRY_RUNTIME="gpt" is not one of opencode, claude, codex/)
  } finally {
    await bad.close()
  }
})
