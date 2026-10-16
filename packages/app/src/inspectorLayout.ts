import type { PointerEvent as ReactPointerEvent } from 'react';

export type InspectorPlacement = 'docked' | 'floating';
export type InspectorMode = InspectorPlacement | 'hidden';

export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Bounds {
  width: number;
  height: number;
}

const MODE_KEY = 'agentry.inspector.mode';
const RECT_KEY = 'agentry.inspector.rect';
const WIDTH_KEY = 'agentry.inspector.width';

export const DOCKED_DEFAULT_WIDTH = 324;
export const DOCKED_MIN_WIDTH = 280;
export const DOCKED_MAX_WIDTH = 560;

export const FLOAT_DEFAULT_WIDTH = 340;
export const FLOAT_MIN_WIDTH = 280;
export const FLOAT_MIN_HEIGHT = 240;
export const FLOAT_MARGIN = 16;

const MODES: readonly InspectorMode[] = ['docked', 'floating', 'hidden'];

const isMode = (value: unknown): value is InspectorMode =>
  typeof value === 'string' && (MODES as readonly string[]).includes(value);

const isFinitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`agentry: failed to persist ${key}`, error);
  }
}

export const clampDockedWidth = (width: number): number =>
  Math.min(DOCKED_MAX_WIDTH, Math.max(DOCKED_MIN_WIDTH, Math.round(width)));

export function readInspectorMode(): InspectorMode {
  const stored = read(MODE_KEY);
  return isMode(stored) ? stored : 'docked';
}

export function writeInspectorMode(mode: InspectorMode): void {
  write(MODE_KEY, mode);
}

export function readInspectorWidth(): number {
  const parsed = Number(read(WIDTH_KEY));
  return isFinitePositive(parsed) ? clampDockedWidth(parsed) : DOCKED_DEFAULT_WIDTH;
}

export function writeInspectorWidth(width: number): void {
  write(WIDTH_KEY, String(clampDockedWidth(width)));
}

export function readInspectorRect(): FloatingRect | null {
  const raw = read(RECT_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { x, y, width, height } = parsed as Record<string, unknown>;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFinitePositive(width) || !isFinitePositive(height)) {
      return null;
    }
    return { x, y, width, height };
  } catch {
    return null;
  }
}

export function writeInspectorRect(rect: FloatingRect): void {
  write(RECT_KEY, JSON.stringify(rect));
}

export const defaultFloatingRect = (bounds: Bounds): FloatingRect => ({
  x: bounds.width - FLOAT_DEFAULT_WIDTH - FLOAT_MARGIN,
  y: FLOAT_MARGIN,
  width: FLOAT_DEFAULT_WIDTH,
  height: bounds.height - 2 * FLOAT_MARGIN,
});

/**
 * Keep a floating rect fully inside `bounds` (the canvas region): size is held
 * at or above the minimum unless the region itself is smaller, then the
 * position is pulled back so no edge leaves the region.
 */
export function clampFloatingRect(rect: FloatingRect, bounds: Bounds): FloatingRect {
  const width = Math.min(Math.max(rect.width, FLOAT_MIN_WIDTH), bounds.width);
  const height = Math.min(Math.max(rect.height, FLOAT_MIN_HEIGHT), bounds.height);
  const x = Math.min(Math.max(rect.x, 0), bounds.width - width);
  const y = Math.min(Math.max(rect.y, 0), bounds.height - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export interface PointerDragOptions {
  /** Class put on <body> for the drag's lifetime (cursor, user-select, transition off). */
  bodyClass: string;
  onMove: (dx: number, dy: number) => void;
  onEnd?: () => void;
}

/**
 * Track one pointer from a React pointerdown until it is released: captures it
 * on the pressed element so moves keep arriving even outside the element or
 * over the canvas, and reports deltas relative to the press point.
 */
export function startPointerDrag(
  event: ReactPointerEvent<HTMLElement>,
  { bodyClass, onMove, onEnd }: PointerDragOptions,
): void {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = event.currentTarget;
  const pointerId = event.pointerId;
  const startX = event.clientX;
  const startY = event.clientY;

  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    onMove(moveEvent.clientX - startX, moveEvent.clientY - startY);
  };
  const end = (endEvent: PointerEvent) => {
    if (endEvent.pointerId !== pointerId) return;
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
    target.removeEventListener('lostpointercapture', end);
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
    document.body.classList.remove(bodyClass);
    onEnd?.();
  };

  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
  target.addEventListener('lostpointercapture', end);
  target.setPointerCapture(pointerId);
  document.body.classList.add(bodyClass);
}
