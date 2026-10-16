import type { NodeState } from '@agentry/core';

export const color = {
  bgApp: '#0b0d10',
  bgBase: '#101317',
  bgSurface: '#161a20',
  bgElevated: '#1c2128',
  bgInset: '#0d1014',
  borderSubtle: '#21262d',
  borderDefault: '#2d333b',
  borderStrong: '#3d444d',
  textPrimary: '#e6edf3',
  textSecondary: '#9da7b3',
  textMuted: '#6e7681',
  accent: '#4d9eff',
  accentHover: '#6cb0ff',
  accentInk: '#06121f',
  accentMuted: 'rgba(77, 158, 255, 0.14)',
} as const;

export const stateColor: Record<NodeState, string> = {
  done: '#3fb950',
  running: '#e3b341',
  pending: '#6e7681',
  failed: '#f85149',
  // skipped = pending at 55% alpha (mirrors the color-mix derivation in tokens.css).
  skipped: 'rgba(110, 118, 129, 0.55)',
};

export const stateColorSoft: Record<NodeState, string> = {
  done: 'rgba(63, 185, 80, 0.16)',
  running: 'rgba(227, 179, 65, 0.18)',
  pending: 'rgba(110, 118, 129, 0.16)',
  failed: 'rgba(248, 81, 73, 0.16)',
  skipped: 'rgba(110, 118, 129, 0.1)',
};

export const font = {
  sans: "'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', 'JetBrains Mono', 'Cascadia Mono', Consolas, ui-monospace, 'SFMono-Regular', monospace",
} as const;

export const fontSize = {
  xs: '11px',
  sm: '12px',
  base: '13px',
  md: '14px',
  lg: '16px',
  xl: '18px',
  xxl: '22px',
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const space = {
  px: '1px',
  xs: '2px',
  sm: '4px',
  md: '6px',
  base: '8px',
  lg: '12px',
  xl: '16px',
  xxl: '20px',
  xxxl: '24px',
  huge: '32px',
} as const;

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  pill: '999px',
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 14px rgba(0, 0, 0, 0.45)',
  lg: '0 14px 36px rgba(0, 0, 0, 0.55)',
  glow: '0 0 0 1px rgba(77, 158, 255, 0.45), 0 0 20px rgba(77, 158, 255, 0.22)',
} as const;
