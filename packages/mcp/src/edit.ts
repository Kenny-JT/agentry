/**
 * Patch operations on a parsed {@link Workflow}. Pure: every function returns a new workflow
 * and throws {@link ToolError} when an operation cannot apply, so the caller writes nothing.
 */
import { fromList, type AgentDefinition, type Workflow } from '@agentry/core';
import { ToolError } from './project';
import { renameNode } from './rename';
import type { Operation } from './schemas';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function node(wf: Workflow, id: string): AgentDefinition {
  const def = wf.agents[id];
  if (!def) throw new ToolError(`no node "${id}" — nodes: ${Object.keys(wf.agents).join(', ') || '(none)'}`);
  return def;
}

const withFrom = (def: AgentDefinition, from: string[]): void => {
  const input = { ...def.input };
  if (from.length === 0) delete input.from;
  else input.from = from.length === 1 ? from[0]! : from;
  if (Object.keys(input).length) def.input = input;
  else delete def.input;
};

function addNode(wf: Workflow, op: Extract<Operation, { op: 'add_node' }>): void {
  if (wf.agents[op.id]) throw new ToolError(`node "${op.id}" already exists — use update_node`);
  const type = op.type ?? 'straight';
  const def: AgentDefinition = {
    ...(op.introduction !== undefined ? { introduction: op.introduction } : {}),
    type,
    output: { schema: op.output_schema ?? {} },
  };
  const from = fromList(op.from);
  for (const id of from) node(wf, id);
  if (from.length) withFrom(def, from);
  if (type !== 'sub-workflow') {
    def.prompt = op.prompt ?? '';
    def.agent_mapping = { opencode: op.agent ?? 'build' };
  }
  wf.agents[op.id] = def;
  wf.workflow.push(op.id);
}

function removeNode(wf: Workflow, id: string): void {
  node(wf, id);
  delete wf.agents[id];
  for (const def of Object.values(wf.agents)) {
    withFrom(def, fromList(def.input?.from).filter((f) => f !== id));
    if (def.input?.select && id in def.input.select) delete def.input.select[id];
    if (def.routes) def.routes = def.routes.filter((r) => r.to !== id);
    if (def.trigger?.when?.from === id) {
      delete def.trigger.when;
      if (!Object.keys(def.trigger).length) delete def.trigger;
    }
  }
  wf.workflow = wf.workflow.filter((n) => n !== id);
  if (wf.input.to) wf.input.to = wf.input.to.filter((n) => n !== id);
  if (wf.output.from) wf.output.from = wf.output.from.filter((n) => n !== id);
}

function updateNode(wf: Workflow, op: Extract<Operation, { op: 'update_node' }>): void {
  const def = node(wf, op.id);
  const { set } = op;
  if (set.introduction !== undefined) def.introduction = set.introduction;
  if (set.prompt !== undefined) def.prompt = set.prompt;
  if (set.type !== undefined) def.type = set.type;
  if (set.agent !== undefined) def.agent_mapping = { ...def.agent_mapping, opencode: set.agent };
  if (set.output_schema !== undefined) def.output = { ...def.output, schema: set.output_schema };
  if (set.trigger !== undefined) {
    if (set.trigger.when) node(wf, set.trigger.when.from);
    def.trigger = set.trigger;
  }
  if (set.input_extra_info !== undefined) def.input = { ...def.input, extra_info: set.input_extra_info };
  if (set.join !== undefined) def.input = { ...def.input, join: set.join };
}

function connect(wf: Workflow, from: string, to: string): void {
  const source = node(wf, from);
  const target = node(wf, to);
  if (from === to) throw new ToolError(`cannot connect "${from}" to itself — use trigger.loop for repetition`);
  if (source.type === 'branch') {
    source.routes ??= [];
    if (!source.routes.some((r) => r.to === to)) source.routes.push({ to });
    return;
  }
  const list = fromList(target.input?.from);
  if (!list.includes(from)) withFrom(target, [...list, from]);
}

function disconnect(wf: Workflow, from: string, to: string): void {
  const source = node(wf, from);
  const target = node(wf, to);
  const before = fromList(target.input?.from);
  const routesBefore = source.routes?.length ?? 0;
  withFrom(target, before.filter((f) => f !== from));
  if (source.routes) source.routes = source.routes.filter((r) => r.to !== to);
  if (before.length === fromList(target.input?.from).length && routesBefore === (source.routes?.length ?? 0)) {
    throw new ToolError(`"${from}" is not connected to "${to}"`);
  }
}

function setBranch(wf: Workflow, op: Extract<Operation, { op: 'set_branch' }>): void {
  const def = node(wf, op.id);
  for (const route of op.routes) node(wf, route.to);
  def.type = 'branch';
  def.branch_on = op.branch_on;
  def.routes = op.routes.map((r) => ({ to: r.to, ...(r.when && Object.keys(r.when).length ? { when: r.when } : {}) }));
}

/** Apply `operations` in order to a copy of `workflow`; the first failure throws. */
export function applyOperations(workflow: Workflow, operations: readonly Operation[]): Workflow {
  let wf = clone(workflow);
  operations.forEach((op, index) => {
    try {
      switch (op.op) {
        case 'add_node':
          addNode(wf, op);
          break;
        case 'remove_node':
          removeNode(wf, op.id);
          break;
        case 'update_node':
          updateNode(wf, op);
          break;
        case 'connect':
          connect(wf, op.from, op.to);
          break;
        case 'disconnect':
          disconnect(wf, op.from, op.to);
          break;
        case 'rename_node':
          wf = renameNode(wf, op.id, op.new_id);
          break;
        case 'set_branch':
          setBranch(wf, op);
          break;
        case 'set_workflow_io':
          if (op.input_description !== undefined) wf.input.description = op.input_description;
          if (op.output_description !== undefined) wf.output.description = op.output_description;
          break;
        default: {
          const unreachable: never = op;
          throw new ToolError(`unknown operation ${JSON.stringify(unreachable)}`);
        }
      }
    } catch (err) {
      if (err instanceof ToolError) throw new ToolError(`operation ${index + 1} (${op.op}) failed: ${err.message}`);
      throw err;
    }
  });
  return wf;
}
