import type { AgentDefinition, AgentInput } from '@agentry/core';

/**
 * Drop a definition's `input.select` entries for the given upstream sources
 * (a filter is scoped to its edge — no edge, no filter). Prunes an
 * emptied `select`/`input` object the same way App's toggle handler does.
 * Returns the SAME definition reference when nothing applies, and keeps
 * surviving entries verbatim (entry order + field-array identity) so exports
 * round-trip byte-identically.
 */
export function pruneSelectEntries(
  definition: AgentDefinition,
  removedSources: readonly string[],
): AgentDefinition {
  const stored = definition.input?.select;
  if (!stored) return definition;
  const dropped = removedSources.filter((source) => source in stored);
  if (dropped.length === 0) return definition;

  const select: Record<string, string[]> = { ...stored };
  for (const source of dropped) delete select[source];
  const input: AgentInput = { ...definition.input };
  if (Object.keys(select).length) input.select = select;
  else delete input.select;
  const next: AgentDefinition = { ...definition };
  if (Object.keys(input).length) next.input = input;
  else delete next.input;
  return next;
}
