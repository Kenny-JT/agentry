/**
 * Execution semantics of the workflow.yaml contract — the ONE implementation,
 * shared by the plugin runner (esbuild bundles this into
 * `.opencode/plugins/agentry.js`) and the editor.
 *
 * Everything a user configures in the editor and the runner later honours —
 * condition matching, which branch port is taken, which upstream outputs a
 * node receives, which nodes must answer in strict JSON, how `input.select`
 * slices an upstream — is decided here, so the two sides cannot drift apart
 * again (the D3/D4 drift was two hand-kept copies of exactly this logic).
 * Pure functions: no I/O, no DOM.
 */

import { checkDecisionSpec, isBatchDecision } from './decision';
import { checkToolSpec } from './tool';
import type { AgentDefinition, BranchRoute, Condition, RouteCondition, RuntimeName, Workflow } from './workflow';

export const RUNTIME_NAMES: readonly RuntimeName[] = ['opencode', 'claude_code', 'codex'];

export const fromList = (from: string | string[] | undefined): string[] =>
  from === undefined ? [] : Array.isArray(from) ? from : [from];

/** Extra rounds a loop-back edge runs when `input.feedback.max` is omitted. */
export const FEEDBACK_DEFAULT_MAX = 3;
/** Upper bound for `input.feedback.max`. */
export const FEEDBACK_MAX_LIMIT = 10;

export const isValidFeedbackMax = (max: unknown): max is number =>
  typeof max === 'number' && Number.isInteger(max) && max >= 1 && max <= FEEDBACK_MAX_LIMIT;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Nodes whose `branch_on` + `routes[]` pick one downstream port: a branch, or a single-mode decision that names `branch_on`. */
export const isRouter = (def: Pick<AgentDefinition, 'type' | 'decision' | 'branch_on'>): boolean =>
  def.type === 'branch' || (def.type === 'decision' && !isBatchDecision(def.decision) && Boolean(def.branch_on?.trim()));

/** `trigger.when` / `loop.exit_when` against an upstream's raw output text — case-insensitive, AND-combined. */
export function matchesCondition(output: string, cond: Condition): boolean {
  const lower = output.toLowerCase().trim();
  if (cond.contains && !lower.includes(String(cond.contains).toLowerCase())) return false;
  if (cond.not_contains && lower.includes(String(cond.not_contains).toLowerCase())) return false;
  if (cond.equals && lower !== String(cond.equals).toLowerCase().trim()) return false;
  return true;
}

const hasCondition = (when: RouteCondition | undefined): when is RouteCondition =>
  when !== undefined && Object.keys(when).length > 0;

/** One branch port's gate against the branch's `branch_on` value. */
export function matchesRoute(value: unknown, when: RouteCondition): boolean {
  const str = String(value).toLowerCase().trim();
  const num = typeof value === 'number' ? value : Number(value);
  if (when.equals !== undefined && str !== String(when.equals).toLowerCase().trim()) return false;
  if (when.contains !== undefined && !str.includes(String(when.contains).toLowerCase())) return false;
  if (when.not_contains !== undefined && str.includes(String(when.not_contains).toLowerCase())) return false;
  if (when.gte !== undefined && !(num >= when.gte)) return false;
  if (when.gt !== undefined && !(num > when.gt)) return false;
  if (when.lte !== undefined && !(num <= when.lte)) return false;
  if (when.lt !== undefined && !(num < when.lt)) return false;
  return true;
}

/**
 * The single port a branch takes (decision D16): conditioned routes are tried
 * in `routes[]` order and the FIRST match wins — list order is priority. A
 * default route (no condition) is the fallback when nothing matched, wherever
 * it sits in the list; with several defaults the first one wins. `undefined`
 * = no port taken (nothing matched and there is no default).
 */
export function pickBranchRoute(routes: readonly BranchRoute[], value: unknown): BranchRoute | undefined {
  return (
    routes.find((route) => hasCondition(route.when) && matchesRoute(value, route.when)) ??
    routes.find((route) => !hasCondition(route.when))
  );
}

/** Every branch routing into each node (branch→child edges live only in the branch's `routes[]`). */
export function branchParents(workflow: Pick<Workflow, 'agents'>): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const [id, def] of Object.entries(workflow.agents)) {
    if (!isRouter(def) || !def.routes) continue;
    for (const route of def.routes) {
      const list = parents.get(route.to) ?? [];
      if (!list.includes(id)) list.push(id);
      parents.set(route.to, list);
    }
  }
  return parents;
}

/**
 * The upstreams whose output a node's prompt receives: `input.from` ∪ its
 * branch parents, order kept. Prompt building and strict-JSON gating both use
 * this one union so they can never disagree about which edges are live.
 */
export function inputSources(def: AgentDefinition, parents: readonly string[] = []): string[] {
  const sources = [...fromList(def.input?.from)];
  for (const parent of parents) if (!sources.includes(parent)) sources.push(parent);
  return sources;
}

/** Fan-in policy (decision D4): `any` fires on the first upstream that finishes; default `all` waits for every one. */
export const joinMode = (def: AgentDefinition): 'all' | 'any' => (def.input?.join === 'any' ? 'any' : 'all');

/**
 * Nodes that must answer in strict JSON at run time — derived,
 * never user-toggled: a branch with a `branch_on` field (its value picks the
 * port) and every upstream a consumer keeps `select`ed fields from over a LIVE
 * edge (the slice needs keys). A dangling `select` key forces nothing.
 */
export function strictJsonNodes(workflow: Pick<Workflow, 'agents'>): Set<string> {
  const strict = new Set<string>();
  const parents = branchParents(workflow);
  for (const [id, def] of Object.entries(workflow.agents)) {
    if (def.type === 'branch' && def.branch_on) strict.add(id);
    const select = def.input?.select;
    if (!isRecord(select)) continue;
    const sources = inputSources(def, parents.get(id) ?? []);
    // a tool or decision node's output is JSON by construction — nothing to force
    for (const upstream of Object.keys(select)) {
      const upstreamType = workflow.agents[upstream]?.type;
      if (sources.includes(upstream) && upstreamType !== 'tool' && upstreamType !== 'decision') strict.add(upstream);
    }
  }
  return strict;
}

export function stripJsonFences(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return match?.[1] !== undefined ? match[1].trim() : text.trim();
}

/**
 * Recover a JSON object from free-form agent text: fenced/plain parse first,
 * then the first balanced-brace span (agents often wrap JSON in prose).
 */
export function extractJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stripJsonFences(text));
    if (isRecord(parsed)) return parsed;
  } catch {
    // not plain JSON — fall through to the brace scan
  }
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth !== 0) continue;
      try {
        const parsed: unknown = JSON.parse(text.slice(start, i + 1));
        if (isRecord(parsed)) return parsed;
      } catch {
        // unbalanced inside strings — give up below
      }
      return null;
    }
  }
  return null;
}

/** How a `select` filter degraded instead of applying exactly as configured (decision D18). */
export type SelectFallback =
  | { reason: 'unparseable' }
  | { reason: 'missing-fields'; missing: string[] };

export interface SelectSlice {
  /** What the consuming node's prompt receives for this edge. */
  text: string;
  /** Set when the filter could not apply as configured — the runner must surface it, never swallow it. */
  fallback?: SelectFallback;
}

/**
 * Slice one upstream's output for one edge's `input.select` entry. The list
 * names the fields KEPT:
 *   absent → the whole output passes (filtering is opt-in);
 *   `[]`   → `"{}"` — nothing passes, whether or not the upstream parses;
 *   `[a]`  → JSON with just those keys.
 * Two degradations remain by decision (D18 option B) but are REPORTED through
 * `fallback`: an upstream that is not JSON passes WHOLE ('unparseable'), and
 * kept fields the upstream did not produce are left out ('missing-fields').
 */
export function sliceUpstream(text: string, fields: readonly string[] | undefined): SelectSlice {
  if (!fields) return { text };
  if (fields.length === 0) return { text: '{}' };
  const parsed = extractJson(text);
  if (!parsed) return { text, fallback: { reason: 'unparseable' } };
  const picked: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const field of fields) {
    if (field in parsed) picked[field] = parsed[field];
    else missing.push(field);
  }
  const slice: SelectSlice = { text: JSON.stringify(picked) };
  if (missing.length) slice.fallback = { reason: 'missing-fields', missing };
  return slice;
}

export type RunnableCheck = { ok: true; workflow: Workflow } | { ok: false; errors: string[] };

/**
 * Structural gate the runner applies to a parsed workflow.yaml before
 * executing it: the shape the scheduler relies on — required fields, every
 * node reference resolving, enum fields in range. Lives next to the types so a
 * contract change updates both at once (D7). Sub-workflow bodies are checked
 * when they run.
 */
export function checkRunnable(raw: unknown): RunnableCheck {
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['Workflow must be an object'] };
  if (typeof raw.introduction !== 'string') errors.push('missing introduction');
  if (typeof raw.type !== 'string') errors.push('missing type');
  if (!isRecord(raw.input)) errors.push('missing input');
  if (!isRecord(raw.output)) errors.push('missing output');

  const agents = isRecord(raw.agents) ? raw.agents : null;
  if (!agents) errors.push('missing agents');
  const ids = new Set(agents ? Object.keys(agents) : []);

  for (const [id, value] of Object.entries(agents ?? {})) {
    if (!isRecord(value)) {
      errors.push(`agents.${id}: not an object`);
      continue;
    }
    // sub-workflow nodes are containers, tool nodes run no model and decision nodes only name a
    // fallback agent — none of them has a prompt
    if (value.type === 'tool') errors.push(...checkToolSpec(id, value.tool));
    else if (value.type === 'decision') errors.push(...checkDecisionSpec(id, value.decision, value.routes !== undefined));
    else if (value.type !== 'sub-workflow') {
      if (typeof value.prompt !== 'string') errors.push(`agents.${id}: missing prompt`);
      if (!isRecord(value.agent_mapping)) errors.push(`agents.${id}: missing agent_mapping`);
      else {
        for (const host of RUNTIME_NAMES) {
          const name = value.agent_mapping[host];
          if (name !== undefined && typeof name !== 'string') errors.push(`agents.${id}.agent_mapping.${host}: expected a string`);
        }
      }
    }

    const input = isRecord(value.input) ? value.input : null;
    if (input?.from !== undefined) {
      for (const ref of Array.isArray(input.from) ? input.from : [input.from]) {
        if (typeof ref !== 'string') errors.push(`agents.${id}.input.from: expected string or string[], got ${typeof ref}`);
        else if (!ids.has(ref)) errors.push(`agents.${id}.input.from: references unknown agent "${ref}"`);
      }
    }
    if (input?.join !== undefined && input.join !== 'all' && input.join !== 'any') {
      errors.push(`agents.${id}.input.join: expected "all" or "any", got ${JSON.stringify(input.join)}`);
    }
    if (input?.feedback !== undefined) {
      const feedback = input.feedback;
      if (!isRecord(feedback)) errors.push(`agents.${id}.input.feedback: expected object`);
      else {
        if (typeof feedback.from !== 'string') errors.push(`agents.${id}.input.feedback.from: required string`);
        else if (!ids.has(feedback.from)) errors.push(`agents.${id}.input.feedback.from: references unknown agent "${feedback.from}"`);
        if (feedback.when !== undefined && !isRecord(feedback.when)) errors.push(`agents.${id}.input.feedback.when: expected object`);
        if (feedback.max !== undefined && !isValidFeedbackMax(feedback.max)) {
          errors.push(`agents.${id}.input.feedback.max: expected an integer from 1 to ${FEEDBACK_MAX_LIMIT}`);
        }
      }
    }
    if (input?.select !== undefined) {
      if (!isRecord(input.select)) errors.push(`agents.${id}.input.select: expected an object of upstream id -> field list`);
      else {
        for (const [upstream, fields] of Object.entries(input.select)) {
          if (!Array.isArray(fields) || fields.some((field) => typeof field !== 'string')) {
            errors.push(`agents.${id}.input.select.${upstream}: expected a list of field names`);
          }
        }
      }
    }

    if (isRecord(value.trigger)) {
      const { when, loop } = value.trigger;
      if (when !== undefined) {
        if (!isRecord(when)) errors.push(`agents.${id}.trigger.when: expected object`);
        else if (typeof when.from !== 'string') errors.push(`agents.${id}.trigger.when.from: required string`);
        else if (!ids.has(when.from)) errors.push(`agents.${id}.trigger.when.from: references unknown agent "${when.from}"`);
      }
      if (loop !== undefined) {
        if (!isRecord(loop)) errors.push(`agents.${id}.trigger.loop: expected object`);
        else if (typeof loop.max !== 'number' || loop.max < 1) errors.push(`agents.${id}.trigger.loop.max: required positive number`);
      }
    }

    if ((value.type === 'branch' || value.type === 'decision') && value.routes !== undefined) {
      if (!Array.isArray(value.routes)) errors.push(`agents.${id}.routes: expected a list`);
      else {
        value.routes.forEach((route: unknown, index: number) => {
          if (!isRecord(route) || typeof route.to !== 'string') errors.push(`agents.${id}.routes[${index}].to: required string`);
          else if (!ids.has(route.to)) errors.push(`agents.${id}.routes[${index}].to: references unknown agent "${route.to}"`);
        });
      }
    }
  }

  if (!Array.isArray(raw.workflow)) errors.push('missing workflow array');
  else if (agents) {
    for (const item of raw.workflow) {
      if (typeof item !== 'string') errors.push('workflow[]: expected string');
      else if (!ids.has(item)) errors.push(`workflow[]: unknown node "${item}"`);
    }
  }
  // The checks above establish every field the runner reads, so this is the one
  // place a parsed document becomes a typed Workflow.
  return errors.length ? { ok: false, errors } : { ok: true, workflow: raw as unknown as Workflow };
}
