/**
 * routing.ts — the NEUTRAL routing seam.
 *
 * This is the ONLY module in the app/canvas allowed to import the concrete
 * routing engine (`reactflow-edge-routing`, backed by `obstacle-router` — a
 * pure-TS libavoid port). Everything else — {@link WorkflowCanvas}, the custom
 * edge, the app, and the teammate's live-execution plugin panel — talks to
 * routing exclusively through the engine-agnostic types and hooks exported here.
 *
 * WHY: an adversarial review flagged the routing-engine choice (pure-TS now vs.
 * a C++ `libavoid-js`/WASM port later) as a one-way door for the plugin. This
 * seam makes it reversible: to swap engines, only this file changes.
 */

import { useCallback, useMemo } from 'react';
import { Position } from '@xyflow/react';
import type { Edge, Node, NodeChange } from '@xyflow/react';
import { useEdgeRouting, useEdgeRoutingStore, useRoutedEdgePath } from 'reactflow-edge-routing';
import type { UseEdgeRoutingOptions } from 'reactflow-edge-routing';

/** A node reduced to the geometry the router cares about. */
export interface RoutingNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A directed connection between two nodes. */
export interface RoutingEdge {
  id: string;
  source: string;
  target: string;
}

/** The four sides an edge can attach to. */
export type RoutingSide = 'left' | 'right' | 'top' | 'bottom';

/** Engine-agnostic routing knobs, mapped onto whatever the concrete engine calls them. */
export interface RoutingOptions {
  /** Orthogonal (right-angle) routing vs. a straight/polyline connector. Default: true. */
  orthogonal?: boolean;
  /** Corner radius (px) for orthogonal bends. */
  cornerRadius?: number;
  /** Minimum gap (px) the router keeps between an edge and a node. */
  nodeSpacing?: number;
  /** Minimum gap (px) between parallel edge segments. */
  edgeSpacing?: number;
  /** Let the router attach each end on whichever side is nearest. */
  autoSide?: boolean;
  /** Re-route continuously during a drag (real-time) instead of only on drop. */
  rerouteWhileDragging?: boolean;
  /** Fan-out gap (px) between edges sharing one handle, so they don't pile up. */
  handleSpread?: number;
  /** Length (px) of the shared trunk stub out of each pin — the fork "buffer zone". */
  stubSize?: number;
  /** Always emit the full routed path (false) vs. a direct line for unblocked edges (true). */
  routeOnlyWhenBlocked?: boolean;
}

/** Routed geometry for a single edge (results are keyed by edgeId inside the engine). */
export interface RoutedGeometry {
  /** SVG path string ready for `<BaseEdge path=...>`. */
  path: string;
  labelX: number;
  labelY: number;
  /** True when this is a real obstacle-avoiding route; false when it's the fallback. */
  routed: boolean;
  /** Full routed waypoints (handle → stub → … → stub → handle), in flow coords. */
  points: { x: number; y: number }[];
}

/** Handle returned to the canvas so it can feed geometry changes back to the router. */
export interface OrthogonalRoutingHandle {
  /** Call from ReactFlow's `onNodesChange`; the router only reacts to position/size/topology. */
  onGeometryChange: (changes: NodeChange<Node>[]) => void;
  /** Force a full re-route (e.g. after a drag settles or a layout is applied). */
  reset: () => void;
}

const DEFAULT_OPTIONS: Required<RoutingOptions> = {
  orthogonal: true,
  cornerRadius: 10,
  nodeSpacing: 12,
  edgeSpacing: 10,
  autoSide: true,
  rerouteWhileDragging: false,
  handleSpread: 12,
  stubSize: 20,
  routeOnlyWhenBlocked: true,
};

/** Adapt the neutral options onto the concrete engine's option names. */
function toEngineOptions(options?: RoutingOptions): UseEdgeRoutingOptions {
  const o = { ...DEFAULT_OPTIONS, ...options };
  return {
    connectorType: o.orthogonal ? 'orthogonal' : 'polyline',
    edgeRounding: o.cornerRadius,
    edgeToNodeSpacing: o.nodeSpacing,
    edgeToEdgeSpacing: o.edgeSpacing,
    // The engine's nearest-side / auto-best-side feature: it picks the attach
    // side from relative node bounds and overrides the visual path, so a node
    // dragged left of / level with its predecessor no longer forces a U-bracket.
    autoBestSideConnection: o.autoSide,
    realTimeRouting: o.rerouteWhileDragging,
    handleSpacing: o.handleSpread,
    stubSize: o.stubSize,
    routeOnlyWhenBlocked: o.routeOnlyWhenBlocked,
  };
}

/**
 * Adapt ReactFlow nodes to the neutral {@link RoutingNode} shape (geometry only).
 * Exposed so a future engine can consume the neutral type instead of RF nodes.
 */
export function toRoutingNodes(nodes: Node[]): RoutingNode[] {
  return nodes.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? n.width ?? 0,
    height: n.measured?.height ?? n.height ?? 0,
  }));
}

/** Adapt ReactFlow edges to the neutral {@link RoutingEdge} shape. */
export function toRoutingEdges(edges: Edge[]): RoutingEdge[] {
  return edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
}

/**
 * The routing seam's main hook. Wraps the concrete engine and returns a neutral
 * handle. The canvas calls this once and forwards node-geometry changes to it.
 *
 * GEOMETRY-ONLY RECOMPUTE (important — do not "optimize" this away): routes are
 * recomputed ONLY when a node's position or size changes, or when the node/edge
 * SET changes. Selection, hover, and arbitrary data/status changes must NOT
 * trigger a re-route. This matters because the same canvas ships to a live-
 * execution panel that mutates node `data.state` frequently; those status
 * updates flow through `setNodes` (never `onNodesChange`) and never change the
 * node COUNT, so neither `onGeometryChange` nor the engine's internal
 * length/options effect fires for them. `engineOptions` is memoized on its
 * primitive values so a stable options object never retriggers routing.
 */
export function useOrthogonalRouting(
  nodes: Node[],
  edges: Edge[],
  options?: RoutingOptions,
): OrthogonalRoutingHandle {
  const engineOptions = useMemo(
    () => toEngineOptions(options),
    [
      options?.orthogonal,
      options?.cornerRadius,
      options?.nodeSpacing,
      options?.edgeSpacing,
      options?.autoSide,
      options?.rerouteWhileDragging,
      options?.handleSpread,
      options?.stubSize,
      options?.routeOnlyWhenBlocked,
    ],
  );

  // Load-bearing: the engine assigns fan-out slot i (i=0 = topmost) at a shared
  // pin = the edge's index WITHIN THIS ARRAY'S ORDER (undocumented; see the fan
  // pre-pass in reactflow-edge-routing/routing-core.ts). Sorting the engine-facing
  // copy by source-node center Y (then target-node center Y) therefore fans every
  // target's inputs and every source's outputs top-to-bottom, killing fork
  // crossings. Reorder ONLY this copy — the store edge order (branch port indices,
  // YAML serialization) must stay untouched. Do not remove this sort.
  const orderedEdges = useMemo(() => {
    const centerY = new Map<string, number>();
    for (const n of nodes) {
      centerY.set(n.id, n.position.y + (n.measured?.height ?? n.height ?? 0) / 2);
    }
    const y = (id: string) => centerY.get(id) ?? 0;
    return [...edges].sort(
      (a, b) =>
        y(a.source) - y(b.source) ||
        y(a.target) - y(b.target) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }, [edges, nodes]);

  // `nodes` already carry each node's ENGINE-OBSTACLE geometry (box for most, box
  // + rear condition band for a branch — see engineObstacleRect), so the router's
  // auto pins land on the volume's outer edge and every node's own edges egress
  // from outside its buffer zone. No separate phantom obstacles needed.
  const { updateRoutingOnNodesChange, resetRouting } = useEdgeRouting(
    nodes,
    orderedEdges,
    engineOptions,
  );

  // Real-time routing while dragging: the engine's path hook shows a straight
  // FALLBACK (not the avoiding route) for any edge whose node is flagged
  // `dragging`, so mid-drag edges tangle and only snap back on drop. Clearing the
  // flag makes the engine treat the drag as live position updates → it reroutes
  // continuously (realTimeRouting) AND keeps showing the real routed path.
  const onGeometryChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      const live = changes.map((c) =>
        c.type === 'position' && c.dragging ? { ...c, dragging: false } : c,
      );
      updateRoutingOnNodesChange(live);
    },
    [updateRoutingOnNodesChange],
  );

  return useMemo(
    () => ({ onGeometryChange, reset: resetRouting }),
    [onGeometryChange, resetRouting],
  );
}

/** Map a ReactFlow `Position` enum to the neutral side string (exhaustive, no casts). */
function toSide(position: Position | undefined): RoutingSide | undefined {
  switch (position) {
    case Position.Left:
      return 'left';
    case Position.Right:
      return 'right';
    case Position.Top:
      return 'top';
    case Position.Bottom:
      return 'bottom';
    default:
      return undefined;
  }
}

/** Params the custom edge passes in to resolve its routed geometry. */
export interface RoutedEdgeParams {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  source?: string;
  target?: string;
  cornerRadius?: number;
}

/**
 * Per-edge geometry hook consumed by the custom edge component. Keeps the
 * concrete engine import inside this seam. Falls back to a smoothstep path (via
 * the side hints) whenever a real route isn't available yet or the edge is
 * mid-drag, so edges never disappear.
 */
export function useRoutedEdgeGeometry(params: RoutedEdgeParams): RoutedGeometry {
  const [path, labelX, labelY, routed, controlPoints, pinPoints] = useRoutedEdgePath({
    id: params.id,
    sourceX: params.sourceX,
    sourceY: params.sourceY,
    targetX: params.targetX,
    targetY: params.targetY,
    sourcePosition: toSide(params.sourcePosition),
    targetPosition: toSide(params.targetPosition),
    source: params.source,
    target: params.target,
    connectorType: 'orthogonal',
    borderRadius: params.cornerRadius ?? DEFAULT_OPTIONS.cornerRadius,
  });

  const points = routed
    ? [
        { x: pinPoints.sourceX, y: pinPoints.sourceY },
        ...controlPoints,
        { x: pinPoints.targetX, y: pinPoints.targetY },
      ]
    : [];

  return { path, labelX, labelY, routed, points };
}

/** A routed edge's id paired with its SVG path string (in FLOW coordinates). */
export interface RoutedEdgePath {
  id: string;
  path: string;
}

/**
 * Read-only view of the engine's current routed geometry, reduced to
 * `{ id, path }` per edge. The concrete store import stays inside this seam, so
 * the minimap can mirror the REAL orthogonal routes without importing the
 * routing engine. Paths are in FLOW coordinates, matching the minimap's
 * flow-coordinate viewBox 1:1. The map is empty until the router first responds,
 * so callers must tolerate missing entries and fall back to a straight line.
 */
export function useRoutedEdgePaths(): RoutedEdgePath[] {
  const routes = useEdgeRoutingStore((s) => s.routes);
  return useMemo(
    () => Object.entries(routes).map(([id, route]) => ({ id, path: route.path })),
    [routes],
  );
}

/** A routed edge's id paired with its full waypoints (flow coords), for the minimap. */
export interface RoutedEdgePoints {
  id: string;
  points: { x: number; y: number }[];
}

export function useRoutedEdgePoints(): RoutedEdgePoints[] {
  const routes = useEdgeRoutingStore((s) => s.routes);
  return useMemo(
    () => Object.entries(routes).map(([id, route]) => ({ id, points: route.points ?? [] })),
    [routes],
  );
}
