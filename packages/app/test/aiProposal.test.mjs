// The AI chat's pure helpers (src/aiProposal.ts): reply -> YAML block, before/after change
// summary, and placing a proposal on the canvas without moving the user's nodes.
import { test } from "node:test"
import assert from "node:assert/strict"
import { extractYamlBlock, isEmptyChange, mergeNodePositions, summarizeWorkflowChange } from "../src/aiProposal.ts"

const agent = (prompt, extra = {}) => ({ prompt, agent_mapping: { opencode: "build" }, output: { schema: {} }, ...extra })

const base = {
  introduction: "Tests then refactor",
  type: "pipeline",
  input: { description: "A repo", to: ["explore"] },
  output: { description: "A report", from: ["refactor"] },
  agents: {
    explore: agent("Explore the code"),
    write_tests: agent("Write tests", { input: { from: "explore" } }),
    refactor: agent("Refactor", { input: { from: "write_tests" } }),
  },
  workflow: ["explore", "write_tests", "refactor"],
}

test("extractYamlBlock: the longest yaml-tagged fence wins over snippets and other languages", () => {
  const reply = [
    "Here is the new step on its own:",
    "```yaml",
    "review_tests:",
    "  prompt: Review",
    "```",
    "And the complete file:",
    "```yml",
    "introduction: x",
    "agents:",
    "  review_tests:",
    "    prompt: Review",
    "```",
    "```json",
    '{"longer": "than both yaml blocks put together, but not yaml at all"}',
    "```",
  ].join("\n")
  assert.equal(extractYamlBlock(reply), "introduction: x\nagents:\n  review_tests:\n    prompt: Review")
})

test("extractYamlBlock: an untagged fence is used only when no yaml fence exists; no fence or an unclosed fence is null", () => {
  assert.equal(extractYamlBlock("Done.\n```\nagents: {}\n```\n"), "agents: {}")
  assert.equal(extractYamlBlock("No code here, just prose about agents:"), null)
  assert.equal(extractYamlBlock("Cut off:\n```yaml\nagents:\n  a:\n    prompt: never closed"), null)
  assert.equal(extractYamlBlock("```yaml\n\n```"), null)
})

test("summarizeWorkflowChange: added / removed / changed nodes and edges, boundary wiring included", () => {
  const after = {
    ...base,
    output: { description: "A report", from: ["refactor", "review_tests"] },
    agents: {
      explore: agent("Explore the code"),
      write_tests: agent("Write tests", { input: { from: "explore" } }),
      review_tests: agent("Review the tests", { input: { from: "write_tests" } }),
      refactor: agent("Refactor, carefully", { input: { from: "review_tests" } }),
    },
    workflow: ["explore", "write_tests", "review_tests", "refactor"],
  }
  const summary = summarizeWorkflowChange(base, after)
  assert.deepEqual(summary.nodesAdded, ["review_tests"])
  assert.deepEqual(summary.nodesRemoved, [])
  assert.deepEqual(summary.nodesChanged, ["refactor"])
  assert.deepEqual(summary.edgesAdded, [
    { from: "write_tests", to: "review_tests" },
    { from: "review_tests", to: "refactor" },
    { from: "review_tests", to: "output" },
  ])
  assert.deepEqual(summary.edgesRemoved, [{ from: "write_tests", to: "refactor" }])
  assert.equal(summary.metaChanged, false)
  assert.equal(isEmptyChange(summary), false)
})

test("summarizeWorkflowChange: key order and wiring-only differences are not changes; description changes are meta", () => {
  const reordered = {
    ...base,
    agents: {
      refactor: { output: { schema: {} }, agent_mapping: { opencode: "build" }, input: { from: "write_tests" }, prompt: "Refactor" },
      write_tests: base.agents.write_tests,
      explore: base.agents.explore,
    },
  }
  const same = summarizeWorkflowChange(base, reordered)
  assert.equal(isEmptyChange(same), true)

  const branchy = {
    ...base,
    agents: {
      ...base.agents,
      gate: agent("Decide", { type: "branch", branch_on: "ok", routes: [{ to: "refactor", when: { equals: "yes" } }, { to: "explore" }] }),
    },
  }
  const withBranch = summarizeWorkflowChange(base, branchy)
  assert.deepEqual(withBranch.edgesAdded, [
    { from: "gate", to: "refactor" },
    { from: "gate", to: "explore" },
  ])

  const described = { ...base, introduction: "Tests, then a careful refactor" }
  assert.equal(summarizeWorkflowChange(base, described).metaChanged, true)
  assert.equal(summarizeWorkflowChange(base, { ...base, input: { ...base.input, to: [] } }).metaChanged, false)
})

test("mergeNodePositions: surviving ids keep their spot, new nodes sit one column after their upstream, orphans keep the layout", () => {
  const current = [
    { id: "explore", position: { x: 100, y: 400 } },
    { id: "write_tests", position: { x: 500, y: 380 } },
    { id: "refactor", position: { x: 900, y: 420 } },
  ]
  const proposed = [
    { id: "explore", position: { x: 40, y: 60 }, data: { tag: "a" } },
    { id: "write_tests", position: { x: 360, y: 60 } },
    { id: "review_tests", position: { x: 680, y: 60 } },
    { id: "summarize", position: { x: 1000, y: 60 } },
    { id: "lonely", position: { x: 40, y: 192 } },
  ]
  const edges = [
    { source: "explore", target: "write_tests" },
    { source: "write_tests", target: "review_tests" },
    { source: "explore", target: "review_tests" },
    { source: "review_tests", target: "summarize" },
  ]
  const merged = mergeNodePositions(current, proposed, edges, 320)
  assert.deepEqual(
    merged.map((node) => [node.id, node.position]),
    [
      ["explore", { x: 100, y: 400 }],
      ["write_tests", { x: 500, y: 380 }],
      ["review_tests", { x: 820, y: 390 }],
      ["summarize", { x: 1140, y: 390 }],
      ["lonely", { x: 40, y: 192 }],
    ],
  )
  assert.deepEqual(merged[0].data, { tag: "a" }, "other node fields pass through")
  assert.equal(merged[0].position === current[0].position, false, "positions are copied, not shared")
  assert.deepEqual(proposed[2].position, { x: 680, y: 60 }, "input is not mutated")
})
