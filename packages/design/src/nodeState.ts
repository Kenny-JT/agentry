import type { NodeState } from '@agentry/core';
import { stateColor, stateColorSoft } from './tokens';

export const nodeStateColor = (state: NodeState): string => stateColor[state];
export const nodeStateColorSoft = (state: NodeState): string => stateColorSoft[state];

export const nodeStateLabel: Record<NodeState, string> = {
  done: 'Done',
  running: 'Running',
  pending: 'Pending',
  failed: 'Failed',
  skipped: 'Skipped',
};
