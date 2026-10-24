/**
 * Pure helpers behind the AI chat's propose / preview / apply loop: pulling the
 * workflow out of a model reply, describing what it would change, and placing
 * it on the canvas without moving the nodes the user already arranged.
 * Type-only imports, so the unit tests run under plain `node --test`.
 */
import type { AgentDefinition, Workflow } from '@agentry/core';

/** Ids of the workflow's boundary ports, as they appear in edge summaries. */
export const SUMMARY_INPUT_ID = 'input';
export const SUMMARY_OUTPUT_ID = 'output';

const FENCE = /```[ \t]*([A-Za-z0-9_-]*)[^\n]*\n([\s\S]*?)```/g;

/**
 * The workflow YAML of a reply: the longest fenced ```yaml / ```yml block (the
 * complete file, when the model also quotes a snippet), or the longest
 * untagged block when no block is tagged. Null when the reply has no closed
 * fence; an unterminated block is a truncated reply, not a workflow.
 */
export function extractYamlBlock(text: string): string | null {
  const tagged: string[] = [];
  const untagged: string[] = [];
  for (const match of text.matchAll(FENCE)) {
    const tag = (match[1] ?? '').toLowerCase();
    const body = (match[2] ?? '').trim();
    if (!body) continue;
    if (tag === 'yaml' || tag === 'yml') tagged.push(body);
    else if (tag === '') untagged.push(body);
  }
  const candidates = tagged.length ? tagged : untagged;
  if (!candidates.length) return null;
  return candidates.reduce((best, block) => (block.length > best.length ? block : best));
}

export interface EdgeRef {
  from: string;
  to: string;
}

export interface ChangeSummary {
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesChanged: string[];
  edgesAdded: EdgeRef[];
  edgesRemoved: EdgeRef[];
  /** Introduction, type, triggers or the input / output descriptions differ. */
  metaChanged: boolean;
}

export const isEmptyChange = (summary: ChangeSummary): boolean =>
  !summary.metaChanged &&
  summary.nodesAdded.length +
    summary.nodesRemoved.length +
    summary.nodesChanged.length +
    summary.edgesAdded.length +
    summary.edgesRemoved.length ===
    0;

/** JSON with object keys sorted at every level, so two definitions compare by content. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableJson(inner)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const fromList = (from: string | string[] | undefined): string[] =>
  from === undefined ? [] : Array.isArray(from) ? from : [from];

/**
 * Every edge a workflow file implies, keyed `from>to`: `input.from` fan-in,
 * branch `routes[]`, and the boundary wiring (`input.to`, `output.from`).
 */
export function workflowEdges(workflow: Workflow): Map<string, EdgeRef> {
  const edges = new Map<string, EdgeRef>();
  const add = (from: string, to: string) => edges.set(`${from}>${to}`, { from, to });
  for (const [id, def] of Object.entries(workflow.agents)) {
    for (const from of fromList(def.input?.from)) add(from, id);
    if (def.type === 'branch') for (const route of def.routes ?? []) add(id, route.to);
  }
  for (const to of workflow.input.to ?? []) add(SUMMARY_INPUT_ID, to);
  for (const from of workflow.output.from ?? []) add(from, SUMMARY_OUTPUT_ID);
  return edges;
}

const metaOf = (workflow: Workflow): string => {
  const { to: _to, ...input } = workflow.input;
  const { from: _from, ...output } = workflow.output;
  return stableJson({ introduction: workflow.introduction, type: workflow.type, on: workflow.on, input, output });
};

/** What applying `after` over `before` would do, node by node and edge by edge. */
export function summarizeWorkflowChange(before: Workflow, after: Workflow): ChangeSummary {
  const beforeAgents: Record<string, AgentDefinition> = before.agents;
  const afterAgents: Record<string, AgentDefinition> = after.agents;
  const nodesAdded = Object.keys(afterAgents).filter((id) => !(id in beforeAgents));
  const nodesRemoved = Object.keys(beforeAgents).filter((id) => !(id in afterAgents));
  const nodesChanged = Object.keys(afterAgents).filter((id) => {
    const previous = beforeAgents[id];
    const next = afterAgents[id];
    return previous !== undefined && next !== undefined && stableJson(previous) !== stableJson(next);
  });
  const beforeEdges = workflowEdges(before);
  const afterEdges = workflowEdges(after);
  const edgesAdded = [...afterEdges].filter(([key]) => !beforeEdges.has(key)).map(([, edge]) => edge);
  const edgesRemoved = [...beforeEdges].filter(([key]) => !afterEdges.has(key)).map(([, edge]) => edge);
  return { nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved, metaChanged: metaOf(before) !== metaOf(after) };
}

export interface Positioned {
  id: string;
  position: { x: number; y: number };
}

export interface PlacementEdge {
  source: string;
  target: string;
}

/** Horizontal distance a new node is placed to the right of the node that feeds it. */
export const PLACEMENT_COLUMN_GAP = 320;

/**
 * Positions for the proposed nodes: a node whose id survives keeps the spot the
 * user gave it; a new node goes one column to the right of the nodes feeding it
 * (level with them), which is where "a step after X" belongs; a new node with no
 * placed upstream keeps its layout position. Overlaps are the caller's business
 * (the canvas settles them like any other load).
 */
export function mergeNodePositions<T extends Positioned>(
  current: readonly Positioned[],
  proposed: readonly T[],
  edges: readonly PlacementEdge[] = [],
  columnGap: number = PLACEMENT_COLUMN_GAP,
): T[] {
  const placed = new Map(current.map((node) => [node.id, node.position]));
  const kept = new Set(placed.keys());
  const pending = proposed.filter((node) => !kept.has(node.id));
  // Several passes: a new node fed only by another new node is placed once that one is.
  for (let pass = 0; pass < pending.length; pass += 1) {
    let progress = false;
    for (const node of pending) {
      if (placed.has(node.id)) continue;
      const upstream = edges
        .filter((edge) => edge.target === node.id && placed.has(edge.source))
        .map((edge) => placed.get(edge.source))
        .filter((position): position is { x: number; y: number } => position !== undefined);
      if (!upstream.length) continue;
      const x = Math.max(...upstream.map((position) => position.x)) + columnGap;
      const y = upstream.reduce((sum, position) => sum + position.y, 0) / upstream.length;
      placed.set(node.id, { x: Math.round(x), y: Math.round(y) });
      progress = true;
    }
    if (!progress) break;
  }
  return proposed.map((node) => {
    const position = placed.get(node.id);
    return position ? { ...node, position: { x: position.x, y: position.y } } : node;
  });
}
