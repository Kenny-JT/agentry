import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  edgeId,
  graphToWorkflow,
  isJsonOut,
  isRouterDef,
  loopEdgeIds,
  orderedRouteTargets,
  useEdgesState,
  resolveVolumeOverlaps,
  useNodesState,
  workflowToGraph,
  WorkflowCanvas,
  WORKFLOW_INPUT_ID,
} from '@agentry/canvas';
import type {
  AgentFlowNode,
  OnConnect,
  OnEdgesChange,
  WorkflowCanvasMode,
  WorkflowEdge,
  WorkflowMeta,
  XYPosition,
} from '@agentry/canvas';
import { validateWorkflow, workflowFromYaml, workflowToYaml } from '@agentry/core';
import type { AgentDefinition, AgentInput, WorkflowTriggers } from '@agentry/core';
import { getStoredTheme, getToggledTheme, setTheme } from '@agentry/design';
import type { Theme } from '@agentry/design';
import { ActivityBar } from './components/ActivityBar';
import { ExportDialog } from './components/ExportDialog';
import { SettingsPanel } from './components/SettingsPanel';
import { Inspector } from './components/Inspector';
import type { IncomingSource, EmbeddableWorkflow } from './components/Inspector';
import { InspectorFloat } from './components/InspectorFloat';
import { PanelRightIcon } from './components/icons';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { AGENT_DROP_MIME, createAgentNode, templateById } from './agentTemplates';
import type { AgentTemplate } from './agentTemplates';
import { deleteWorkflow, listWorkflows, newWorkflowId, upsertWorkflow } from './workflowStore';
import type { SavedWorkflow } from './workflowStore';
import { heroGraph } from './sampleWorkflow';
import {
  readInspectorMode,
  readInspectorWidth,
  writeInspectorMode,
  writeInspectorWidth,
} from './inspectorLayout';
import type { InspectorMode, InspectorPlacement } from './inspectorLayout';
import { openYamlFile } from './platform';
import { getStoredProjectRoot, pushPanelTheme, storeProjectRoot } from './panelDiscovery';
import { pruneSelectEntries } from './pruneSelect';
import { renameDefinitionRefs } from './renameRefs';
import { useRunEvents } from './useRunEvents';

export type SidebarView = 'agents' | 'history';
export type HistorySort = 'Name' | 'Created' | 'Edited';

const WORKFLOW_FILE = 'add-tests-and-refactor.workflow.yaml';

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.closest('input, textarea, select') !== null);

export function App() {
  const [view, setView] = useState<SidebarView>('agents');
  const [meta, setMeta] = useState<WorkflowMeta>(heroGraph.meta);
  const [fitKey, setFitKey] = useState(0);
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentFlowNode>(
    resolveVolumeOverlaps(heroGraph.nodes),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>([
    ...heroGraph.edges,
    {
      id: edgeId('explore_code', 'refactor'),
      source: 'explore_code',
      target: 'refactor',
      type: 'orthogonal',
    },
    {
      id: edgeId('refactor', 'explore_code'),
      source: 'refactor',
      target: 'explore_code',
      type: 'orthogonal',
    },
  ]);
  const [exportYaml, setExportYaml] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState(WORKFLOW_FILE);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedWorkflow[]>(() => listWorkflows());
  const [historySort, setHistorySort] = useState<HistorySort>('Edited');
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme() ?? 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // The inspector's placement survives hiding: "hidden" is a flag over the last
  // visible placement, so the toggle brings back floating or docked as it was.
  const [inspectorPlacement, setInspectorPlacement] = useState<InspectorPlacement>(() => {
    const stored = readInspectorMode();
    return stored === 'hidden' ? 'docked' : stored;
  });
  const [inspectorHidden, setInspectorHidden] = useState(() => readInspectorMode() === 'hidden');
  const [inspectorWidth, setInspectorWidth] = useState(() => readInspectorWidth());
  const inspectorMode: InspectorMode = inspectorHidden ? 'hidden' : inspectorPlacement;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<WorkflowCanvasMode>('edit');
  const [observing, setObserving] = useState(false);
  const [projectRoot, setProjectRoot] = useState<string>(() => getStoredProjectRoot());
  const [panelPortText, setPanelPortText] = useState('');

  const portOverride = useMemo(() => {
    const parsed = Number.parseInt(panelPortText, 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
  }, [panelPortText]);

  const run = useRunEvents({ enabled: observing, projectRoot, portOverride });

  // First run event flips the canvas into run mode.
  useEffect(() => {
    if (observing && (run.runId !== null || run.nodeStates.size > 0)) setMode('run');
  }, [observing, run.runId, run.nodeStates]);

  // Paint live states into node.data; bail out with the SAME array reference
  // when nothing changed so useNodesState doesn't re-render every SSE tick.
  // The run's state map is authoritative for the WHOLE canvas: a node absent
  // from it has no live status and is repainted to pending, so a new run
  // (run.started reseeds the map with only its own ids) clears every leftover
  // done/failed from the previous run instead of leaving stale paint.
  useEffect(() => {
    if (!observing || run.nodeStates.size === 0) return;
    setNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        const state = run.nodeStates.get(node.id) ?? 'pending';
        const warnings = run.nodeWarnings.get(node.id);
        if (node.data.state === state && node.data.warnings === warnings) return node;
        changed = true;
        return { ...node, data: { ...node.data, state, warnings } };
      });
      return changed ? next : current;
    });
  }, [observing, run.nodeStates, run.nodeWarnings, setNodes]);

  useEffect(() => {
    if (observing && run.status === 'connected' && run.port !== null) void pushPanelTheme(run.port, theme);
  }, [observing, run.status, run.port, theme]);

  const onToggleObserve = useCallback(() => {
    setObserving((current) => !current);
    if (observing) {
      setMode('edit');
      setNodes((current) =>
        current.map((node) =>
          node.data.state === 'pending' && !node.data.warnings
            ? node
            : { ...node, data: { ...node.data, state: 'pending', warnings: undefined } },
        ),
      );
    }
  }, [observing, setNodes]);

  const onProjectRootChange = useCallback((root: string) => {
    setProjectRoot(root);
    storeProjectRoot(root);
  }, []);

  const workflow = useMemo(() => graphToWorkflow(meta, nodes, edges), [meta, nodes, edges]);
  const issues = useMemo(() => validateWorkflow(workflow), [workflow]);
  const errorTotal = useMemo(() => issues.filter((issue) => issue.severity === 'error').length, [issues]);
  const warningTotal = issues.length - errorTotal;

  const onSelectView = useCallback(
    (next: SidebarView) => {
      setSidebarOpen((open) => (next === view && open ? false : true));
      setView(next);
    },
    [view],
  );

  useEffect(() => writeInspectorMode(inspectorMode), [inspectorMode]);
  useEffect(() => writeInspectorWidth(inspectorWidth), [inspectorWidth]);

  const onToggleSidebar = useCallback(() => setSidebarOpen((open) => !open), []);
  const onToggleInspector = useCallback(() => setInspectorHidden((hidden) => !hidden), []);
  const onHideInspector = useCallback(() => setInspectorHidden(true), []);
  const onShowInspector = useCallback(() => setInspectorHidden(false), []);
  const onToggleInspectorPlacement = useCallback(
    () => setInspectorPlacement((placement) => (placement === 'docked' ? 'floating' : 'docked')),
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (event.key !== 'b' && event.key !== 'B') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.altKey) onToggleInspector();
      else onToggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleInspector, onToggleSidebar]);

  // Edge-lens field toggle: flip one upstream field on the TARGET
  // node's `input.select`. The lens stores nothing itself — `select` lists the
  // KEPT fields in schema order, and an all-fields-on upstream serialises to no
  // entry at all, so untouched workflows never gain a `select` key.
  const onToggleEdgeField = useCallback(
    (edge: { id: string; source: string; target: string }, field: string) => {
      setNodes((current) => {
        const sourceSchema =
          current.find((node) => node.id === edge.source)?.data.definition.output?.schema ?? {};
        const schemaKeys = Object.keys(sourceSchema);
        if (!schemaKeys.includes(field)) return current;
        return current.map((node) => {
          if (node.id !== edge.target) return node;
          const def = node.data.definition;
          const stored = def.input?.select ?? {};
          const keptSet = new Set(stored[edge.source] ?? schemaKeys);
          if (keptSet.has(field)) keptSet.delete(field);
          else keptSet.add(field);
          const kept = schemaKeys.filter((key) => keptSet.has(key));
          const select: Record<string, string[]> = { ...stored };
          if (kept.length === schemaKeys.length) delete select[edge.source];
          else select[edge.source] = kept;
          const input: AgentInput = { ...def.input };
          if (Object.keys(select).length) input.select = select;
          else delete input.select;
          const definition: AgentDefinition = { ...def };
          if (Object.keys(input).length) definition.input = input;
          else delete definition.input;
          return { ...node, data: { ...node.data, definition } };
        });
      });
    },
    [setNodes],
  );

  // A `select` filter is scoped to its edge: deleting edge A→B must also drop
  // B's `input.select[A]` from the in-memory definition. The
  // export already filters `select` by live edges, so without this the two
  // models disagree — re-adding the same edge in the same session silently
  // resurrects the old filter, while after save+reload it would not. Prunes an
  // emptied `select`/`input` exactly like onToggleEdgeField; surviving entries
  // pass through verbatim (order + array identity) for round-trip identity.
  const handleEdgesChange = useCallback<OnEdgesChange<WorkflowEdge>>(
    (changes) => {
      const removedIds = new Set(
        changes.flatMap((change) => (change.type === 'remove' ? [change.id] : [])),
      );
      if (removedIds.size > 0) {
        const removed = edges.filter((edge) => removedIds.has(edge.id));
        if (removed.length > 0) {
          setNodes((current) =>
            current.map((node) => {
              const sources = removed
                .filter((edge) => edge.target === node.id)
                .map((edge) => edge.source);
              if (sources.length === 0) return node;
              const definition = pruneSelectEntries(node.data.definition, sources);
              return definition === node.data.definition
                ? node
                : { ...node, data: { ...node.data, definition } };
            }),
          );
        }
      }
      onEdgesChange(changes);
    },
    [edges, onEdgesChange, setNodes],
  );

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      const { source, target } = connection;
      if (!source || !target || source === target) return;
      setEdges((current) =>
        addEdge({ ...connection, id: edgeId(source, target), type: 'orthogonal' }, current),
      );
    },
    [setEdges],
  );

  const addAgent = useCallback(
    (template: AgentTemplate, position: XYPosition) => {
      setNodes((current) =>
        resolveVolumeOverlaps([
          ...current,
          createAgentNode(
            template,
            position,
            current.map((node) => node.id),
          ),
        ]),
      );
    },
    [setNodes],
  );

  const onDropToPane = useCallback(
    (position: XYPosition, dataTransfer: DataTransfer) => {
      const template = templateById(dataTransfer.getData(AGENT_DROP_MIME));
      if (template) addAgent(template, position);
    },
    [addAgent],
  );

  const onAddAgent = useCallback(
    (template: AgentTemplate) => {
      const spread = nodes.length % 5;
      addAgent(template, { x: 140 + spread * 44, y: 340 + spread * 44 });
    },
    [addAgent, nodes.length],
  );

  const onChangeDefinition = useCallback(
    (nodeId: string, next: AgentDefinition) => {
      setNodes((current) =>
        resolveVolumeOverlaps(
          current.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, definition: next } } : node,
          ),
        ),
      );
    },
    [setNodes],
  );

  const onChangeTriggers = useCallback(
    (next: WorkflowTriggers | undefined) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== WORKFLOW_INPUT_ID) return node;
          const { triggers: _previous, ...rest } = node.data;
          return { ...node, data: next ? { ...rest, triggers: next } : rest };
        }),
      );
    },
    [setNodes],
  );

  const onRenameNode = useCallback(
    (oldId: string, nextId: string) => {
      if (nodes.some((node) => node.id === nextId)) return;
      setNodes((current) =>
        current.map((node) => {
          // Definitions store node ids as data (select keys, routes[].to,
          // trigger.when.from) — remap them in the same pass as the id/edges.
          const definition = renameDefinitionRefs(node.data.definition, oldId, nextId);
          if (node.id === oldId) {
            return { ...node, id: nextId, data: { ...node.data, agentId: nextId, definition } };
          }
          return definition === node.data.definition
            ? node
            : { ...node, data: { ...node.data, definition } };
        }),
      );
      setEdges((current) =>
        current.map((edge) => {
          const source = edge.source === oldId ? nextId : edge.source;
          const target = edge.target === oldId ? nextId : edge.target;
          return source === edge.source && target === edge.target
            ? edge
            : { ...edge, source, target, id: edgeId(source, target) };
        }),
      );
    },
    [nodes, setNodes, setEdges],
  );

  const onExport = useCallback(() => {
    setExportYaml(workflowToYaml(workflow));
  }, [workflow]);

  const onImport = useCallback(async () => {
    const file = await openYamlFile();
    if (!file) return;
    try {
      const graph = workflowToGraph(workflowFromYaml(file.content));
      setMeta(graph.meta);
      setNodes(resolveVolumeOverlaps(graph.nodes));
      setEdges(graph.edges);
      setWorkflowName(file.name);
      setSavedId(null);
      setFitKey((key) => key + 1);
    } catch (error) {
      window.alert(
        `Could not import ${file.name}: ${error instanceof Error ? error.message : 'invalid workflow YAML'}`,
      );
    }
  }, [setMeta, setNodes, setEdges]);

  const onImportSubworkflow = useCallback(async () => {
    const file = await openYamlFile();
    if (!file) return;
    let workflow;
    try {
      workflow = workflowFromYaml(file.content);
    } catch (error) {
      window.alert(
        `Could not import ${file.name}: ${error instanceof Error ? error.message : 'invalid workflow YAML'}`,
      );
      return;
    }
    const template = templateById('subflow');
    if (!template) return;
    const name = file.name.replace(/\.(workflow\.)?ya?ml$/i, '').trim() || workflow.introduction.trim() || 'sub-workflow';
    const now = Date.now();
    setSaved(upsertWorkflow({ id: newWorkflowId(), name, workflow, layout: {}, createdAt: now, updatedAt: now }));
    const outputSchema = Object.fromEntries(
      (workflow.output.from ?? []).flatMap((src) =>
        Object.entries(workflow.agents[src]?.output?.schema ?? {}),
      ),
    );
    setNodes((current) => {
      const spread = current.length % 5;
      const base = createAgentNode(
        template,
        { x: 180 + spread * 48, y: 360 + spread * 48 },
        current.map((node) => node.id),
      );
      return resolveVolumeOverlaps([
        ...current,
        {
          ...base,
          data: {
            ...base.data,
            definition: {
              ...base.data.definition,
              introduction: name,
              output: { schema: outputSchema },
              tech_stack: { workflow },
            },
          },
        },
      ]);
    });
  }, [setSaved, setNodes]);

  const onSave = useCallback(() => {
    const now = Date.now();
    const id = savedId ?? newWorkflowId();
    const layout: Record<string, { x: number; y: number }> = {};
    for (const node of nodes) layout[node.id] = { x: node.position.x, y: node.position.y };
    const existing = saved.find((item) => item.id === id);
    const entry: SavedWorkflow = {
      id,
      name: workflowName,
      workflow: graphToWorkflow(meta, nodes, edges),
      layout,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setSaved(upsertWorkflow(entry));
    setSavedId(id);
  }, [savedId, saved, workflowName, meta, nodes, edges]);

  const onOpenWorkflow = useCallback(
    (entry: SavedWorkflow) => {
      const graph = workflowToGraph(entry.workflow);
      setMeta(graph.meta);
      setNodes(
        resolveVolumeOverlaps(
          graph.nodes.map((node) => {
            const position = entry.layout[node.id];
            return position ? { ...node, position } : node;
          }),
        ),
      );
      setEdges(graph.edges);
      setSavedId(entry.id);
      setWorkflowName(entry.name);
      setFitKey((key) => key + 1);
    },
    [setMeta, setNodes, setEdges],
  );

  const onDeleteWorkflow = useCallback((id: string) => {
    setSaved(deleteWorkflow(id));
    setSavedId((current) => (current === id ? null : current));
  }, []);

  const onToggleTheme = useCallback(() => {
    const next = getToggledTheme(theme);
    setTheme(next);
    setThemeState(next);
  }, [theme]);

  const onSelectTheme = useCallback((id: Theme) => {
    setTheme(id);
    setThemeState(id);
  }, []);

  const selectedNode = nodes.find((node) => node.selected) ?? null;
  const definitionById = (id: string): AgentDefinition | undefined =>
    nodes.find((node) => node.id === id)?.data.definition;
  // a loop-back edge feeds its head as feedback, not as an input: the Inspector shows it apart
  const loops = loopEdgeIds(nodes, edges);
  const loopFrom = selectedNode
    ? edges.find((edge) => edge.target === selectedNode.id && loops.has(edge.id))?.source
    : undefined;
  const incoming: IncomingSource[] = selectedNode
    ? edges
        .filter((edge) => edge.target === selectedNode.id && !loops.has(edge.id))
        .map((edge) => {
          const def = definitionById(edge.source);
          return {
            id: edge.source,
            label: edge.source === WORKFLOW_INPUT_ID ? 'workflow input' : edge.source,
            fields: Object.entries(def?.output?.schema ?? {}).map(([key, type]) => ({ key, type })),
          };
        })
    : [];
  const outgoingTargets = selectedNode
    ? edges.filter((edge) => edge.source === selectedNode.id && !loops.has(edge.id)).map((edge) => edge.target)
    : [];
  const outgoingTo =
    selectedNode && isRouterDef(selectedNode.data.definition)
      ? orderedRouteTargets(selectedNode.data.definition, outgoingTargets)
      : outgoingTargets;
  const embeddable: EmbeddableWorkflow[] =
    selectedNode?.data.definition.type === 'sub-workflow'
      ? saved
          .filter((entry) => entry.id !== savedId)
          .map((entry) => ({ name: entry.name, workflow: entry.workflow }))
      : [];

  const inspector = selectedNode && inspectorMode !== 'hidden' && (
    <Inspector
      node={selectedNode}
      incoming={incoming}
      loopFrom={loopFrom}
      outgoingTo={outgoingTo}
      embeddable={embeddable}
      existingIds={nodes.map((node) => node.id)}
      jsonOut={isJsonOut(selectedNode.id, nodes, edges)}
      onChangeDefinition={onChangeDefinition}
      onRenameNode={onRenameNode}
      onChangeTriggers={onChangeTriggers}
      placement={inspectorMode}
      onTogglePlacement={onToggleInspectorPlacement}
      onHide={onHideInspector}
      width={inspectorMode === 'docked' ? inspectorWidth : undefined}
      onResizeWidth={inspectorMode === 'docked' ? setInspectorWidth : undefined}
    />
  );
  const docked = inspector && inspectorMode === 'docked';

  return (
    <div className="agentry-shell">
      <Toolbar
        workflowName={workflowName}
        onWorkflowNameChange={setWorkflowName}
        onSave={onSave}
        onImport={onImport}
        onExport={onExport}
        observing={observing}
        onToggleObserve={onToggleObserve}
        observeStatus={run.status}
        observePort={run.port}
        observeRunEnded={run.runEnded}
        projectRoot={projectRoot}
        onProjectRootChange={onProjectRootChange}
        panelPort={panelPortText}
        onPanelPortChange={setPanelPortText}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        inspectorVisible={!inspectorHidden}
        onToggleInspector={onToggleInspector}
      />

      <div
        className="agentry-body"
        style={{
          gridTemplateColumns: `52px ${sidebarOpen ? '264px' : '0px'} minmax(0, 1fr) ${
            docked ? `${inspectorWidth}px` : '0px'
          }`,
        }}
      >
        <ActivityBar
          view={view}
          collapsed={!sidebarOpen}
          onChange={onSelectView}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {sidebarOpen && (
          <Sidebar
            view={view}
            onAddAgent={onAddAgent}
            onImportSubworkflow={onImportSubworkflow}
            history={{
              items: saved,
              sort: historySort,
              onSort: setHistorySort,
              onOpen: onOpenWorkflow,
              onDelete: onDeleteWorkflow,
              currentId: savedId,
            }}
          />
        )}
        <main className="agentry-stage">
          <WorkflowCanvas
            mode={mode}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onDropToPane={onDropToPane}
            onToggleEdgeField={onToggleEdgeField}
            fitKey={fitKey}
          />
          {inspector && inspectorMode === 'floating' && <InspectorFloat>{inspector}</InspectorFloat>}
          {selectedNode && inspectorMode === 'hidden' && (
            <button
              type="button"
              className="agentry-inspector-tab"
              title="Show inspector (Ctrl+Alt+B)"
              onClick={onShowInspector}
            >
              <PanelRightIcon size={14} />
              <span className="agentry-inspector-tab__label">Inspector</span>
            </button>
          )}
        </main>
        {docked && inspector}
      </div>

      <StatusBar
        mode={mode}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        errorCount={errorTotal}
        warningCount={warningTotal}
        onShowIssues={onExport}
      />

      {exportYaml !== null && (
        <ExportDialog
          yaml={exportYaml}
          filename={workflowName}
          issues={issues}
          onClose={() => setExportYaml(null)}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          onSelectTheme={onSelectTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
