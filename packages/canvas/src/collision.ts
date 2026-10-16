/**
 * collision.ts — drag-time overlap blocking.
 *
 * THE PROBLEM: when two blocks' node zones (or their transparent buffer bands)
 * overlap, the routed connections between them get occluded / tangled. So during
 * an edit-mode drag we stop a node from being dragged INTO another node's zone:
 * it slides along the obstacle instead of overlapping it.
 *
 * COLLISION BOX: a node's box = its measured React Flow box, which ALREADY
 * includes the FORK_EXTENSION fork band on the left/right (see AgentNode's
 * EXTENSION_STYLE padding — the visible card is inset inside that band). We then
 * inflate obstacles by {@link COLLISION_GAP} so the buffer zones keep a little
 * air between them rather than butting flush.
 *
 * RESOLUTION: a classic per-axis clamp — advance X as far as allowed toward the
 * pointer, then Y from the resolved X. Clamping each axis independently is what
 * produces natural wall-sliding: head-on you stop at the wall, parallel you glide
 * along it. Movement is only ever clamped in the direction of travel, so a node
 * that already sits closer than the gap (e.g. a tight imported layout) can always
 * move APART — it just can't get any closer.
 */

/** A node's axis-aligned box in flow coordinates (top-left origin, matching RF `node.position`). */
export interface CollisionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Breathing room kept between two nodes' (buffer-inclusive) boxes, in px. */
export const COLLISION_GAP = 14;

interface Span {
  lo: number;
  hi: number;
}

/** Do two spans overlap? */
function overlaps(a: Span, b: Span): boolean {
  return a.lo < b.hi && b.lo < a.hi;
}

/**
 * Farthest position `p` in `[from, to]` (moving in the sign of `to - from`) that
 * the moving span `[from, from + len]` can reach without pushing DEEPER into any
 * obstacle span that overlaps on the perpendicular axis. Obstacles are inflated
 * by `gap`, so a clearance is always kept.
 *
 * Three cases per obstacle (a 1-D swept clamp with penetration awareness):
 *  - fully behind the travel direction  → ignored (moving away is free);
 *  - ahead with a clean gap             → a hard wall at its near edge;
 *  - already overlapping                → blocked ONLY in the direction that
 *    increases penetration (decided by which side of the obstacle's center the
 *    moving span's center sits). This is what lets a node that starts inside a
 *    zone — e.g. a branch whose rear buffer already overlaps its neighbour —
 *    still slide OUT while never being draggable further IN.
 */
function clampAxis(
  from: number,
  to: number,
  len: number,
  perpFrom: number,
  perpLen: number,
  obstacles: readonly { near: number; far: number; perpNear: number; perpFar: number }[],
  gap: number,
): number {
  if (to === from) return from;
  const dir = to > from ? 1 : -1;
  const moving: Span = { lo: perpFrom, hi: perpFrom + perpLen };
  let limit = to;
  for (const o of obstacles) {
    const lo = o.near - gap;
    const hi = o.far + gap;
    if (!overlaps(moving, { lo: o.perpNear - gap, hi: o.perpFar + gap })) continue;
    if (dir > 0) {
      if (hi <= from) continue; // fully behind
      if (from + len <= lo) limit = Math.min(limit, lo - len); // clean wall ahead
      else if (from + len / 2 <= (lo + hi) / 2) limit = Math.min(limit, from); // overlapping, deeper
    } else {
      if (lo >= from + len) continue; // fully ahead
      if (from >= hi) limit = Math.max(limit, hi); // clean wall behind
      else if (from + len / 2 >= (lo + hi) / 2) limit = Math.max(limit, from); // overlapping, deeper
    }
  }
  return dir > 0 ? Math.max(from, limit) : Math.min(from, limit);
}

/**
 * Clamp the moving node's `from` → `to` travel so its box keeps `gap` clear of
 * every obstacle. Returns the accepted top-left position.
 *
 * Per-axis swept clamp: X first (against the node's pre-move Y span), then Y
 * (against the resolved X span, which is what lets the node slide along a wall).
 *
 * @param from      the node's last non-overlapping position (top-left).
 * @param to        the position the pointer wants to move it to (top-left).
 * @param size      the moving node's footprint (collision volume, buffer-inclusive).
 * @param obstacles the OTHER nodes' collision volumes.
 * @param gap       clearance kept between the moving box and each obstacle.
 */
export function resolveNoOverlap(
  from: Point,
  to: Point,
  size: { w: number; h: number },
  obstacles: CollisionBox[],
  gap = COLLISION_GAP,
): Point {
  const { w, h } = size;
  const x = clampAxis(
    from.x,
    to.x,
    w,
    from.y,
    h,
    obstacles.map((o) => ({ near: o.x, far: o.x + o.w, perpNear: o.y, perpFar: o.y + o.h })),
    gap,
  );
  const y = clampAxis(
    from.y,
    to.y,
    h,
    x,
    w,
    obstacles.map((o) => ({ near: o.y, far: o.y + o.h, perpNear: o.x, perpFar: o.x + o.w })),
    gap,
  );
  return { x, y };
}
