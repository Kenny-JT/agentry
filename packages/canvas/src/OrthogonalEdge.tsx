import { BaseEdge, EdgeLabelRenderer, useStore } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { isRouter } from '@agentry/core';
import type { AgentType, RouteCondition } from '@agentry/core';
import { useRoutedEdgeGeometry } from './routing';
import { orthogonalPath } from './backEdge';
import { branchBufferCenterX, branchLead, FORK_EXTENSION, forkPoints, inForkTail } from './fork';
import type { CardTrunks } from './fork';
import { orderedRouteTargets } from './graph';
import type { AgentNodeData } from './types';

const TYPE_CLASS: Record<AgentType, string> = {
  straight: 'is-type-straight',
  branch: 'is-type-branch',
  reporter: 'is-type-reporter',
  documenter: 'is-type-documenter',
  'sub-workflow': 'is-type-subworkflow',
  tool: 'is-type-tool',
  decision: 'is-type-decision',
  'workflow-input': 'is-type-input',
  'workflow-output': 'is-type-output',
};

const CORNER_RADIUS = 10;

/** One-line summary of a branch port's gate, shown as a chip on its out-edge. */
function routeChipText(when: RouteCondition | undefined): string {
  if (!when) return 'else';
  const parts: string[] = [];
  if (when.gte !== undefined) parts.push(`\u2265 ${when.gte}`);
  if (when.gt !== undefined) parts.push(`> ${when.gt}`);
  if (when.lte !== undefined) parts.push(`\u2264 ${when.lte}`);
  if (when.lt !== undefined) parts.push(`< ${when.lt}`);
  if (when.equals !== undefined) parts.push(`= ${when.equals}`);
  if (when.contains !== undefined) parts.push(`\u2283 ${when.contains}`);
  if (when.not_contains !== undefined) parts.push(`\u2209 ${when.not_contains}`);
  return parts.length ? parts.join('  ') : 'else';
}

export function OrthogonalEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const engine = useRoutedEdgeGeometry({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    source,
    target,
  });

  const sourceType = useStore((s): AgentType | undefined => {
    const data = s.nodeLookup.get(source)?.data as AgentNodeData | undefined;
    return data?.definition.type;
  });

  // Ports are tried in priority order and the first match wins (D16), so once a
  // branch has several gated ports the chips carry their rank; else stays "else".
  const routeWhen = useStore(
    (s): { branch: boolean; when: RouteCondition | undefined; rank: number } => {
      const def = (s.nodeLookup.get(source)?.data as AgentNodeData | undefined)?.definition;
      if (!def || !isRouter(def)) return { branch: false, when: undefined, rank: 0 };
      const whenOf = (to: string) => def.routes?.find((route) => route.to === to)?.when;
      const gated = orderedRouteTargets(
        def,
        s.edges.filter((edge) => edge.source === source).map((edge) => edge.target),
      ).filter((to) => Object.keys(whenOf(to) ?? {}).length > 0);
      return {
        branch: true,
        when: whenOf(target),
        rank: gated.length > 1 ? gated.indexOf(target) + 1 : 0,
      };
    },
  );

  // Card edges: the visible card sits FORK_EXTENSION px inside each side of the
  // node box, so the fork trunk anchors at the card edge (box edge ∓ extension)
  // on the node's vertical center, while the engine pins live at the box edge.
  const cards = useStore((s): CardTrunks | null => {
    const sourceNode = s.nodeLookup.get(source);
    const targetNode = s.nodeLookup.get(target);
    if (!sourceNode || !targetNode) return null;
    const sw = sourceNode.measured?.width ?? 0;
    const sh = sourceNode.measured?.height ?? 0;
    const tw = targetNode.measured?.width ?? 0;
    const th = targetNode.measured?.height ?? 0;
    if (!sw || !sh || !tw || !th) return null;
    const sp = sourceNode.internals.positionAbsolute;
    const tp = targetNode.internals.positionAbsolute;
    return {
      sourceTrunkX: sp.x + sw - FORK_EXTENSION,
      sourceCenterY: sp.y + sh / 2,
      targetTrunkX: tp.x + FORK_EXTENSION,
      targetCenterY: tp.y + th / 2,
    };
  });

  const firstPt = engine.points[0];
  const lastPt = engine.points[engine.points.length - 1];
  let path: string;
  if (routeWhen.branch && cards && firstPt && lastPt) {
    // Branch out-edge: hand-draw the two IN-VOLUME buffers — the fork + the
    // straight parallel condition buffer (branchLead, ending at the engine pin on
    // the volume's outer edge) — then the engine's obstacle-avoiding route (C),
    // then the target's fork tail. So A+B are straight/tidy, C avoids nodes.
    const lead = branchLead(cards.sourceTrunkX, cards.sourceCenterY, firstPt);
    const tail = inForkTail(cards.targetTrunkX, cards.targetCenterY, lastPt.y);
    path = orthogonalPath([...lead, ...engine.points, ...tail], CORNER_RADIUS);
  } else if (cards && engine.points.length >= 2) {
    path = orthogonalPath(forkPoints(cards, engine.points), CORNER_RADIUS);
  } else {
    path = engine.path;
  }

  // The condition chip sits on ITS engine-routed out-edge (at the fanned source
  // pin Y, just right of the branch card) so it tracks the edge — the old fixed
  // buffer-column position no longer matches where the engine actually routes.
  const srcPin = engine.points[0];
  const chip =
    cards && srcPin
      ? { x: branchBufferCenterX(cards.sourceTrunkX, srcPin.x), y: srcPin.y }
      : { x: engine.labelX, y: engine.labelY };

  const typeClass = sourceType ? TYPE_CLASS[sourceType] : undefined;
  const className = typeClass ? `agentry-edge ${typeClass}` : 'agentry-edge';

  return (
    <>
      <BaseEdge id={id} path={path} className={className} />
      {routeWhen.branch && (
        <EdgeLabelRenderer>
          <div
            className="agentry-edge__chip nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${chip.x}px, ${chip.y}px)` }}
          >
            {routeWhen.rank > 0 ? `${routeWhen.rank} · ` : ''}
            {routeChipText(routeWhen.when)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
