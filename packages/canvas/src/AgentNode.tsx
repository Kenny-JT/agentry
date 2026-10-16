import { Handle, Position, useEdges, useNodes } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import { activeTriggerKinds, checkTriggers, describeTrigger, toolLabel } from '@agentry/core';
import type { ToolKind, ToolSpec, WorkflowTriggers } from '@agentry/core';
import { nodeStateLabel } from '@agentry/design';
import { orthogonalPath } from './backEdge';
import { DOCUMENTER_FORK, FORK_EXTENSION } from './fork';
import { isJsonOut } from './graph';
import { TriggerIcon } from './TriggerIcon';
import type { AgentFlowNode } from './types';

const JSON_BADGE_TITLE =
  'Emits strict JSON (schema-enforced at run time; may retry once, slightly slower)';
const JOIN_BADGE_TITLE = 'Fires on the first upstream to finish (join: any)';

const EXTENSION_STYLE = {
  paddingLeft: FORK_EXTENSION,
  paddingRight: FORK_EXTENSION,
  '--agentry-fork-ext': `${FORK_EXTENSION}px`,
} as CSSProperties;

const isBoundaryType = (type: AgentFlowNode['data']['definition']['type']): boolean =>
  type === 'workflow-input' || type === 'workflow-output';

const TOOL_GLYPH_PATH: Record<ToolKind, string> = {
  http: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  read_file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  write_file: 'M6 3h8l4 4v14H6zM14 3v4h4M9 15l6-6 2 2-6 6H9z',
  script: 'M4 5h16v14H4zM7 9l3 3-3 3M12 15h5',
};

const toolChipKey = (kind: ToolKind | undefined): string =>
  kind === 'read_file' || kind === 'write_file' ? 'file' : kind ?? 'tool';

function toolChipValue(tool: ToolSpec | undefined): string {
  if (tool?.kind !== 'script') return toolLabel(tool);
  const first = (Array.isArray(tool.command) ? tool.command[0] : tool.command.trim().split(/\s+/)[0]) ?? '';
  const program = first.split(/[\\/]/).pop() ?? first;
  return program.length > 16 ? `${program.slice(0, 15)}…` : program || 'script';
}

export function ToolGlyph({ kind, size = 11 }: { kind: ToolKind; size?: number }) {
  return (
    <svg
      className="agentry-node__tool-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TOOL_GLYPH_PATH[kind]} />
    </svg>
  );
}

const DOC_FORK_H = 120;
const DOC_FORK_CORNER = 6;
const DOC_FORK_SOURCE_YS = [8, 40, 80, 112];

function DocumenterFork({ id }: { id: string }) {
  const gradId = `agentry-doc-fork-${id}`;
  const w = DOCUMENTER_FORK;
  const cy = DOC_FORK_H / 2;
  const trunkX = w - 18;
  // Each arm: a horizontal run in from the far-left, a shared vertical trunk at
  // trunkX, then one horizontal into the pin — the same right-angle tree fork the
  // real fan-in edges draw (orthogonalPath rounds the corners identically).
  const paths = DOC_FORK_SOURCE_YS.map((y) =>
    orthogonalPath(
      [
        { x: 4, y },
        { x: trunkX, y },
        { x: trunkX, y: cy },
        { x: w, y: cy },
      ],
      DOC_FORK_CORNER,
    ),
  );
  return (
    <svg
      className="agentry-documenter-fork"
      viewBox={`0 0 ${w} ${DOC_FORK_H}`}
      width={w}
      height={DOC_FORK_H}
      style={{ left: `calc(var(--agentry-fork-ext) - ${w}px)` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1={cy} x2={w} y2={cy}>
          <stop offset="0" stopColor="var(--agentry-color-type-documenter)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--agentry-color-type-documenter)" stopOpacity="1" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${gradId})`}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * IN-port chip for the workflow's `on:` block. INVARIANT: it is absolutely
 * positioned outside the node box (canvas.css) — routing, collision volumes and
 * the minimap read the measured box, so the chip must never grow it.
 */
function TriggerBadge({ triggers }: { triggers: WorkflowTriggers }) {
  const kinds = activeTriggerKinds(triggers);
  if (!kinds.length) return null;
  const invalid = new Set(checkTriggers(triggers).map((problem) => problem.kind));
  const lines = kinds.map((kind) => describeTrigger(kind, triggers));
  const stacked = kinds.length > 1;
  return (
    <span
      className={`agentry-trigger${stacked ? ' agentry-trigger--stack' : ''}${invalid.size ? ' is-invalid' : ''}`}
      title={lines.join('\n')}
      aria-label={`Triggers: ${lines.join('; ')}`}
    >
      {kinds.map((kind) => (
        <TriggerIcon key={kind} kind={kind} size={12} className={invalid.has(kind) ? 'is-invalid' : undefined} />
      ))}
      {!stacked && <span className="agentry-trigger__text">{lines[0]}</span>}
    </span>
  );
}

export function AgentNode({ id, data, selected }: NodeProps<AgentFlowNode>) {
  const { agentId, state, definition, warnings, triggers } = data;
  const { type: agentType, introduction: title } = definition;
  const opencodeAgent = definition.agent_mapping?.opencode;
  const embeddedSteps = Object.keys(definition.tech_stack?.workflow?.agents ?? {}).length;
  const nodes = useNodes<AgentFlowNode>();
  const edges = useEdges();

  if (agentType === 'workflow-input' || agentType === 'workflow-output') {
    const isInput = agentType === 'workflow-input';
    return (
      <div
        className={`agentry-node agentry-boundary agentry-boundary--${isInput ? 'input' : 'output'}${
          selected ? ' is-selected' : ''
        }`}
        data-type={agentType}
        style={EXTENSION_STYLE}
        title={title || (isInput ? 'Workflow input' : 'Workflow output')}
      >
        {!isInput && (
          <Handle type="target" position={Position.Left} className="agentry-handle agentry-handle--in" />
        )}
        {isInput && triggers && <TriggerBadge triggers={triggers} />}
        <div className="agentry-node__card agentry-boundary__card">
          <span
            className={`agentry-node__pin agentry-node__pin--${isInput ? 'out' : 'in'}`}
            aria-hidden="true"
          />
          <span className="agentry-boundary__label">{isInput ? 'IN' : 'OUT'}</span>
        </div>
        {isInput && (
          <Handle type="source" position={Position.Right} className="agentry-handle agentry-handle--out" />
        )}
      </div>
    );
  }

  const number =
    nodes.filter((node) => !isBoundaryType(node.data.definition.type)).findIndex((node) => node.id === id) + 1;
  const jsonOut = isJsonOut(id, nodes, edges);
  const joinAny = definition.input?.join === 'any';

  return (
    <div
      className={`agentry-node agentry-node--${state}${selected ? ' is-selected' : ''}`}
      data-state={state}
      data-type={agentType}
      style={EXTENSION_STYLE}
    >
      <Handle type="target" position={Position.Left} className="agentry-handle agentry-handle--in" />
      {agentType === 'documenter' && <DocumenterFork id={id} />}

      <div className="agentry-node__card">
        <span className="agentry-node__pin agentry-node__pin--in" aria-hidden="true" />

        <span className="agentry-node__number">{number}</span>

        <div className="agentry-node__head">
          <span className="agentry-node__type">{agentType}</span>
          {(jsonOut || joinAny || Boolean(warnings?.length)) && (
            <span className="agentry-node__badges">
              {jsonOut && (
                <span className="agentry-node__badge" title={JSON_BADGE_TITLE}>
                  JSON
                </span>
              )}
              {joinAny && (
                <span className="agentry-node__badge agentry-node__badge--join" title={JOIN_BADGE_TITLE}>
                  ANY
                </span>
              )}
              {warnings?.length ? (
                <span className="agentry-node__badge agentry-node__badge--warn" title={warnings.join('\n')}>
                  ⚠ {warnings.length}
                </span>
              ) : null}
            </span>
          )}
          <span className="agentry-node__state">
            <span className="agentry-node__dot" />
            {nodeStateLabel[state]}
          </span>
        </div>

        <div className="agentry-node__title">{title}</div>
        <code className="agentry-node__id">{agentId}</code>

        {agentType === 'sub-workflow' ? (
          <div className="agentry-node__mapping">
            <span className="agentry-node__mapping-key">steps</span>
            <code className="agentry-node__mapping-val">{embeddedSteps || '—'}</code>
          </div>
        ) : agentType === 'tool' ? (
          <div className="agentry-node__mapping" title="Runs without a model">
            {definition.tool && <ToolGlyph kind={definition.tool.kind} />}
            <span className="agentry-node__mapping-key">{toolChipKey(definition.tool?.kind)}</span>
            <code className="agentry-node__mapping-val">{toolChipValue(definition.tool)}</code>
          </div>
        ) : (
          <div className="agentry-node__mapping">
            <span className="agentry-node__mapping-key">opencode</span>
            <code className="agentry-node__mapping-val">{opencodeAgent ?? '—'}</code>
          </div>
        )}

        <span className="agentry-node__pin agentry-node__pin--out" aria-hidden="true" />
      </div>

      <Handle type="source" position={Position.Right} className="agentry-handle agentry-handle--out" />
    </div>
  );
}
