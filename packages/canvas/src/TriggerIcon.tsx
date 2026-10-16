import type { ReactNode } from 'react';
import type { TriggerKind } from '@agentry/core';

/**
 * One glyph per workflow trigger kind (the top-level `on:` block), in the same
 * Lucide/Feather stroke style as the app's icon set. Lives in the canvas package
 * so the IN-port badge and the Inspector's trigger editor draw the same glyphs.
 */
const GLYPHS: Record<TriggerKind, ReactNode> = {
  // folder-down: a file landing in a folder
  file: (
    <>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M12 10v6M15 13l-3 3-3-3" />
    </>
  ),
  // clock
  schedule: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  // globe
  web: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
    </>
  ),
  // mail
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  // git-branch
  git: (
    <>
      <path d="M6 3v12" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
};

export interface TriggerIconProps {
  kind: TriggerKind;
  size?: number;
  className?: string;
}

export function TriggerIcon({ kind, size = 14, className }: TriggerIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {GLYPHS[kind]}
    </svg>
  );
}
