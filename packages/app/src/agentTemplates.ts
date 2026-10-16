import type { AgentFlowNode, XYPosition } from '@agentry/canvas';
import type { AgentDefinition, AgentType } from '@agentry/core';

export type AgentGroup = 'opencode' | 'omo' | 'control';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  group: AgentGroup;
  type: AgentType;
  opencodeAgent: string;
  prompt: string;
  outputSchema: Record<string, string>;
}

export const AGENT_DROP_MIME = 'application/agentry-template';

export const agentGroupLabel: Record<AgentGroup, string> = {
  opencode: 'opencode',
  omo: 'OmO agents',
  control: 'Control flow',
};

export const agentGroups: readonly AgentGroup[] = ['opencode', 'omo', 'control'];

export const agentTemplates: readonly AgentTemplate[] = [
  {
    id: 'build',
    name: 'Build',
    description: 'Implement & edit code',
    group: 'opencode',
    type: 'straight',
    opencodeAgent: 'build',
    prompt: 'Implement the change described by the upstream step.',
    outputSchema: { changed_files: 'string[]' },
  },
  {
    id: 'plan',
    name: 'Plan',
    description: 'Plan an approach without editing',
    group: 'opencode',
    type: 'straight',
    opencodeAgent: 'plan',
    prompt: 'Produce a step-by-step plan for the task; do not edit files.',
    outputSchema: { plan: 'string' },
  },
  {
    id: 'general',
    name: 'General',
    description: 'General multi-step task',
    group: 'opencode',
    type: 'straight',
    opencodeAgent: 'general',
    prompt: 'Carry out the requested multi-step task.',
    outputSchema: { result: 'string' },
  },
  {
    id: 'executer',
    name: 'Executer',
    description: 'Run a script to process data',
    group: 'opencode',
    type: 'straight',
    opencodeAgent: 'build',
    prompt:
      'Run the script specified by the input on the provided data; do not modify the script, only execute it and report its results.',
    outputSchema: { exit_code: 'number', output_files: 'string[]' },
  },
  {
    id: 'explore',
    name: 'Explore',
    description: 'Survey & map the relevant code',
    group: 'omo',
    type: 'straight',
    opencodeAgent: 'explore',
    prompt: 'Survey the code related to the task and summarize its structure.',
    outputSchema: { files: 'string[]', summary: 'string' },
  },
  {
    id: 'librarian',
    name: 'Librarian',
    description: 'Search docs, history & references',
    group: 'omo',
    type: 'straight',
    opencodeAgent: 'librarian',
    prompt: 'Find documentation, references and prior art for the task.',
    outputSchema: { references: 'string[]' },
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: 'Deep reasoning & review',
    group: 'omo',
    type: 'straight',
    opencodeAgent: 'oracle',
    prompt: 'Review the work so far and report risks, gaps and a verdict.',
    outputSchema: { findings: 'string[]', verdict: 'string' },
  },
  {
    id: 'reporter',
    name: 'Reporter',
    description: 'Summarize upstream work into a report',
    group: 'omo',
    type: 'reporter',
    opencodeAgent: 'general',
    prompt: 'Read the upstream outputs and write a clear, structured report of what was done, the key results and any open risks.',
    outputSchema: { report: 'string', highlights: 'string[]' },
  },
  {
    id: 'documenter',
    name: 'Documenter',
    description: 'Summarize the whole run into one log.md',
    group: 'omo',
    type: 'documenter',
    opencodeAgent: 'general',
    prompt:
      "Read every upstream node's log.md from this run, then write one workflow-level log.md that summarizes the whole workflow: what each step did, the overall outcome, and the difficulties and lessons encountered along the way.",
    outputSchema: { summary: 'string', difficulties: 'string[]', lessons: 'string[]' },
  },
  {
    id: 'metis',
    name: 'Metis',
    description: 'Pre-planning analysis',
    group: 'omo',
    type: 'reporter',
    opencodeAgent: 'metis',
    prompt: 'Analyze the request for hidden intentions, ambiguities and failure points.',
    outputSchema: { risks: 'string[]', questions: 'string[]' },
  },
  {
    id: 'momus',
    name: 'Momus',
    description: 'Plan critique & QA',
    group: 'omo',
    type: 'reporter',
    opencodeAgent: 'momus',
    prompt: 'Evaluate the plan for clarity, verifiability and completeness.',
    outputSchema: { issues: 'string[]', verdict: 'string' },
  },
  {
    id: 'multimodal',
    name: 'Multimodal',
    description: 'Analyze images, PDFs & diagrams',
    group: 'omo',
    type: 'straight',
    opencodeAgent: 'multimodal-looker',
    prompt: 'Extract the requested information from the given media files.',
    outputSchema: { summary: 'string' },
  },
  {
    id: 'sisyphus',
    name: 'Sisyphus',
    description: 'Autonomous task executor',
    group: 'omo',
    type: 'straight',
    opencodeAgent: 'sisyphus',
    prompt: 'Execute the task end-to-end, delegating to other agents as needed.',
    outputSchema: { result: 'string' },
  },
  {
    id: 'branch',
    name: 'Branch',
    description: 'Route downstream by an output value',
    group: 'control',
    type: 'branch',
    opencodeAgent: 'general',
    prompt: 'Evaluate the input and produce the value used to choose a downstream path.',
    outputSchema: { decision: 'string' },
  },
  {
    id: 'subflow',
    name: 'Sub-workflow',
    description: 'Run another workflow as one step',
    group: 'control',
    type: 'sub-workflow',
    opencodeAgent: 'general',
    prompt: 'Run the referenced workflow and return its result to the parent.',
    outputSchema: { result: 'string' },
  },
];

const templatesById = new Map(agentTemplates.map((template) => [template.id, template]));

export const templateById = (id: string): AgentTemplate | undefined => templatesById.get(id);

export function templateToDefinition(template: AgentTemplate): AgentDefinition {
  if (template.type === 'sub-workflow') {
    return {
      introduction: template.name,
      type: template.type,
      output: { schema: {} },
    };
  }
  const definition: AgentDefinition = {
    introduction: template.name,
    type: template.type,
    output: { schema: template.outputSchema },
    tech_stack: { agent: template.opencodeAgent },
    prompt: template.prompt,
    agent_mapping: { opencode: template.opencodeAgent },
  };
  if (template.type === 'branch') {
    const firstField = Object.keys(template.outputSchema)[0];
    if (firstField) definition.branch_on = firstField;
  }
  return definition;
}

export function uniqueAgentId(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

export function createAgentNode(
  template: AgentTemplate,
  position: XYPosition,
  existingIds: Iterable<string>,
): AgentFlowNode {
  const id = uniqueAgentId(template.id, existingIds);
  return {
    id,
    type: 'agent' as const,
    position,
    data: { agentId: id, state: 'pending', definition: templateToDefinition(template) },
  };
}
