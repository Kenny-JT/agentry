/**
 * One Agentry project on disk: the `workflows/` folder and what the tools may do to it.
 * Every file argument a host passes is a path under `workflows/` — nothing else is readable
 * or writable through the server.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  activeTriggerKinds,
  checkRunnable,
  describeTrigger,
  fromList,
  normalizeWorkflow,
  validateWorkflow,
  workflowToYaml,
  type AgentDefinition,
  type BranchRoute,
  type ValidationIssue,
  type Workflow,
  type WorkflowTriggers,
} from '@agentry/core';

export const WORKFLOWS_DIR = 'workflows';

/** A tool refused: the message is for the host's model, so it says what to do instead. */
export class ToolError extends Error {}

export interface WorkflowListing {
  file: string;
  introduction: string;
  nodes: number;
  triggers: string[];
  error?: string;
}

export interface NodeSummary {
  id: string;
  type: string;
  agent?: string;
  from: string[];
  routes?: BranchRoute[];
  trigger?: AgentDefinition['trigger'];
}

export interface WorkflowCheck {
  workflow: Workflow;
  issues: ValidationIssue[];
  errors: number;
}

const summarizeNode = (id: string, def: AgentDefinition): NodeSummary => ({
  id,
  type: def.type ?? 'straight',
  ...(def.agent_mapping?.opencode ? { agent: def.agent_mapping.opencode } : {}),
  from: fromList(def.input?.from),
  ...(def.routes ? { routes: def.routes.map((r) => ({ to: r.to, ...(r.when ? { when: r.when } : {}) })) } : {}),
  ...(def.trigger ? { trigger: def.trigger } : {}),
});

export const summarizeNodes = (workflow: Workflow): NodeSummary[] =>
  Object.entries(workflow.agents).map(([id, def]) => summarizeNode(id, def));

/** The runner's structural gate + the editor's static checks, as one issue list. */
export function checkWorkflow(raw: unknown): WorkflowCheck {
  const workflow = normalizeWorkflow(raw);
  const runnable = checkRunnable(JSON.parse(JSON.stringify(workflow)) as unknown);
  const issues: ValidationIssue[] = runnable.ok
    ? []
    : runnable.errors.map((message) => ({ severity: 'error', code: 'not-runnable', message }));
  issues.push(...validateWorkflow(workflow));
  return { workflow, issues, errors: issues.filter((i) => i.severity === 'error').length };
}

export function parseWorkflowText(text: string): unknown {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new ToolError(`YAML does not parse: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new ToolError('the YAML must be a mapping (introduction, type, input, output, agents, workflow)');
  return raw;
}

export class Project {
  readonly dir: string;
  readonly workflowsDir: string;

  constructor(dir: string) {
    this.dir = path.resolve(dir);
    this.workflowsDir = path.join(this.dir, WORKFLOWS_DIR);
  }

  /** `workflows/<rel>` (posix) for a host-supplied path; refuses anything that leaves the folder. */
  relativeFile(file: string): string {
    const raw = file.trim().replace(/\\/g, '/');
    if (!raw) throw new ToolError('file is required (a path under workflows/, e.g. workflows/review.yaml)');
    if (path.isAbsolute(raw) || /^[A-Za-z]:\//.test(raw)) throw new ToolError(`file must be relative to the project (got "${file}")`);
    const parts = raw.split('/').filter((p) => p !== '' && p !== '.');
    if (parts.includes('..')) throw new ToolError(`file must stay inside workflows/ (got "${file}")`);
    if (parts[0] === WORKFLOWS_DIR) parts.shift();
    if (!parts.length) throw new ToolError(`file names a folder, not a workflow (got "${file}")`);
    if (!/\.ya?ml$/i.test(parts[parts.length - 1] ?? '')) throw new ToolError(`file must end in .yaml or .yml (got "${file}")`);
    return path.posix.join(WORKFLOWS_DIR, ...parts);
  }

  absoluteFile(file: string): string {
    return path.join(this.dir, ...this.relativeFile(file).split('/'));
  }

  readText(file: string): string {
    const abs = this.absoluteFile(file);
    if (!fs.existsSync(abs)) throw new ToolError(`${this.relativeFile(file)} does not exist — list_workflows shows what is there`);
    return fs.readFileSync(abs, 'utf8');
  }

  listFiles(): string[] {
    if (!fs.existsSync(this.workflowsDir)) return [];
    const out: string[] = [];
    const walk = (dir: string, rel: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath);
        else if (/\.ya?ml$/i.test(entry.name)) out.push(path.posix.join(WORKFLOWS_DIR, relPath));
      }
    };
    walk(this.workflowsDir, '');
    return out;
  }

  list(): WorkflowListing[] {
    return this.listFiles().map((file) => {
      try {
        const raw = parseWorkflowText(this.readText(file)) as { introduction?: unknown; agents?: unknown; on?: unknown };
        const agents = typeof raw.agents === 'object' && raw.agents !== null ? Object.keys(raw.agents) : [];
        const on = raw.on as WorkflowTriggers | undefined;
        const triggers = typeof on === 'object' && on !== null ? activeTriggerKinds(on).map((kind) => describeTrigger(kind, on)) : [];
        return { file, introduction: typeof raw.introduction === 'string' ? raw.introduction : '', nodes: agents.length, triggers };
      } catch (err) {
        return { file, introduction: '', nodes: 0, triggers: [], error: err instanceof Error ? err.message : String(err) };
      }
    });
  }

  /** Parse + check a file (or a YAML text handed in directly). */
  check(file: string | undefined, yaml: string | undefined): WorkflowCheck & { yaml: string } {
    const text = yaml ?? (file !== undefined ? this.readText(file) : undefined);
    if (text === undefined) throw new ToolError('pass file (a path under workflows/) or yaml (the text to check)');
    return { ...checkWorkflow(parseWorkflowText(text)), yaml: text };
  }

  /** Write `text` to `file`; errors block it unless `force`, an existing file unless `overwrite`. */
  save(file: string, text: string, opts: { overwrite: boolean; force: boolean }): { file: string; issues: ValidationIssue[]; errors: number; written: boolean } {
    const rel = this.relativeFile(file);
    const abs = this.absoluteFile(file);
    const { issues, errors } = checkWorkflow(parseWorkflowText(text));
    if (fs.existsSync(abs) && !opts.overwrite) throw new ToolError(`${rel} already exists — pass overwrite: true to replace it`);
    if (errors && !opts.force) throw new ToolError(`${rel} not written: ${errors} error(s) — fix them or pass force: true\n${issues.filter((i) => i.severity === 'error').map((i) => `- ${i.message}`).join('\n')}`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text.endsWith('\n') ? text : `${text}\n`);
    return { file: rel, issues, errors, written: true };
  }

  /** Serialize a (possibly edited) workflow back to its file; same gates as {@link save}. */
  saveWorkflow(file: string, workflow: Workflow, force: boolean): { file: string; yaml: string; issues: ValidationIssue[]; errors: number } {
    const yaml = workflowToYaml(workflow);
    const result = this.save(file, yaml, { overwrite: true, force });
    return { file: result.file, yaml, issues: result.issues, errors: result.errors };
  }
}
