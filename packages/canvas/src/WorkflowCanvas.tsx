import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react';
import type {
  DefaultEdgeOptions,
  IsValidConnection,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  XYPosition,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, MouseEvent as ReactMouseEvent, MutableRefObject } from 'react';
import { isRouter } from '@agentry/core';
import type { AgentType } from '@agentry/core';
import { AgentNode } from './AgentNode';
import { EdgePreview, WHOLE_OUTPUT_KEY } from './EdgePreview';
import type { EdgePreviewField } from './EdgePreview';
import { isBoundaryId } from './graph';
import { OrthogonalEdge } from './OrthogonalEdge';
import { WorkflowMiniMap } from './WorkflowMiniMap';
import { useOrthogonalRouting } from './routing';
import type { RoutingOptions } from './routing';
import {
  BACK_EDGE_LANE_GAP,
  BACK_EDGE_LANE_MARGIN,
  BACK_EDGE_SIDE_MARGIN,
  backEdgeOrder,
} from './backEdge';
import { BRANCH_BUFFER, BRANCH_LANE_GAP, BRANCH_LEAD, FORK_EXTENSION } from './fork';
import { resolveNoOverlap } from './collision';
import type { CollisionBox } from './collision';
import { engineObstacleRect, nodeVolume } from './volume';
import type { AgentFlowNode, WorkflowCanvasMode, WorkflowEdge } from './types';

const nodeTypes = { agent: AgentNode };
const edgeTypes = { orthogonal: OrthogonalEdge };
const DELETE_KEYS = ['Backspace', 'Delete'];

// Edge lens timings. The magnifier opens only after a deliberate 2 s rest on an edge;
// the leave grace lets a jittery cursor cross the edge->box gap without flicker,
// and FADE_MS matches the CSS opacity transition.
const PREVIEW_OPEN_DELAY = 2000;
const PREVIEW_CLOSE_GRACE = 120;
const PREVIEW_FADE_MS = 120;

// ON-wire color per source-node type (mirrors the edge tint); falls back to accent.
const TYPE_ACCENT: Record<AgentType, string> = {
  straight: 'var(--agentry-color-type-straight)',
  branch: 'var(--agentry-color-type-branch)',
  reporter: 'var(--agentry-color-type-reporter)',
  documenter: 'var(--agentry-color-type-documenter)',
  'sub-workflow': 'var(--agentry-color-type-subworkflow)',
  tool: 'var(--agentry-color-type-tool)',
  decision: 'var(--agentry-color-type-decision)',
  'workflow-input': 'var(--agentry-color-type-input)',
  'workflow-output': 'var(--agentry-color-type-output)',
};

const EMPTY_OFF_FIELDS: ReadonlySet<string> = new Set();

type EdgePreviewState = {
  edgeId: string;
  source: string;
  target: string;
  x: number;
  y: number;
  open: boolean;
};

// Fallback node dimensions before React Flow has measured a freshly-added node.
const FALLBACK_NODE_W = 220;
const FALLBACK_NODE_H = 132;
// Extra breathing room baked into the fit bounds, on top of the edge-overhang margins.
const FIT_BASE_MARGIN = 32;
// The IN port's trigger chip hangs this far left of the port (canvas.css .agentry-trigger max-width).
const TRIGGER_CHIP_OVERHANG = 192;

const ROUTING_OPTIONS: RoutingOptions = {
  orthogonal: true,
  cornerRadius: 10,
  nodeSpacing: 14,
  // Buffer-zone fork: the engine fans each shared-pin edge to its own exit 22px
  // apart at the EXTENDED node edge and routes the separated middle cleanly; the
  // transparent extension band (FORK_EXTENSION) is where OrthogonalEdge converges
  // those fanned exits back to one trunk point at the visible card edge.
  edgeSpacing: 22,
  handleSpread: 22,
  stubSize: 20,
  // Emit full routed waypoints for every edge (even unblocked) so OrthogonalEdge
  // always has the fanned pins to build the fork from; a direct fallback skips them.
  routeOnlyWhenBlocked: false,
  // Keep fixed left-in / right-out pins. Auto-side picks sides by dx/dy, which
  // (a) routes edges up-and-over on vertical offsets and (b) makes A->B and B->A
  // resolve to the same pin pair, so the reverse edge overlaps the forward one
  // and disappears. Fixed pins keep every edge distinct and horizontal-first.
  autoSide: false,
  rerouteWhileDragging: true,
};

const DEFAULT_EDGE_OPTIONS: DefaultEdgeOptions = {
  type: 'orthogonal',
};

export interface WorkflowCanvasProps {
  mode: WorkflowCanvasMode;
  nodes: AgentFlowNode[];
  edges: WorkflowEdge[];
  onNodesChange?: OnNodesChange<AgentFlowNode>;
  onEdgesChange?: OnEdgesChange<WorkflowEdge>;
  onConnect?: OnConnect;
  onDropToPane?: (position: XYPosition, dataTransfer: DataTransfer) => void;
  /**
   * Owner-side destination for the edge lens's field switches.
   * When provided, toggling a schema field on an agent→agent edge is delegated
   * here — the owner flips the target node's `input.select` and the lens
   * re-derives its ON/OFF state from that — so the switches live in the
   * workflow document instead of dying with the canvas. The schema-less "whole
   * output" row stays canvas-local exactly as before. Boundary (IN/OUT) edges
   * offer no toggles at all: `input.select` lives on the downstream AGENT's
   * input and boundary nodes never serialise into `agents{}`, so a boundary
   * toggle could never persist — the lens shows their fields read-only instead
   * of pretending otherwise.
   */
  onToggleEdgeField?: (edge: { id: string; source: string; target: string }, field: string) => void;
  /** Change it to frame the whole graph again — e.g. after loading another workflow. */
  fitKey?: number;
  className?: string;
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  const { mode, className } = props;

  return (
    <div className={`agentry-canvas agentry-canvas--${mode}${className ? ` ${className}` : ''}`}>
      <ReactFlowProvider>
        <CanvasFlow {...props} />
      </ReactFlowProvider>
    </div>
  );
}

function CanvasFlow({
  mode,
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDropToPane,
  onToggleEdgeField,
  fitKey,
}: WorkflowCanvasProps) {
  const editable = mode === 'edit';
  const { screenToFlowPosition, getNodes, fitBounds } = useReactFlow<AgentFlowNode>();

  // Feed the router each node's ENGINE-OBSTACLE geometry (box for most; box + rear
  // condition band for a branch) instead of the raw box. This puts a branch's own
  // out-pin on the volume's OUTER edge, so its fork + condition buffer are hand-
  // drawn INSIDE the volume and the engine only routes past them — while OTHER
  // edges still avoid the whole volume as one obstacle.
  const routingNodes = useMemo(
    () =>
      nodes.map((node) => {
        const w = node.measured?.width ?? node.width ?? 0;
        const h = node.measured?.height ?? node.height ?? 0;
        if (!w || !h) return node;
        const rect = engineObstacleRect(
          { x: node.position.x, y: node.position.y, w, h },
          node.data.definition.type,
        );
        if (rect.w === w && rect.h === h) return node;
        return {
          ...node,
          width: rect.w,
          height: rect.h,
          measured: { width: rect.w, height: rect.h },
        };
      }),
    [nodes],
  );

  const routing = useOrthogonalRouting(routingNodes, edges, ROUTING_OPTIONS);

  // React Flow's built-in fit only frames node bounding boxes, so edges that route
  // OUTSIDE those boxes — back-edges over the top, fork bands on the L/R, branch
  // condition buffers — spill past the viewport after fitting. We instead frame a
  // rect padded by each of those known overhangs so every line stays on screen.
  const handleFitView = useCallback(() => {
    const flowNodes = getNodes();
    if (flowNodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const centerX = new Map<string, number>();
    let hasBranchOut = false;
    for (const node of flowNodes) {
      const w = node.measured?.width ?? FALLBACK_NODE_W;
      const h = node.measured?.height ?? FALLBACK_NODE_H;
      const chip = node.data.triggers ? TRIGGER_CHIP_OVERHANG : 0;
      minX = Math.min(minX, node.position.x - chip);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
      centerX.set(node.id, node.position.x + w / 2);
      if (
        isRouter(node.data.definition) &&
        edges.some((edge) => edge.source === node.id)
      ) {
        hasBranchOut = true;
      }
    }

    const lanes = backEdgeOrder(edges, (id) => centerX.get(id)).size;
    const backTop = lanes ? BACK_EDGE_LANE_MARGIN + lanes * BACK_EDGE_LANE_GAP : 0;
    const backSide = lanes ? BACK_EDGE_SIDE_MARGIN + Math.max(0, lanes - 1) * BACK_EDGE_LANE_GAP : 0;
    const branchRight = hasBranchOut ? BRANCH_LEAD + BRANCH_BUFFER : 0;
    const branchSpread = hasBranchOut ? BRANCH_LANE_GAP * 3 : 0;

    const left = FIT_BASE_MARGIN + FORK_EXTENSION + backSide;
    const right = FIT_BASE_MARGIN + FORK_EXTENSION + backSide + branchRight;
    const top = FIT_BASE_MARGIN + backTop + branchSpread;
    const bottom = FIT_BASE_MARGIN + branchSpread;

    void fitBounds(
      {
        x: minX - left,
        y: minY - top,
        width: maxX - minX + left + right,
        height: maxY - minY + top + bottom,
      },
      { padding: 0.06, duration: 320 },
    );
  }, [edges, fitBounds, getNodes]);

  // Re-frame once per new fitKey (a freshly loaded workflow), as soon as its nodes are measured.
  const nodesInitialized = useNodesInitialized();
  const framedKey = useRef(fitKey);
  useEffect(() => {
    if (!nodesInitialized || fitKey === framedKey.current) return;
    framedKey.current = fitKey;
    handleFitView();
  }, [fitKey, nodesInitialized, handleFitView]);

  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [hoverEdgeId, setHoverEdgeId] = useState<string | null>(null);

  const [preview, setPreview] = useState<EdgePreviewState | null>(null);
  const previewRef = useRef<EdgePreviewState | null>(null);
  const openTimer = useRef<number>();
  const closeTimer = useRef<number>();
  const unmountTimer = useRef<number>();
  // Latest cursor position while resting on an edge, read when the 3s timer fires
  // so the box anchors where the pointer actually settled, not where it entered.
  const edgePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Residual CANVAS-LOCAL switches: only the schema-less "whole output" row
  // (and, without an owner handler, plain field rows). Real field switches live
  // in the workflow document via `onToggleEdgeField` and are derived in
  // `selectOff`; boundary edges are read-only and never write here.
  const [edgeFieldOff, setEdgeFieldOff] = useState<Map<string, Set<string>>>(() => new Map());

  // Workflow-document switches, derived per edge: a target's `input.select`
  // entry lists the KEPT fields, the lens paints the complement OFF.
  const selectOff = useMemo(() => {
    const map = new Map<string, ReadonlySet<string>>();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    for (const edge of edges) {
      const kept = byId.get(edge.target)?.data.definition.input?.select?.[edge.source];
      if (!kept) continue;
      const schema = byId.get(edge.source)?.data.definition.output?.schema;
      if (!schema) continue;
      const keptSet = new Set(kept);
      const off = new Set(Object.keys(schema).filter((key) => !keptSet.has(key)));
      if (off.size) map.set(edge.id, off);
    }
    return map;
  }, [nodes, edges]);

  const writePreview = useCallback((next: EdgePreviewState | null) => {
    previewRef.current = next;
    setPreview(next);
  }, []);

  const clearTimer = (timer: MutableRefObject<number | undefined>) => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  };

  const beginClose = useCallback(() => {
    const current = previewRef.current;
    if (!current) return;
    writePreview({ ...current, open: false });
    clearTimer(unmountTimer);
    unmountTimer.current = window.setTimeout(() => writePreview(null), PREVIEW_FADE_MS + 20);
  }, [writePreview]);

  const handleEdgeMouseEnter = useCallback(
    (event: ReactMouseEvent, edge: WorkflowEdge) => {
      setHoverEdgeId(edge.id);
      edgePosRef.current = { x: event.clientX, y: event.clientY };
      clearTimer(openTimer);
      clearTimer(closeTimer);
      clearTimer(unmountTimer);
      openTimer.current = window.setTimeout(() => {
        writePreview({
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          x: edgePosRef.current.x,
          y: edgePosRef.current.y,
          open: true,
        });
      }, PREVIEW_OPEN_DELAY);
    },
    [writePreview],
  );

  const handleEdgeMouseMove = useCallback((event: ReactMouseEvent, _edge: WorkflowEdge) => {
    edgePosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  // Leaving the edge cancels a pending open; if the lens is already open it only
  // starts the grace-timed close, which the box's own enter cancels when the
  // pointer crosses into it (so moving edge->box keeps it open).
  const handleEdgeMouseLeave = useCallback(() => {
    setHoverEdgeId(null);
    clearTimer(openTimer);
    if (previewRef.current?.open) {
      clearTimer(closeTimer);
      closeTimer.current = window.setTimeout(beginClose, PREVIEW_CLOSE_GRACE);
    }
  }, [beginClose]);

  const handleBoxEnter = useCallback(() => {
    clearTimer(closeTimer);
    clearTimer(unmountTimer);
    const current = previewRef.current;
    if (current && !current.open) writePreview({ ...current, open: true });
  }, [writePreview]);

  const handleBoxLeave = useCallback(() => {
    clearTimer(closeTimer);
    closeTimer.current = window.setTimeout(beginClose, PREVIEW_CLOSE_GRACE);
  }, [beginClose]);

  const toggleField = useCallback(
    (edge: { edgeId: string; source: string; target: string }, key: string) => {
      if (isBoundaryId(edge.source) || isBoundaryId(edge.target)) return;
      if (onToggleEdgeField && key !== WHOLE_OUTPUT_KEY) {
        onToggleEdgeField({ id: edge.edgeId, source: edge.source, target: edge.target }, key);
        return;
      }
      setEdgeFieldOff((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(edge.edgeId) ?? []);
        if (set.has(key)) set.delete(key);
        else set.add(key);
        if (set.size === 0) next.delete(edge.edgeId);
        else next.set(edge.edgeId, set);
        return next;
      });
    },
    [onToggleEdgeField],
  );

  useEffect(
    () => () => {
      clearTimer(openTimer);
      clearTimer(closeTimer);
      clearTimer(unmountTimer);
    },
    [],
  );

  const previewFields = useMemo<EdgePreviewField[]>(() => {
    if (!preview) return [];
    const sourceNode = nodes.find((node) => node.id === preview.source);
    const schema = sourceNode?.data.definition.output?.schema;
    if (!schema) return [];
    return Object.entries(schema).map(([key, type]) => ({ key, type: String(type) }));
  }, [preview, nodes]);

  const previewAccent = useMemo(() => {
    if (!preview) return 'var(--agentry-color-accent)';
    const type = nodes.find((node) => node.id === preview.source)?.data.definition.type;
    return type ? TYPE_ACCENT[type] : 'var(--agentry-color-accent)';
  }, [preview, nodes]);

  const previewOff = useMemo<ReadonlySet<string>>(() => {
    if (!preview) return EMPTY_OFF_FIELDS;
    const local = edgeFieldOff.get(preview.edgeId);
    const stored = selectOff.get(preview.edgeId);
    if (!local) return stored ?? EMPTY_OFF_FIELDS;
    if (!stored) return local;
    return new Set([...local, ...stored]);
  }, [preview, edgeFieldOff, selectOff]);

  const displayEdges = useMemo(() => {
    const lensEdgeId = hoverEdgeId ?? preview?.edgeId ?? null;
    if (!hoverNodeId && !lensEdgeId) return edges;
    const active = new Set<string>();
    if (lensEdgeId) active.add(lensEdgeId);
    if (hoverNodeId) {
      for (const edge of edges) {
        if (edge.source === hoverNodeId || edge.target === hoverNodeId) active.add(edge.id);
      }
    }
    return edges.map((edge) => {
      const tag = active.has(edge.id) ? 'is-active' : 'is-dim';
      return { ...edge, className: edge.className ? `${edge.className} ${tag}` : tag };
    });
  }, [edges, hoverNodeId, hoverEdgeId, preview]);

  // The moving node's last accepted (non-overlapping) position during a drag, so
  // each clamp resolves from where the node actually settled, not the raw pointer.
  const dragAnchor = useRef<{ id: string; x: number; y: number } | null>(null);

  const handleNodesChange = useCallback<OnNodesChange<AgentFlowNode>>(
    (changes) => {
      const isPositioned = (
        c: NodeChange<AgentFlowNode>,
      ): c is Extract<NodeChange<AgentFlowNode>, { type: 'position' }> =>
        c.type === 'position' && !!c.position;

      const positioned = changes.filter(isPositioned);
      const anchor = dragAnchor.current;
      // The change we constrain: either the single live drag move, or — so the
      // node can't settle overlapping — the drop commit of the node we've been
      // anchoring. Lock-step multi-select drags are left alone (their members
      // would fight the clamp), so we only act when exactly one node moves.
      const only = positioned.length === 1 ? positioned[0] : undefined;
      const move =
        only && (only.dragging === true || only.id === anchor?.id) ? only : undefined;

      let outgoing = changes;
      if (move && move.position) {
        const flowNodes = getNodes();
        const moving = flowNodes.find((n) => n.id === move.id);
        if (moving) {
          // Clamp against each node's full COLLISION VOLUME (box + buffer zones on
          // BOTH sides + a branch's rear condition buffer). The volume can extend
          // LEFT of the box, so map the box top-left into volume space via `off`,
          // clamp there, then map the accepted volume position back to a box one.
          const box = {
            x: moving.position.x,
            y: moving.position.y,
            w: moving.measured?.width ?? FALLBACK_NODE_W,
            h: moving.measured?.height ?? FALLBACK_NODE_H,
          };
          const vol = nodeVolume(box, moving.data.definition.type).aabb;
          const off = { x: vol.x - box.x, y: vol.y - box.y };
          const size = { w: vol.w, h: vol.h };
          const fromBox = anchor?.id === move.id ? { x: anchor.x, y: anchor.y } : box;
          const fromVol = { x: fromBox.x + off.x, y: fromBox.y + off.y };
          const toVol = { x: move.position.x + off.x, y: move.position.y + off.y };
          const obstacles: CollisionBox[] = flowNodes
            .filter((n) => n.id !== move.id)
            .map(
              (n) =>
                nodeVolume(
                  {
                    x: n.position.x,
                    y: n.position.y,
                    w: n.measured?.width ?? FALLBACK_NODE_W,
                    h: n.measured?.height ?? FALLBACK_NODE_H,
                  },
                  n.data.definition.type,
                ).aabb,
            );
          const acceptedVol = resolveNoOverlap(fromVol, toVol, size, obstacles);
          const accepted = { x: acceptedVol.x - off.x, y: acceptedVol.y - off.y };
          dragAnchor.current = { id: move.id, x: accepted.x, y: accepted.y };
          outgoing = changes.map((c) => (c === move ? { ...c, position: accepted } : c));
        }
      } else if (anchor && !positioned.some((c) => c.id === anchor.id && c.dragging === true)) {
        dragAnchor.current = null;
      }

      onNodesChange?.(outgoing);
      routing.onGeometryChange(outgoing);
    },
    [getNodes, onNodesChange, routing],
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!onDropToPane) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onDropToPane(position, event.dataTransfer);
  };

  const isValidConnection: IsValidConnection<WorkflowEdge> = (connection) =>
    connection.source !== connection.target;

  return (
    <>
    <ReactFlow
      nodes={nodes}
      edges={displayEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeMouseEnter={(_, node) => setHoverNodeId(node.id)}
      onNodeMouseLeave={() => setHoverNodeId(null)}
      onEdgeMouseEnter={handleEdgeMouseEnter}
      onEdgeMouseMove={handleEdgeMouseMove}
      onEdgeMouseLeave={handleEdgeMouseLeave}
      onNodesChange={editable ? handleNodesChange : undefined}
      onNodeDragStop={
        editable
          ? () => {
              dragAnchor.current = null;
              routing.reset();
            }
          : undefined
      }
      onEdgesChange={editable ? onEdgesChange : undefined}
      onConnect={editable ? onConnect : undefined}
      isValidConnection={editable ? isValidConnection : undefined}
      onDrop={editable ? handleDrop : undefined}
      onDragOver={editable ? handleDragOver : undefined}
      deleteKeyCode={editable ? DELETE_KEYS : null}
      nodesDraggable={editable}
      nodesConnectable={editable}
      elementsSelectable={editable}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      minZoom={0.3}
      maxZoom={1.75}
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
      <WorkflowMiniMap />
      <Controls showInteractive={false} onFitView={handleFitView} />
    </ReactFlow>
      {preview && (
        <EdgePreview
          key={preview.edgeId}
          open={preview.open}
          source={preview.source}
          target={preview.target}
          fields={previewFields}
          accent={previewAccent}
          offFields={previewOff}
          interactive={!isBoundaryId(preview.source) && !isBoundaryId(preview.target)}
          x={preview.x}
          y={preview.y}
          onToggleField={(key) =>
            toggleField(
              { edgeId: preview.edgeId, source: preview.source, target: preview.target },
              key,
            )
          }
          onPointerEnter={handleBoxEnter}
          onPointerLeave={handleBoxLeave}
        />
      )}
    </>
  );
}
