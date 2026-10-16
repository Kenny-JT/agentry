/**
 * Node-rename support: remap every place an {@link AgentDefinition} stores a
 * node id as DATA. Edges + node ids are remapped by the caller; this covers the
 * three references that are NOT derivable from edges and would otherwise go
 * stale on rename:
 *
 *  1. `input.select` KEYS — `select` is `Record<upstreamNodeId, keptFields[]>`,
 *     so a stale key silently detaches the filter: the lens re-derives its
 *     ON/OFF switches from `select?.[sourceId]` (finds nothing → all ON), and
 *     on export `mergeInput` prunes the stale entry BEFORE validation can emit
 *     `select-unknown-source` — the user's filter vanishes with zero feedback.
 *  2. `routes[].to` — a branch's per-port condition is looked up by target id;
 *     a stale `to` misses and the port silently degrades to the default/else.
 *  3. `trigger.when.from` — goes stale the same way (caught by validation, but
 *     fixed here in the same pass).
 *
 * Returns the SAME definition reference when nothing referenced `oldId`.
 * `select` entry order and field arrays pass through verbatim (round-trip
 * identity depends on it); route order and conditions are preserved.
 */
import { renameToolRefs } from '@agentry/core';
import type { AgentDefinition } from '@agentry/core';

export function renameDefinitionRefs(
  definition: AgentDefinition,
  oldId: string,
  nextId: string,
): AgentDefinition {
  let next = definition;

  const input = definition.input;
  const select = input?.select;
  if (input && select && oldId in select) {
    const remapped: Record<string, string[]> = {};
    for (const [upstream, fields] of Object.entries(select)) {
      remapped[upstream === oldId ? nextId : upstream] = fields;
    }
    next = { ...next, input: { ...input, select: remapped } };
  }

  const routes = definition.routes;
  if (routes?.some((route) => route.to === oldId)) {
    next = {
      ...next,
      routes: routes.map((route) => (route.to === oldId ? { ...route, to: nextId } : route)),
    };
  }

  const trigger = definition.trigger;
  const when = trigger?.when;
  if (trigger && when && when.from === oldId) {
    next = { ...next, trigger: { ...trigger, when: { ...when, from: nextId } } };
  }

  // 4. `{oldId.field}` template references inside a tool node's spec.
  const tool = definition.tool;
  if (tool) {
    const renamed = renameToolRefs(tool, oldId, nextId);
    if (renamed !== tool) next = { ...next, tool: renamed };
  }

  return next;
}
