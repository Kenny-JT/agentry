/**
 * Loop-back edges (`input.feedback`) and the dependency graph they sit on.
 * Pure graph helpers shared by validation, the runner and the editor, so the
 * three agree on what a cycle is and which nodes a loop body contains.
 */

import { branchParents, fromList } from './runtime';
import type { Workflow } from './workflow';

/** Node executions one run may spend before it fails with "loop budget exceeded". */
export const RUN_EXECUTION_BUDGET = 200;

/**
 * Execution dependencies per node — `input.from` ∪ branch parents ∪
 * `trigger.when.from`, loop-back edges EXCLUDED. This is the graph the
 * scheduler waits on, so a cycle in it is a deadlock.
 */
export function dependencyGraph(workflow: Pick<Workflow, 'agents'>): Map<string, string[]> {
  const parents = branchParents(workflow);
  const deps = new Map<string, string[]>();
  for (const [id, def] of Object.entries(workflow.agents)) {
    const upstream = [...fromList(def.input?.from)];
    for (const parent of parents.get(id) ?? []) if (!upstream.includes(parent)) upstream.push(parent);
    const gate = def.trigger?.when?.from;
    if (gate && !upstream.includes(gate)) upstream.push(gate);
    deps.set(id, upstream.filter((dep) => workflow.agents[dep] !== undefined));
  }
  return deps;
}

/** Every cycle of the dependency graph, each listed once in walk order (`a → b → a` as `[a, b]`). */
export function findCycles(deps: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const reported = new Set<string>();
  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    if (onStack.has(id)) {
      const cycle = stack.slice(stack.indexOf(id));
      const key = [...cycle].sort().join('\u0000');
      if (!reported.has(key)) {
        reported.add(key);
        cycles.push(cycle);
      }
      return;
    }
    stack.push(id);
    onStack.add(id);
    for (const dep of deps.get(id) ?? []) visit(dep);
    stack.pop();
    onStack.delete(id);
    done.add(id);
  };
  for (const id of deps.keys()) visit(id);
  // deps point upstream, so a walk records the cycle backwards — flip it to data-flow order,
  // keeping the first node visited in front
  return cycles.map((cycle) => {
    const flowOrder = [...cycle].reverse();
    const start = flowOrder.indexOf(cycle[0] ?? '');
    return [...flowOrder.slice(start), ...flowOrder.slice(0, start)];
  });
}

/** Nodes reachable from `start` by walking `step` (start excluded unless it is on a cycle). */
function reach(start: string, step: (id: string) => readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    for (const next of step(current)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/**
 * The body of the loop that `input.feedback` on `nodeId` closes: `nodeId`,
 * `feedback.from`, and every node on a dependency path between them.
 * `null` when the edge does not close a loop — `from` missing or not
 * downstream of `nodeId`.
 */
export function feedbackLoopBody(workflow: Pick<Workflow, 'agents'>, nodeId: string): Set<string> | null {
  const from = workflow.agents[nodeId]?.input?.feedback?.from;
  if (!from || !workflow.agents[from]) return null;
  const deps = dependencyGraph(workflow);
  const children = new Map<string, string[]>();
  for (const [id, upstream] of deps) {
    for (const dep of upstream) children.set(dep, [...(children.get(dep) ?? []), id]);
  }
  const downstream = reach(nodeId, (id) => children.get(id) ?? []);
  if (!downstream.has(from)) return null;
  const ancestors = reach(from, (id) => deps.get(id) ?? []);
  const body = new Set<string>([nodeId, from]);
  for (const id of downstream) if (ancestors.has(id)) body.add(id);
  return body;
}
