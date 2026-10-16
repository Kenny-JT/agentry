/**
 * Execution events.
 *
 * ❄️ FROZEN against the plugin's real emissions. The runner (plugin) emits these; the run-mode panel and the
 * editor consume them. Kept in `core` so both ends share one definition.
 * All later additions are optional (`?`) for backward
 * compatibility with older event streams.
 */

/**
 * Unified node state. Drives the canonical status colors in @agentry/design.
 * `skipped` = the node was bypassed by a branch route / trigger condition:
 * rendered muted, clearly distinct from `failed`.
 */
export type NodeState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** Terminal status of a whole run. */
export type RunStatus = 'ok' | 'error' | 'cancelled';

interface BaseEvent {
  /** Id of the run this event belongs to. */
  runId: string;
  /** ISO-8601 timestamp. */
  at: string;
}

/** workflow started — initialize the node graph. */
export interface RunStartedEvent extends BaseEvent {
  type: 'run.started';
  /** Workflow id / introduction. */
  workflow: string;
  /** Node ids present in the graph. */
  nodeIds: string[];
  /** Dependency map: nodeId -> upstream nodeIds. */
  deps?: Record<string, string[]>;
}

/** A node changed state — update its color. */
export interface NodeStateEvent extends BaseEvent {
  type: 'node.state';
  nodeId: string;
  state: NodeState;
  /** opencode agent executing the node. */
  agent?: string;
  /** Current `trigger.loop` iteration, 1-based. */
  iteration?: number;
  /** True while the node is re-firing under `trigger.loop`. */
  looping?: boolean;
  /** Wall-clock duration of the node run in milliseconds. */
  ms?: number;
}

/** A node produced an output fragment — scroll it on the node. */
export interface NodeOutputEvent extends BaseEvent {
  type: 'node.output';
  nodeId: string;
  chunk: string;
}

/** A file was handed from one node to another — animate the edge. */
export interface HandoffEvent extends BaseEvent {
  type: 'handoff';
  from: string;
  to: string;
  /** Path of the artifact passed A -> B. */
  artifact?: string;
}

/** A checkpoint was reached — mark a resumable position. */
export interface CheckpointEvent extends BaseEvent {
  type: 'checkpoint';
  /** Last completed node. */
  nodeId: string;
}

/** workflow finished — wrap up. */
export interface RunFinishedEvent extends BaseEvent {
  type: 'run.finished';
  status: RunStatus;
}

/** A node's structured output failed schema validation — surface it. */
export interface SchemaWarningEvent extends BaseEvent {
  type: 'schema.warning';
  nodeId: string;
  warnings: string[];
}

/**
 * An `input.select` filter could not apply as configured (decision D18) — the
 * runner passed what it could and says so instead of degrading silently.
 * `unparseable`: the upstream output was not JSON, so it passed WHOLE,
 * unfiltered. `missing-fields`: the kept fields in `missing` were absent, the
 * rest passed. Inside a sub-workflow, `nodeId` is the sub-workflow node and
 * `from` the inner `consumer/upstream` path.
 */
export interface SelectFallbackEvent extends BaseEvent {
  type: 'select.fallback';
  nodeId: string;
  from: string;
  reason: 'unparseable' | 'missing-fields';
  missing?: string[];
}

/** The discriminated union of all execution events. */
export type WorkflowEvent =
  | RunStartedEvent
  | NodeStateEvent
  | NodeOutputEvent
  | HandoffEvent
  | CheckpointEvent
  | RunFinishedEvent
  | SchemaWarningEvent
  | SelectFallbackEvent;

/** All possible `WorkflowEvent.type` discriminants. */
export type WorkflowEventType = WorkflowEvent['type'];
