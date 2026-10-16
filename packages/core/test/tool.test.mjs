// Tool nodes: the `{ref}` template language and the shape checks (src/tool.ts, runtime.ts, validate.ts).
import { test } from "node:test"
import assert from "node:assert/strict"
import { renameToolRefs, renderTemplate, renderUrl, templateRefs } from "../src/tool.ts"
import { checkRunnable, strictJsonNodes } from "../src/runtime.ts"
import { validateWorkflow } from "../src/validate.ts"

const scope = {
  sources: ["find", "page"],
  outputs: new Map([
    ["find", 'Here you go: {"url":"https://x.test/a b","meta":{"n":3,"tags":["p","q"]},"flag":true}'],
    ["page", "plain text output"],
  ]),
  input: '{"course":"CS 225"}',
}

test("renderTemplate: whole output, JSON paths, input, scalars and nested values", () => {
  assert.equal(renderTemplate("{page}", scope).text, "plain text output")
  assert.equal(renderTemplate("n={find.meta.n} flag={find.flag} tag={find.meta.tags.1}", scope).text, "n=3 flag=true tag=q")
  assert.equal(renderTemplate("{find.meta}", scope).text, '{"n":3,"tags":["p","q"]}')
  assert.equal(renderTemplate("{input} / {input.course}", scope).text, '{"course":"CS 225"} / CS 225')
})

test("renderTemplate: references outside the node's sources are left untouched (literal JSON survives)", () => {
  const { text, notices } = renderTemplate('{"q": "{other.x}", "u": "{find.url}", "raw": {nope}}', scope)
  assert.equal(text, '{"q": "{other.x}", "u": "https://x.test/a b", "raw": {nope}}')
  assert.deepEqual(notices, [])
})

test("renderTemplate: a missing path renders empty and is reported", () => {
  const { text, notices } = renderTemplate("a={find.meta.missing} b={page.x}", scope)
  assert.equal(text, "a= b=")
  assert.deepEqual(notices, ['{find.meta.missing} has no value — rendered as ""', '{page.x} has no value — rendered as ""'])
})

test("renderUrl: exactly one reference is substituted raw, anything else is URL-encoded", () => {
  assert.equal(renderUrl("{find.url}", scope).text, "https://x.test/a b")
  assert.equal(renderUrl(" {find.url} ", scope).text, "https://x.test/a b")
  assert.equal(renderUrl("https://api.test/q?u={find.url}&c={input.course}", scope).text,
    "https://api.test/q?u=https%3A%2F%2Fx.test%2Fa%20b&c=CS%20225")
  assert.equal(renderUrl("https://api.test/{nope}", scope).text, "https://api.test/{nope}")
})

test("templateRefs + renameToolRefs follow a node rename", () => {
  assert.deepEqual(templateRefs("{a.b.c} and {input} and {x}").map((r) => [r.root, r.path]), [["a", ["b", "c"]], ["input", []], ["x", []]])
  const spec = { kind: "http", url: "{find.url}", headers: { "X-Q": "{find.meta.n}" }, body: { q: "{find.url}", n: 1 } }
  const renamed = renameToolRefs(spec, "find", "locate")
  assert.deepEqual(renamed, { kind: "http", url: "{locate.url}", headers: { "X-Q": "{locate.meta.n}" }, body: { q: "{locate.url}", n: 1 } })
  assert.equal(renameToolRefs(spec, "other", "z"), spec)
})

const base = { introduction: "t", type: "pipeline", input: { description: "" }, output: { description: "" } }
const wf = (agents) => ({ ...base, agents, workflow: Object.keys(agents) })

test("checkRunnable accepts tool nodes without prompt/agent_mapping and rejects malformed specs", () => {
  const ok = checkRunnable(wf({
    fetch: { type: "tool", tool: { kind: "http", url: "https://x.test" }, output: { schema: {} } },
    read: { type: "tool", tool: { kind: "read_file", path: "notes.md" }, output: { schema: {} } },
    write: { type: "tool", input: { from: "fetch" }, tool: { kind: "write_file", path: "out/page.html", content: "{fetch.body}" }, output: { schema: {} } },
    run: { type: "tool", tool: { kind: "script", command: ["py", -3, "x.py"], timeout_s: 5 }, output: { schema: {} } }, // YAML gives -3 as a number
  }))
  assert.equal(ok.ok, true)

  const bad = checkRunnable(wf({
    a: { type: "tool", tool: { kind: "ftp", url: "x" }, output: { schema: {} } },
    b: { type: "tool", tool: { kind: "http" }, output: { schema: {} } },
    c: { type: "tool", tool: { kind: "http", url: "x", method: "FETCH", timeout_s: 0 }, output: { schema: {} } },
    d: { type: "tool", tool: { kind: "read_file" }, output: { schema: {} } },
    e: { type: "tool", tool: { kind: "script", command: [] }, output: { schema: {} } },
    f: { type: "tool", output: { schema: {} } },
  }))
  assert.equal(bad.ok, false)
  assert.deepEqual(bad.errors.map((e) => e.split(":")[0]).sort(), [
    "agents.a.tool.kind", "agents.b.tool.url", "agents.c.tool.method", "agents.c.tool.timeout_s", "agents.d.tool.path", "agents.e.tool.command", "agents.f.tool",
  ])
})

test("validateWorkflow: missing tool field is an error, a reference to a non-upstream is a warning; tool upstreams are never forced strict", () => {
  const workflow = wf({
    find: { prompt: "p", agent_mapping: { opencode: "build" }, output: { schema: { url: "string" } } },
    fetch: { type: "tool", input: { from: "find" }, tool: { kind: "http", url: "{find.url}?x={other.y}&i={input}" }, output: { schema: { body: "any" } } },
    broken: { type: "tool", input: { from: "fetch" }, tool: { kind: "write_file" }, output: { schema: {} } },
    use: { prompt: "p", agent_mapping: { opencode: "build" }, input: { from: "fetch", select: { fetch: ["body"] } }, output: { schema: {} } },
  })
  const issues = validateWorkflow(workflow)
  const codes = issues.map((i) => `${i.code}:${i.nodeId ?? ""}:${i.field ?? ""}`).sort()
  assert.ok(codes.includes("template-unknown-source:fetch:url"), codes.join("\n"))
  assert.ok(codes.includes("tool-invalid:broken:tool"), codes.join("\n"))
  assert.deepEqual(issues.filter((i) => i.nodeId === "fetch").map((i) => i.severity), ["warning"]) // {find.url} and {input} are fine; only {other.y} is flagged
  assert.equal(issues.find((i) => i.nodeId === "broken")?.severity, "error")
  assert.deepEqual([...strictJsonNodes(workflow)], [])
})
