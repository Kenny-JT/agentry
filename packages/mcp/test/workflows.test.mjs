// list / get / validate / save / edit through the built server, on a temp project seeded
// with copies of the repo's workflows.
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { connect, seedProject } from "./helpers.mjs"

const TOOLS = ["list_workflows", "get_workflow", "validate_workflow", "save_workflow", "edit_workflow", "run_workflow", "get_run", "wait_for_run", "list_runs", "cancel_run"]

let dir
let mcp
before(async () => {
  dir = seedProject()
  mcp = await connect(dir)
})
after(async () => {
  await mcp.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

const readFile = (rel) => fs.readFileSync(path.join(dir, ...rel.split("/")), "utf8")

test("tools/list exposes all ten tools with input schemas", async () => {
  const { tools } = await mcp.client.listTools()
  assert.deepEqual(tools.map((t) => t.name).sort(), [...TOOLS].sort())
  for (const tool of tools) {
    assert.ok(tool.description.length > 40, `${tool.name} has a description`)
    assert.equal(tool.inputSchema.type, "object", `${tool.name} has an object schema`)
  }
})

test("list_workflows: every seeded file, with introduction and node count", async () => {
  const { data } = await mcp.call("list_workflows")
  assert.deepEqual(data.workflows.map((w) => w.file), ["workflows/branching.yaml", "workflows/code-review.yaml", "workflows/hero.yaml"])
  const hero = data.workflows.find((w) => w.file === "workflows/hero.yaml")
  assert.equal(hero.introduction, "Explore a codebase and produce a structured summary")
  assert.equal(hero.nodes, 2)
  assert.deepEqual(hero.triggers, [])
})

test("get_workflow: yaml text, node summary with upstreams and branch routes, issues", async () => {
  const { data } = await mcp.call("get_workflow", { file: "branching.yaml" })
  assert.equal(data.file, "workflows/branching.yaml")
  assert.match(data.yaml, /^# Branch probe/)
  const classify = data.nodes.find((n) => n.id === "classify")
  assert.equal(classify.type, "branch")
  assert.deepEqual(classify.routes.map((r) => r.to), ["small_path", "big_path"])
  assert.deepEqual(data.nodes.find((n) => n.id === "small_path").from, ["classify"])
  assert.equal(data.errors, 0)
})

test("validate_workflow: a file passes; a yaml text with a dangling reference reports the error", async () => {
  const ok = await mcp.call("validate_workflow", { file: "workflows/code-review.yaml" })
  assert.equal(ok.data.ok, true)
  const bad = await mcp.call("validate_workflow", {
    yaml: "introduction: x\ntype: pipeline\ninput: {description: ''}\noutput: {description: ''}\nagents:\n  a:\n    input: {from: ghost}\n    output: {schema: {}}\n    prompt: hi\n    agent_mapping: {opencode: build}\nworkflow: [a]\n",
  })
  assert.equal(bad.data.ok, false)
  assert.ok(bad.data.issues.some((i) => i.severity === "error" && /ghost/.test(i.message)))
})

test("file arguments must stay inside workflows/ and be yaml", async () => {
  for (const file of ["../package.json", "/etc/passwd", "C:\\Windows\\x.yaml", "workflows/../../x.yaml", "workflows/notes.txt"]) {
    const { isError, text } = await mcp.call("get_workflow", { file })
    assert.equal(isError, true, file)
    assert.match(text, /file must|must stay inside|must end in/)
  }
  const missing = await mcp.call("get_workflow", { file: "nope.yaml" })
  assert.equal(missing.isError, true)
  assert.match(missing.text, /does not exist/)
})

test("save_workflow: refuses to overwrite, refuses errors, force writes anyway", async () => {
  const hero = readFile("workflows/hero.yaml")
  const refused = await mcp.call("save_workflow", { file: "hero.yaml", yaml: hero })
  assert.equal(refused.isError, true)
  assert.match(refused.text, /already exists/)

  const broken = hero.replace("from: explore_code", "from: nobody")
  const errors = await mcp.call("save_workflow", { file: "copy.yaml", yaml: broken })
  assert.equal(errors.isError, true)
  assert.match(errors.text, /not written/)
  assert.equal(fs.existsSync(path.join(dir, "workflows", "copy.yaml")), false)

  const forced = await mcp.call("save_workflow", { file: "copy.yaml", yaml: broken, force: true })
  assert.equal(forced.data.written, true)
  assert.ok(forced.data.errors > 0)
  assert.equal(readFile("workflows/copy.yaml"), broken)

  const clean = await mcp.call("save_workflow", { file: "copy.yaml", yaml: hero, overwrite: true })
  assert.equal(clean.data.errors, 0)
  assert.equal(readFile("workflows/copy.yaml"), hero)
})

test("edit_workflow: add + connect + rename rewrites references and prompt tokens", async () => {
  const { data } = await mcp.call("edit_workflow", {
    file: "hero.yaml",
    operations: [
      { op: "add_node", id: "polish", prompt: "Polish {write_summary.summary} and keep {write_summary} short", agent: "build", output_schema: { final: "string" } },
      { op: "connect", from: "write_summary", to: "polish" },
      { op: "update_node", id: "polish", set: { trigger: { when: { from: "write_summary", contains: "summary" } }, input_extra_info: "see {write_summary.summary}" } },
      { op: "rename_node", id: "write_summary", new_id: "summarize" },
    ],
  })
  assert.equal(data.errors, 0, JSON.stringify(data.issues))
  assert.deepEqual(data.nodes.map((n) => n.id), ["explore_code", "summarize", "polish"])
  const polish = data.nodes.find((n) => n.id === "polish")
  assert.deepEqual(polish.from, ["summarize"])
  assert.equal(polish.trigger.when.from, "summarize")
  assert.match(data.yaml, /Polish \{summarize\.summary\} and keep \{summarize\} short/)
  assert.match(data.yaml, /see \{summarize\.summary\}/)
  assert.doesNotMatch(data.yaml, /write_summary/)
  assert.equal(readFile("workflows/hero.yaml"), data.yaml)
})

test("edit_workflow: remove_node cleans every reference; a failing operation writes nothing", async () => {
  const before = readFile("workflows/branching.yaml")
  const failed = await mcp.call("edit_workflow", {
    file: "branching.yaml",
    operations: [
      { op: "remove_node", id: "big_path" },
      { op: "connect", from: "classify", to: "ghost" },
    ],
  })
  assert.equal(failed.isError, true)
  assert.match(failed.text, /operation 2 \(connect\) failed: no node "ghost"/)
  assert.equal(readFile("workflows/branching.yaml"), before)

  const { data } = await mcp.call("edit_workflow", {
    file: "branching.yaml",
    operations: [
      { op: "set_branch", id: "classify", branch_on: "size", routes: [{ to: "small_path", when: { equals: "small" } }, { to: "big_path" }] },
      { op: "remove_node", id: "big_path" },
    ],
  })
  assert.equal(data.errors, 0, JSON.stringify(data.issues))
  assert.deepEqual(data.nodes.map((n) => n.id), ["classify", "small_path", "report"])
  assert.deepEqual(data.nodes.find((n) => n.id === "classify").routes, [{ to: "small_path", when: { equals: "small" } }])
  assert.doesNotMatch(data.yaml, /big_path/)
})

test("edit_workflow: an edit that leaves validation errors is refused unless forced", async () => {
  const before = readFile("workflows/branching.yaml")
  const ops = [{ op: "update_node", id: "classify", set: { output_schema: {} } }]
  const refused = await mcp.call("edit_workflow", { file: "branching.yaml", operations: ops })
  assert.equal(refused.isError, true)
  assert.match(refused.text, /branch-field-missing|routes on "size"/)
  assert.equal(readFile("workflows/branching.yaml"), before)

  const forced = await mcp.call("edit_workflow", { file: "branching.yaml", operations: ops, force: true })
  assert.ok(forced.data.errors > 0)
  assert.equal(readFile("workflows/branching.yaml"), forced.data.yaml)
})
