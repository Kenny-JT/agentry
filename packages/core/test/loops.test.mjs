// Loop-back edges: cycle detection, the feedback rules, the runner's shape gate and the YAML round-trip
// (src/loops.ts, validate.ts, runtime.ts, serialize.ts).
import { test } from "node:test"
import assert from "node:assert/strict"
import { dependencyGraph, feedbackLoopBody, findCycles } from "../src/loops.ts"
import { checkRunnable } from "../src/runtime.ts"
import { workflowFromYaml, workflowToYaml } from "../src/serialize.ts"
import { validateWorkflow } from "../src/validate.ts"

const agent = (extra = {}) => ({ prompt: "p", agent_mapping: { opencode: "build" }, output: { schema: { text: "string" } }, ...extra })
const workflow = (agents) => ({ introduction: "t", type: "pipeline", input: { description: "" }, output: { description: "" }, agents, workflow: Object.keys(agents) })
const codes = (wf, severity) => validateWorkflow(wf).filter((i) => !severity || i.severity === severity).map((i) => i.code)

const reviewLoop = () => workflow({
  writer: agent({ input: { feedback: { from: "reviewer", when: { not_contains: "APPROVED" }, max: 3 } } }),
  reviewer: agent({ input: { from: "writer" } }),
  publish: agent({ input: { from: "reviewer" } }),
})

test("a cycle in input.from / routes / trigger.when is an error that names the cycle; a loop-back edge is not a cycle", () => {
  const cyclic = workflow({
    a: agent({ input: { from: "c" } }),
    b: agent({ input: { from: "a" } }),
    c: agent({ input: { from: "b" } }),
    d: agent({ input: { from: "c" } }),
  })
  assert.deepEqual(findCycles(dependencyGraph(cyclic)), [["a", "b", "c"]])
  const [issue] = validateWorkflow(cyclic).filter((i) => i.code === "cycle")
  assert.equal(issue.severity, "error")
  assert.equal(issue.nodeId, "a")
  assert.match(issue.message, /"a" → "b" → "c" → "a" is a cycle/)
  assert.match(issue.message, /loop-back edge/)

  const viaGate = workflow({ x: agent({ trigger: { when: { from: "y", contains: "go" } } }), y: agent({ input: { from: "x" } }) })
  assert.deepEqual(findCycles(dependencyGraph(viaGate)), [["x", "y"]])
  const viaRoute = workflow({
    pick: agent({ type: "branch", branch_on: "text", input: { from: "redo" }, routes: [{ to: "redo", when: { equals: "again" } }] }),
    redo: agent(),
  })
  assert.deepEqual(findCycles(dependencyGraph(viaRoute)), [["pick", "redo"]])
  assert.deepEqual(findCycles(dependencyGraph(workflow({ self: agent({ input: { from: "self" } }) }))), [["self"]])

  assert.deepEqual(codes(reviewLoop(), "error"), [])
})

test("feedback.from must be an existing node downstream of the loop head; max is 1..10; no `when` is a warning", () => {
  const ok = reviewLoop()
  assert.deepEqual([...feedbackLoopBody(ok, "writer")].sort(), ["reviewer", "writer"])
  assert.deepEqual(codes(ok), [])

  const unknown = workflow({ a: agent({ input: { feedback: { from: "ghost", when: { contains: "x" } } } }) })
  assert.deepEqual(codes(unknown, "error"), ["feedback-unknown"])

  const notLoop = workflow({ a: agent({ input: { from: "b", feedback: { from: "b", when: { contains: "x" } } } }), b: agent() })
  assert.equal(feedbackLoopBody(notLoop, "a"), null)
  const [issue] = validateWorkflow(notLoop).filter((i) => i.code === "feedback-not-loop")
  assert.match(issue.message, /"b" is not downstream of "a"/)

  for (const max of [0, 11, 2.5, "3"]) {
    const bad = reviewLoop()
    bad.agents.writer.input.feedback.max = max
    assert.ok(codes(bad, "error").includes("feedback-max"), String(max))
  }

  const noExit = reviewLoop()
  delete noExit.agents.writer.input.feedback.when
  assert.deepEqual(codes(noExit), ["loop-no-exit"])
  assert.equal(validateWorkflow(noExit)[0].severity, "warning")
})

test("the loop body is every node on a path from the head to the loop-back source, branches and gates included", () => {
  const wf = workflow({
    head: agent(),
    left: agent({ input: { from: "head" } }),
    right: agent({ input: { from: "head" } }),
    aside: agent({ input: { from: "head" } }),
    pick: agent({ type: "branch", branch_on: "text", input: { from: ["left", "right"] }, routes: [{ to: "tail" }] }),
    tail: agent({ trigger: { when: { from: "aside", contains: "ok" } } }),
    after: agent({ input: { from: "tail" } }),
  })
  wf.agents.head.input = { feedback: { from: "tail", max: 2 } }
  assert.deepEqual([...feedbackLoopBody(wf, "head")].sort(), ["aside", "head", "left", "pick", "right", "tail"])
})

test("checkRunnable gates the feedback shape the runner relies on", () => {
  const errorsOf = (feedback) => {
    const wf = reviewLoop()
    wf.agents.writer.input.feedback = feedback
    const check = checkRunnable(wf)
    return check.ok ? [] : check.errors
  }
  assert.deepEqual(errorsOf({ from: "reviewer" }), [])
  assert.deepEqual(errorsOf("reviewer"), ["agents.writer.input.feedback: expected object"])
  assert.deepEqual(errorsOf({}), ["agents.writer.input.feedback.from: required string"])
  assert.deepEqual(errorsOf({ from: "nope" }), ['agents.writer.input.feedback.from: references unknown agent "nope"'])
  assert.deepEqual(errorsOf({ from: "reviewer", when: "APPROVED" }), ["agents.writer.input.feedback.when: expected object"])
  assert.deepEqual(errorsOf({ from: "reviewer", max: 12 }), ["agents.writer.input.feedback.max: expected an integer from 1 to 10"])
})

test("input.feedback survives a YAML round-trip untouched", () => {
  const wf = reviewLoop()
  const yaml = workflowToYaml(wf)
  assert.match(yaml, /feedback:\n {8}from: reviewer\n {8}when:\n {10}not_contains: APPROVED\n {8}max: 3/)
  const back = workflowFromYaml(yaml)
  assert.deepEqual(back.agents.writer.input, wf.agents.writer.input)
  const normalized = workflowToYaml(back)
  assert.equal(workflowToYaml(workflowFromYaml(normalized)), normalized)
})
