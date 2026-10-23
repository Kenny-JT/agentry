/**
 * Run artifacts & checkpoint layout.
 *
 * ⚠️ PROVISIONAL. The runner writes these to `.agentry/runs/<runId>/`; the
 * panel reads them and resume rebuilds state from them. Kept in `core` as the
 * shared contract between the plugin and the editor.
 */

import type { NodeState } from './events';

export interface NodeArtifact {
  nodeId: string;
  /** Path to `<nodeId>.output.json` (the canonical structured output). */
  outputPath: string;
  /** Path to `<nodeId>.log.md` (the execution record). */
  logPath: string;
  /** Side files under `files/`, referenced by path inside the output JSON. */
  files?: string[];
}

/** `checkpoint.json` — node completion state + DAG progress; key to resume. */
export interface Checkpoint {
  runId: string;
  workflow: string;
  /** State per node id at the time of writing. */
  nodes: Record<string, NodeState>;
  /** Node ids completed so far; resume continues after these. */
  completed: string[];
  /** Node currently in flight, if any. */
  current?: string;
  /** Node ids skipped so far (branch route not chosen / trigger.when unmet); settled on resume. */
  skipped?: string[];
  /** Completed `trigger.loop` iterations per node id. */
  iterations?: Record<string, number>;
  /** Per loop-back node: extra rounds started so far, and the last feedback text handed to it. */
  loops?: Record<string, LoopCheckpoint>;
  /** Node executions spent so far (the run-wide loop budget counts these). */
  executions?: number;
  updatedAt: string;
}

/** Resume state of one loop-back edge, keyed by the node that carries `input.feedback`. */
export interface LoopCheckpoint {
  /** Node whose output fed back (`input.feedback.from`). */
  from: string;
  /** Extra rounds started, 1-based; the loop body is on round `round + 1`. */
  round: number;
  /** `from`'s output that started the current round — the next prompt's feedback, and the no-progress reference. */
  text: string;
}

export const RUN_DIR_ROOT = '.agentry/runs';
export const CHECKPOINT_FILE = 'checkpoint.json';
export const FILES_DIR = 'files';

export const outputFileName = (nodeId: string): string => `${nodeId}.output.json`;
export const logFileName = (nodeId: string): string => `${nodeId}.log.md`;
