import { useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import {
  clampFloatingRect,
  defaultFloatingRect,
  readInspectorRect,
  startPointerDrag,
  writeInspectorRect,
  FLOAT_MIN_HEIGHT,
  FLOAT_MIN_WIDTH,
} from '../inspectorLayout';
import type { Bounds, FloatingRect } from '../inspectorLayout';

type ResizeEdge = 'left' | 'bottom' | 'corner';

const HANDLES: ReadonlyArray<{ edge: ResizeEdge; bodyClass: string }> = [
  { edge: 'left', bodyClass: 'agentry-drag--ew' },
  { edge: 'bottom', bodyClass: 'agentry-drag--ns' },
  { edge: 'corner', bodyClass: 'agentry-drag--nesw' },
];

/* The panel is absolutely positioned inside the stage (<main>), so the stage's
   padding box is both its containing block and the region it must stay in;
   clientWidth/Height exclude the stage's own border. */
const boundsOf = (stage: HTMLElement): Bounds | null =>
  stage.clientWidth > 0 && stage.clientHeight > 0
    ? { width: stage.clientWidth, height: stage.clientHeight }
    : null;

/**
 * Floating host for the inspector. `placed` is where the user last put the
 * panel (or null: the top-right default); what renders is that rect clamped to
 * the CURRENT stage size, so a sidebar opening or the dock column collapsing
 * only pushes the panel in for as long as the stage is actually narrower.
 */
export function InspectorFloat({ children }: { children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [placed, setPlaced] = useState<FloatingRect | null>(() => readInspectorRect());

  useLayoutEffect(() => {
    const stage = panelRef.current?.parentElement;
    if (!stage) return;
    const measure = () => setBounds(boundsOf(stage));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const rect = bounds ? clampFloatingRect(placed ?? defaultFloatingRect(bounds), bounds) : null;

  const drag = (
    event: ReactPointerEvent<HTMLDivElement>,
    bodyClass: string,
    next: (start: FloatingRect, dx: number, dy: number, within: Bounds) => FloatingRect,
  ) => {
    if (!rect || !bounds) return;
    const start = rect;
    const within = bounds;
    let latest = start;
    startPointerDrag(event, {
      bodyClass,
      onMove: (dx, dy) => {
        latest = clampFloatingRect(next(start, dx, dy, within), within);
        setPlaced(latest);
      },
      onEnd: () => writeInspectorRect(latest),
    });
  };

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.agentry-inspector__head') || event.target.closest('button')) return;
    drag(event, 'agentry-drag--move', (start, dx, dy) => ({ ...start, x: start.x + dx, y: start.y + dy }));
  };

  const onHandlePointerDown = (edge: ResizeEdge, bodyClass: string) => (event: ReactPointerEvent<HTMLDivElement>) =>
    drag(event, bodyClass, (start, dx, dy, within) => {
      const right = start.x + start.width;
      const width = edge === 'bottom' ? start.width : Math.min(Math.max(start.width - dx, FLOAT_MIN_WIDTH), right);
      const height =
        edge === 'left'
          ? start.height
          : Math.min(Math.max(start.height + dy, FLOAT_MIN_HEIGHT), within.height - start.y);
      return { x: right - width, y: start.y, width, height };
    });

  return (
    <div
      ref={panelRef}
      className="agentry-inspector-float"
      style={
        rect
          ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height }
          : { visibility: 'hidden' }
      }
      onPointerDown={onHeaderPointerDown}
    >
      {children}
      {HANDLES.map(({ edge, bodyClass }) => (
        <div
          key={edge}
          className={`agentry-inspector-float__handle agentry-inspector-float__handle--${edge}`}
          onPointerDown={onHandlePointerDown(edge, bodyClass)}
        />
      ))}
    </div>
  );
}
