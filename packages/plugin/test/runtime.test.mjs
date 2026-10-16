// Drives the BUILT plugin (.opencode/plugins/agentry.js — what opencode loads) through
// agentry_run with a scripted opencode client: scheduler semantics, the live panel's HTTP
// surface, and teardown. Run: pnpm --filter @agentry/plugin build && pnpm --filter @agentry/plugin test
import { after, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

process.env.AGENTRY_NO_BROWSER = "1"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const { default: plugin } = await import(pathToFileURL(path.join(repoRoot, ".opencode", "plugins", "agentry.js")).href)

const agent = (prompt, extra = {}) => ({ prompt, agent_mapping: { opencode: "build" }, output: { schema: {} }, ...extra })
const workflow = (agents) => ({ introduction: "test", type: "pipeline", input: { description: "" }, output: { description: "" }, agents, workflow: Object.keys(agents) })

/** reply(prompt) → the agent's text reply; an object is sent back as its JSON text. */
function scriptedClient(reply) {
  const calls = []
  const sessions = []
  const logs = []
  return {
    calls,
    sessions,
    logs,
    app: {
      // a failing agents() makes the runner accept any agent name (resolveAgent's fallback)
      agents: async () => { throw new Error("offline") },
      log: async ({ body }) => { logs.push(body) },
    },
    session: {
      create: async ({ body }) => {
        const id = `ses_${sessions.length}`
        sessions.push({ id, ...body })
        return { data: { id } }
      },
      prompt: async ({ path: { id: session }, body }) => {
        const text = body.parts[0].text
        calls.push({ text, format: body.format, session })
        const out = reply(text)
        return { data: { info: {}, parts: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }] } }
      },
    },
  }
}

const tag = (text) => /NODE=(\w+)/.exec(text)?.[1]

const tempDirs = []
after(() => { for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true }) })

async function run(source, reply, args = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentry-test-"))
  tempDirs.push(dir)
  const file = typeof source === "string" ? source : path.join(dir, "wf.yaml")
  if (typeof source !== "string") fs.writeFileSync(file, JSON.stringify(source)) // JSON is valid YAML
  const client = scriptedClient(reply)
  const hooks = await plugin.server({ client, directory: dir })
  const out = await hooks.tool.agentry_run.execute({ workflow: file, ...args }, {})
  const runId = /Run ID\s*:\s*(\S+)/.exec(out)?.[1]
  const runDir = runId ? path.join(dir, ".agentry", "runs", runId) : ""
  const cp = runId ? JSON.parse(fs.readFileSync(path.join(runDir, "checkpoint.json"), "utf8")) : null
  const promptOf = (id) => client.calls.find((c) => tag(c.text) === id)?.text ?? ""
  return { dir, out, hooks, runDir, cp, promptOf, client }
}

function request(port, { method = "GET", path: p = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: p, headers }, (res) => {
      let data = ""
      res.setEncoding("utf8")
      res.on("data", (chunk) => { data += chunk })
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on("error", reject)
    if (body) req.write(body)
    req.end()
  })
}

/** The panel's SSE replay buffer — what a client connecting after the run would receive. */
function replayedEvents(port) {
  return new Promise((resolve, reject) => {
    const events = []
    const req = http.get({ host: "127.0.0.1", port, path: "/events" }, (res) => {
      res.setEncoding("utf8")
      let buf = ""
      res.on("data", (chunk) => {
        buf += chunk
        for (let i = buf.indexOf("\n\n"); i >= 0; i = buf.indexOf("\n\n")) {
          events.push(JSON.parse(buf.slice(0, i).replace(/^data: /, "")))
          buf = buf.slice(i + 2)
        }
      })
      setTimeout(() => { req.destroy(); resolve(events) }, 150)
    })
    req.on("error", reject)
  })
}

const panelPort = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".agentry", "panel.json"), "utf8")).port

async function waitFor(check, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > until) throw new Error("waitFor timed out")
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

test("a branch takes only its first matching port; a join:any merge runs on the taken path; the rest of the untaken subtree is skipped", async () => {
  const { out, cp, promptOf, client } = await run(workflow({
    classify: agent("NODE=classify", {
      type: "branch", branch_on: "fmt", output: { schema: { fmt: "string" } },
      routes: [{ to: "via_p", when: { contains: "p" } }, { to: "via_png", when: { equals: "png" } }, { to: "via_else" }],
    }),
    via_p: agent("NODE=via_p"),
    via_png: agent("NODE=via_png"),
    via_else: agent("NODE=via_else"),
    after_png: agent("NODE=after_png", { input: { from: "via_png" } }),
    deliver: agent("NODE=deliver", { input: { from: ["via_png", "via_p", "via_else"], join: "any" } }),
    strict_merge: agent("NODE=strict_merge", { input: { from: ["via_p", "via_png"] } }),
  }), (text) => (tag(text) === "classify" ? '{"fmt":"png"}' : `${tag(text)} ok`))

  assert.match(out, /WORKFLOW RUN COMPLETE/)
  assert.deepEqual([...cp.completed].sort(), ["classify", "deliver", "via_p"])
  assert.deepEqual([...cp.skipped].sort(), ["after_png", "strict_merge", "via_else", "via_png"])
  // the merge is labelled with the upstream that actually delivered, not the first declared one
  assert.match(promptOf("deliver"), /^Context from "via_p":/)
  assert.match(out, /strict_merge" merges alternative ports of branch "classify"/)
  // the branch answers in JSON because its prompt asks for it — opencode's `format` forces a
  // tool_choice that Claude Opus 5.5 rejects with an API error, so it must never be sent
  assert.match(promptOf("classify"), /You MUST respond with a valid JSON object matching this schema: \{"fmt":"string"\}/)
  assert.ok(client.calls.every((c) => c.format === undefined))
})

test("join:any fires on the first finished upstream instead of waiting for the slow one", async () => {
  const { cp, promptOf, client } = await run(workflow({
    fast: agent("NODE=fast"),
    slow_a: agent("NODE=slow_a"),
    slow_b: agent("NODE=slow_b", { input: { from: "slow_a" } }),
    first: agent("NODE=first", { input: { from: ["fast", "slow_b"], join: "any" } }),
    all: agent("NODE=all", { input: { from: ["fast", "slow_b"] } }),
  }), (text) => `${tag(text)} result`)

  assert.equal(cp.completed.length, 5)
  assert.match(promptOf("first"), /fast result/)
  assert.doesNotMatch(promptOf("first"), /slow_b result/)
  assert.match(promptOf("all"), /slow_b result/)
  // parallel nodes must not share a session (concurrent prompts on one session clobber replies)
  const [runSession, ...nodeSessions] = client.sessions
  assert.equal(new Set(client.calls.map((c) => c.session)).size, client.calls.length)
  assert.ok(nodeSessions.every((s) => s.parentID === runSession.id))
})

test("trigger.when skips keep the v0 merge semantics (conditional-loop.yaml)", async () => {
  const { cp } = await run(path.join(repoRoot, "workflows", "conditional-loop.yaml"),
    (text) => (/classify this project's complexity/.test(text) ? "simple" : "done FINALIZED"))

  assert.deepEqual(cp.skipped, ["detailed_analysis"])
  assert.ok(cp.completed.includes("refine_report") && cp.completed.includes("final_output"))
})

test("degraded select filters are reported, never silent", async () => {
  const { dir, runDir, promptOf } = await run(workflow({
    prose: agent("NODE=prose", { output: { schema: { x: "string" } } }),
    partial: agent("NODE=partial", { output: { schema: { a: "number", b: "number" } } }),
    consumer: agent("NODE=consumer", { input: { from: ["prose", "partial"], select: { prose: ["x"], partial: ["a", "b"] } } }),
  }), (text) => (tag(text) === "prose" || /Your prior output was/.test(text) ? "just some prose" : tag(text) === "partial" ? '{"a":1}' : "ok"))

  const consumerPrompt = promptOf("consumer")
  assert.match(consumerPrompt, /just some prose/) // unparseable → passed whole
  assert.match(consumerPrompt, /\{"a":1\}/)

  const fallbacks = (await replayedEvents(panelPort(dir))).filter((e) => e.type === "select.fallback")
  assert.deepEqual(fallbacks.map((e) => [e.nodeId, e.from, e.reason, e.missing]), [
    ["consumer", "prose", "unparseable", undefined],
    ["consumer", "partial", "missing-fields", ["b"]],
  ])
  assert.match(fs.readFileSync(path.join(runDir, "consumer.log.md"), "utf8"), /## Filter notices/)
})

test("the documenter writes a markdown run report from execution-ordered records", async () => {
  const { out, runDir, promptOf } = await run(workflow({
    gate: agent("NODE=gate", { type: "branch", branch_on: "go", output: { schema: { go: "string" } }, routes: [{ to: "taken", when: { equals: "yes" } }, { to: "dropped" }] }),
    taken: agent("NODE=taken"),
    dropped: agent("NODE=dropped"),
    report: agent("NODE=report", { type: "documenter", output: { schema: { summary: "string", lessons: "string[]" } } }),
  }), (text) => {
    if (tag(text) === "gate") return '{"go":"yes"}'
    if (tag(text) === "report") return '{"summary":"It worked.","lessons":["Branch first."]}'
    return `${tag(text)} output`
  })

  assert.match(out, /Report {3}: .*log\.md/)
  // completion order: the untaken port is skipped the moment gate decides, before taken runs
  assert.match(promptOf("report"), /### 2\. dropped\n- Result: skipped \(branch route not chosen\)[\s\S]*### 3\. taken[\s\S]*taken output/)
  const report = fs.readFileSync(path.join(runDir, "log.md"), "utf8")
  assert.match(report, /^# Run report — test/)
  assert.match(report, /\| 2 \| `dropped` \| — \| skipped — branch route not chosen \| — \|/)
  assert.match(report, /\| 3 \| `taken` \| build \| done \|/)
  assert.match(report, /## Summary\n\nIt worked\./)
  assert.match(report, /## Lessons\n\n- Branch first\./)
})

test("a sub-workflow runs its inner graph with full control flow, scoped and off the parent canvas", async () => {
  const inner = workflow({
    pick: agent("NODE=pick", { type: "branch", branch_on: "lane", output: { schema: { lane: "string" } }, routes: [{ to: "fast", when: { equals: "fast" } }, { to: "slow" }] }),
    fast: agent("NODE=fast"),
    slow: agent("NODE=slow"),
    merge: agent("NODE=merge", { input: { from: ["fast", "slow"], join: "any" }, output: { schema: { result: "string" } } }),
  })
  inner.output = { description: "", from: ["merge"] }
  const { dir, runDir, cp, promptOf } = await run(workflow({
    pre: agent("NODE=pre"),
    sub: { type: "sub-workflow", input: { from: "pre" }, output: { schema: { result: "string" } }, tech_stack: { workflow: inner } },
    post: agent("NODE=post", { input: { from: "sub" } }),
  }), (text) => {
    if (tag(text) === "pick") return '{"lane":"fast"}'
    if (tag(text) === "merge") return '{"result":"merged via fast"}'
    return `${tag(text)} ok`
  })

  assert.deepEqual(cp.completed, ["pre", "sub", "post"])
  assert.match(promptOf("pick"), /^Context from the parent workflow:\n\n\[pre\]:\npre ok/) // the sub node's own input reaches the inner entry
  assert.doesNotMatch(promptOf("fast"), /pre ok/) // …but only the entry: inner nodes read inner upstreams
  assert.match(promptOf("post"), /merged via fast/)
  assert.ok(fs.existsSync(path.join(runDir, "sub", "fast.output.json")))
  assert.equal(fs.existsSync(path.join(runDir, "sub", "slow.output.json")), false)
  assert.match(fs.readFileSync(path.join(runDir, "sub.log.md"), "utf8"), /`slow`: skipped — branch route not chosen/)
  const ids = new Set((await replayedEvents(panelPort(dir))).map((e) => e.nodeId).filter(Boolean))
  assert.deepEqual([...ids].sort(), ["post", "pre", "sub"])
})

test("every bundled workflows/*.yaml runs to completion against a scripted agent", async () => {
  const dir = path.join(repoRoot, "workflows")
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"))) {
    const { out } = await run(path.join(dir, file), (text) => {
      // answer in the shape the prompt asks for: keyed JSON when the node declares a schema
      const asked = /matching this schema: (\{.*?\})\. Return ONLY/.exec(text)?.[1]
      if (!asked) return "complex simple ALL PASSED FINALIZED done"
      const schema = JSON.parse(asked)
      return Object.fromEntries(Object.entries(schema).map(([k, hint]) => [k, hint.endsWith("[]") ? [] : hint.startsWith("number") ? 1 : "small"]))
    })
    assert.match(out, /WORKFLOW RUN COMPLETE/, `${file}: ${out.split("\n")[0]}`)
  }
})

test("run progress goes to opencode's log, never to the terminal (the TUI owns it)", async () => {
  const printed = []
  const capture = (text) => { if (/agentry/i.test(String(text))) printed.push(String(text)) }
  const original = { write: process.stderr.write, error: console.error, log: console.log, warn: console.warn }
  process.stderr.write = (chunk, ...rest) => { capture(chunk); return original.write.call(process.stderr, chunk, ...rest) }
  console.error = console.log = console.warn = (...args) => capture(args.join(" "))
  let result
  try {
    result = await run(workflow({ only: agent("NODE=only", { output: { schema: { x: "string" } } }) }), () => "prose, not JSON")
  } finally {
    process.stderr.write = original.write
    Object.assign(console, { error: original.error, log: original.log, warn: original.warn })
  }

  assert.deepEqual(printed, [])
  const messages = result.client.logs.filter((l) => l.service === "agentry").map((l) => `${l.level} ${l.message}`)
  assert.ok(messages.some((m) => /^info \[agentry\] run\.started /.test(m)), messages.join("\n"))
  assert.ok(messages.some((m) => /^info \[agentry\] node\.state only done /.test(m)), messages.join("\n"))
})

test("the panel answers only the editor and itself, and follows the editor's theme", async () => {
  const { dir } = await run(workflow({ only: agent("NODE=only") }), () => "ok")
  const port = panelPort(dir)

  const editor = await request(port, { path: "/health", headers: { Origin: "http://tauri.localhost" } })
  assert.equal(editor.status, 200)
  assert.equal(editor.headers["access-control-allow-origin"], "http://tauri.localhost")
  assert.equal(JSON.parse(editor.body).app, "agentry")
  assert.equal((await request(port, { path: "/health", headers: { Origin: "https://evil.example" } })).status, 403)
  assert.equal((await request(port, { path: "/events", headers: { Host: `evil.example:${port}` } })).status, 403)
  assert.equal((await request(port, { method: "POST", path: "/api/stop", headers: { Origin: "https://evil.example" } })).status, 403)

  const preflight = await request(port, { method: "OPTIONS", path: "/api/theme", headers: { Origin: "http://localhost:5173" } })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers["access-control-allow-origin"], "http://localhost:5173")

  const set = await request(port, { method: "POST", path: "/api/theme", headers: { Origin: "tauri://localhost", "Content-Type": "text/plain" }, body: JSON.stringify({ theme: "gruvbox-light" }) })
  assert.equal(set.status, 200)
  assert.match((await request(port)).body, /<html data-theme="gruvbox-light" data-mode="light">/)
  assert.equal((await request(port, { method: "POST", path: "/api/theme", body: JSON.stringify({ theme: "nope" }) })).status, 400)
})

test("the run's input reaches the entry nodes — only the ones wired from IN when the workflow says so", async () => {
  const wf = workflow({ a: agent("NODE=a"), b: agent("NODE=b"), c: agent("NODE=c", { input: { from: "a" } }) })
  const event = '{"trigger":"file","files":["x.pdf"]}'
  const plain = await run(wf, (text) => `${tag(text)} ok`, { input: event })
  assert.match(plain.promptOf("a"), /^Workflow input:\n\n\{"trigger":"file"/)
  assert.match(plain.promptOf("b"), /^Workflow input:/)
  assert.doesNotMatch(plain.promptOf("c"), /Workflow input/)
  assert.equal(fs.readFileSync(path.join(plain.runDir, "input.txt"), "utf8"), event)
  assert.match(plain.out, /Input\s+: .*input\.txt/)

  const wired = await run({ ...wf, input: { description: "", to: ["b", "c"] } }, (text) => `${tag(text)} ok`, { input: event })
  assert.doesNotMatch(wired.promptOf("a"), /Workflow input/)
  assert.match(wired.promptOf("b"), /^Workflow input:/)
  assert.match(wired.promptOf("c"), /^Context from "a":[\s\S]*Workflow input:/) // a wired entry with an upstream gets both
})

test("POST /api/run starts a run with no model in the loop: token required, one run at a time", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentry-test-"))
  tempDirs.push(dir)
  fs.writeFileSync(path.join(dir, "wf.yaml"), JSON.stringify(workflow({ slow: agent("NODE=slow") })))
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const client = scriptedClient(() => "slow ok")
  const prompt = client.session.prompt
  client.session.prompt = async (opts) => { await gate; return prompt(opts) }
  const hooks = await plugin.server({ client, directory: dir })

  const panelFile = path.join(dir, ".agentry", "panel.json")
  await waitFor(() => fs.existsSync(panelFile)) // the panel is up before anything has run
  const { port, token } = JSON.parse(fs.readFileSync(panelFile, "utf8"))
  assert.ok(typeof token === "string" && token.length >= 32)
  const post = (headers, body) => request(port, { method: "POST", path: "/api/run", headers: { "Content-Type": "application/json", ...headers }, body })
  const auth = { "X-Agentry-Token": token }

  assert.equal((await post({}, JSON.stringify({ workflow: "wf.yaml" }))).status, 401)
  assert.equal((await post({ "X-Agentry-Token": "guess" }, JSON.stringify({ workflow: "wf.yaml" }))).status, 401)
  assert.equal((await post(auth, "{not json")).status, 400)
  assert.equal((await post(auth, JSON.stringify({ workflow: "missing.yaml" }))).status, 400)

  const started = await post(auth, JSON.stringify({ workflow: "wf.yaml", input: "hello from a trigger" }))
  assert.equal(started.status, 202)
  const { runId } = JSON.parse(started.body)
  assert.match(runId, /^run_\d+$/)
  const busy = await post(auth, JSON.stringify({ workflow: "wf.yaml" }))
  assert.equal(busy.status, 409)
  assert.equal(JSON.parse(busy.body).runId, runId)

  release()
  await waitFor(async () => JSON.parse((await request(port, { path: "/health" })).body).busy === false)
  const cp = JSON.parse(fs.readFileSync(path.join(dir, ".agentry", "runs", runId, "checkpoint.json"), "utf8"))
  assert.deepEqual(cp.completed, ["slow"])
  assert.match(client.calls[0].text, /^Workflow input:\n\nhello from a trigger/)
  await hooks.dispose()
})

test("dispose closes the panel server and withdraws panel.json", async () => {
  const { dir, hooks } = await run(workflow({ only: agent("NODE=only") }), () => "ok")
  const port = panelPort(dir)
  await hooks.dispose()
  assert.equal(fs.existsSync(path.join(dir, ".agentry", "panel.json")), false)
  await assert.rejects(request(port, { path: "/health" }))
})
