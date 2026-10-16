/**
 * Runs: start one through the opencode server the way agentry-watch does (its Dispatcher,
 * reused), then watch it through the live panel when it answers and the run directory
 * (`.agentry/runs/<id>`: checkpoint.json, <node>.output.json, log.md) when it does not.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CHECKPOINT_FILE, RUN_DIR_ROOT, outputFileName, type Checkpoint, type NodeState, type WorkflowEvent } from '@agentry/core';
import { Dispatcher } from '@agentry/trigger/dispatch';
import { isRecord, livePanel, readJson, replayEvents, type LivePanel, type PanelInfo } from './panel';
import { ToolError } from './project';

const REPORT_FILE = 'log.md';
const PREVIEW_CHARS = 240;

export type RunStatus = 'running' | 'done' | 'failed' | 'cancelled';

export interface NodeReport {
  id: string;
  state: NodeState;
  agent?: string;
  iteration?: number;
  ms?: number;
  preview?: string;
  warnings?: string[];
}

export interface RunReport {
  run_id: string;
  status: RunStatus;
  workflow?: string;
  started_at?: string;
  updated_at?: string;
  live: boolean;
  nodes: NodeReport[];
  report?: string;
  run_dir: string;
}

export interface RunListing {
  run_id: string;
  status: RunStatus;
  workflow?: string;
  started_at?: string;
}

export interface RunsOptions {
  projectDir: string;
  serverUrl: string;
  password?: string;
  autostart: boolean;
  startScript?: string;
  opencodeBin?: string;
  log: (message: string) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const preview = (text: string): string => (text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text);
const runTime = (id: string): number => Number(/^run_(\d+)$/.exec(id)?.[1] ?? 0);
const readCheckpoint = (runDir: string): Checkpoint | null => {
  const raw = readJson(path.join(runDir, CHECKPOINT_FILE));
  return isRecord(raw) && isRecord(raw.nodes) ? (raw as unknown as Checkpoint) : null;
};

/** A run nobody is executing: finished, failed, or stopped before it could settle every node. */
function settledStatus(cp: Checkpoint | null): RunStatus {
  if (!cp) return 'cancelled';
  const states = Object.values(cp.nodes);
  if (states.includes('failed')) return 'failed';
  if (states.length && states.every((s) => s === 'done' || s === 'skipped')) return 'done';
  return 'cancelled';
}

function nodesFromDisk(cp: Checkpoint | null, runDir: string): Map<string, NodeReport> {
  const nodes = new Map<string, NodeReport>();
  for (const [id, state] of Object.entries(cp?.nodes ?? {})) {
    const node: NodeReport = { id, state, ...(cp?.iterations?.[id] ? { iteration: cp.iterations[id] } : {}) };
    const out = readJson(path.join(runDir, outputFileName(id)));
    if (isRecord(out)) {
      if (typeof out.agent === 'string') node.agent = out.agent;
      if (typeof out.elapsed_ms === 'number') node.ms = out.elapsed_ms;
      if (typeof out.iteration === 'number') node.iteration = out.iteration;
      if (typeof out.result === 'string') node.preview = preview(out.result);
      if (Array.isArray(out.schemaWarnings) && out.schemaWarnings.length) node.warnings = out.schemaWarnings.filter((w): w is string => typeof w === 'string');
    }
    nodes.set(id, node);
  }
  return nodes;
}

/** Fold the panel's replay over the on-disk picture; returns the status the events settle on. */
function applyEvents(nodes: Map<string, NodeReport>, events: WorkflowEvent[], runId: string): RunStatus {
  let status: RunStatus = 'running';
  for (const event of events) {
    if (event.runId !== runId) continue;
    switch (event.type) {
      case 'run.started':
        for (const id of event.nodeIds) nodes.set(id, nodes.get(id) ?? { id, state: 'pending' });
        break;
      case 'node.state': {
        const node = nodes.get(event.nodeId) ?? { id: event.nodeId, state: event.state };
        node.state = event.state;
        if (event.agent) node.agent = event.agent;
        if (event.iteration) node.iteration = event.iteration;
        if (event.ms !== undefined) node.ms = event.ms;
        nodes.set(event.nodeId, node);
        break;
      }
      case 'node.output': {
        const node = nodes.get(event.nodeId);
        if (node && !node.preview) node.preview = preview(event.chunk);
        break;
      }
      case 'run.finished':
        status = event.status === 'ok' ? 'done' : event.status === 'cancelled' ? 'cancelled' : 'failed';
        break;
      case 'handoff':
      case 'checkpoint':
      case 'schema.warning':
      case 'select.fallback':
        break;
      default: {
        const unreachable: never = event;
        throw new Error(`unexpected panel event ${JSON.stringify(unreachable)}`);
      }
    }
  }
  return status;
}

function startFailure(message: string, opts: RunsOptions): string {
  const plugin = path.join(opts.projectDir, '.opencode', 'plugins');
  const hasPlugin = fs.existsSync(plugin) && fs.readdirSync(plugin).some((f) => /^agentry\.(js|ts)$/.test(f));
  return [
    `could not start the run: ${message}`,
    ...(hasPlugin ? [] : [`the Agentry plugin is not in ${plugin} (expected agentry.js) — the run needs it`]),
    `opencode server: ${opts.serverUrl}${opts.autostart ? ' (started when nothing listens there; needs the opencode CLI on PATH or AGENTRY_OPENCODE_BIN)' : ' (autostart is off)'}`,
    'auth: OPENCODE_SERVER_PASSWORD when the server has one',
  ].join('\n');
}

export class Runs {
  private readonly dispatcher: Dispatcher;
  private readonly runsDir: string;

  constructor(private readonly opts: RunsOptions) {
    this.dispatcher = new Dispatcher(opts);
    this.runsDir = path.join(opts.projectDir, ...RUN_DIR_ROOT.split('/'));
  }

  private live(): Promise<LivePanel | null> {
    return livePanel(this.opts.projectDir);
  }

  private runIds(): string[] {
    if (!fs.existsSync(this.runsDir)) return [];
    return fs
      .readdirSync(this.runsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => runTime(b) - runTime(a) || b.localeCompare(a));
  }

  async start(file: string, input: string | undefined): Promise<{ run_id: string; panel_port: number }> {
    let panel: PanelInfo;
    try {
      panel = await this.dispatcher.panel();
    } catch (err) {
      throw new ToolError(startFailure(err instanceof Error ? err.message : String(err), this.opts));
    }
    const res = await fetch(`http://127.0.0.1:${panel.port}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Agentry-Token': panel.token },
      body: JSON.stringify({ workflow: file, ...(input !== undefined ? { input } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
    if (res.status === 202 && body.runId) return { run_id: body.runId, panel_port: panel.port };
    if (res.status === 409) throw new ToolError(`a run is already going (${body.runId ?? '?'}) — wait_for_run it or cancel_run first`);
    if (res.status === 401) throw new ToolError('the panel rejected the token in .agentry/panel.json — the plugin restarted; try again');
    throw new ToolError(`run refused (${res.status}): ${body.error ?? 'no reason given'}`);
  }

  async cancel(runId: string | undefined): Promise<{ run_id: string; stopping: true }> {
    const live = await this.live();
    if (!live || !live.busy) throw new ToolError('nothing is running');
    if (runId !== undefined && live.runId && live.runId !== runId) throw new ToolError(`${runId} is not running; the live run is ${live.runId}`);
    const res = await fetch(`http://127.0.0.1:${live.port}/api/stop`, { method: 'POST', signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new ToolError(`the panel answered ${res.status} to /api/stop`);
    return { run_id: live.runId ?? runId ?? '?', stopping: true };
  }

  async get(runId: string | undefined): Promise<RunReport> {
    const live = await this.live();
    const id = runId ?? (live?.busy && live.runId ? live.runId : this.runIds()[0]);
    if (!id) throw new ToolError('no runs yet — run_workflow starts one');
    const runDir = path.join(this.runsDir, id);
    const cp = readCheckpoint(runDir);
    const isLive = Boolean(live?.busy && live.runId === id);
    if (!cp && !isLive) throw new ToolError(`unknown run "${id}" — list_runs shows what exists`);

    const nodes = nodesFromDisk(cp, runDir);
    const status = isLive && live ? applyEvents(nodes, await replayEvents(live.port), id) : settledStatus(cp);
    const reportPath = path.join(runDir, REPORT_FILE);
    const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : undefined;
    return {
      run_id: id,
      status,
      ...(cp?.workflow ? { workflow: cp.workflow } : {}),
      ...(runTime(id) ? { started_at: new Date(runTime(id)).toISOString() } : {}),
      ...(cp?.updatedAt ? { updated_at: cp.updatedAt } : {}),
      live: isLive,
      nodes: [...nodes.values()],
      ...(report !== undefined ? { report } : {}),
      run_dir: runDir,
    };
  }

  async wait(runId: string, timeoutS: number): Promise<RunReport> {
    const until = Date.now() + timeoutS * 1000;
    for (;;) {
      const report = await this.get(runId);
      if (report.status !== 'running' || Date.now() >= until) return report;
      await sleep(Math.min(1000, Math.max(50, until - Date.now())));
    }
  }

  async list(limit: number): Promise<RunListing[]> {
    const live = await this.live();
    return this.runIds()
      .slice(0, limit)
      .map((id) => {
        const cp = readCheckpoint(path.join(this.runsDir, id));
        return {
          run_id: id,
          status: live?.busy && live.runId === id ? 'running' : settledStatus(cp),
          ...(cp?.workflow ? { workflow: cp.workflow } : {}),
          ...(runTime(id) ? { started_at: new Date(runTime(id)).toISOString() } : {}),
        };
      });
  }
}
