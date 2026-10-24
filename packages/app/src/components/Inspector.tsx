import { useState } from 'react';
import { TriggerIcon, WORKFLOW_INPUT_ID } from '@agentry/canvas';
import type { AgentFlowNode } from '@agentry/canvas';
import { activeTriggerKinds, asPatternList, checkTriggers, decisionOutputSchema, FEEDBACK_DEFAULT_MAX, FEEDBACK_MAX_LIMIT, isBatchDecision, isRouter, TRIGGER_DEFAULTS, TRIGGER_KINDS } from '@agentry/core';
import type {
  AgentDefinition,
  AgentInput,
  AgentOutput,
  AgentType,
  BranchRoute,
  Condition,
  DecisionSpec,
  FeedbackLoop,
  FileTrigger,
  GitTrigger,
  MailTrigger,
  RouteCondition,
  ScheduleTrigger,
  TechStack,
  ToolSpec,
  Trigger,
  TriggerKind,
  TriggerProblem,
  WebTrigger,
  Workflow,
  WorkflowTriggers,
} from '@agentry/core';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PanelRightCloseIcon,
  PanelRightIcon,
  PlusIcon,
  PopOutIcon,
  TrashIcon,
} from './icons';
import { defaultDecisionSpec } from '../agentTemplates';
import { clampDockedWidth, startPointerDrag } from '../inspectorLayout';
import type { InspectorPlacement } from '../inspectorLayout';
import { DecisionSection } from './DecisionSection';
import type { QuestionRename } from './DecisionSection';
import { defaultToolSpec, ToolSection, toolSchemaFor } from './ToolSection';

const AGENT_TYPES: readonly AgentType[] = ['straight', 'branch', 'decision', 'reporter', 'documenter', 'sub-workflow', 'tool'];

export type IncomingField = { key: string; type: string };
export type IncomingSource = { id: string; label: string; fields: IncomingField[] };
export type EmbeddableWorkflow = { name: string; workflow: Workflow };

const schemaFields = (schema: Record<string, string> | undefined): IncomingField[] =>
  Object.entries(schema ?? {}).map(([key, type]) => ({ key, type }));

/** The output fields a workflow produces = the merged output schemas of the nodes wired into its OUT port. */
function workflowProduces(workflow: Workflow): IncomingField[] {
  return (workflow.output.from ?? []).flatMap((src) => schemaFields(workflow.agents[src]?.output?.schema));
}

type SchemaRow = { key: string; value: string };

const commaToList = (value: string): string[] => value.split(',').map((part) => part.trim()).filter(Boolean);
const listToComma = (list: string[] | undefined): string => (list ?? []).join(', ');

const schemaToRows = (schema: Record<string, string>): SchemaRow[] =>
  Object.entries(schema).map(([key, value]) => ({ key, value }));

const rowsToSchema = (rows: SchemaRow[]): Record<string, string> => {
  const schema: Record<string, string> = {};
  for (const { key, value } of rows) {
    const trimmed = key.trim();
    if (trimmed) schema[trimmed] = value;
  }
  return schema;
};

const dropEmpty = (list: string[] | undefined): string[] | undefined => {
  const cleaned = (list ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
};

function cleanFrom(from: string | string[] | undefined): string | string[] | undefined {
  const list = (Array.isArray(from) ? from : from ? [from] : []).map((id) => id.trim()).filter(Boolean);
  if (!list.length) return undefined;
  return list.length === 1 ? list[0] : list;
}

function cleanInput(input: AgentInput | undefined): AgentInput | undefined {
  if (!input) return undefined;
  const next: AgentInput = {};
  const from = cleanFrom(input.from);
  if (from !== undefined) next.from = from;
  // `select` is owned by the canvas edge lens — pass it through untouched so an
  // Inspector edit never silently drops the per-edge field filters.
  if (input.select && Object.keys(input.select).length) next.select = input.select;
  if (input.join === 'any' || input.join === 'all') next.join = input.join;
  if (input.feedback?.from) {
    const when = cleanCondition(input.feedback.when);
    const { max } = input.feedback;
    next.feedback = { from: input.feedback.from, ...(when ? { when } : {}), ...(max !== undefined ? { max } : {}) };
  }
  const files = dropEmpty(input.files);
  if (files) next.files = files;
  if (input.extra_info && input.extra_info.trim()) next.extra_info = input.extra_info;
  return Object.keys(next).length ? next : undefined;
}

function cleanCondition(condition: Condition | undefined): Condition | undefined {
  if (!condition) return undefined;
  const next: Condition = {};
  if (condition.contains?.trim()) next.contains = condition.contains.trim();
  if (condition.not_contains?.trim()) next.not_contains = condition.not_contains.trim();
  if (condition.equals?.trim()) next.equals = condition.equals.trim();
  return Object.keys(next).length ? next : undefined;
}

function cleanTrigger(trigger: Trigger | undefined): Trigger | undefined {
  if (!trigger) return undefined;
  const next: Trigger = {};
  const whenFrom = trigger.when?.from?.trim();
  if (whenFrom) next.when = { from: whenFrom, ...cleanCondition(trigger.when) };
  if (trigger.loop && Number.isFinite(trigger.loop.max) && trigger.loop.max >= 1) {
    const exit = cleanCondition(trigger.loop.exit_when);
    next.loop = { max: Math.floor(trigger.loop.max), ...(exit ? { exit_when: exit } : {}) };
  }
  return next.when || next.loop ? next : undefined;
}

const ROUTE_NUM_KEYS = ['gte', 'gt', 'lte', 'lt'] as const;

function cleanRouteWhen(when: RouteCondition | undefined): RouteCondition | undefined {
  if (!when) return undefined;
  const next: RouteCondition = {};
  if (when.equals?.trim()) next.equals = when.equals.trim();
  if (when.contains?.trim()) next.contains = when.contains.trim();
  if (when.not_contains?.trim()) next.not_contains = when.not_contains.trim();
  for (const key of ROUTE_NUM_KEYS) {
    const value = when[key];
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
  }
  return Object.keys(next).length ? next : undefined;
}

function cleanRoutes(routes: BranchRoute[] | undefined): BranchRoute[] | undefined {
  if (!routes) return undefined;
  const cleaned = routes
    .filter((route) => route.to.trim())
    .map((route) => {
      const when = cleanRouteWhen(route.when);
      return when ? { to: route.to.trim(), when } : { to: route.to.trim() };
    });
  return cleaned.length ? cleaned : undefined;
}

function cleanTech(tech: TechStack | undefined): TechStack | undefined {
  if (!tech) return undefined;
  const next: TechStack = {};
  if (tech.agent && tech.agent.trim()) next.agent = tech.agent.trim();
  const abilities = dropEmpty(tech.abilities);
  if (abilities) next.abilities = abilities;
  const skills = dropEmpty(tech.skills);
  if (skills) next.skills = skills;
  const subagents = dropEmpty(tech.subagents);
  if (subagents) next.subagents = subagents;
  if (tech.workflow) next.workflow = tech.workflow;
  return Object.keys(next).length ? next : undefined;
}

function cleanOutput(output: AgentOutput): AgentOutput {
  const next: AgentOutput = { schema: output.schema };
  const files = dropEmpty(output.files);
  if (files) next.files = files;
  if (output.log === false) next.log = false;
  return next;
}

/** Drop the keys a blank field leaves behind so the exported `tool:` block holds only what was set. */
function cleanToolSpec(spec: ToolSpec | undefined): ToolSpec {
  const base = spec ?? defaultToolSpec('http');
  const entries = Object.entries(base).filter(([, value]) => value !== undefined && value !== '' && value !== false);
  return Object.fromEntries(entries) as unknown as ToolSpec;
}

/** Optional keys only when set; `state` / `for_each` first, so the exported block reads top-down. */
function cleanDecisionSpec(spec: DecisionSpec | undefined): DecisionSpec {
  const base = spec ?? defaultDecisionSpec();
  return {
    ...(base.state?.trim() ? { state: base.state } : {}),
    ...(base.for_each?.trim() ? { for_each: base.for_each.trim() } : {}),
    questions: base.questions,
    ...(base.min_confidence !== undefined ? { min_confidence: base.min_confidence } : {}),
    ...(base.model?.trim() ? { model: base.model.trim() } : {}),
  };
}

function cleanDefinition(def: AgentDefinition): AgentDefinition {
  const isSub = def.type === 'sub-workflow';
  const isTool = def.type === 'tool';
  const out: AgentDefinition = {
    introduction: def.introduction,
    type: def.type,
    output: cleanOutput(def.output),
  };
  if (isTool) out.tool = cleanToolSpec(def.tool);
  else if (def.type === 'decision') {
    out.decision = cleanDecisionSpec(def.decision);
    // no prompt; the agent only answers when TYPESAFE_API_KEY is not set
    const fallback = def.agent_mapping?.opencode?.trim();
    if (fallback) out.agent_mapping = { opencode: fallback };
  } else if (!isSub) {
    out.prompt = def.prompt ?? '';
    out.agent_mapping = def.agent_mapping ?? { opencode: 'build' };
  }
  const input = cleanInput(def.input);
  if (input) out.input = input;
  const tech = cleanTech(def.tech_stack);
  if (tech) out.tech_stack = tech;
  const trigger = cleanTrigger(def.trigger);
  if (trigger) out.trigger = trigger;
  if (isRouter(def)) {
    if (def.branch_on && def.branch_on.trim()) out.branch_on = def.branch_on.trim();
    const routes = cleanRoutes(def.routes);
    if (routes) out.routes = routes;
  }
  return out;
}

export interface InspectorProps {
  node: AgentFlowNode | null;
  incoming: IncomingSource[];
  /** Source of the loop-back edge into this node, if one closes a loop here. */
  loopFrom?: string;
  outgoingTo: string[];
  embeddable: EmbeddableWorkflow[];
  existingIds: string[];
  /** Derived strict-JSON marker (branch, or upstream of a `select` edge). */
  jsonOut?: boolean;
  onChangeDefinition: (nodeId: string, next: AgentDefinition) => void;
  onRenameNode: (oldId: string, nextId: string) => void;
  /** IN port only: the workflow's `on:` block; `undefined` = no triggers. */
  onChangeTriggers: (next: WorkflowTriggers | undefined) => void;
  placement: InspectorPlacement;
  onTogglePlacement: () => void;
  onHide: () => void;
  /** Docked only: the column width, reported live while the left sash is dragged. */
  width?: number;
  onResizeWidth?: (width: number) => void;
}

type HeadActionsProps = Pick<InspectorProps, 'placement' | 'onTogglePlacement' | 'onHide'>;

export function Inspector({
  node,
  incoming,
  loopFrom,
  outgoingTo,
  embeddable,
  existingIds,
  jsonOut,
  onChangeDefinition,
  onRenameNode,
  onChangeTriggers,
  placement,
  onTogglePlacement,
  onHide,
  width,
  onResizeWidth,
}: InspectorProps) {
  const headActions = { placement, onTogglePlacement, onHide };
  return (
    <aside className={`agentry-inspector agentry-inspector--${placement}`} aria-label="Node inspector">
      {placement === 'docked' && width !== undefined && onResizeWidth && (
        <DockSash width={width} onResize={onResizeWidth} />
      )}
      {node ? (
        <InspectorForm
          key={node.id}
          node={node}
          incoming={incoming}
          loopFrom={loopFrom}
          outgoingTo={outgoingTo}
          embeddable={embeddable}
          existingIds={existingIds}
          jsonOut={jsonOut}
          onChangeDefinition={onChangeDefinition}
          onRenameNode={onRenameNode}
          onChangeTriggers={onChangeTriggers}
          headActions={headActions}
        />
      ) : (
        <div className="agentry-inspector__empty">
          <p className="agentry-empty__title">No node selected</p>
          <p className="agentry-empty__hint">Select a node on the canvas to edit its workflow.yaml fields.</p>
        </div>
      )}
    </aside>
  );
}

function HeadActions({ placement, onTogglePlacement, onHide }: HeadActionsProps) {
  const floating = placement === 'floating';
  return (
    <span className="agentry-inspector__actions">
      <button
        type="button"
        className="agentry-iconbtn"
        title={floating ? 'Dock to the right' : 'Pop out as a floating panel'}
        aria-label={floating ? 'Dock inspector' : 'Pop out inspector'}
        onClick={onTogglePlacement}
      >
        {floating ? <PanelRightIcon size={14} filled /> : <PopOutIcon size={14} />}
      </button>
      <button
        type="button"
        className="agentry-iconbtn"
        title="Hide inspector (Ctrl+Alt+B)"
        aria-label="Hide inspector"
        onClick={onHide}
      >
        <PanelRightCloseIcon size={14} />
      </button>
    </span>
  );
}

function DockSash({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  return (
    <div
      className="agentry-inspector__sash"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector"
      onPointerDown={(event) =>
        startPointerDrag(event, {
          bodyClass: 'agentry-drag--col',
          onMove: (dx) => onResize(clampDockedWidth(width - dx)),
        })
      }
    />
  );
}

function InspectorForm({
  node,
  incoming,
  loopFrom,
  outgoingTo,
  embeddable,
  existingIds,
  jsonOut,
  onChangeDefinition,
  onRenameNode,
  onChangeTriggers,
  headActions,
}: Omit<InspectorProps, 'node' | 'placement' | 'onTogglePlacement' | 'onHide' | 'width' | 'onResizeWidth'> & {
  node: AgentFlowNode;
  headActions: HeadActionsProps;
}) {
  const nodeId = node.id;
  const def = node.data.definition;
  const [idDraft, setIdDraft] = useState(node.data.agentId);
  const [schemaRows, setSchemaRows] = useState<SchemaRow[]>(() =>
    schemaToRows(def.type === 'decision' && def.decision ? decisionOutputSchema(def.decision) : (def.output?.schema ?? {})),
  );

  const emit = (next: AgentDefinition, rows: SchemaRow[] = schemaRows) =>
    onChangeDefinition(nodeId, cleanDefinition({ ...next, output: { ...next.output, schema: rowsToSchema(rows) } }));

  const setField = (partial: Partial<AgentDefinition>) => emit({ ...def, ...partial });

  const commitId = () => {
    const next = idDraft.trim();
    if (!next || next === nodeId || existingIds.includes(next)) {
      setIdDraft(nodeId);
      return;
    }
    onRenameNode(nodeId, next);
  };

  const setRows = (rows: SchemaRow[]) => {
    setSchemaRows(rows);
    emit(def, rows);
  };

  // the derived fields and the routed-on field follow every edit of the questions
  const setDecision = (decision: DecisionSpec, renamed?: QuestionRename) => {
    const rows = schemaToRows(decisionOutputSchema(decision));
    setSchemaRows(rows);
    const followed = renamed && def.branch_on === renamed.from ? renamed.to : def.branch_on;
    // one that routes keeps a field that still exists; one that does not route stays that way
    const branchOn = !followed ? undefined : rows.some((row) => row.key === followed) ? followed : Object.keys(decision.questions)[0];
    emit({ ...def, decision, branch_on: branchOn }, rows);
  };

  const trigger = def.trigger;
  const upstreamOptions = existingIds.filter((id) => id !== nodeId);
  const setTrigger = (next: Trigger | undefined) => setField({ trigger: next });

  // `outgoingTo` arrives in route PRIORITY order (first match wins, D16), so every
  // rewrite of `routes` below keeps or deliberately changes that order.
  const routeWhenFor = (to: string): RouteCondition | undefined =>
    def.routes?.find((route) => route.to === to)?.when;
  const writeRoutes = (order: readonly string[], override?: { to: string; when: RouteCondition }) => {
    const stored = new Map((def.routes ?? []).map((route) => [route.to, route.when]));
    if (override) stored.set(override.to, override.when);
    const routes: BranchRoute[] = order.map((target) => {
      const w = stored.get(target);
      return w && Object.keys(w).length ? { to: target, when: w } : { to: target };
    });
    setField({ routes });
  };
  const setRouteWhen = (to: string, when: RouteCondition) => writeRoutes(outgoingTo, { to, when });
  const moveRoute = (index: number, delta: -1 | 1) => {
    const order = [...outgoingTo];
    const a = order[index];
    const b = order[index + delta];
    if (a === undefined || b === undefined) return;
    order[index] = b;
    order[index + delta] = a;
    writeRoutes(order);
  };

  const feedback = def.input?.feedback;
  const setFeedback = (patch: Partial<FeedbackLoop>) => {
    if (loopFrom) setField({ input: { ...def.input, feedback: { ...feedback, ...patch, from: loopFrom } } });
  };

  const fanIn = incoming.filter((source) => source.id !== WORKFLOW_INPUT_ID).length;
  const join = def.input?.join === 'any' ? 'any' : 'all';
  const setJoin = (next: 'all' | 'any') => {
    const input: AgentInput = { ...def.input };
    if (next === 'any') input.join = 'any';
    else delete input.join;
    setField({ input });
  };

  const embedded = def.tech_stack?.workflow;
  const applyEmbed = (name: string) => {
    const target = embeddable.find((entry) => entry.name === name);
    if (!target) return;
    const rows = workflowProduces(target.workflow).map((field) => ({ key: field.key, value: field.type }));
    setSchemaRows(rows);
    emit({ ...def, introduction: target.name, tech_stack: { workflow: target.workflow } }, rows);
  };

  if (def.type === 'workflow-input' || def.type === 'workflow-output') {
    const isInput = def.type === 'workflow-input';
    return (
      <div className="agentry-inspector__form">
        <header className="agentry-inspector__head">
          <span className="agentry-inspector__eyebrow">{isInput ? 'Workflow input (IN)' : 'Workflow output (OUT)'}</span>
          <code className="agentry-inspector__id">{isInput ? 'input.json' : 'output.json'}</code>
          <HeadActions {...headActions} />
        </header>

        <div className="agentry-inspector__body">
          <section className="agentry-section">
            <span className="agentry-section__title">{isInput ? 'Overall input' : 'Overall output'}</span>

            <label className="agentry-field">
              <span className="agentry-field__label">Description</span>
              <textarea
                className="agentry-textarea"
                rows={2}
                value={def.introduction ?? ''}
                onChange={(event) => setField({ introduction: event.target.value })}
              />
              <span className="agentry-field__hint">
                {isInput
                  ? 'What the workflow takes in. Wire this port to the entry nodes on the canvas.'
                  : 'What the workflow delivers, assembled from the connected nodes below.'}
              </span>
            </label>

            {isInput ? (
              <>
                <div className="agentry-field">
                  <span className="agentry-field__label">Input schema</span>
                  <SchemaEditor rows={schemaRows} onChange={setRows} />
                  <span className="agentry-field__hint">Fields of the input JSON: field → type hint.</span>
                </div>

                <label className="agentry-field">
                  <span className="agentry-field__label">Extra info</span>
                  <textarea
                    className="agentry-textarea"
                    rows={2}
                    value={def.input?.extra_info ?? ''}
                    onChange={(event) => setField({ input: { ...def.input, extra_info: event.target.value } })}
                  />
                </label>

                <ListField
                  label="Reference files"
                  hint="Comma-separated paths."
                  value={def.input?.files}
                  onCommit={(files) => setField({ input: { ...def.input, files } })}
                />
              </>
            ) : (
              <>
                <div className="agentry-field">
                  <span className="agentry-field__label">Required fields</span>
                  <SchemaEditor rows={schemaRows} onChange={setRows} />
                  <span className="agentry-field__hint">
                    Fields the workflow must deliver: field → type hint. Typecheck flags any not
                    produced by a connected node.
                  </span>
                </div>

                <div className="agentry-field">
                  <span className="agentry-field__label">Connected</span>
                  <IncomingVariables incoming={incoming} emptyLabel="no connections yet" />
                  <span className="agentry-field__hint">
                    Fields actually produced by the nodes wired into this port.
                  </span>
                </div>
              </>
            )}
          </section>

          {isInput && <TriggerSection triggers={node.data.triggers} onChange={onChangeTriggers} />}
        </div>
      </div>
    );
  }

  return (
    <div className="agentry-inspector__form">
      <header className="agentry-inspector__head">
        <span className="agentry-inspector__eyebrow">
          Node
          {jsonOut && (
            <span
              className="agentry-inspector__badge"
              title="Emits strict JSON (schema-enforced at run time; may retry once, slightly slower)"
            >
              JSON
            </span>
          )}
        </span>
        <code className="agentry-inspector__id">{nodeId}</code>
        <HeadActions {...headActions} />
      </header>

      <div className="agentry-inspector__body">
        <section className="agentry-section">
          <span className="agentry-section__title">Identity</span>

          <label className="agentry-field">
            <span className="agentry-field__label">ID</span>
            <input
              className="agentry-input"
              value={idDraft}
              onChange={(event) => setIdDraft(event.target.value)}
              onBlur={commitId}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              spellCheck={false}
            />
            <span className="agentry-field__hint">Unique key used in workflow.yaml.</span>
          </label>

          <label className="agentry-field">
            <span className="agentry-field__label">Title</span>
            <input
              className="agentry-input"
              value={def.introduction ?? ''}
              onChange={(event) => setField({ introduction: event.target.value })}
            />
          </label>
        </section>

        <section className="agentry-section">
          <span className="agentry-section__title">Behavior</span>

          <label className="agentry-field">
            <span className="agentry-field__label">Type</span>
            <select
              className="agentry-select"
              value={def.type ?? 'straight'}
              onChange={(event) => {
                const type = event.target.value as AgentType;
                if (type === 'tool' && !def.tool) {
                  // becoming a tool: start from an HTTP spec and the schema it always produces
                  const rows = schemaToRows(toolSchemaFor('http'));
                  setSchemaRows(rows);
                  emit({ ...def, type, tool: defaultToolSpec('http') }, rows);
                  return;
                }
                if (type === 'decision' && !def.decision) {
                  // becoming a decision: one question to route on, and the fields its answers produce
                  const decision = defaultDecisionSpec();
                  const rows = schemaToRows(decisionOutputSchema(decision));
                  setSchemaRows(rows);
                  emit({ ...def, type, decision, branch_on: Object.keys(decision.questions)[0] }, rows);
                  return;
                }
                setField({ type });
              }}
            >
              {AGENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          {def.type !== 'sub-workflow' && def.type !== 'tool' && def.type !== 'decision' && (
            <>
              <label className="agentry-field">
                <span className="agentry-field__label">opencode agent</span>
                <input
                  className="agentry-input"
                  value={def.agent_mapping?.opencode ?? ''}
                  onChange={(event) => setField({ agent_mapping: { ...def.agent_mapping, opencode: event.target.value } })}
                  spellCheck={false}
                />
                <span className="agentry-field__hint">Native opencode agent this node runs as.</span>
              </label>

              <label className="agentry-field">
                <span className="agentry-field__label">Claude Code agent (optional)</span>
                <input
                  className="agentry-input"
                  value={def.agent_mapping?.claude_code ?? ''}
                  onChange={(event) => setField({ agent_mapping: { ...def.agent_mapping, claude_code: event.target.value || undefined } })}
                  spellCheck={false}
                />
                <span className="agentry-field__hint">Subagent for runs on Claude Code (claude --agent). Empty = the host default.</span>
              </label>

              <label className="agentry-field">
                <span className="agentry-field__label">Codex profile (optional)</span>
                <input
                  className="agentry-input"
                  value={def.agent_mapping?.codex ?? ''}
                  onChange={(event) => setField({ agent_mapping: { ...def.agent_mapping, codex: event.target.value || undefined } })}
                  spellCheck={false}
                />
                <span className="agentry-field__hint">Config profile for runs on Codex (codex exec --profile). Empty = the host default.</span>
              </label>

              <label className="agentry-field">
                <span className="agentry-field__label">Prompt</span>
                <textarea
                  className="agentry-textarea"
                  rows={4}
                  value={def.prompt ?? ''}
                  onChange={(event) => setField({ prompt: event.target.value })}
                />
              </label>
            </>
          )}
        </section>

        {def.type === 'tool' && (
          <ToolSection
            spec={def.tool ?? defaultToolSpec('http')}
            incoming={incoming}
            onChange={(tool) => {
              if (tool.kind === def.tool?.kind) {
                setField({ tool });
                return;
              }
              const rows = schemaToRows(toolSchemaFor(tool.kind));
              setSchemaRows(rows);
              emit({ ...def, tool }, rows);
            }}
          />
        )}

        {def.type === 'decision' && (
          <DecisionSection
            spec={def.decision ?? defaultDecisionSpec()}
            fallbackAgent={def.agent_mapping?.opencode ?? ''}
            incoming={incoming}
            onChange={setDecision}
            onFallbackAgent={(opencode) => setField({ agent_mapping: { opencode } })}
          />
        )}

        <section className="agentry-section">
          <span className="agentry-section__title">Input</span>

          <div className="agentry-field">
            <span className="agentry-field__label">From</span>
            <IncomingVariables incoming={incoming} emptyLabel="no upstream" />
            <span className="agentry-field__hint">
              Variables received from each connected node. Set by wiring nodes on the canvas.
            </span>
          </div>

          {(fanIn >= 2 || join === 'any') && (
            <label className="agentry-field">
              <span className="agentry-field__label">Fire when</span>
              <select
                className="agentry-select"
                value={join}
                onChange={(event) => setJoin(event.target.value === 'any' ? 'any' : 'all')}
              >
                <option value="all">every upstream has finished (all)</option>
                <option value="any">the first upstream finishes (any)</option>
              </select>
              <span className="agentry-field__hint">
                {join === 'any'
                  ? 'Runs once, with whatever has arrived — the merge point after a branch, or first result wins. Skipped only if every upstream is skipped.'
                  : 'Waits for all of them. If a branch skips one, this node is skipped too — merging a branch\u2019s alternative paths needs “any”.'}
              </span>
            </label>
          )}

          {loopFrom && (
            <div className="agentry-field">
              <span className="agentry-field__label">Loops back from {loopFrom}</span>
              <span className="agentry-field__hint">
                When “{loopFrom}” finishes, this node and every step between them run again, with its output as feedback.
                A loop also stops when “{loopFrom}” says the same thing twice in a row.
              </span>
              <label className="agentry-field">
                <span className="agentry-field__label">Extra rounds at most</span>
                <input
                  className="agentry-input"
                  type="number"
                  min={1}
                  max={FEEDBACK_MAX_LIMIT}
                  value={feedback?.max ?? FEEDBACK_DEFAULT_MAX}
                  onChange={(event) => setFeedback({ max: Math.trunc(Number(event.target.value)) })}
                />
              </label>
              <span className="agentry-field__label">Loop again while its output</span>
              <ConditionEditor condition={feedback?.when} onChange={(when) => setFeedback({ when })} />
              <span className="agentry-field__hint">Leave all three empty to always run every round.</span>
            </div>
          )}

          <label className="agentry-field">
            <span className="agentry-field__label">Extra info</span>
            <textarea
              className="agentry-textarea"
              rows={2}
              value={def.input?.extra_info ?? ''}
              onChange={(event) => setField({ input: { ...def.input, extra_info: event.target.value } })}
            />
          </label>

          <ListField
            label="Reference files"
            hint="Comma-separated paths."
            value={def.input?.files}
            onCommit={(files) => setField({ input: { ...def.input, files } })}
          />
        </section>

        {def.type !== 'sub-workflow' && def.type !== 'decision' && (
          <section className="agentry-section">
            <span className="agentry-section__title">Output</span>

            <div className="agentry-field">
              <span className="agentry-field__label">Schema</span>
              <SchemaEditor rows={schemaRows} onChange={setRows} />
              <span className="agentry-field__hint">Canonical output JSON: field → type hint.</span>
            </div>

            <ListField
              label="Side files"
              hint="Comma-separated paths."
              value={def.output?.files}
              onCommit={(files) => setField({ output: { ...def.output, files } })}
            />

            <label className="agentry-checkbox">
              <input
                type="checkbox"
                checked={def.output?.log !== false}
                onChange={(event) => setField({ output: { ...def.output, log: event.target.checked } })}
              />
              <span>Emit log.md</span>
            </label>
          </section>
        )}

        {def.type === 'decision' && (
          <section className="agentry-section">
            <span className="agentry-section__title">Output</span>
            <RefFieldList label="Fields" fields={schemaFields(decisionOutputSchema(def.decision ?? defaultDecisionSpec()))} />
            <span className="agentry-field__hint">
              {isBatchDecision(def.decision)
                ? 'One record per item in items, how many items got each answer in counts, and the unsure items by index.'
                : 'Each answer with its confidence, the questions answered below the confidence bar in unsure, and the backend that answered.'}
            </span>
          </section>
        )}

        {/* a single decision shows it too: picking a field is what makes it route */}
        {(def.type === 'branch' || (def.type === 'decision' && !isBatchDecision(def.decision))) && (
          <section className="agentry-section">
            <span className="agentry-section__title">{def.type === 'decision' ? 'Routing' : 'Branch routing'}</span>

            <label className="agentry-field">
              <span className="agentry-field__label">Route on field</span>
              <select
                className="agentry-select"
                value={def.branch_on ?? ''}
                onChange={(event) => setField({ branch_on: event.target.value })}
              >
                <option value="">select output field…</option>
                {schemaRows
                  .map((row) => row.key.trim())
                  .filter(Boolean)
                  .map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
              </select>
              <span className="agentry-field__hint">
                {def.type === 'decision'
                  ? 'A choice routes on its option name, a yes / no on true or false, a score on its expected level (0 = the first).'
                  : 'Output field whose value decides which port an edge takes.'}
              </span>
            </label>

            {outgoingTo.length === 0 ? (
              <p className="agentry-field__hint">
                Connect this {def.type === 'decision' ? 'decision' : 'branch'} to downstream nodes — each connection is a port you can gate below.
              </p>
            ) : (
              <>
                {outgoingTo.length > 1 && (
                  <p className="agentry-field__hint">
                    Ports are checked top to bottom and only the first match runs. A port left blank is the
                    fallback (else), taken only when nothing above matched.
                  </p>
                )}
                {outgoingTo.map((to, index) => (
                  <div className="agentry-subgroup" key={to}>
                    <div className="agentry-field__label agentry-route__head">
                      {outgoingTo.length > 1 && <span className="agentry-route__rank">{index + 1}</span>}
                      <span className="agentry-route__arrow">→</span>
                      <code>{to}</code>
                      {outgoingTo.length > 1 && (
                        <span className="agentry-route__order">
                          <button
                            type="button"
                            className="agentry-iconbtn"
                            title="Check this port earlier"
                            aria-label={`Move ${to} up`}
                            disabled={index === 0}
                            onClick={() => moveRoute(index, -1)}
                          >
                            <ChevronUpIcon />
                          </button>
                          <button
                            type="button"
                            className="agentry-iconbtn"
                            title="Check this port later"
                            aria-label={`Move ${to} down`}
                            disabled={index === outgoingTo.length - 1}
                            onClick={() => moveRoute(index, 1)}
                          >
                            <ChevronDownIcon />
                          </button>
                        </span>
                      )}
                    </div>
                    <RouteConditionEditor
                      condition={routeWhenFor(to)}
                      onChange={(when) => setRouteWhen(to, when)}
                    />
                    <span className="agentry-field__hint">Leave all blank for the default (else) port.</span>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {def.type === 'sub-workflow' && (
          <section className="agentry-section">
            <span className="agentry-section__title">Sub-workflow</span>

            {embedded ? (
              <>
                <div className="agentry-field">
                  <span className="agentry-field__label">Embedded workflow</span>
                  <div className="agentry-readonly">
                    <code>{embedded.introduction || def.introduction || 'workflow'}</code>
                    <span className="agentry-readonly__muted"> · {Object.keys(embedded.agents).length} steps</span>
                  </div>
                  <span className="agentry-field__hint">
                    Fully inlined — travels with this workflow when exported or copied.
                  </span>
                </div>
                <p className="agentry-field__hint">
                  Runs as a workflow of its own: inner branches, conditions, loops and joins all apply.
                  On this canvas it stays one step; its inner artifacts land in a folder named after it.
                </p>
                <RefFieldList label="Expects (input)" fields={schemaFields(embedded.input.schema)} />
                <RefFieldList label="Produces (output)" fields={workflowProduces(embedded)} />
                <RefFieldList
                  label="Steps"
                  fields={Object.entries(embedded.agents).map(([id, a]) => ({ key: id, type: a.type ?? 'straight' }))}
                />
              </>
            ) : (
              <p className="agentry-field__hint">
                Empty. Use “Import a .yaml as a sub-workflow node” in the Agents panel, or embed a saved workflow below.
              </p>
            )}

            <label className="agentry-field">
              <span className="agentry-field__label">{embedded ? 'Replace with' : 'Embed a saved workflow'}</span>
              <select
                className="agentry-select"
                value=""
                onChange={(event) => {
                  if (event.target.value) applyEmbed(event.target.value);
                }}
              >
                <option value="">{embeddable.length ? 'select a saved workflow…' : 'no saved workflows yet'}</option>
                {embeddable.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <span className="agentry-field__hint">Copies the whole workflow in (no external reference).</span>
            </label>
          </section>
        )}

        {def.type !== 'sub-workflow' && def.type !== 'tool' && def.type !== 'decision' && (
          <details className="agentry-collapse">
            <summary>Tech stack</summary>
            <div className="agentry-collapse__body">
              <label className="agentry-field">
                <span className="agentry-field__label">Abstract role</span>
                <input
                  className="agentry-input"
                  value={def.tech_stack?.agent ?? ''}
                  onChange={(event) => setField({ tech_stack: { ...def.tech_stack, agent: event.target.value } })}
                  spellCheck={false}
                />
              </label>
              <ListField
                label="Abilities"
                value={def.tech_stack?.abilities}
                onCommit={(abilities) => setField({ tech_stack: { ...def.tech_stack, abilities } })}
              />
              <ListField
                label="Skills"
                value={def.tech_stack?.skills}
                onCommit={(skills) => setField({ tech_stack: { ...def.tech_stack, skills } })}
              />
              <ListField
                label="Subagents"
                value={def.tech_stack?.subagents}
                onCommit={(subagents) => setField({ tech_stack: { ...def.tech_stack, subagents } })}
              />
            </div>
          </details>
        )}

        <section className="agentry-section">
          <span className="agentry-section__title">Trigger</span>

          <label className="agentry-checkbox">
            <input
              type="checkbox"
              checked={Boolean(trigger?.when)}
              onChange={(event) =>
                setTrigger({
                  ...trigger,
                  when: event.target.checked
                    ? { from: trigger?.when?.from || upstreamOptions[0] || '' }
                    : undefined,
                })
              }
            />
            <span>Conditional run</span>
          </label>

          {trigger?.when && (
            <div className="agentry-subgroup">
              <label className="agentry-field">
                <span className="agentry-field__label">When node</span>
                <select
                  className="agentry-select"
                  value={trigger.when.from}
                  onChange={(event) =>
                    setTrigger({ ...trigger, when: { ...trigger.when, from: event.target.value } })
                  }
                >
                  <option value="">select node…</option>
                  {upstreamOptions.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
                <span className="agentry-field__hint">Runs only if this node's output matches below.</span>
              </label>
              <ConditionEditor
                condition={trigger.when}
                onChange={(cond) => setTrigger({ ...trigger, when: { from: trigger.when!.from, ...cond } })}
              />
            </div>
          )}

          <label className="agentry-checkbox">
            <input
              type="checkbox"
              checked={Boolean(trigger?.loop)}
              onChange={(event) =>
                setTrigger({
                  ...trigger,
                  loop: event.target.checked
                    ? { max: trigger?.loop?.max ?? 3, exit_when: trigger?.loop?.exit_when }
                    : undefined,
                })
              }
            />
            <span>Loop</span>
          </label>

          {trigger?.loop && (
            <div className="agentry-subgroup">
              <label className="agentry-field">
                <span className="agentry-field__label">Max iterations</span>
                <input
                  className="agentry-input"
                  type="number"
                  min={1}
                  value={trigger.loop.max}
                  onChange={(event) =>
                    setTrigger({
                      ...trigger,
                      loop: { ...trigger.loop!, max: Math.max(1, Math.floor(Number(event.target.value) || 1)) },
                    })
                  }
                />
              </label>
              <div className="agentry-field">
                <span className="agentry-field__label">Exit when</span>
                <ConditionEditor
                  condition={trigger.loop.exit_when}
                  onChange={(cond) => setTrigger({ ...trigger, loop: { ...trigger.loop!, exit_when: cond } })}
                />
                <span className="agentry-field__hint">Required to loop — without it the node runs once.</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ConditionEditor({
  condition,
  onChange,
}: {
  condition: Condition | undefined;
  onChange: (next: Condition) => void;
}) {
  const value = condition ?? {};
  const set = (patch: Partial<Condition>) => onChange({ ...value, ...patch });

  return (
    <div className="agentry-condition">
      <label className="agentry-field">
        <span className="agentry-field__label">contains</span>
        <input
          className="agentry-input agentry-input--mono"
          value={value.contains ?? ''}
          placeholder="substring"
          onChange={(event) => set({ contains: event.target.value })}
        />
      </label>
      <label className="agentry-field">
        <span className="agentry-field__label">not contains</span>
        <input
          className="agentry-input agentry-input--mono"
          value={value.not_contains ?? ''}
          placeholder="substring"
          onChange={(event) => set({ not_contains: event.target.value })}
        />
      </label>
      <label className="agentry-field">
        <span className="agentry-field__label">equals</span>
        <input
          className="agentry-input agentry-input--mono"
          value={value.equals ?? ''}
          placeholder="exact value"
          onChange={(event) => set({ equals: event.target.value })}
        />
      </label>
    </div>
  );
}

const ROUTE_NUM_LABEL: Record<(typeof ROUTE_NUM_KEYS)[number], string> = {
  gte: '\u2265',
  gt: '>',
  lte: '\u2264',
  lt: '<',
};

function RouteConditionEditor({
  condition,
  onChange,
}: {
  condition: RouteCondition | undefined;
  onChange: (next: RouteCondition) => void;
}) {
  const value = condition ?? {};
  const setStr = (patch: Partial<RouteCondition>) => onChange({ ...value, ...patch });
  const setNum = (key: (typeof ROUTE_NUM_KEYS)[number], raw: string) => {
    const next: RouteCondition = { ...value };
    const parsed = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(parsed)) delete next[key];
    else next[key] = parsed;
    onChange(next);
  };

  return (
    <div className="agentry-condition">
      <label className="agentry-field">
        <span className="agentry-field__label">equals</span>
        <input
          className="agentry-input agentry-input--mono"
          value={value.equals ?? ''}
          placeholder="exact value"
          onChange={(event) => setStr({ equals: event.target.value })}
        />
      </label>
      <label className="agentry-field">
        <span className="agentry-field__label">contains</span>
        <input
          className="agentry-input agentry-input--mono"
          value={value.contains ?? ''}
          placeholder="substring"
          onChange={(event) => setStr({ contains: event.target.value })}
        />
      </label>
      <div className="agentry-route__nums">
        {ROUTE_NUM_KEYS.map((key) => (
          <label className="agentry-route__num" key={key}>
            <span className="agentry-route__op">{ROUTE_NUM_LABEL[key]}</span>
            <input
              className="agentry-input agentry-input--mono"
              type="number"
              value={value[key] ?? ''}
              onChange={(event) => setNum(key, event.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function SchemaEditor({ rows, onChange }: { rows: SchemaRow[]; onChange: (rows: SchemaRow[]) => void }) {
  const update = (index: number, patch: Partial<SchemaRow>) =>
    onChange(rows.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_, current) => current !== index));
  const add = () => onChange([...rows, { key: '', value: 'string' }]);

  return (
    <div className="agentry-schema">
      {rows.map((row, index) => (
        <div className="agentry-schema__row" key={index}>
          <input
            className="agentry-input agentry-input--mono"
            value={row.key}
            placeholder="field"
            onChange={(event) => update(index, { key: event.target.value })}
            spellCheck={false}
          />
          <input
            className="agentry-input agentry-input--mono"
            value={row.value}
            placeholder="type"
            onChange={(event) => update(index, { value: event.target.value })}
            spellCheck={false}
          />
          <button type="button" className="agentry-iconbtn" title="Remove field" onClick={() => remove(index)}>
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="agentry-schema__add" onClick={add}>
        <PlusIcon size={13} />
        Add field
      </button>
    </div>
  );
}

function RefFieldList({ label, fields }: { label: string; fields: IncomingField[] }) {
  return (
    <div className="agentry-field">
      <span className="agentry-field__label">{label}</span>
      {fields.length ? (
        <div className="agentry-vars__list">
          {fields.map((field) => (
            <div className="agentry-vars__row" key={field.key}>
              <code className="agentry-vars__key">{field.key}</code>
              <span className="agentry-vars__type">{field.type}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="agentry-readonly__muted">none declared</span>
      )}
    </div>
  );
}

function IncomingVariables({ incoming, emptyLabel }: { incoming: IncomingSource[]; emptyLabel: string }) {
  if (!incoming.length) {
    return (
      <div className="agentry-readonly">
        <span className="agentry-readonly__muted">{emptyLabel}</span>
      </div>
    );
  }
  return (
    <div className="agentry-vars">
      {incoming.map((source) => (
        <div className="agentry-subgroup" key={source.id}>
          <div className="agentry-field__label agentry-route__head">
            <span className="agentry-route__arrow">→</span>
            <code>{source.label}</code>
          </div>
          {source.fields.length ? (
            <div className="agentry-vars__list">
              {source.fields.map((field) => (
                <div className="agentry-vars__row" key={field.key}>
                  <code className="agentry-vars__key">{field.key}</code>
                  <span className="agentry-vars__type">{field.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="agentry-readonly__muted">no declared output fields</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ListField({
  label,
  hint,
  placeholder,
  error,
  value,
  onCommit,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  error?: string;
  value: string[] | undefined;
  onCommit: (list: string[]) => void;
}) {
  const [text, setText] = useState(listToComma(value));

  return (
    <label className="agentry-field">
      <span className="agentry-field__label">{label}</span>
      <input
        className={`agentry-input agentry-input--mono${error ? ' is-invalid' : ''}`}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onCommit(commaToList(text))}
        spellCheck={false}
      />
      <FieldError message={error} />
      {hint ? <span className="agentry-field__hint">{hint}</span> : null}
    </label>
  );
}

const TRIGGER_LABEL: Record<TriggerKind, string> = {
  file: 'a file lands in a folder',
  schedule: 'a scheduled time comes',
  web: 'a web page changes',
  mail: 'new mail arrives',
  git: 'a git branch moves',
};

const TRIGGER_STARTER: { [K in TriggerKind]: NonNullable<WorkflowTriggers[K]> } = {
  file: { path: '~/Downloads' },
  schedule: { at: '09:00' },
  web: { url: '' },
  mail: { provider: 'gmail' },
  git: { repo: '.' },
};

function withTrigger<K extends TriggerKind>(
  triggers: WorkflowTriggers | undefined,
  kind: K,
  value: NonNullable<WorkflowTriggers[K]>,
): WorkflowTriggers {
  const next: WorkflowTriggers = { ...triggers };
  next[kind] = value;
  return next;
}

function withoutTrigger(triggers: WorkflowTriggers | undefined, kind: TriggerKind): WorkflowTriggers | undefined {
  const next: WorkflowTriggers = { ...triggers };
  delete next[kind];
  return activeTriggerKinds(next).length ? next : undefined;
}

/** Copy with `key` set, or dropped when blank/undefined — optional settings never serialize empty. */
function withSetting<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): T {
  const next: Partial<T> = { ...obj };
  if (value === undefined || value === '') delete next[key];
  else next[key] = value;
  return next as T;
}

const patternValue = (list: string[]): string | string[] | undefined => (list.length <= 1 ? list[0] : list);

const problemText = (problems: TriggerProblem[], field?: string): string | undefined =>
  problems.find((problem) => problem.field === field)?.message;

function FieldError({ message }: { message: string | undefined }) {
  return message ? (
    <span className="agentry-field__error" role="alert">
      {message}
    </span>
  ) : null;
}

function SettingField({
  label,
  value,
  placeholder,
  hint,
  error,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="agentry-field">
      <span className="agentry-field__label">{label}</span>
      <input
        className={`agentry-input agentry-input--mono${error ? ' is-invalid' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
      <FieldError message={error} />
      {hint ? <span className="agentry-field__hint">{hint}</span> : null}
    </label>
  );
}

function TriggerSection({
  triggers,
  onChange,
}: {
  triggers: WorkflowTriggers | undefined;
  onChange: (next: WorkflowTriggers | undefined) => void;
}) {
  const problems = checkTriggers(triggers);
  const blockProblems = problems.filter((problem) => problem.kind === 'on');
  const toggle = (kind: TriggerKind, on: boolean) =>
    onChange(on ? withTrigger(triggers, kind, TRIGGER_STARTER[kind]) : withoutTrigger(triggers, kind));

  return (
    <section className="agentry-section">
      <div className="agentry-section__head">
        <span className="agentry-section__title">Triggers</span>
        <span className="agentry-field__hint">Starts on its own when…</span>
      </div>

      {blockProblems.map((problem) => (
        <FieldError key={problem.field ?? problem.message} message={problem.message} />
      ))}

      {TRIGGER_KINDS.map((kind) => {
        const active = triggers?.[kind] !== undefined;
        return (
          <div className={`agentry-trigger-kind${active ? ' is-on' : ''}`} key={kind}>
            <label className="agentry-checkbox agentry-trigger-kind__toggle">
              <input type="checkbox" checked={active} onChange={(event) => toggle(kind, event.target.checked)} />
              <TriggerIcon kind={kind} size={13} />
              <span>{TRIGGER_LABEL[kind]}</span>
            </label>
            {active && triggers && (
              <div className="agentry-subgroup">
                <TriggerKindFields
                  kind={kind}
                  triggers={triggers}
                  problems={problems.filter((problem) => problem.kind === kind)}
                  onChange={onChange}
                />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function TriggerKindFields({
  kind,
  triggers,
  problems,
  onChange,
}: {
  kind: TriggerKind;
  triggers: WorkflowTriggers;
  problems: TriggerProblem[];
  onChange: (next: WorkflowTriggers) => void;
}) {
  switch (kind) {
    case 'file':
      return triggers.file ? (
        <FileTriggerFields
          value={triggers.file}
          problems={problems}
          onChange={(next) => onChange(withTrigger(triggers, 'file', next))}
        />
      ) : null;
    case 'schedule':
      return triggers.schedule ? (
        <ScheduleTriggerFields
          value={triggers.schedule}
          problems={problems}
          onChange={(next) => onChange(withTrigger(triggers, 'schedule', next))}
        />
      ) : null;
    case 'web':
      return triggers.web ? (
        <WebTriggerFields
          value={triggers.web}
          problems={problems}
          onChange={(next) => onChange(withTrigger(triggers, 'web', next))}
        />
      ) : null;
    case 'mail':
      return triggers.mail ? (
        <MailTriggerFields
          value={triggers.mail}
          problems={problems}
          onChange={(next) => onChange(withTrigger(triggers, 'mail', next))}
        />
      ) : null;
    case 'git':
      return triggers.git ? (
        <GitTriggerFields
          value={triggers.git}
          problems={problems}
          onChange={(next) => onChange(withTrigger(triggers, 'git', next))}
        />
      ) : null;
  }
}

type KindFieldsProps<T> = { value: T; problems: TriggerProblem[]; onChange: (next: T) => void };

function FileTriggerFields({ value: t, problems, onChange }: KindFieldsProps<FileTrigger>) {
  return (
    <>
      <SettingField
        label="Folder"
        value={t.path}
        placeholder="~/Downloads"
        hint="Absolute, ~/…, or relative to the project root. A file counts once it has finished downloading."
        error={problemText(problems, 'path')}
        onChange={(path) => onChange({ ...t, path })}
      />
      <ListField
        label="Only files matching"
        placeholder="*.pdf, *.png"
        hint="Comma-separated globs. Blank = every file."
        value={asPatternList(t.match)}
        error={problemText(problems, 'match')}
        onCommit={(list) => onChange(withSetting(t, 'match', patternValue(list)))}
      />
      <ListField
        label="Never for"
        placeholder="draft*"
        hint="Globs that never start a run."
        value={asPatternList(t.ignore)}
        error={problemText(problems, 'ignore')}
        onCommit={(list) => onChange(withSetting(t, 'ignore', patternValue(list)))}
      />
      <SettingField
        label="Settle"
        value={t.settle ?? ''}
        placeholder={TRIGGER_DEFAULTS.fileSettle}
        hint="Files arriving within this window start one run together (30s, 15m, 2h)."
        error={problemText(problems, 'settle')}
        onChange={(settle) => onChange(withSetting(t, 'settle', settle))}
      />
    </>
  );
}

function ScheduleTriggerFields({ value: t, problems, onChange }: KindFieldsProps<ScheduleTrigger>) {
  const mode = t.every !== undefined && t.at === undefined ? 'every' : 'at';
  return (
    <>
      <FieldError message={problemText(problems)} />
      <label className="agentry-field">
        <span className="agentry-field__label">Fires</span>
        <select
          className="agentry-select"
          value={mode}
          onChange={(event) =>
            onChange(event.target.value === 'every' ? { every: t.every ?? '1h' } : { at: t.at ?? '09:00' })
          }
        >
          <option value="at">at a time of day</option>
          <option value="every">every interval</option>
        </select>
      </label>
      {mode === 'at' ? (
        <SettingField
          label="At"
          value={t.at ?? ''}
          placeholder="Fri 17:00"
          hint='Local time, optionally with days: "17:00", "Fri 17:00", "Mon-Fri 08:30", "weekdays 08:00".'
          error={problemText(problems, 'at')}
          onChange={(at) => onChange({ at })}
        />
      ) : (
        <SettingField
          label="Every"
          value={t.every ?? ''}
          placeholder="15m"
          hint="A fixed interval: 30s, 15m, 2h, 1d."
          error={problemText(problems, 'every')}
          onChange={(every) => onChange({ every })}
        />
      )}
    </>
  );
}

function WebTriggerFields({ value: t, problems, onChange }: KindFieldsProps<WebTrigger>) {
  return (
    <>
      <SettingField
        label="Page"
        value={t.url}
        placeholder="https://…"
        hint="Fires when the page's visible text changes."
        error={problemText(problems, 'url')}
        onChange={(url) => onChange({ ...t, url })}
      />
      <SettingField
        label="Check every"
        value={t.every ?? ''}
        placeholder={TRIGGER_DEFAULTS.webEvery}
        hint="Poll interval: 30s, 15m, 2h."
        error={problemText(problems, 'every')}
        onChange={(every) => onChange(withSetting(t, 'every', every))}
      />
      <label className="agentry-checkbox">
        <input
          type="checkbox"
          checked={t.initial === true}
          onChange={(event) => onChange(withSetting(t, 'initial', event.target.checked ? true : undefined))}
        />
        <span>Also run once when the watcher starts</span>
      </label>
      <FieldError message={problemText(problems, 'initial')} />
    </>
  );
}

function MailTriggerFields({ value: t, problems, onChange }: KindFieldsProps<MailTrigger>) {
  return (
    <>
      <div className="agentry-field">
        <span className="agentry-field__label">Mailbox</span>
        <div className="agentry-readonly">
          <code>gmail</code>
          <span className="agentry-readonly__muted"> · signed in via ~/.agentry/google-token.json</span>
        </div>
        <FieldError message={problemText(problems, 'provider')} />
      </div>
      <SettingField
        label="Only mail matching"
        value={t.query ?? ''}
        placeholder="in:inbox -category:promotions"
        hint="Gmail search syntax. Blank = every new message."
        error={problemText(problems, 'query')}
        onChange={(query) => onChange(withSetting(t, 'query', query))}
      />
      <SettingField
        label="Check every"
        value={t.every ?? ''}
        placeholder={TRIGGER_DEFAULTS.mailEvery}
        hint="Poll interval: 15s, 1m, 5m."
        error={problemText(problems, 'every')}
        onChange={(every) => onChange(withSetting(t, 'every', every))}
      />
    </>
  );
}

function GitTriggerFields({ value: t, problems, onChange }: KindFieldsProps<GitTrigger>) {
  return (
    <>
      <SettingField
        label="Repository"
        value={t.repo}
        placeholder="."
        hint="Absolute, ~/…, or relative to the project root (. = this project)."
        error={problemText(problems, 'repo')}
        onChange={(repo) => onChange({ ...t, repo })}
      />
      <label className="agentry-field">
        <span className="agentry-field__label">When</span>
        <select
          className="agentry-select"
          value={t.event ?? 'push'}
          onChange={(event) =>
            onChange(withSetting(t, 'event', event.target.value === 'commit' ? 'commit' : undefined))
          }
        >
          <option value="push">a branch is pushed (remote-tracking branch moves)</option>
          <option value="commit">a commit lands (local branch moves)</option>
        </select>
        <FieldError message={problemText(problems, 'event')} />
      </label>
      <ListField
        label="Branches"
        placeholder="main, release/*"
        hint="Comma-separated. Blank = every branch."
        value={asPatternList(t.branch)}
        error={problemText(problems, 'branch')}
        onCommit={(list) => onChange(withSetting(t, 'branch', patternValue(list)))}
      />
    </>
  );
}
