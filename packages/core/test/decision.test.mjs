// Decision nodes: the shape check, the derived output schema, the state a node is asked about,
// the confidence formulas and the answer mapping of both backends (src/decision.ts, decisionAnswers.ts).
import { test } from "node:test"
import assert from "node:assert/strict"
import { checkDecisionSpec, decisionOutputSchema, decisionStates, toJevQuestions } from "../src/decision.ts"
import { batchRecord, choiceConfidence, decisionPrompt, decisionRecord, fromJevAnswers, parseLlmAnswers, scoreConfidence, yesNoConfidence } from "../src/decisionAnswers.ts"
import { branchParents, checkRunnable, isRouter, strictJsonNodes } from "../src/runtime.ts"
import { validateWorkflow } from "../src/validate.ts"
import { workflowFromYaml } from "../src/serialize.ts"

const questions = {
  category: { type: "choice", instructions: "Which team", options: { billing: "Payments", technical: "Bugs", other: null } },
  urgent: { type: "yes_no", instructions: "The message is urgent" },
  severity: { type: "score", instructions: "How severe", levels: ["none", "minor", "major", "critical"] },
}
const spec = { questions }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`)

test("checkDecisionSpec: bad question types, too few options, level counts, min_confidence range, routes + for_each", () => {
  assert.deepEqual(checkDecisionSpec("d", spec), [])
  const errors = checkDecisionSpec("d", {
    model: 3,
    min_confidence: 1.5,
    for_each: "{a.items}",
    questions: {
      a: { type: "rank", instructions: "x" },
      b: { type: "choice", instructions: "x", options: { only: null } },
      c: { type: "score", instructions: "x", levels: ["one"] },
      d: { type: "score", instructions: "x", levels: Array.from({ length: 11 }, (_, i) => `l${i}`) },
      e: { type: "yes_no" },
      unsure: { type: "yes_no", instructions: "reserved name" },
      "bad name": { type: "yes_no", instructions: "x" },
    },
  }, true)
  assert.deepEqual(errors.map((e) => e.split(":")[0]).sort(), [
    "agents.d.decision.for_each", "agents.d.decision.min_confidence", "agents.d.decision.model",
    "agents.d.decision.questions.a.type", "agents.d.decision.questions.b.options", "agents.d.decision.questions.bad name",
    "agents.d.decision.questions.c.levels", "agents.d.decision.questions.d.levels", "agents.d.decision.questions.e.instructions",
    "agents.d.decision.questions.unsure",
  ])
  assert.deepEqual(checkDecisionSpec("d", { questions: {} }), ["agents.d.decision.questions: required non-empty object"])
  assert.deepEqual(checkDecisionSpec("d", undefined), ["agents.d.decision: required object for a decision node"])
})

test("decisionOutputSchema derives one value + one confidence field per question; batch mode has the fixed shape", () => {
  assert.deepEqual(decisionOutputSchema(spec), {
    category: "string", category_confidence: "number", urgent: "boolean", urgent_p: "number",
    severity: "number", severity_confidence: "number", unsure: "string[]", backend: "string",
  })
  assert.deepEqual(decisionOutputSchema({ ...spec, for_each: "{a.items}" }), { items: "object[]", counts: "object", unsure: "number[]", backend: "string" })
})

test("decisionStates: default = upstream outputs keyed by id (parsed), state template, for_each array, run input for an entry", () => {
  const outputs = new Map([["read_mail", '{"emails":[{"id":1},{"id":2}],"n":2}'], ["notes", "plain text"]])
  const scope = { sources: ["read_mail", "notes"], outputs, input: '{"trigger":"mail"}' }
  assert.deepEqual(decisionStates(spec, scope).states, [{ read_mail: { emails: [{ id: 1 }, { id: 2 }], n: 2 }, notes: "plain text" }])
  assert.deepEqual(decisionStates({ ...spec, state: "{notes} / {read_mail.n}" }, scope).states, ["plain text / 2"])
  assert.deepEqual(decisionStates({ ...spec, for_each: "{read_mail.emails}" }, scope).states, [{ id: 1 }, { id: 2 }])
  assert.deepEqual(decisionStates(spec, { sources: [], outputs: new Map(), input: '{"trigger":"mail"}' }).states, [{ trigger: "mail" }])
  assert.throws(() => decisionStates({ ...spec, for_each: "{read_mail.n}" }, scope), /must resolve to a JSON array/)
  assert.deepEqual(decisionStates({ ...spec, state: "{nope.x}" }, scope).notices, [])
})

test("confidence formulas match the documented values", () => {
  close(choiceConfidence([0.6, 0.3, 0.1]), 0.4)
  close(choiceConfidence([0.6, 0.2, 0.2]), 0.4)
  close(choiceConfidence([1, 0, 0]), 1)
  close(choiceConfidence([1 / 3, 1 / 3, 1 / 3]), 0)
  close(scoreConfidence([0, 0.5, 0.5]), 0.25)
  close(scoreConfidence([0.5, 0, 0.5]), 0)
  close(scoreConfidence([0, 0.57, 0.43]), 1 - 0.43 / (2 / 3))
  close(scoreConfidence([0, 0, 1]), 1)
  close(yesNoConfidence(0.5), 0)
  close(yesNoConfidence(0.95), 0.9)
})

test("toJevQuestions maps yes_no to noul and options/levels to criteria; fromJevAnswers normalizes the response", () => {
  assert.deepEqual(toJevQuestions(spec), {
    category: { type: "choice", instructions: "Which team", criteria: { billing: "Payments", technical: "Bugs", other: null } },
    urgent: { type: "noul", instructions: "The message is urgent" },
    severity: { type: "score", instructions: "How severe", criteria: ["none", "minor", "major", "critical"] },
  })
  const answers = fromJevAnswers(spec, {
    category: { type: "choice", choice: "billing", probabilities: { billing: 0.88, technical: 0.12, other: 0 }, confidence: 0.82 },
    urgent: { type: "noul", noul: 0.95 },
    severity: { type: "score", score: 2.1, legend: {}, probabilities: { 0: 0, 1: 0.1, 2: 0.7, 3: 0.2 }, confidence: 0.76 },
  })
  assert.deepEqual(answers.category, { type: "choice", choice: "billing", probabilities: { billing: 0.88, technical: 0.12, other: 0 }, confidence: 0.82 })
  assert.deepEqual(answers.urgent, { type: "yes_no", p: 0.95 })
  assert.deepEqual(answers.severity, { type: "score", score: 2.1, probabilities: [0, 0.1, 0.7, 0.2], confidence: 0.76 })
  assert.throws(() => fromJevAnswers(spec, { category: { type: "choice", choice: "billing" } }), /not a choice/)
  assert.throws(() => fromJevAnswers(spec, {}), /answered nothing for "category"/)
})

test("decisionRecord flattens answers with their confidence field and lists the unsure ones; batchRecord tallies", () => {
  const answers = fromJevAnswers(spec, {
    category: { type: "choice", choice: "billing", probabilities: { billing: 0.5, technical: 0.4, other: 0.1 }, confidence: 0.25 },
    urgent: { type: "noul", noul: 0.3 },
    severity: { type: "score", score: 2, probabilities: { 0: 0, 1: 0, 2: 1, 3: 0 }, confidence: 1 },
  })
  assert.deepEqual(decisionRecord({ ...spec, min_confidence: 0.6 }, answers), {
    category: "billing", category_confidence: 0.25, urgent: false, urgent_p: 0.3, severity: 2, severity_confidence: 1, unsure: ["category", "urgent"],
  })
  assert.deepEqual(decisionRecord(spec, answers).unsure, [])

  const sure = fromJevAnswers(spec, {
    category: { type: "choice", choice: "technical", probabilities: { billing: 0, technical: 1, other: 0 }, confidence: 1 },
    urgent: { type: "noul", noul: 0.9 },
    severity: { type: "score", score: 3, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1 }, confidence: 1 },
  })
  const batch = batchRecord({ ...spec, min_confidence: 0.6 }, [answers, sure, sure])
  assert.deepEqual(batch.items.map((i) => [i.index, i.category, i.urgent, i.severity]), [[0, "billing", false, 2], [1, "technical", true, 3], [2, "technical", true, 3]])
  assert.deepEqual(batch.counts, { category: { billing: 1, technical: 2 }, urgent: { false: 1, true: 2 } })
  assert.deepEqual(batch.unsure, [0])
  assert.ok(!("unsure" in batch.items[0]))
})

test("the LLM fallback prompt asks for probabilities and parseLlmAnswers accepts the shapes a model tends to pick", () => {
  const prompt = decisionPrompt(spec, { subject: "refund" })
  assert.match(prompt, /STATE:\n\{\n {2}"subject": "refund"\n\}/)
  assert.match(prompt, /"category" \(choice\): Which team\n {2}Answer: an object mapping EVERY option[^\n]*"billing" \(Payments\), "technical" \(Bugs\), "other"\./)
  assert.match(prompt, /"severity" \(score\)[^\n]*\n {2}Answer: an array of 4 probabilities[^\n]*0 = none; 1 = minor; 2 = major; 3 = critical/)
  assert.match(prompt, /keys are exactly: "category", "urgent", "severity"\. No prose/)

  const parsed = parseLlmAnswers(spec, '```json\n{"category":{"billing":0.8,"technical":0.2},"urgent":true,"severity":[0,0.1,0.9,0]}\n```')
  assert.equal(parsed.category.choice, "billing")
  close(parsed.category.confidence, choiceConfidence([0.8, 0.2, 0]))
  assert.deepEqual(parsed.urgent, { type: "yes_no", p: 1 })
  close(parsed.severity.score, 1.9) // the expected level, as Jev reports it, not the most likely one
  close(parsed.severity.confidence, scoreConfidence([0, 0.1, 0.9, 0]))

  // bare option name, bare level index, probability as number; unnormalized weights are scaled
  const loose = parseLlmAnswers(spec, '{"category":"Technical","urgent":0.2,"severity":3}')
  assert.deepEqual(loose.category, { type: "choice", choice: "technical", probabilities: { billing: 0, technical: 1, other: 0 }, confidence: 1 })
  assert.deepEqual(loose.urgent, { type: "yes_no", p: 0.2 })
  assert.deepEqual(loose.severity.probabilities, [0, 0, 0, 1])
  assert.deepEqual(parseLlmAnswers(spec, '{"category":{"billing":3,"technical":1},"urgent":0,"severity":[1,1,0,0]}').category.probabilities, { billing: 0.75, technical: 0.25, other: 0 })
  assert.throws(() => parseLlmAnswers(spec, '{"category":"nope","urgent":0.2,"severity":3}'), /no usable answer for "category"/)
  assert.throws(() => parseLlmAnswers(spec, "no json here"), /holds no JSON object/)
})

const base = { introduction: "t", type: "pipeline", input: { description: "" }, output: { description: "" } }
const wf = (agents) => ({ ...base, agents, workflow: Object.keys(agents) })
const node = (extra = {}) => ({ prompt: "p", agent_mapping: { opencode: "build" }, output: { schema: {} }, ...extra })

test("checkRunnable + validateWorkflow: a single-mode decision routes like a branch, batch mode may not; its schema is derived", () => {
  const ok = wf({
    read: node({ output: { schema: { emails: "object[]" } } }),
    triage: { type: "decision", input: { from: "read" }, decision: spec, output: { schema: {} }, branch_on: "category", routes: [{ to: "billing_desk", when: { equals: "billing" } }, { to: "helpdesk" }] },
    billing_desk: node(),
    helpdesk: node({ input: { select: { triage: ["urgent"] } } }),
    review: { type: "decision", input: { from: "read" }, decision: { ...spec, for_each: "{read.emails}", state: "{other.x}" }, output: { schema: {} } },
    after: node({ input: { from: "review" } }),
  })
  assert.equal(checkRunnable(ok).ok, true)
  assert.deepEqual([...branchParents(ok).entries()], [["billing_desk", ["triage"]], ["helpdesk", ["triage"]]])
  assert.deepEqual([...strictJsonNodes(ok)], []) // a decision answers in JSON by construction — never forced
  const issues = validateWorkflow(ok)
  assert.deepEqual(issues.filter((i) => i.severity === "error"), [])
  assert.deepEqual(issues.filter((i) => i.nodeId === "review").map((i) => [i.code, i.field]), [["template-unknown-source", "state"]])
  assert.ok(!issues.some((i) => i.code === "branch-field-missing"), "branch_on is checked against the DERIVED schema")

  const bad = wf({
    batch: { type: "decision", decision: { ...spec, for_each: "{input}" }, output: { schema: {} }, routes: [{ to: "x" }] },
    x: node(),
    missing: { type: "decision", output: { schema: {} } },
    wrongField: { type: "decision", decision: spec, output: { schema: {} }, branch_on: "team", routes: [{ to: "x", when: { equals: "a" } }] },
  })
  const check = checkRunnable(bad)
  assert.equal(check.ok, false)
  assert.ok(check.errors.some((e) => /batch\.decision\.for_each: a batch decision cannot route/.test(e)), check.errors.join("\n"))
  assert.ok(check.errors.some((e) => /agents\.missing\.decision: required object/.test(e)))
  const codes = validateWorkflow(bad).map((i) => `${i.code}:${i.nodeId}`)
  assert.ok(codes.includes("decision-invalid:batch"), codes.join("\n"))
  assert.ok(codes.includes("decision-missing:missing"), codes.join("\n"))
  assert.ok(codes.includes("branch-field-missing:wrongField"), codes.join("\n"))
})

test("workflowFromYaml gives a decision no prompt and no default agent: its fallback stays the runner's", () => {
  const wf = workflowFromYaml("agents:\n  judge:\n    type: decision\n    decision:\n      questions:\n        ok: { type: yes_no, instructions: It is fine. }\n")
  assert.equal(wf.agents.judge.prompt, undefined)
  assert.equal(wf.agents.judge.agent_mapping, undefined)
  assert.deepEqual(wf.agents.judge.output, { schema: {} })
})

test("a decision routes only when it names branch_on; without it, its edges stay plain data edges", () => {
  const decision = { questions: { ok: { type: "yes_no", instructions: "It is fine." } } }
  assert.equal(isRouter({ type: "decision", decision }), false)
  assert.equal(isRouter({ type: "decision", decision, branch_on: "ok" }), true)
  assert.equal(isRouter({ type: "decision", decision: { ...decision, for_each: "{src.items}" }, branch_on: "ok" }), false)
  const wf = {
    introduction: "t", type: "pipeline", input: { description: "" }, output: { description: "" }, workflow: ["judge", "next"],
    agents: {
      judge: { type: "decision", decision, routes: [{ to: "next" }], output: { schema: {} } },
      next: { prompt: "x", agent_mapping: { opencode: "build" }, input: { from: "judge" }, output: { schema: {} } },
    },
  }
  assert.deepEqual([...branchParents(wf).keys()], [])
})
