/**
 * `workflow.yaml` (de)serialization (06-implementation-final-plan §5.1).
 *
 * ⚠️ PROVISIONAL. Pairs with the `Workflow` types in `workflow.ts`, which are
 * not yet frozen. Lives in `core` so BOTH ends share one serializer: the App
 * exports YAML here; the plugin runner parses it back here. A real validator
 * (zod / JSON Schema, per 06 §5.1) is a later deliverable — `workflowFromYaml`
 * currently trusts its input shape.
 */

import { parse, stringify } from 'yaml';
import type { AgentDefinition, AgentOutput, Workflow } from './workflow';

const STRINGIFY_OPTIONS = {
  // lineWidth 0 disables scalar folding, keeping long prompts on one line.
  lineWidth: 0,
  indent: 2,
} as const;

/** Serialize a {@link Workflow} to a `workflow.yaml` string. */
export function workflowToYaml(workflow: Workflow): string {
  return stringify(workflow, STRINGIFY_OPTIONS);
}

/**
 * Parse a `workflow.yaml` string into a {@link Workflow}, filling the fields the
 * editor model assumes are always present but the frozen v0 plugin contract
 * marks optional (per-node `output.schema`, top-level io). Lets the editor
 * import a sparse plugin-authored file without crashing; runtime-meaningful
 * fields (prompt, agent_mapping, input, trigger) pass through untouched.
 */
export function workflowFromYaml(text: string): Workflow {
  return normalizeWorkflow(parse(text));
}

export function normalizeWorkflow(raw: unknown): Workflow {
  const wf = (raw ?? {}) as Partial<Workflow>;
  const agents: Record<string, AgentDefinition> = {};
  for (const [id, value] of Object.entries(wf.agents ?? {})) {
    const def = (value ?? {}) as Partial<AgentDefinition>;
    const output = (def.output ?? {}) as Partial<AgentOutput>;
    const normalized: AgentDefinition = {
      ...def,
      output: { ...output, schema: output.schema ?? {} },
    };
    if (def.type !== 'sub-workflow' && def.type !== 'tool') {
      normalized.prompt = def.prompt ?? '';
      normalized.agent_mapping = def.agent_mapping ?? { opencode: 'build' };
    }
    agents[id] = normalized;
  }
  return {
    introduction: wf.introduction ?? '',
    type: wf.type ?? 'pipeline',
    ...(wf.on ? { on: wf.on } : {}),
    input: wf.input ?? { description: '' },
    output: wf.output ?? { description: '' },
    agents,
    workflow: Array.isArray(wf.workflow) ? wf.workflow : Object.keys(agents),
  };
}
