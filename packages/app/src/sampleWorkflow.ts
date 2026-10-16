import { workflowToGraph } from '@agentry/canvas';
import type { AgentFlowNode } from '@agentry/canvas';
import type { AgentDefinition, Workflow } from '@agentry/core';

export const heroWorkflow: Workflow = {
  introduction: 'Add unit tests to a feature and refactor it',
  type: 'pipeline',
  input: { description: 'Path to the target code directory' },
  output: { description: 'Refactored code + tests + an openable report page' },
  agents: {
    explore_code: {
      introduction: 'Explore code & map structure',
      type: 'straight',
      input: { extra_info: 'The directory path the user provides' },
      output: { schema: { files: 'string[]', summary: 'string' } },
      tech_stack: { agent: 'explore' },
      prompt: 'Find the files related to the target feature and summarize the structure.',
      agent_mapping: { opencode: 'explore' },
    },
    write_tests: {
      introduction: 'Write unit tests',
      type: 'straight',
      input: { from: 'explore_code' },
      output: { schema: { test_files: 'string[]' } },
      tech_stack: { agent: 'build' },
      prompt: 'Using {explore_code.summary}, write unit tests for these files.',
      agent_mapping: { opencode: 'build' },
    },
    refactor: {
      introduction: 'Refactor & verify',
      type: 'straight',
      input: { from: 'write_tests' },
      output: { schema: { changed_files: 'string[]', report: 'string' } },
      tech_stack: { agent: 'build' },
      prompt: 'Refactor the code while keeping {write_tests.test_files} green; write a short report.',
      agent_mapping: { opencode: 'build' },
    },
  },
  workflow: ['explore_code', 'write_tests', 'refactor'],
};

const documenterDefinition: AgentDefinition = {
  introduction: 'Document the whole run',
  type: 'documenter',
  output: { schema: { summary: 'string', difficulties: 'string[]', lessons: 'string[]' } },
  tech_stack: { agent: 'general' },
  prompt:
    "Read every upstream node's log.md from this run, then write one workflow-level log.md that summarizes the whole workflow: what each step did, the overall outcome, and the difficulties and lessons encountered along the way.",
  agent_mapping: { opencode: 'general' },
};

// The Documenter ships in the default flowchart but is intentionally edge-less
// (its incoming lines are the decorative gradient fork drawn on the node). It is
// appended AFTER layout so it never joins the depth/column math — otherwise a
// no-input node would land in column 0 and shove the pipeline's vertical center.
const heroBase = workflowToGraph(heroWorkflow);
const documenterNode: AgentFlowNode = {
  id: 'documenter',
  type: 'agent',
  position: { x: 720, y: 350 },
  data: { agentId: 'documenter', state: 'pending', definition: documenterDefinition },
};

export const heroGraph = { ...heroBase, nodes: [...heroBase.nodes, documenterNode] };
