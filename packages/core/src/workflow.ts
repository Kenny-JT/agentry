/**
 * workflow.yaml — v0 schema types.
 *
 * ⚠️ PROVISIONAL until 1.0. These types are the shared `workflow.yaml`
 * contract; fields may still change between 0.x releases. A change lands here
 * first, then the plugin is rebuilt from it.
 *
 * Source of truth for: the App (editor, export) and the plugin runner (parse).
 */

import type { DecisionSpec } from './decision';
import type { ToolSpec } from './tool';
import type { WorkflowTriggers } from './triggers';

/**
 * Kind of an agent node. App-side editing vocabulary only — the plugin runtime
 * IGNORES per-node `type` (workflow.yaml v0 §2, contracts/workflow.v0.schema.yaml).
 */
export type AgentType =
  | 'straight'
  | 'branch'
  | 'reporter'
  /**
   * Workflow-level log aggregator. VISUALLY a reporter (right semicircle), but a
   * distinct role: at the end of a run it reads EVERY upstream node's `log.md`
   * and writes one workflow-level `log.md` summarizing the whole run — what each
   * step did, the outcome, and the difficulties / lessons encountered. App-side
   * editing vocab only; the plugin ignores per-node `type` so this stays v0-safe.
   *
   * INVARIANTS (see {@link ./validate}): its output IS the whole-run `log.md`,
   * delivered outside the normal OUT channel — so a documenter needs no
   * downstream wiring (never flagged "disconnected"), and a workflow may hold
   * AT MOST ONE (two or more is a validation error).
   */
  | 'documenter'
  | 'sub-workflow'
  /**
   * Deterministic step with NO model (PROVISIONAL, README "Tool steps"): an
   * HTTP request, a file read/write or a script, described by {@link AgentDefinition.tool}.
   * The runner dispatches on this type; `prompt` / `agent_mapping` are absent.
   */
  | 'tool'
  /**
   * Typed decision with NO text generation (PROVISIONAL, README "Decision
   * steps"): the questions in {@link AgentDefinition.decision} are answered by
   * Jev (TypeSafe's System One model) or, without a key, by an LLM through a
   * strict-JSON prompt. May carry `branch_on` + `routes` and then routes exactly
   * like a branch; `prompt` is absent, `agent_mapping` only names the fallback agent.
   */
  | 'decision'
  /**
   * Workflow-level Vivado I/O boundary ports (Phase-5, App-only editing vocab).
   * These are NOT executable agents and NEVER serialize into `agents{}`; the
   * canvas synthesizes exactly ONE of each from {@link Workflow.input}/`output`
   * and folds their wiring back into those top-level fields. The plugin ignores
   * per-node `type` and never sees a boundary node, so this stays v0-safe.
   */
  | 'workflow-input'
  | 'workflow-output';

/**
 * Condition tested against an upstream node's output text (matched
 * LOWERCASED + trimmed). All keys optional and AND-combined when several are
 * present. Shared by {@link TriggerWhen} and {@link TriggerLoop.exit_when}.
 * (workflow.yaml v0 §5 — condition language.)
 */
export interface Condition {
  /** output includes this substring (case-insensitive). */
  contains?: string;
  /** output does NOT include this substring (case-insensitive). */
  not_contains?: string;
  /** trimmed output equals this value (case-insensitive). */
  equals?: string;
}

/**
 * Conditional execution: the node runs only when the condition on `from`'s
 * output holds, otherwise it is skipped. `from` becomes an execution dependency.
 * (workflow.yaml v0 §5.1.)
 */
export interface TriggerWhen extends Condition {
  /** id of the upstream node whose output is tested. Must be an existing node. */
  from: string;
}

/**
 * Loop control: re-run the node until `exit_when` holds or `max` iterations are
 * reached. Without `exit_when` the node runs once (no re-queue). (v0 §5.2.)
 */
export interface TriggerLoop {
  /** Maximum iterations. Must be an integer >= 1 (plugin validator enforces). */
  max: number;
  /** Early-exit condition; same language as {@link TriggerWhen}. */
  exit_when?: Condition;
}

/**
 * Loop / branch control attached to a node (workflow.yaml v0 §5). Both blocks
 * are independent and optional. NOTE: the old `kind` field is REMOVED — the
 * plugin validator rejects it and requires this structured shape.
 */
export interface Trigger {
  when?: TriggerWhen;
  loop?: TriggerLoop;
}

/**
 * A branch node's routing condition, tested against the branch's chosen output
 * value. String keys match text output (case-insensitive, like {@link Condition});
 * numeric keys compare a parsed number. Keys are AND-combined; an empty/omitted
 * condition marks the default ("else") port. Exactly ONE port is taken: the
 * first conditioned route that matches, in `routes[]` order, else the first
 * default (decision D16 — see `pickBranchRoute` in ./runtime).
 */
export interface RouteCondition {
  equals?: string;
  contains?: string;
  not_contains?: string;
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
}

/** One output port of a branch node: which downstream node it feeds + its gate. */
export interface BranchRoute {
  /** Downstream node id this port connects to (an existing node). */
  to: string;
  /** Gate for this port; omit for the default/else port. */
  when?: RouteCondition;
}

/**
 * Loop-back edge (PROVISIONAL): placed on the FIRST node of a
 * loop. After `from` — a node DOWNSTREAM of this one — finishes a round, the
 * loop body (this node, `from`, and every node on a path between them) runs
 * again with `from`'s output handed to this node as feedback, while `when`
 * matches that output (absent = always) and at most `max` extra rounds have
 * run. A loop-back edge is NOT an execution dependency: this node never waits
 * for `from`. See {@link ./loops} for the body computation and the limits.
 */
export interface FeedbackLoop {
  /** id of the downstream node whose output feeds back. Must be reachable from this node. */
  from: string;
  /** Keep looping while this holds on `from`'s output; omitted = always (runs `max` rounds). */
  when?: Condition;
  /** Extra rounds at most, integer 1..10 (default {@link FEEDBACK_DEFAULT_MAX}). */
  max?: number;
}

/** A node's inputs: upstream references, reference files, and free-form info. */
export interface AgentInput {
  /**
   * Upstream node id(s) whose output feeds this one (workflow.yaml v0 §3).
   * Single upstream = a bare string; fan-in (multiple upstreams) = a string[].
   * Every id must reference an existing node in `agents`.
   */
  from?: string | string[];
  /**
   * Per-edge field filter (PROVISIONAL like the rest of this file):
   * upstream node id -> the field names of that upstream's `output.schema` this
   * node KEEPS. Edge-level only — it narrows what THIS node receives on that
   * one edge and never changes the upstream's own output or its other
   * out-edges. An upstream absent from the map (or `select` absent entirely)
   * passes its WHOLE output — filtering is strictly opt-in, so existing
   * workflows are untouched. The plugin runner already honours this field
   * (slices the upstream's structured JSON per edge before prompting).
   */
  select?: Record<string, string[]>;
  /**
   * Fan-in policy when the node has several upstreams (decision D4). `all`
   * (default, omitted from YAML) waits for every upstream to settle; if a
   * branch skips one of them, this node is skipped too. `any` fires once, as
   * soon as the FIRST upstream finishes — the merge point for a branch's
   * alternative paths, or "first result wins" over parallel paths; it is
   * skipped only when every upstream was skipped.
   */
  join?: 'all' | 'any';
  /** Loop-back edge from a downstream node (one per node); see {@link FeedbackLoop}. */
  feedback?: FeedbackLoop;
  /** Reference files (requirements / examples): html / png / md, by path. */
  files?: string[];
  /** Non-structured input, to adapt the node to a specific task. */
  extra_info?: string;
}

/**
 * Loose description of the canonical output JSON. v0 keeps this as a flat
 * field -> type-hint map (e.g. `{ files: "string[]", summary: "string" }`);
 * it will tighten into a real JSON Schema / zod once the runner needs it.
 */
export type OutputSchema = Record<string, string>;

/** A node's outputs: one canonical JSON + side files + a `log.md` record. */
export interface AgentOutput {
  /** Shape of the canonical output JSON. */
  schema: OutputSchema;
  /** Side files emitted by the node, referenced by path inside the JSON. */
  files?: string[];
  /** Whether the node emits a `log.md` execution record (default: true). */
  log?: boolean;
}

/** Capabilities the node needs (the editor's "tech stack" section). v0 minimal. */
export interface TechStack {
  /** Primary abstract role (e.g. "explore", "build"). */
  agent?: string;
  abilities?: string[];
  skills?: string[];
  subagents?: string[];
  /**
   * Embedded sub-workflow (only for type === 'sub-workflow'). The referenced
   * workflow is INLINED here in full — agents, wiring, its own input/output and
   * order — so the node is self-contained and survives being copied elsewhere
   * (no external ref to resolve). The runner executes it with the same
   * scheduler as a top-level workflow — inner branch / trigger.when / loop /
   * join all apply — and folds its `output.from` nodes into this
   * node's output.
   */
  workflow?: Workflow;
}

/** Maps the abstract role onto each CLI's native agent. v1: opencode only. */
export interface AgentMapping {
  /** The opencode agent name this node runs as (e.g. "explore", "build"). */
  opencode: string;
  // claudeCode?: string; // added once Claude Code support lands
  // codex?: string;      // added once Codex support lands
}

/** A single agent node in the workflow (keyed by its id in `Workflow.agents`). */
export interface AgentDefinition {
  introduction?: string;
  type?: AgentType;
  input?: AgentInput;
  output: AgentOutput;
  tech_stack?: TechStack;
  /** Required for agent node types; OMITTED for type === 'sub-workflow' and 'tool'. */
  prompt?: string;
  /** Required for agent node types; OMITTED for type === 'sub-workflow' and 'tool'. */
  agent_mapping?: AgentMapping;
  /** What the step does, for type === 'tool' (required there; absent elsewhere). */
  tool?: ToolSpec;
  /** The questions asked, for type === 'decision' (required there; absent elsewhere). */
  decision?: DecisionSpec;
  trigger?: Trigger;
  /** Output field whose value the node routes on (type === 'branch', or a single-mode 'decision'). */
  branch_on?: string;
  /** One entry per output port, in PRIORITY order — first match wins (type === 'branch', or a single-mode 'decision'). */
  routes?: BranchRoute[];
}

/**
 * Top-level workflow input / output boundary (Phase-5 Vivado I/O). `description`
 * is the frozen v0 field (plugin ignores it at runtime); the rest are additive
 * App metadata. `to`/`from` are the wired entry/exit node ids, derived from the
 * canvas edges of the boundary node — omitted when nothing is wired.
 */
export interface WorkflowIO {
  description: string;
  schema?: OutputSchema;
  files?: string[];
  extra_info?: string;
  to?: string[];
  from?: string[];
}

/** A complete `workflow.yaml` document. */
export interface Workflow {
  introduction: string;
  /** Workflow kind, e.g. "pipeline". */
  type: string;
  /**
   * When the workflow starts by itself: a new file, a time, a page or
   * mailbox change, a git push. Read by `agentry-watch`, never by the runner —
   * the fired event reaches the entry nodes as the run's input. Only the
   * top-level workflow's `on` is watched; a sub-workflow's is ignored.
   */
  on?: WorkflowTriggers;
  input: WorkflowIO;
  output: WorkflowIO;
  /** Node id -> node definition. */
  agents: Record<string, AgentDefinition>;
  /**
   * Execution ordering. v0 is a linear list of node ids; parallel / branch /
   * loop semantics are layered on later via per-node `trigger`.
   */
  workflow: string[];
}
