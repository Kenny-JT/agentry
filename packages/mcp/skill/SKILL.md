---
name: agentry
description: Work with Agentry workflows (workflow.yaml files under workflows/) through the `agentry` MCP server — list, read, validate, edit, save, run and watch them. Use when the user mentions Agentry, a workflow.yaml, workflows/, "run the workflow", "add a node", "wire X to Y", "what did the run do", or asks to build an agent pipeline out of opencode agents.
---

# Agentry workflows through MCP

The `agentry` MCP server serves ONE project. Its tools are the only way to touch `workflows/`; never edit those files by hand when the server is available — `edit_workflow` and `save_workflow` validate before writing.

## Which tool

| Want to… | Call |
|---|---|
| see what exists | `list_workflows` → then `get_workflow {file}` for the YAML, node summary and issues |
| check a draft before saving | `validate_workflow {yaml}` (or `{file}`) — `errors` must be 0 for the runner to accept it |
| change an existing workflow | `edit_workflow {file, operations}` — one call, operations in order, atomic |
| write a new file / replace one wholesale | `save_workflow {file, yaml, overwrite?}` |
| execute | `run_workflow {file, input?}` → `{run_id}`; then `wait_for_run {run_id}` (≤ 50 s per call, repeat while `status` is `running`) or `get_run` |
| see history / stop | `list_runs`, `cancel_run` |

Rules of thumb:
- Prefer `edit_workflow` over rewriting YAML: `rename_node` rewrites every reference, `remove_node` drops every edge, `connect` wires `input.from` (or a branch route when the source is a branch).
- Read `issues` in every write result. Fix errors; mention warnings (`disconnected`, `empty-output`) to the user rather than forcing.
- `run_workflow` returns immediately. Do not loop `wait_for_run` forever: report progress to the user after a few polls, and `cancel_run` only when asked.
- `get_run` gives per-node state, iteration, duration and output previews; the `report` field is the documenter's Markdown when the workflow has one.

## workflow.yaml — the contract

```yaml
introduction: One line: what this workflow does        # required
type: pipeline                                         # required (any string; "pipeline")
input:  { description: "What the run receives" }       # required
output: { description: "What the run produces" }       # required
on:                                                    # optional: starts by itself (agentry-watch)
  file: { path: ~/Downloads, match: "*.pdf" }          # or schedule: {at: "Fri 17:00" | every: "15m"}
                                                       # web: {url}, mail: {query}, git: {repo, event: push|commit, branch}
agents:                                                # required: node id -> definition
  gather:
    introduction: Short label
    type: straight                                     # straight | branch | reporter | documenter | sub-workflow
    input:
      extra_info: "Free-form hints for this node"
    output:
      schema: { files: "string[]", summary: "string" } # field -> type hint; {} = free text
    prompt: >
      What the agent must do. Upstream outputs are prepended automatically.
    agent_mapping: { opencode: explore }               # required unless type is sub-workflow
  decide:
    type: branch
    input: { from: gather }                            # one upstream, or [a, b] for fan-in
    output: { schema: { size: "string" } }
    branch_on: size                                    # output field the value is read from (must be in schema)
    routes:                                            # priority order; first matching when wins
      - { to: small, when: { equals: "small" } }       # equals | contains | not_contains | gte | gt | lte | lt
      - { to: big }                                    # no when = default (else) port; only one is useful
    prompt: ...
    agent_mapping: { opencode: build }
  small:
    input: { from: decide }
    ...
  merge:
    input:
      from: [small, big]
      join: any                                        # any = fire on the first upstream (needed after a branch); default all
      select: { small: [summary] }                     # keep only these fields of that upstream's JSON
    trigger:
      when: { from: decide, contains: "ok" }           # run only when the upstream's output matches, else skipped
      loop: { max: 3, exit_when: { contains: "APPROVED" } }  # re-run until exit_when holds or max
    ...
  report:
    type: documenter                                   # at most one; reads every node's log, writes the run report
    output: { schema: {} }
    prompt: Summarize what every step did.
    agent_mapping: { opencode: build }
workflow: [gather, decide, small, big, merge, report]  # required: every node id, in a sensible order
```

Semantics the runner enforces:
- Every `input.from`, `routes[].to`, `trigger.when.from`, `select` key and `workflow[]` entry must name an existing node — the structural gate refuses the file otherwise.
- Nodes run in waves: a node runs when all its upstreams settled (`join: all`) or when the first one did (`join: any`). A node whose upstream was skipped is skipped too — a merge after a branch needs `join: any`.
- Conditions are case-insensitive substring / equality tests on the upstream's output text; keys are AND-combined.
- A branch with `branch_on` and any `select` source must answer in strict JSON — give those nodes an `output.schema`.
- `type: sub-workflow` nodes carry a whole workflow under `tech_stack.workflow` instead of `prompt` / `agent_mapping`.
- `documenter` needs no downstream wiring; it writes `log.md` beside the run artifacts (`.agentry/runs/<run_id>/`).
- opencode agents to map onto: `build` (edits files), `explore` (reads), `plan`, or any agent the project defines.
- For runs on Claude Code or Codex (`run_workflow` with `runtime: claude` or `codex`), `agent_mapping.claude_code` names a Claude Code subagent and `agent_mapping.codex` a Codex profile. A step without one runs as the CLI's default agent, read-only when its opencode agent is `explore` or `plan`.

## A typical exchange

1. `list_workflows` → pick `workflows/code-review.yaml`.
2. `get_workflow` → see 5 nodes, no errors.
3. `edit_workflow` with `[{op: add_node, id: docs_check, prompt: "...", agent: explore, from: gather_context, output_schema: {findings: "string[]"}}, {op: connect, from: docs_check, to: synthesize_report}]`.
4. `run_workflow {file}` → `run_1760000000000`; `wait_for_run` twice; report the node timings and the documenter's summary.
