/**
 * Bridge between a {@link Workflow} (workflow.yaml shape) and the React Flow
 * graph the canvas renders. The editor exports its graph back to a Workflow;
 * the run panel turns a parsed Workflow into a graph. Shared so both stay in
 * lockstep.
 *
 * BRANCH ROUTING (2026-07-12). A `branch` node does NOT feed its children
 * through their `input.from`; instead it owns a `routes[]` list (one entry per
 * out-edge, in port order) with a per-port `when` gate + a `branch_on` output
 * field. So a branch→child edge is serialized ONLY on the branch (as a route),
 * and is PARTITIONED OUT of the child's `input.from`. To keep every consumer
 * (depth layout, topo order, fan-in) honest, both directions build ONE combined
 * edge list — from `input.from` for non-branch deps AND from `routes[]` for
 * branch deps — and derive everything from that.
 */

import { activeTriggerKinds } from '@agentry/core';
import type { AgentDefinition, AgentInput, BranchRoute, Workflow, WorkflowIO, WorkflowTriggers } from '@agentry/core';
import type { AgentFlowNode, WorkflowEdge } from './types';
import { BRANCH_REAR } from './volume';

export const WORKFLOW_INPUT_ID = '__workflow_input__';
export const WORKFLOW_OUTPUT_ID = '__workflow_output__';

const BOUNDARY_IDS = new Set<string>([WORKFLOW_INPUT_ID, WORKFLOW_OUTPUT_ID]);

export const isBoundaryId = (id: string): boolean => BOUNDARY_IDS.has(id);

export interface WorkflowMeta {
  introduction: string;
  type: string;
  on?: WorkflowTriggers;
  input: WorkflowIO;
  output: WorkflowIO;
}

export interface WorkflowGraph {
  meta: WorkflowMeta;
  nodes: AgentFlowNode[];
  edges: WorkflowEdge[];
}

export interface LayoutOptions {
  columnGap: number;
  rowGap: number;
  originX: number;
  originY: number;
}

const DEFAULT_LAYOUT: LayoutOptions = { columnGap: 320, rowGap: 132, originX: 40, originY: 60 };

export const edgeId = (source: string, target: string): string => `e-${source}-${target}`;

const fromList = (from: string | string[] | undefined): string[] =>
  from === undefined ? [] : Array.isArray(from) ? from : [from];

function boundaryDefinition(
  kind: 'workflow-input' | 'workflow-output',
  io: WorkflowIO,
): AgentDefinition {
  const input: AgentInput = {};
  if (io.files && io.files.length) input.files = io.files;
  if (io.extra_info) input.extra_info = io.extra_info;
  return {
    introduction: io.description ?? '',
    type: kind,
    ...(Object.keys(input).length ? { input } : {}),
    output: { schema: io.schema ?? {} },
    prompt: '',
    agent_mapping: { opencode: '' },
  };
}

function boundaryNode(
  id: string,
  kind: 'workflow-input' | 'workflow-output',
  io: WorkflowIO,
  x: number,
  y: number,
  triggers?: WorkflowTriggers,
): AgentFlowNode {
  return {
    id,
    type: 'agent' as const,
    deletable: false,
    position: { x, y },
    data: { agentId: id, state: 'pending', definition: boundaryDefinition(kind, io), ...(triggers ? { triggers } : {}) },
  };
}

function boundaryIO(
  node: AgentFlowNode | undefined,
  fallback: WorkflowIO,
  wiring: { to?: string[]; from?: string[] },
): WorkflowIO {
  const def = node?.data.definition;
  const io: WorkflowIO = { description: def?.introduction ?? fallback.description ?? '' };
  const schema = def?.output?.schema ?? fallback.schema;
  if (schema && Object.keys(schema).length) io.schema = schema;
  const files = def?.input?.files ?? fallback.files;
  if (files && files.length) io.files = files;
  const extra = def?.input?.extra_info ?? fallback.extra_info;
  if (extra) io.extra_info = extra;
  if (wiring.to && wiring.to.length) io.to = wiring.to;
  if (wiring.from && wiring.from.length) io.from = wiring.from;
  return io;
}

/**
 * The complete edge set of a workflow, from BOTH `input.from` (non-branch deps)
 * and every branch node's `routes[]` (branch deps). Deduped, in a stable order:
 * a node's fan-in edges first, then its branch routes in port order.
 */
function edgesFromWorkflow(workflow: Workflow, ids: string[]): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  const seen = new Set<string>();
  const push = (source: string, target: string, loop = false) => {
    if (!workflow.agents[source] || !workflow.agents[target]) return;
    const id = edgeId(source, target);
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, source, target, type: 'orthogonal', ...(loop ? { data: { loop: true } } : {}) });
  };
  for (const id of ids) {
    const def = workflow.agents[id];
    if (!def) continue;
    for (const from of fromList(def.input?.from)) push(from, id);
    const loopFrom = def.input?.feedback?.from;
    if (loopFrom) push(loopFrom, id, true);
    if (def.type === 'branch' && def.routes) {
      for (const route of def.routes) push(id, route.to);
    }
  }
  return edges;
}

export function workflowToGraph(workflow: Workflow, layout: Partial<LayoutOptions> = {}): WorkflowGraph {
  const opts = { ...DEFAULT_LAYOUT, ...layout };
  const ids = workflow.workflow.length ? workflow.workflow : Object.keys(workflow.agents);

  const edges = edgesFromWorkflow(workflow, ids);

  // a loop-back edge points at an earlier column; laying it out as a dependency would fold the loop
  const depthOf = buildDepths(ids, edges.filter((edge) => edge.data?.loop !== true));
  // A documenter has no wired inputs but runs after everything: lay it out in the last column
  // (under the sinks) instead of column 0, where "no inputs" would otherwise put it.
  const isDocumenter = (id: string) => workflow.agents[id]?.type === 'documenter';
  const lastDepth = Math.max(0, ...ids.filter((id) => !isDocumenter(id)).map((id) => depthOf.get(id) ?? 0));
  for (const id of ids) {
    if (isDocumenter(id) && !edges.some((edge) => edge.target === id)) depthOf.set(id, lastDepth);
  }
  const columns = new Map<number, string[]>();
  for (const id of ids) {
    const depth = depthOf.get(id) ?? 0;
    const column = columns.get(depth) ?? [];
    column.push(id);
    columns.set(depth, column);
  }
  const tallest = Math.max(1, ...[...columns.values()].map((c) => c.length));
  const maxDepth = Math.max(0, ...depthOf.values());

  // Per-column X: a column that contains a BRANCH projects a ~132px rear
  // collision volume, so the NEXT column must start that much further right or
  // the branch's volume overlaps its neighbour (which traps the neighbour's
  // engine pin → a non-avoiding route). Only branch columns pay the extra width.
  const branchDepths = new Set<number>();
  for (const id of ids) {
    if (workflow.agents[id]?.type === 'branch') branchDepths.add(depthOf.get(id) ?? 0);
  }
  const colX = new Map<number, number>();
  let cursor = opts.originX;
  for (let d = 0; d <= maxDepth; d += 1) {
    colX.set(d, cursor);
    cursor += opts.columnGap + (branchDepths.has(d) ? BRANCH_REAR : 0);
  }
  const xAt = (depth: number): number => colX.get(depth) ?? opts.originX + depth * opts.columnGap;

  const nodes: AgentFlowNode[] = ids.flatMap((id) => {
    const definition = workflow.agents[id];
    if (!definition) return [];
    const depth = depthOf.get(id) ?? 0;
    const column = columns.get(depth) ?? [];
    const row = column.indexOf(id);
    const offset = (tallest - column.length) / 2;
    return [
      {
        id,
        type: 'agent' as const,
        position: {
          x: xAt(depth),
          y: opts.originY + (row + offset) * opts.rowGap,
        },
        data: { agentId: id, state: 'pending', definition },
      },
    ];
  });
  const centerY = opts.originY + ((tallest - 1) / 2) * opts.rowGap;
  const inputNode = boundaryNode(
    WORKFLOW_INPUT_ID,
    'workflow-input',
    workflow.input,
    opts.originX - opts.columnGap,
    centerY,
    workflow.on,
  );
  const outputNode = boundaryNode(
    WORKFLOW_OUTPUT_ID,
    'workflow-output',
    workflow.output,
    cursor,
    centerY,
  );

  const boundaryEdges: WorkflowEdge[] = [];
  for (const to of workflow.input.to ?? []) {
    if (workflow.agents[to]) {
      boundaryEdges.push({ id: edgeId(WORKFLOW_INPUT_ID, to), source: WORKFLOW_INPUT_ID, target: to, type: 'orthogonal' });
    }
  }
  for (const from of workflow.output.from ?? []) {
    if (workflow.agents[from]) {
      boundaryEdges.push({ id: edgeId(from, WORKFLOW_OUTPUT_ID), source: from, target: WORKFLOW_OUTPUT_ID, type: 'orthogonal' });
    }
  }

  return {
    meta: {
      introduction: workflow.introduction,
      type: workflow.type,
      ...(workflow.on ? { on: workflow.on } : {}),
      input: workflow.input,
      output: workflow.output,
    },
    nodes: [...nodes, inputNode, outputNode],
    edges: [...edges, ...boundaryEdges],
  };
}

export function graphToWorkflow(
  meta: WorkflowMeta,
  nodes: AgentFlowNode[],
  edges: WorkflowEdge[],
): Workflow {
  const loops = loopEdgeIds(nodes, edges);
  const forward = edges.filter((edge) => !loops.has(edge.id));
  const loopFrom = new Map(edges.filter((edge) => loops.has(edge.id)).map((edge) => [edge.target, edge.source]));
  const order = topoOrder(nodes, forward);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const isBranch = (id: string): boolean => byId.get(id)?.data.definition.type === 'branch';

  // Fan-in sources per target, EXCLUDING edges out of a branch (those become the
  // branch's routes[], not the child's input.from).
  const sources = new Map<string, string[]>();
  // Upstreams a node may carry a `select` entry for: EVERY live in-edge source,
  // branch parents included (the runner slices branch-fed context too) — only
  // boundary pseudo-nodes are out, they never exist in `agents{}`.
  const selectSources = new Map<string, Set<string>>();
  for (const edge of forward) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    if (isBoundaryId(edge.source)) continue;
    const selectable = selectSources.get(edge.target) ?? new Set<string>();
    selectable.add(edge.source);
    selectSources.set(edge.target, selectable);
    if (isBranch(edge.source)) continue;
    const list = sources.get(edge.target) ?? [];
    if (!list.includes(edge.source)) list.push(edge.source);
    sources.set(edge.target, list);
  }

  const agents: Record<string, AgentDefinition> = {};
  for (const id of order) {
    if (isBoundaryId(id)) continue;
    const node = byId.get(id);
    if (!node) continue;
    const def = node.data.definition;
    const input = mergeInput(def, sources.get(id), selectSources.get(id), loopFrom.get(id));
    const branch = def.type === 'branch' ? branchFields(id, def, forward, byId) : undefined;
    const isSub = def.type === 'sub-workflow';
    const isTool = def.type === 'tool';
    agents[id] = {
      ...(def.introduction !== undefined ? { introduction: def.introduction } : {}),
      ...(def.type !== undefined ? { type: def.type } : {}),
      ...(input ? { input } : {}),
      output: def.output,
      ...(def.tech_stack ? { tech_stack: def.tech_stack } : {}),
      ...(isTool && def.tool ? { tool: def.tool } : {}),
      ...(isSub || isTool ? {} : { prompt: def.prompt ?? '', agent_mapping: def.agent_mapping ?? { opencode: 'build' } }),
      ...(def.trigger ? { trigger: def.trigger } : {}),
      ...(branch?.branch_on ? { branch_on: branch.branch_on } : {}),
      ...(branch?.routes ? { routes: branch.routes } : {}),
    } satisfies AgentDefinition;
  }

  const inputTo = edges
    .filter((edge) => edge.source === WORKFLOW_INPUT_ID && byId.has(edge.target) && !isBoundaryId(edge.target))
    .map((edge) => edge.target);
  const outputFrom = edges
    .filter((edge) => edge.target === WORKFLOW_OUTPUT_ID && byId.has(edge.source) && !isBoundaryId(edge.source))
    .map((edge) => edge.source);

  // the IN port owns the triggers while editing — even "none": falling back to meta.on would undo a removal
  const inputPort = byId.get(WORKFLOW_INPUT_ID);
  const on = inputPort ? inputPort.data.triggers : meta.on;

  return {
    introduction: meta.introduction,
    type: meta.type,
    ...(on && activeTriggerKinds(on).length ? { on } : {}),
    input: boundaryIO(inputPort, meta.input, { to: inputTo }),
    output: boundaryIO(byId.get(WORKFLOW_OUTPUT_ID), meta.output, { from: outputFrom }),
    agents,
    workflow: order.filter((id) => !isBoundaryId(id)),
  };
}

/**
 * A branch's port targets in PRIORITY order (decision D16: the first matching
 * route wins, so order is behaviour): the user's stored `routes[]` order first,
 * then out-edges that have no route entry yet, in edge order.
 */
export function orderedRouteTargets(def: AgentDefinition, targets: readonly string[]): string[] {
  const stored = (def.routes ?? []).map((route) => route.to).filter((to) => targets.includes(to));
  return [...stored, ...targets.filter((to) => !stored.includes(to))];
}

/**
 * Build a branch node's `branch_on` + `routes[]` from its ACTUAL out-edges (the
 * canvas is the source of truth for which ports exist), in priority order, taking
 * each port's condition from the stored `def.routes` matched by target. A port
 * with no stored condition is the default/"else" route.
 */
function branchFields(
  id: string,
  def: AgentDefinition,
  edges: WorkflowEdge[],
  byId: Map<string, AgentFlowNode>,
): { branch_on?: string; routes?: BranchRoute[] } {
  const targets = edges.filter((edge) => edge.source === id && byId.has(edge.target)).map((edge) => edge.target);
  const routes: BranchRoute[] = [];
  for (const to of orderedRouteTargets(def, targets)) {
    const when = cleanRoute(def.routes?.find((route) => route.to === to)?.when);
    routes.push(when ? { to, when } : { to });
  }
  return {
    ...(def.branch_on && def.branch_on.trim() ? { branch_on: def.branch_on.trim() } : {}),
    ...(routes.length ? { routes } : {}),
  };
}

/** Drop empty / whitespace-only condition keys; return undefined when nothing remains. */
function cleanRoute(when: BranchRoute['when'] | undefined): BranchRoute['when'] | undefined {
  if (!when) return undefined;
  const next: NonNullable<BranchRoute['when']> = {};
  if (when.equals?.trim()) next.equals = when.equals.trim();
  if (when.contains?.trim()) next.contains = when.contains.trim();
  if (when.not_contains?.trim()) next.not_contains = when.not_contains.trim();
  for (const key of ['gte', 'gt', 'lte', 'lt'] as const) {
    const value = when[key];
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
  }
  return Object.keys(next).length ? next : undefined;
}

/**
 * LOOP-BACK EDGES. An edge leading back to a node it depends on closes a loop. It is saved
 * as that node's `input.feedback` — never `input.from`, a cycle no runner can start — and
 * stays out of ordering, layout, branch routes and `select`. Imported feedback edges carry
 * `data.loop`; a drawn edge counts when it runs right-to-left and closes a cycle over the
 * edges kept so far. One per node: a second edge back into the same node stays an ordinary
 * input, so validation reports its cycle instead of the canvas dropping it.
 */
export function loopEdgeIds(nodes: readonly AgentFlowNode[], edges: readonly WorkflowEdge[]): Set<string> {
  const x = new Map(nodes.map((node) => [node.id, node.position.x]));
  const forward = new Map<string, string[]>();
  const keep = (edge: WorkflowEdge) => forward.set(edge.source, [...(forward.get(edge.source) ?? []), edge.target]);
  const reaches = (from: string, to: string): boolean => {
    const seen = new Set([from]);
    for (const queue = [from]; queue.length > 0;) {
      const id = queue.shift() as string;
      if (id === to) return true;
      for (const next of forward.get(id) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };
  const loops = new Set<string>();
  const heads = new Set<string>();
  const backward: WorkflowEdge[] = [];
  for (const edge of edges) {
    if (isBoundaryId(edge.source) || isBoundaryId(edge.target)) continue;
    if (edge.data?.loop === true && !heads.has(edge.target)) {
      loops.add(edge.id);
      heads.add(edge.target);
    } else if (edge.data?.loop !== true && (x.get(edge.source) ?? 0) >= (x.get(edge.target) ?? 0)) {
      backward.push(edge);
    } else {
      keep(edge);
    }
  }
  // ordinary edges are all in first, so only a right-to-left edge can be the one closing a cycle
  for (const edge of backward) {
    if (!heads.has(edge.target) && reaches(edge.target, edge.source)) {
      loops.add(edge.id);
      heads.add(edge.target);
    } else {
      keep(edge);
    }
  }
  return loops;
}

/** Kahn topological sort; on a cycle, leftover nodes keep their array order. */
export function topoOrder(nodes: AgentFlowNode[], edges: WorkflowEdge[]): string[] {
  const ids = nodes.map((node) => node.id);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]));

  for (const edge of edges) {
    if (!indegree.has(edge.target) || !adjacency.has(edge.source)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const ordered: string[] = [];
  const seen = new Set<string>();

  while (queue.length) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining <= 0) queue.push(next);
    }
  }

  for (const id of ids) {
    if (!seen.has(id)) ordered.push(id);
  }
  return ordered;
}

function mergeInput(
  def: AgentDefinition,
  sources: string[] | undefined,
  selectable: ReadonlySet<string> | undefined,
  loopFrom: string | undefined,
): AgentInput | undefined {
  const base = def.input ?? {};
  const next: AgentInput = {};
  if (sources && sources.length) next.from = sources.length === 1 ? sources[0] : sources;
  // Stored `select` passes through VERBATIM (entry order + field arrays kept as
  // written, so load→save round-trips byte-identically), constrained to live
  // edges — like a branch's routes[], the canvas is truth for which edges exist.
  if (base.select) {
    const entries = Object.entries(base.select).filter(([upstream]) => selectable?.has(upstream));
    if (entries.length) next.select = Object.fromEntries(entries);
  }
  if (base.join !== undefined) next.join = base.join;
  // the edge says where the loop comes back from; its condition and limit live on the node
  if (loopFrom) {
    const { when, max } = base.feedback ?? {};
    next.feedback = { from: loopFrom, ...(when ? { when } : {}), ...(max !== undefined ? { max } : {}) };
  }
  if (base.files && base.files.length) next.files = base.files;
  if (base.extra_info !== undefined) next.extra_info = base.extra_info;
  return Object.keys(next).length ? next : undefined;
}

/**
 * Whether a node is forced into strict-JSON output at run time.
 * Derived, never user-toggled: a `branch` node, or the upstream of at least one
 * live edge carrying an `input.select` filter. Prose agents stay unbadged
 * unless they meet this rule.
 */
export function isJsonOut(
  nodeId: string,
  nodes: readonly AgentFlowNode[],
  edges: readonly WorkflowEdge[],
): boolean {
  const self = nodes.find((node) => node.id === nodeId);
  if (!self || isBoundaryId(nodeId)) return false;
  if (self.data.definition.type === 'branch') return true;
  // a tool's output is JSON by construction — nothing is enforced on it at run time
  if (self.data.definition.type === 'tool') return false;
  return edges.some(
    (edge) =>
      edge.source === nodeId &&
      nodes.find((node) => node.id === edge.target)?.data.definition.input?.select?.[nodeId] !==
        undefined,
  );
}

/** Longest-path depth for column layout, from the combined edge set (predecessors). */
function buildDepths(ids: string[], edges: WorkflowEdge[]): Map<string, number> {
  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of edges) {
    if (preds.has(edge.target)) preds.get(edge.target)?.push(edge.source);
  }
  const cache = new Map<string, number>();
  const resolve = (id: string, stack: Set<string>): number => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    if (stack.has(id)) return 0;
    let depth = 0;
    stack.add(id);
    for (const from of preds.get(id) ?? []) {
      depth = Math.max(depth, resolve(from, stack) + 1);
    }
    stack.delete(id);
    cache.set(id, depth);
    return depth;
  };
  for (const id of ids) resolve(id, new Set());
  return cache;
}
