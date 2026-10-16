/**
 * Type shim for `reactflow-edge-routing` v0.1.13.
 *
 * The published package sets "types": "./src/index.ts" and ships raw .ts source
 * (not .d.ts). Under this monorepo's strict config (`noUncheckedIndexedAccess`),
 * `tsc` therefore type-checks the library's own source and reports ~50 errors in
 * IT (e.g. routing-core.ts). `skipLibCheck` only skips .d.ts, so it does not help.
 *
 * This shim declares only the public surface the routing seam actually uses, with
 * signatures copied faithfully from the library source, and is mapped in via
 * tsconfig `paths`. Vite ignores tsconfig paths (no tsconfig-paths plugin), so at
 * runtime it still bundles the real package (including its Web Worker). Swapping
 * or upgrading the engine only touches routing.ts + this shim.
 */
declare module 'reactflow-edge-routing' {
  import type { Edge, Node, NodeChange } from '@xyflow/react';

  export type ConnectorType = 'orthogonal' | 'polyline' | 'bezier';

  export interface UseEdgeRoutingOptions {
    edgeToEdgeSpacing?: number;
    edgeToNodeSpacing?: number;
    handleSpacing?: number;
    connectorType?: ConnectorType;
    edgeRounding?: number;
    autoBestSideConnection?: boolean;
    routeOnlyWhenBlocked?: boolean;
    debounceMs?: number;
    realTimeRouting?: boolean;
    stubSize?: number;
    enrichNode?: (node: Node) => Node;
  }

  export interface UseEdgeRoutingResult {
    updateRoutingOnNodesChange: (changes: NodeChange<Node>[]) => void;
    resetRouting: () => void;
    refreshRouting: () => void;
    updateRoutingForNodeIds: (nodeIds: string[]) => void;
  }

  export function useEdgeRouting(
    nodes: Node[],
    edges: Edge[],
    options?: UseEdgeRoutingOptions,
  ): UseEdgeRoutingResult;

  export type RoutedSide = 'left' | 'right' | 'top' | 'bottom';

  export interface UseRoutedEdgePathParams {
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition?: RoutedSide;
    targetPosition?: RoutedSide;
    borderRadius?: number;
    offset?: number;
    connectorType?: ConnectorType;
    source?: string;
    target?: string;
  }

  export type RoutePinPoints = {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
  };

  export function useRoutedEdgePath(
    params: UseRoutedEdgePathParams,
  ): [
    path: string,
    labelX: number,
    labelY: number,
    wasRouted: boolean,
    controlPoints: { x: number; y: number }[],
    pinPoints: RoutePinPoints,
  ];

  /**
   * Routed geometry for a single edge. Shape copied faithfully from the library
   * source (`routing-core.ts` `AvoidRoute`). All coordinates are in FLOW space.
   */
  export interface AvoidRoute {
    path: string;
    labelX: number;
    labelY: number;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    /** Raw routed waypoints (including handle stubs). */
    points?: { x: number; y: number }[];
  }

  /**
   * The zustand store holding routed geometry, keyed by edgeId in `routes`.
   * Shape copied faithfully from the library source (`edge-routing-store.ts`
   * `EdgeRoutingState`). The routing seam reads `routes` to mirror the real
   * orthogonal lines in the minimap.
   */
  export interface EdgeRoutingState {
    loaded: boolean;
    routes: Record<string, AvoidRoute>;
    connectorType: ConnectorType;
    stubSize: number;
    draggingNodeIds: Set<string>;
    setLoaded: (loaded: boolean) => void;
    setRoutes: (routes: Record<string, AvoidRoute>) => void;
    setConnectorType: (type: ConnectorType) => void;
    setStubSize: (size: number) => void;
    setDraggingNodeIds: (ids: Set<string>) => void;
  }

  export function useEdgeRoutingStore(): EdgeRoutingState;
  export function useEdgeRoutingStore<U>(selector: (state: EdgeRoutingState) => U): U;
}
