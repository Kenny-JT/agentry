import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/**
 * Edge hover "magnifier lens" (half-1: canvas-local): after resting on an edge
 * the hovered edge is exploded into one straight horizontal wire PER upstream
 * output field, each labelled with a centered pill. Clicking a wire toggles it
 * ON (accent) / OFF (muted) as a canvas-local pass/block switch; the state is
 * owned by WorkflowCanvas so it survives reopening. Rendered in SCREEN SPACE
 * (portaled to <body>, fixed) so it never scales with zoom, and interactive
 * (dismissed when the pointer leaves the box, not the edge). With
 * `interactive: false` (workflow-boundary edges, where no toggle could ever
 * persist) the same field view renders read-only: static pills, no switch
 * affordance.
 */

export interface EdgePreviewField {
  key: string;
  type: string;
}

export interface EdgePreviewProps {
  open: boolean;
  source: string;
  target: string;
  fields: EdgePreviewField[];
  accent: string;
  offFields: ReadonlySet<string>;
  /** When false the lens is a read-only field view: no toggle affordance. */
  interactive?: boolean;
  x: number;
  y: number;
  onToggleField: (key: string) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

const VIEWPORT_MARGIN = 8;
const SVG_WIDTH = 212;
const ROW_GAP = 30;
const ROW_PAD_Y = 18;
export const WHOLE_OUTPUT_KEY = '\u0000whole-output';

type LensRow = { key: string; label: string; type: string };

export function EdgePreview({
  open,
  source,
  target,
  fields,
  accent,
  offFields,
  interactive = true,
  x,
  y,
  onToggleField,
  onPointerEnter,
  onPointerLeave,
}: EdgePreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [entered, setEntered] = useState(false);

  const rows: LensRow[] =
    fields.length > 0
      ? fields.map((field) => ({ key: field.key, label: field.key, type: field.type }))
      : [{ key: WHOLE_OUTPUT_KEY, label: 'whole output', type: '' }];
  const count = rows.length;
  const svgHeight = ROW_PAD_Y * 2 + (count - 1) * ROW_GAP;
  const rowY = (index: number) => ROW_PAD_Y + index * ROW_GAP;

  // Center the box on the cursor, then clamp to the 8px viewport margin on both
  // axes so it never runs off-screen. Measured before paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();

    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(x - width / 2, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(y - height / 2, window.innerHeight - height - VIEWPORT_MARGIN),
    );

    setPos({ left, top });
  }, [x, y, count]);

  // Flip visible on the first painted frame so the fade transition runs (a
  // layout-effect set would collapse into a single frame).
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // The box now opens centered UNDER the cursor, so the covered edge fires a
  // spurious mouseout that would schedule the grace-close. Assert box-hover on
  // open to cancel it; the real onMouseLeave still handles the actual exit.
  useEffect(() => {
    if (open) onPointerEnter();
  }, [open, onPointerEnter]);

  const visible = open && entered && pos !== null;

  const panelStyle: CSSProperties = {
    left: pos ? `${pos.left}px` : `${x}px`,
    top: pos ? `${pos.top}px` : `${y}px`,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(-4px)',
    ['--lens-accent' as string]: accent,
  };

  const popup = (
    <div
      ref={ref}
      className="agentry-edge-preview"
      role="dialog"
      aria-label={`Fields carried from ${source} to ${target}`}
      style={panelStyle}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
    >
      <div className="agentry-edge-preview__lens" style={{ width: SVG_WIDTH, height: svgHeight }}>
        <svg
          className="agentry-edge-preview__wires"
          width={SVG_WIDTH}
          height={svgHeight}
          viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
          aria-hidden="true"
        >
          {rows.map((row, index) => (
            <line
              key={row.key}
              className={`agentry-edge-preview__wire ${interactive && offFields.has(row.key) ? 'is-off' : 'is-on'}`}
              x1={0}
              y1={rowY(index)}
              x2={SVG_WIDTH}
              y2={rowY(index)}
            />
          ))}
        </svg>
        {rows.map((row, index) => {
          const title = row.type ? `${row.label}: ${row.type}` : row.label;
          if (!interactive) {
            return (
              <span
                key={row.key}
                className="agentry-edge-preview__row is-static"
                style={{ top: `${rowY(index)}px` }}
                title={title}
              >
                <span className="agentry-edge-preview__pill">{row.label}</span>
              </span>
            );
          }
          const off = offFields.has(row.key);
          return (
            <button
              key={row.key}
              type="button"
              className={`agentry-edge-preview__row ${off ? 'is-off' : 'is-on'}`}
              style={{ top: `${rowY(index)}px` }}
              title={title}
              aria-pressed={!off}
              onClick={() => onToggleField(row.key)}
            >
              <span className="agentry-edge-preview__pill">{row.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
