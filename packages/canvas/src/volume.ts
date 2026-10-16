/**
 * volume.ts — the single source of truth for a node's "collision volume" (碰撞体积).
 *
 * A node occupies more than its measured box: the box already bakes in the 15px
 * FORK_EXTENSION fork bands (left/right), but a BRANCH also projects a ~132px
 * condition-buffer zone to its RIGHT (where its per-port ovals live) that sits
 * OUTSIDE the box. If two nodes' buffer zones overlap, the routed edges between
 * them tangle. So every consumer that reasons about "how close may nodes get"
 * and "what must edges route around" reads its geometry from here:
 *
 *   - drag blocking (collision.ts)     → clamps against `aabb`
 *   - edge obstacle-avoidance (engine) → gets `box` (pin-owning) + `phantoms`
 *                                        (pinless extra obstacles)
 *   - back-edge corridor search        → treats `aabb` as a forbidden interval
 *
 * Two distinct consumers, two rules:
 *  - `phantoms` (ROUTER obstacles): a pin-owning obstacle is NEVER enlarged past
 *    its pins (Oracle). Pins live on the box edge, so the router keeps box-sized
 *    obstacles; only buffers on a side with NO engine pin become phantoms — i.e.
 *    a branch's REAR buffer (its out-edges are hand-drawn, so nothing egresses
 *    there). A straight node's left-in / right-out pins ARE engine-routed, so we
 *    must NOT phantom-block its sides or its own edges get trapped.
 *  - `aabb` (DRAG footprint + back-edge corridor): pure geometry, no pin problem,
 *    so it includes the buffer zone on BOTH sides — the fork band mirrored out as
 *    reserved space ({@link SIDE_BUFFER}) plus the branch rear — so two nodes
 *    can't be dragged close enough for their bands/edges to tangle. Because the
 *    aabb can extend LEFT of the box, it does NOT share the box's top-left;
 *    callers must offset by `aabb - box` when mapping a box position to it.
 */

import type { AgentType } from '@agentry/core';
import { BRANCH_BUFFER, BRANCH_LEAD, DOCUMENTER_FORK, FORK_EXTENSION } from './fork';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NodeVolume {
  box: Rect;
  phantoms: Rect[];
  aabb: Rect;
}

/** Width (px) of a branch's rear condition-buffer zone, right of its box. */
export const BRANCH_REAR = BRANCH_LEAD + BRANCH_BUFFER;

/** Per-side buffer zone (px) reserved around every node for its fork band + edge routing room. */
export const SIDE_BUFFER = FORK_EXTENSION + 12;

/**
 * The rect fed to the routing ENGINE as this node's obstacle. It includes any
 * buffer zone the node's OWN edges must exit from OUTSIDE (a branch's rear
 * condition band), so the engine places the node's pins on the volume's outer
 * edge and its own out-edges start beyond the buffer — the fork + condition
 * buffer are then hand-drawn INSIDE, and the engine only routes past them. The
 * 15px fork band is already inside the measured box, so normal nodes = box.
 */
export function engineObstacleRect(box: Rect, type: AgentType | undefined): Rect {
  if (type === 'branch') return { x: box.x, y: box.y, w: box.w + BRANCH_REAR, h: box.h };
  return box;
}

export function nodeVolume(box: Rect, type: AgentType | undefined): NodeVolume {
  const phantoms: Rect[] = [];
  if (type === 'branch') {
    phantoms.push({ x: box.x + box.w, y: box.y, w: BRANCH_REAR, h: box.h });
  }
  const rightPad = type === 'branch' ? BRANCH_REAR : SIDE_BUFFER;
  // Documenter reserves its LEFT fan-in buffer (where the decorative fork lives)
  // as drag/layout space so neighbours can't overlap it. No LEFT phantom though:
  // its left-in pin is a real engine pin, and phantom-blocking it would trap any
  // edge routed into the documenter (the branch-rear rule, mirrored).
  const leftPad = type === 'documenter' ? DOCUMENTER_FORK : SIDE_BUFFER;
  const aabb: Rect = {
    x: box.x - leftPad,
    y: box.y,
    w: box.w + leftPad + rightPad,
    h: box.h,
  };
  return { box, phantoms, aabb };
}
