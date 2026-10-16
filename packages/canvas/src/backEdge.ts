import { inForkTail, outForkLead } from './fork';

export const BACK_EDGE_DEADBAND = 96;
export const BACK_EDGE_LANE_MARGIN = 104;
export const BACK_EDGE_LANE_GAP = 24;
export const BACK_EDGE_SIDE_MARGIN = 44;
export const BACK_EDGE_CORNER = 10;

type Pt = { x: number; y: number };

export interface BackEdgeEnds {
  source: string;
  target: string;
}

export const isBack = (sourceCenterX: number, targetCenterX: number): boolean =>
  targetCenterX < sourceCenterX - BACK_EDGE_DEADBAND;

export function backEdgeOrder(
  edges: readonly BackEdgeEnds[],
  centerXOf: (nodeId: string) => number | undefined,
): Map<string, number> {
  const ids: string[] = [];
  for (const edge of edges) {
    const source = centerXOf(edge.source);
    const target = centerXOf(edge.target);
    if (source !== undefined && target !== undefined && isBack(source, target)) {
      ids.push(`${edge.source}\u0000${edge.target}`);
    }
  }
  ids.sort();
  const order = new Map<string, number>();
  ids.forEach((key, index) => order.set(key, index));
  return order;
}

export const backEdgeKey = (source: string, target: string): string => `${source}\u0000${target}`;

export interface BackObstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Nearest x to `desired` (searching in `dir`: +1 right, -1 left) whose vertical
 * segment spanning `[yTop, yBot]` clears every obstacle. Each obstacle inflated by
 * `gap` becomes a forbidden x-bar for the rows it occupies; whenever the candidate
 * lands inside a bar it jumps to that bar's far edge and re-checks, so it settles in
 * the first free corridor. This is what stops a back-edge's riser/descender column
 * from cutting straight through an intermediate block.
 */
export function freeColumnX(
  desired: number,
  dir: 1 | -1,
  yTop: number,
  yBot: number,
  obstacles: readonly BackObstacle[],
  gap: number,
): number {
  const lo = Math.min(yTop, yBot);
  const hi = Math.max(yTop, yBot);
  const bars: Array<[number, number]> = [];
  for (const o of obstacles) {
    if (o.y - gap < hi && lo < o.y + o.h + gap) bars.push([o.x - gap, o.x + o.w + gap]);
  }
  let x = desired;
  for (let guard = 0; guard < 128; guard += 1) {
    let moved = false;
    for (const [l, r] of bars) {
      if (x > l && x < r) {
        x = dir > 0 ? r : l;
        moved = true;
      }
    }
    if (!moved) return x;
  }
  return x;
}

export const backEdgeLaneY = (topY: number, laneIndex: number): number =>
  topY - BACK_EDGE_LANE_MARGIN - laneIndex * BACK_EDGE_LANE_GAP;

export const backEdgeSideOffset = (laneIndex: number): number =>
  BACK_EDGE_SIDE_MARGIN + laneIndex * BACK_EDGE_LANE_GAP;

// A back-edge loops from the source's right card edge, up into an over-the-top
// lane, across, and down into the target's left card edge. Its two ends reuse the
// SAME buffer-zone fork the engine-routed edges use (outForkLead / inForkTail): each
// end rises/descends to the fanned pin Y (harvested from the engine so it interleaves
// with the forward edges at that pin), then converges to the card-edge trunk within
// the band -- so a back-edge joins the tree fork instead of cutting flat across it.
// sourcePinY / targetPinY default to the card centers (a lone back-edge needs no fan).
export function backEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  laneY: number,
  forkLead: number,
  sourcePinY: number = sourceY,
  targetPinY: number = targetY,
  riserX: number = sourceX + forkLead,
  descenderX: number = targetX - forkLead,
): string {
  return orthogonalPath(
    [
      ...outForkLead(sourceX, sourceY, sourcePinY),
      { x: riserX, y: sourcePinY },
      { x: riserX, y: laneY },
      { x: descenderX, y: laneY },
      { x: descenderX, y: targetPinY },
      ...inForkTail(targetX, targetY, targetPinY),
    ],
    BACK_EDGE_CORNER,
  );
}

export function orthogonalPath(points: Pt[], radius: number): string {
  const pts: Pt[] = [];
  for (const p of points) {
    const prev = pts[pts.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) pts.push(p);
  }
  const start = pts[0];
  const end = pts[pts.length - 1];
  if (!start || !end || pts.length < 2) return '';
  const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const unit = (a: Pt, b: Pt) => {
    const d = dist(a, b) || 1;
    return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
  };
  let d = `M ${start.x} ${start.y}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    if (!prev || !cur || !next) continue;
    const r = Math.min(radius, dist(cur, prev) / 2, dist(cur, next) / 2);
    const a = unit(cur, prev);
    const b = unit(cur, next);
    d += ` L ${cur.x + a.x * r} ${cur.y + a.y * r} Q ${cur.x} ${cur.y} ${cur.x + b.x * r} ${cur.y + b.y * r}`;
  }
  d += ` L ${end.x} ${end.y}`;
  return d;
}
