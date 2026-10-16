import { Panel, useEdges, useNodes, useReactFlow, useStore, useViewport } from '@xyflow/react';
import { useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { AgentType } from '@agentry/core';
import type { AgentFlowNode } from './types';
import { useRoutedEdgePoints } from './routing';
import { orthogonalPath } from './backEdge';
import { branchLead, FORK_EXTENSION, forkPoints, inForkTail } from './fork';

/**
 * Custom minimap kept INSTEAD of React Flow's built-in `<MiniMap>` for the numbered,
 * labelled blocks. It now MIRRORS THE REAL ROUTED GEOMETRY: each edge is drawn from
 * the same obstacle-avoiding orthogonal path shown on the canvas (read through the
 * routing seam via {@link useRoutedEdgePaths}), so the overview matches the diagram
 * 1:1. Edges the router hasn't resolved yet fall back to a thin straight
 * center-to-center line so none is ever missing. The SVG viewBox is the node bounding
 * box in flow coordinates, and routed paths are also in flow coordinates, so the two
 * align exactly; blocks and labels scale together like a zoomed-out view. Colors come
 * from the shared design tokens.
 */

const BOUNDS_PADDING = 48;
const FALLBACK_NODE_W = 220;
const FALLBACK_NODE_H = 132;
const MAX_LABEL_FONT = 96;
const MIN_LABEL_FONT = 16;
const MINIMAP_CORNER = 10;

const MINI_TYPE_CLASS: Record<AgentType, string> = {
  straight: 'is-type-straight',
  branch: 'is-type-branch',
  reporter: 'is-type-reporter',
  documenter: 'is-type-documenter',
  'sub-workflow': 'is-type-subworkflow',
  'workflow-input': 'is-type-input',
  'workflow-output': 'is-type-output',
};

/* Node silhouette in the minimap, matching each type's on-canvas shape so the
   overview reads at a glance: straight = rounded rect, branch = right-opening
   trapezoid, sub-workflow = flat hexagon, reporter = right semicircle. */
function miniNodeShape(type: AgentType | undefined, bx: number, by: number, bw: number, bh: number, className: string) {
  if (type === 'branch') {
    const s = Math.min(14, bh * 0.16);
    return <path className={className} d={`M ${bx} ${by + s} L ${bx + bw} ${by} L ${bx + bw} ${by + bh} L ${bx} ${by + bh - s} Z`} />;
  }
  if (type === 'sub-workflow') {
    const p = Math.min(18, bw * 0.12);
    return (
      <path
        className={className}
        d={`M ${bx + p} ${by} L ${bx + bw - p} ${by} L ${bx + bw} ${by + bh / 2} L ${bx + bw - p} ${by + bh} L ${bx + p} ${by + bh} L ${bx} ${by + bh / 2} Z`}
      />
    );
  }
  if (type === 'reporter' || type === 'documenter') {
    const r = bh / 2;
    return <path className={className} d={`M ${bx} ${by} L ${bx + bw - r} ${by} A ${r} ${r} 0 0 1 ${bx + bw - r} ${by + bh} L ${bx} ${by + bh} Z`} />;
  }
  if (type === 'workflow-input') {
    const p = Math.min(20, bw * 0.22);
    return <path className={className} d={`M ${bx} ${by} L ${bx + bw - p} ${by} L ${bx + bw} ${by + bh / 2} L ${bx + bw - p} ${by + bh} L ${bx} ${by + bh} Z`} />;
  }
  if (type === 'workflow-output') {
    const p = Math.min(20, bw * 0.22);
    return <path className={className} d={`M ${bx + p} ${by} L ${bx + bw} ${by} L ${bx + bw} ${by + bh} L ${bx + p} ${by + bh} L ${bx} ${by + bh / 2} Z`} />;
  }
  return <rect className={className} x={bx} y={by} width={bw} height={bh} rx={16} ry={16} />;
}

type Box = { x: number; y: number; w: number; h: number };

export function WorkflowMiniMap() {
  const nodes = useNodes<AgentFlowNode>();
  const edges = useEdges();
  const routedPoints = useRoutedEdgePoints();
  const viewport = useViewport();
  const paneWidth = useStore((s) => s.width);
  const paneHeight = useStore((s) => s.height);
  const { setCenter } = useReactFlow();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const boxes = useMemo(() => {
    const map = new Map<string, Box>();
    for (const node of nodes) {
      map.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        w: node.measured?.width ?? FALLBACK_NODE_W,
        h: node.measured?.height ?? FALLBACK_NODE_H,
      });
    }
    return map;
  }, [nodes]);

  const routedPointsById = useMemo(
    () => new Map(routedPoints.map((entry) => [entry.id, entry.points])),
    [routedPoints],
  );

  const typeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.definition.type])),
    [nodes],
  );

  const bounds = useMemo<Box>(() => {
    if (boxes.size === 0) return { x: 0, y: 0, w: 1, h: 1 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const b of boxes.values()) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    // Include the real routed edge geometry: the engine routes back-edges over/
    // around nodes, well past the node bounding box, so frame those points too.
    for (const pts of routedPointsById.values()) {
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    return {
      x: minX - BOUNDS_PADDING,
      y: minY - BOUNDS_PADDING,
      w: maxX - minX + BOUNDS_PADDING * 2,
      h: maxY - minY + BOUNDS_PADDING * 2,
    };
  }, [boxes, routedPointsById]);

  /** One uniform label size that fits the tightest block — keeps captions consistent. */
  const numberById = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const node of nodes) {
      const type = node.data.definition.type;
      if (type === 'workflow-input' || type === 'workflow-output') continue;
      n += 1;
      map.set(node.id, n);
    }
    return map;
  }, [nodes]);

  const labelFont = useMemo(() => {
    let font = MAX_LABEL_FONT;
    for (const box of boxes.values()) {
      font = Math.min(font, box.h * 0.56, (box.w - 2 * FORK_EXTENSION) * 0.5);
    }
    return Math.max(MIN_LABEL_FONT, font);
  }, [boxes]);

  /** Current visible area of the main canvas, in flow coordinates. */
  const view = useMemo<Box | null>(() => {
    if (!paneWidth || !paneHeight || !viewport.zoom) return null;
    return {
      x: -viewport.x / viewport.zoom,
      y: -viewport.y / viewport.zoom,
      w: paneWidth / viewport.zoom,
      h: paneHeight / viewport.zoom,
    };
  }, [viewport, paneWidth, paneHeight]);

  const panToClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const fx = bounds.x + ((clientX - rect.left) / rect.width) * bounds.w;
    const fy = bounds.y + ((clientY - rect.top) / rect.height) * bounds.h;
    void setCenter(fx, fy, { zoom: viewport.zoom, duration: 0 });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || nodes.length === 0) return;
    dragging.current = true;
    svgRef.current?.setPointerCapture(event.pointerId);
    panToClient(event.clientX, event.clientY);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragging.current) panToClient(event.clientX, event.clientY);
  };
  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <Panel position="bottom-right" className="agentry-minimap">
      <svg
        ref={svgRef}
        className="agentry-minimap__svg"
        viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Workflow minimap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <g className="agentry-minimap__edges">
          {edges.map((edge) => {
            const source = boxes.get(edge.source);
            const target = boxes.get(edge.target);

            const pts = routedPointsById.get(edge.id);
            const first = pts?.[0];
            const last = pts?.[pts.length - 1];
            if (pts && first && last && pts.length >= 2 && source && target) {
              const trunks = {
                sourceTrunkX: source.x + source.w - FORK_EXTENSION,
                sourceCenterY: source.y + source.h / 2,
                targetTrunkX: target.x + FORK_EXTENSION,
                targetCenterY: target.y + target.h / 2,
              };
              // Mirror the canvas: a branch's out-edge hand-draws the fork + parallel
              // condition buffer (branchLead) up to the engine pin, then the routed C.
              const wp =
                typeById.get(edge.source) === 'branch'
                  ? [
                      ...branchLead(trunks.sourceTrunkX, trunks.sourceCenterY, first),
                      ...pts,
                      ...inForkTail(trunks.targetTrunkX, trunks.targetCenterY, last.y),
                    ]
                  : forkPoints(trunks, pts);
              const d = orthogonalPath(wp, MINIMAP_CORNER);
              return <path key={edge.id} className="agentry-minimap__edge" d={d} fill="none" />;
            }
            if (!source || !target) return null;
            const x1 = source.x + source.w / 2;
            const y1 = source.y + source.h / 2;
            const x2 = target.x + target.w / 2;
            const y2 = target.y + target.h / 2;
            return (
              <path
                key={edge.id}
                className="agentry-minimap__edge"
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                fill="none"
              />
            );
          })}
        </g>

        {nodes.map((node) => {
          const box = boxes.get(node.id);
          if (!box) return null;
          const label = numberById.get(node.id);
          const type = node.data.definition.type;
          const nodeClass = `agentry-minimap__node${type ? ` ${MINI_TYPE_CLASS[type]}` : ''}`;
          return (
            <g key={node.id}>
              <title>{`${label ? `${label}. ` : ''}${node.data.agentId}`}</title>
              {miniNodeShape(type, box.x + FORK_EXTENSION, box.y, box.w - 2 * FORK_EXTENSION, box.h, nodeClass)}
              {label ? (
                <text
                  className="agentry-minimap__label"
                  x={box.x + box.w / 2}
                  y={box.y + box.h / 2}
                  fontSize={labelFont}
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}

        {view ? (
          <rect
            className="agentry-minimap__viewport"
            x={view.x}
            y={view.y}
            width={view.w}
            height={view.h}
            rx={8}
            ry={8}
          />
        ) : null}
      </svg>
    </Panel>
  );
}
