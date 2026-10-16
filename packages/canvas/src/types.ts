import type { Edge, Node } from '@xyflow/react';
import type { AgentDefinition, NodeState, WorkflowTriggers } from '@agentry/core';

export type WorkflowCanvasMode = 'edit' | 'run';

/**
 * Data carried by an agent node. Holds the node's full {@link AgentDefinition}
 * (the editable workflow.yaml contract) plus its runtime `state`. The editor
 * edits the definition; the run panel parses workflow.yaml into the same shape,
 * so both ends share one node model and one renderer.
 */
export type AgentNodeData = {
  agentId: string;
  state: NodeState;
  definition: AgentDefinition;
  /** Run-time notices for this node while observing a run (schema warnings, degraded select filters). */
  warnings?: readonly string[];
  /** IN port only: the workflow's `on:` block — it lives here while editing and folds back into `Workflow.on`. */
  triggers?: WorkflowTriggers;
};

export type AgentFlowNode = Node<AgentNodeData, 'agent'>;
export type WorkflowEdge = Edge;
