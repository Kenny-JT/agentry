/**
 * fork.ts — the "buffer-zone fork" geometry.
 *
 * THE IDEA: the routing engine is great at clean orthogonal
 * fan-out (edgeSpacing/handleSpread = 22) but can't converge a node's shared-pin
 * edges into a tidy tree fork. So instead of fighting the engine, we EXTEND each
 * block by {@link FORK_EXTENSION}px on the left and right. That extension is a
 * transparent band (the visible card is inset inside it); the connection pins sit
 * on the OUTER edge of the band, so the engine routes to/from there exactly as it
 * always did. Then, inside the obstacle-free transparent band, we hand-draw the
 * fork: every edge sharing a pin runs back to ONE trunk point at the visible card
 * edge, so N edges automatically render as an N-way right-angle tree branch.
 *
 * This module only owns the band width and the little wrapper waypoints; the
 * actual SVG is built in {@link OrthogonalEdge} by concatenating these with the
 * engine's routed waypoints and rendering through `orthogonalPath`.
 */

export const FORK_EXTENSION = 15;

/**
 * Width (flow px) of a documenter's left fan-in buffer: the decorative
 * orthogonal fork is drawn inside it, and volume.ts reserves it as collision
 * space so neighbours never overlap the fork. Shared by AgentNode (SVG geometry)
 * and volume.ts (aabb left pad). Mirrors the branch's rear buffer, on the left.
 */
export const DOCUMENTER_FORK = 132;

const SPLIT_FRACTION = 0.5;

export interface ForkPoint {
  x: number;
  y: number;
}

/**
 * OUT-side fork waypoints: from the shared trunk point at the card's right edge,
 * out along the band, then up/down to meet the engine-fanned pin's Y.
 * (The pin itself — {@link pin} — is NOT included; the caller appends the engine
 * path which already starts there.)
 */
export function outForkLead(cardRightX: number, centerY: number, pinY: number): ForkPoint[] {
  const splitX = cardRightX + FORK_EXTENSION * SPLIT_FRACTION;
  return [
    { x: cardRightX, y: centerY },
    { x: splitX, y: centerY },
    { x: splitX, y: pinY },
  ];
}

/**
 * IN-side fork waypoints: from the engine-fanned pin's Y, in along the band, then
 * to the shared trunk point at the card's left edge. (The pin itself is NOT
 * included; the caller's engine path already ends there.)
 */
export function inForkTail(cardLeftX: number, centerY: number, pinY: number): ForkPoint[] {
  const splitX = cardLeftX - FORK_EXTENSION * SPLIT_FRACTION;
  return [
    { x: splitX, y: pinY },
    { x: splitX, y: centerY },
    { x: cardLeftX, y: centerY },
  ];
}

/** The four trunk anchors of an edge's two card edges (source right, target left). */
export interface CardTrunks {
  sourceTrunkX: number;
  sourceCenterY: number;
  targetTrunkX: number;
  targetCenterY: number;
}

/*
 * Branch fork + condition buffer. A branch's out-edges
 * converge to ONE trunk at its card's right-center, run a short shared stub,
 * then split into one horizontal lane per port. Every lane runs through a
 * fixed-width BUFFER band whose center X is the SAME for all ports, so the
 * per-port condition ovals stack into an aligned column right behind the branch.
 * Past the buffer each lane turns toward its own target. Drawn entirely by hand
 * (no routing engine) — so it is stable and the ovals always line up.
 */
export const BRANCH_LEAD = 16;
export const BRANCH_LANE_GAP = 30;
export const BRANCH_BUFFER = 116;

/** Vertical lane (and oval) Y for port `index` of `count`, centered on the branch. */
export function branchLaneY(centerY: number, index: number, count: number): number {
  return centerY + (index - (count - 1) / 2) * BRANCH_LANE_GAP;
}

/** Shared X (flow coords) where every port's condition oval is centered. */
export function branchOvalX(sourceTrunkX: number): number {
  return sourceTrunkX + BRANCH_LEAD + BRANCH_BUFFER * 0.5;
}

/**
 * The IN-VOLUME lead for ONE branch out-edge, ending at the engine pin `pin`
 * (which sits on the branch's collision-volume OUTER edge). It draws the two
 * hand-drawn branch buffer zones: (A) the fork — converge to a shared trunk at
 * the card's right-center, short stub, then rise/fall to this port's lane; then
 * (B) the parallel condition buffer — a straight horizontal run at the port's Y
 * out to `pin.x`. All ports share `splitX`, so their condition ovals line up in
 * a column. The caller appends the engine's routed path (which starts at `pin`).
 */
export function branchLead(sourceTrunkX: number, sourceCenterY: number, pin: ForkPoint): ForkPoint[] {
  const splitX = sourceTrunkX + BRANCH_LEAD;
  return [
    { x: sourceTrunkX, y: sourceCenterY },
    { x: splitX, y: sourceCenterY },
    { x: splitX, y: pin.y },
    { x: pin.x, y: pin.y },
  ];
}

/** X (flow coords) at the center of a branch's parallel condition buffer, given the engine pin X. */
export function branchBufferCenterX(sourceTrunkX: number, pinX: number): number {
  return (sourceTrunkX + BRANCH_LEAD + pinX) / 2;
}

/** Hand-drawn orthogonal waypoints for one branch out-edge (trunk → lane → buffer → target). */
export function branchForkPoints(trunks: CardTrunks, index: number, count: number): ForkPoint[] {
  const laneY = branchLaneY(trunks.sourceCenterY, index, count);
  const splitX = trunks.sourceTrunkX + BRANCH_LEAD;
  const bufferExitX = trunks.sourceTrunkX + BRANCH_LEAD + BRANCH_BUFFER;
  const approachX = Math.max(bufferExitX, trunks.targetTrunkX - BRANCH_LEAD);
  return [
    { x: trunks.sourceTrunkX, y: trunks.sourceCenterY },
    { x: splitX, y: trunks.sourceCenterY },
    { x: splitX, y: laneY },
    { x: bufferExitX, y: laneY },
    { x: approachX, y: laneY },
    { x: approachX, y: trunks.targetCenterY },
    { x: trunks.targetTrunkX, y: trunks.targetCenterY },
  ];
}

/**
 * The single geometry seam shared by the canvas edge and the minimap: wrap the
 * engine's routed waypoints with each side's card-edge lead/tail. When a side
 * `converge`s (the default), edges collapse to that card's center trunk (the
 * N-way tree fork). When it does NOT (a branch OUT side, a reporter IN side),
 * the edge instead anchors straight at its own fanned pin Y, so distinct ports /
 * spread-out inputs stay separated. Behaviour is identical to the old inline
 * fork when both sides converge.
 */
export function forkPoints(
  trunks: CardTrunks,
  enginePoints: ForkPoint[],
  convergeSource = true,
  convergeTarget = true,
): ForkPoint[] {
  const first = enginePoints[0];
  const last = enginePoints[enginePoints.length - 1];
  if (!first || !last) return enginePoints;
  const lead = convergeSource
    ? outForkLead(trunks.sourceTrunkX, trunks.sourceCenterY, first.y)
    : [{ x: trunks.sourceTrunkX, y: first.y }];
  const tail = convergeTarget
    ? inForkTail(trunks.targetTrunkX, trunks.targetCenterY, last.y)
    : [{ x: trunks.targetTrunkX, y: last.y }];
  return [...lead, ...enginePoints, ...tail];
}
