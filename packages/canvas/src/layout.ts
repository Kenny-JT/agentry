/**
 * layout.ts — push nodes apart until no two collision VOLUMES overlap.
 *
 * The same volume geometry + gap the drag-clamp uses, applied as a global settle
 * pass so volumes never overlap AT REST — needed whenever positions aren't the
 * product of dragging: on YAML load, on creating a node, and after a definition
 * change that GROWS a volume (e.g. straight → branch adds the ~132px rear
 * condition band). An overlapping volume would put the neighbour's engine pin
 * INSIDE an obstacle and make its edge cut straight through, so we relax the
 * layout instead: each overlapping pair pushes the node further along the
 * shallower-overlap axis out by the penetration depth, iterated to convergence.
 */

import { COLLISION_GAP } from './collision';
import type { AgentFlowNode } from './types';
import { nodeVolume } from './volume';

const FALLBACK_W = 220;
const FALLBACK_H = 132;
const MAX_ITERATIONS = 24;

export function resolveVolumeOverlaps(
  nodes: AgentFlowNode[],
  gap = COLLISION_GAP,
): AgentFlowNode[] {
  if (nodes.length < 2) return nodes;

  const pos = new Map(nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]));
  const size = new Map(
    nodes.map((n) => [
      n.id,
      { w: n.measured?.width ?? n.width ?? FALLBACK_W, h: n.measured?.height ?? n.height ?? FALLBACK_H },
    ]),
  );

  const aabbOf = (n: AgentFlowNode) => {
    const p = pos.get(n.id) ?? n.position;
    const s = size.get(n.id) ?? { w: FALLBACK_W, h: FALLBACK_H };
    return nodeVolume({ x: p.x, y: p.y, w: s.w, h: s.h }, n.data.definition.type).aabb;
  };

  let moved = false;
  for (let iter = 0; iter < MAX_ITERATIONS; iter += 1) {
    let any = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        if (!a || !b) continue;
        const va = aabbOf(a);
        const vb = aabbOf(b);
        const ox = Math.min(va.x + va.w, vb.x + vb.w) - Math.max(va.x, vb.x) + gap;
        const oy = Math.min(va.y + va.h, vb.y + vb.h) - Math.max(va.y, vb.y) + gap;
        if (ox <= 0 || oy <= 0) continue;
        const pa = pos.get(a.id);
        const pb = pos.get(b.id);
        if (!pa || !pb) continue;
        any = true;
        moved = true;
        if (ox <= oy) {
          if (va.x + va.w / 2 >= vb.x + vb.w / 2) pa.x += ox;
          else pb.x += ox;
        } else if (va.y + va.h / 2 >= vb.y + vb.h / 2) pa.y += oy;
        else pb.y += oy;
      }
    }
    if (!any) break;
  }

  if (!moved) return nodes;
  return nodes.map((n) => {
    const p = pos.get(n.id);
    return !p || (p.x === n.position.x && p.y === n.position.y) ? n : { ...n, position: { x: p.x, y: p.y } };
  });
}
