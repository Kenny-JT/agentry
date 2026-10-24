// run / get / wait / list / cancel through the built server against the fake opencode server
// and fake panel (never the user's real one: AGENTRY_OPENCODE_URL points at the fake).
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fakeOpencode, fakePanel } from "./fakes.mjs"
import { connect, seedProject } from "./helpers.mjs"

let dir
let opencode
let panel
let mcp
before(async () => {
  dir = seedProject(["hero.yaml"])
  opencode = await fakeOpencode()
  panel = await fakePanel(dir)
  mcp = await connect(dir, { AGENTRY_OPENCODE_URL: opencode.url, AGENTRY_OPENCODE_AUTOSTART: "0" })
})
after(async () => {
  await mcp.close()
  await panel.close()
  await opencode.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test("no runs yet: get_run and cancel_run say so", async () => {
  const none = await mcp.call("get_run")
  assert.equal(none.isError, true)
  assert.match(none.text, /no runs yet/)
  const idle = await mcp.call("cancel_run")
  assert.equal(idle.isError, true)
  assert.match(idle.text, /nothing is running/)
  assert.deepEqual((await mcp.call("list_runs")).data, [])
})

test("run_workflow returns at once; get_run reads the live panel; wait_for_run sees it finish", async () => {
  const t0 = Date.now()
  const started = await mcp.call("run_workflow", { file: "hero.yaml", input: "hello" })
  assert.equal(started.isError, false, started.text)
  assert.match(started.data.run_id, /^run_\d+$/)
  assert.ok(Date.now() - t0 < 1000, "does not wait for the run")
  assert.equal(panel.state.runId, started.data.run_id)

  const live = await mcp.call("get_run")
  assert.equal(live.data.run_id, started.data.run_id)
  assert.equal(live.data.status, "running")
  assert.equal(live.data.live, true)
  assert.deepEqual(live.data.nodes.map((n) => [n.id, n.state]), [["explore_code", "running"], ["write_summary", "pending"]])
  assert.equal(live.data.nodes[0].agent, "explore")

  const busy = await mcp.call("run_workflow", { file: "hero.yaml" })
  assert.equal(busy.isError, true)
  assert.match(busy.text, /already going/)

  const done = await mcp.call("wait_for_run", { run_id: started.data.run_id, timeout_s: 10 })
  assert.equal(done.data.status, "done")
  assert.equal(done.data.live, false)
  assert.equal(done.data.workflow, "hero")
  const node = done.data.nodes.find((n) => n.id === "write_summary")
  assert.equal(node.state, "done")
  assert.equal(node.ms, 200)
  assert.equal(node.iteration, 1)
  assert.match(node.preview, /^output of write_summary /)
  assert.ok(node.preview.length <= 241)
  assert.match(done.data.report, /# Run report/)
})

test("cancel_run stops the live run; list_runs is newest first with statuses", async () => {
  const second = await mcp.call("run_workflow", { file: "workflows/hero.yaml" })
  assert.equal(second.isError, false, second.text)
  const wrongId = await mcp.call("cancel_run", { run_id: "run_1" })
  assert.equal(wrongId.isError, true)
  assert.match(wrongId.text, /is not running/)

  const cancelled = await mcp.call("cancel_run")
  assert.deepEqual(cancelled.data, { run_id: second.data.run_id, stopping: true })
  const after = await mcp.call("wait_for_run", { run_id: second.data.run_id, timeout_s: 5 })
  assert.equal(after.data.status, "cancelled")

  const runs = (await mcp.call("list_runs", { limit: 10 })).data
  assert.equal(runs.length, 2)
  assert.equal(runs[0].run_id, second.data.run_id)
  assert.deepEqual(runs.map((r) => r.status), ["cancelled", "done"])
  assert.ok(runs.every((r) => r.started_at && r.workflow === "hero"))
  assert.equal((await mcp.call("list_runs", { limit: 1 })).data.length, 1)

  const unknown = await mcp.call("get_run", { run_id: "run_42" })
  assert.equal(unknown.isError, true)
  assert.match(unknown.text, /unknown run/)
})

test("run_workflow refuses a workflow with errors before touching opencode", async () => {
  fs.writeFileSync(path.join(dir, "workflows", "bad.yaml"), "introduction: bad\ntype: pipeline\ninput: {description: ''}\noutput: {description: ''}\nagents:\n  a:\n    output: {schema: {}}\n    prompt: hi\n    agent_mapping: {opencode: build}\n    input: {from: ghost}\nworkflow: [a]\n")
  const hits = opencode.hits.length
  const refused = await mcp.call("run_workflow", { file: "bad.yaml" })
  assert.equal(refused.isError, true)
  assert.match(refused.text, /validation error/)
  assert.equal(opencode.hits.length, hits)
})

test("without a live panel the dispatcher wakes the project through the opencode server", async () => {
  const other = seedProject(["hero.yaml"])
  const otherPanel = await fakePanel(other, { finishAfterMs: 50, publish: false })
  const woken = []
  opencode.hooks.onRequest = (url) => {
    woken.push(url)
    otherPanel.publish()
  }
  const mcp2 = await connect(other, { AGENTRY_OPENCODE_URL: opencode.url, AGENTRY_OPENCODE_AUTOSTART: "0" })
  try {
    const run = await mcp2.call("run_workflow", { file: "hero.yaml" })
    assert.equal(run.isError, false, run.text)
    assert.equal(woken.length, 1)
    // the fake answers JSON like an opencode 2 server, so the API location wakes it (no /path fallback)
    assert.equal(woken[0], `/api/agent?location[directory]=${encodeURIComponent(other)}`)
    const finished = await mcp2.call("wait_for_run", { run_id: run.data.run_id, timeout_s: 5 })
    assert.equal(finished.data.status, "done")
  } finally {
    await mcp2.close()
    await otherPanel.close()
    fs.rmSync(other, { recursive: true, force: true })
  }
})

test("no opencode server and autostart off: an actionable failure", async () => {
  const lonely = seedProject(["hero.yaml"])
  const mcp3 = await connect(lonely, { AGENTRY_OPENCODE_URL: "http://127.0.0.1:1", AGENTRY_OPENCODE_AUTOSTART: "0" })
  try {
    const failed = await mcp3.call("run_workflow", { file: "hero.yaml" })
    assert.equal(failed.isError, true)
    assert.match(failed.text, /no opencode server on http:\/\/127\.0\.0\.1:1/)
    assert.match(failed.text, /plugin is not in .*\.opencode/)
    assert.match(failed.text, /autostart is off/)
  } finally {
    await mcp3.close()
    fs.rmSync(lonely, { recursive: true, force: true })
  }
})
