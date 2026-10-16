/**
 * Node rename: every place a workflow stores a node id as data. The editor's
 * `packages/app/src/renameRefs.ts` covers the three per-definition references (`input.select`
 * keys, `routes[].to`, `trigger.when.from`); a YAML-level rename must also move the agents
 * key, `input.from`, `workflow[]`, the top-level `input.to` / `output.from`, and the
 * `{id.field}` / `{id}` tokens a prompt may use to name an upstream.
 */
import { fromList, type AgentDefinition, type Workflow } from '@agentry/core';
import { ToolError } from './project';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `{old.field}` and `{old}` become `{new.field}` / `{new}`; nothing else in the text moves. */
export function renamePromptTokens(text: string, oldId: string, nextId: string): string {
  const re = new RegExp(`\\{${escapeRegExp(oldId)}(?=[.}])`, 'g');
  return text.replace(re, `{${nextId}`);
}

const mapIds = (list: string[] | undefined, oldId: string, nextId: string): string[] | undefined =>
  list?.map((id) => (id === oldId ? nextId : id));

function renameDefinitionRefs(def: AgentDefinition, oldId: string, nextId: string): AgentDefinition {
  const next: AgentDefinition = { ...def };
  const from = fromList(def.input?.from);
  const input = { ...def.input };
  if (from.includes(oldId)) {
    const mapped = mapIds(from, oldId, nextId)!;
    input.from = mapped.length === 1 ? mapped[0]! : mapped;
  }
  if (input.select && oldId in input.select) {
    const remapped: Record<string, string[]> = {};
    for (const [upstream, fields] of Object.entries(input.select)) remapped[upstream === oldId ? nextId : upstream] = fields;
    input.select = remapped;
  }
  if (typeof input.extra_info === 'string') input.extra_info = renamePromptTokens(input.extra_info, oldId, nextId);
  if (Object.keys(input).length) next.input = input;
  if (def.routes) next.routes = def.routes.map((r) => (r.to === oldId ? { ...r, to: nextId } : r));
  if (def.trigger?.when?.from === oldId) next.trigger = { ...def.trigger, when: { ...def.trigger.when, from: nextId } };
  if (typeof def.prompt === 'string') next.prompt = renamePromptTokens(def.prompt, oldId, nextId);
  return next;
}

export function renameNode(wf: Workflow, oldId: string, nextId: string): Workflow {
  if (!wf.agents[oldId]) throw new ToolError(`no node "${oldId}"`);
  if (oldId === nextId) return wf;
  if (wf.agents[nextId]) throw new ToolError(`node "${nextId}" already exists`);
  const agents: Record<string, AgentDefinition> = {};
  for (const [id, def] of Object.entries(wf.agents)) agents[id === oldId ? nextId : id] = renameDefinitionRefs(def, oldId, nextId);
  const next: Workflow = { ...wf, agents, workflow: mapIds(wf.workflow, oldId, nextId) ?? [] };
  if (wf.input.to) next.input = { ...wf.input, to: mapIds(wf.input.to, oldId, nextId) };
  if (wf.output.from) next.output = { ...wf.output, from: mapIds(wf.output.from, oldId, nextId) };
  return next;
}
