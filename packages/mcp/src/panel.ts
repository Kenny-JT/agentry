/**
 * Read-only client of the plugin's panel server (`.agentry/panel.json` → `/health`, `/events`).
 * Never wakes or starts anything: that is the dispatcher's job when a run is requested.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkflowEvent } from '@agentry/core';

const PANEL_FILE = path.join('.agentry', 'panel.json');
const REPLAY_WINDOW_MS = 600;

export interface PanelInfo {
  port: number;
  token: string;
}

export interface PanelHealth {
  app?: string;
  busy?: boolean;
  runId?: string;
}

export type LivePanel = PanelInfo & PanelHealth;

export const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
};

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The panel only ever streams the plugin's WorkflowEvents; the shape past `type`/`runId` is the frozen contract (core/events.ts). */
const isPanelEvent = (v: unknown): v is WorkflowEvent => isRecord(v) && typeof v.type === 'string' && typeof v.runId === 'string';

export function readPanelFile(projectDir: string): PanelInfo | null {
  const raw = readJson(path.join(projectDir, PANEL_FILE));
  return isRecord(raw) && typeof raw.port === 'number' && typeof raw.token === 'string' ? { port: raw.port, token: raw.token } : null;
}

async function health(port: number): Promise<PanelHealth | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) });
    const body: unknown = res.ok ? await res.json() : null;
    return isRecord(body) && body.app === 'agentry' ? (body as PanelHealth) : null;
  } catch {
    return null;
  }
}

export async function livePanel(projectDir: string): Promise<LivePanel | null> {
  const info = readPanelFile(projectDir);
  if (!info) return null;
  const state = await health(info.port);
  return state ? { ...info, ...state } : null;
}

/** The panel's event replay: everything it remembers about the current run, read in a short window. */
export async function replayEvents(port: number): Promise<WorkflowEvent[]> {
  const events: WorkflowEvent[] = [];
  const controller = new AbortController();
  const stop = setTimeout(() => controller.abort(), REPLAY_WINDOW_MS);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/events`, { signal: controller.signal });
    if (!res.ok || !res.body) return events;
    const reader = res.body.getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += Buffer.from(value).toString('utf8');
      for (;;) {
        const end = buffer.indexOf('\n\n');
        if (end < 0) break;
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
        if (!data) continue;
        try {
          const parsed: unknown = JSON.parse(data);
          if (isPanelEvent(parsed)) events.push(parsed);
        } catch {
          // not one of ours
        }
      }
    }
  } catch {
    // aborted after the window, or the panel went away: what we have is the replay
  } finally {
    clearTimeout(stop);
  }
  return events;
}
