import { isTauri } from './platform';

/**
 * Discovery of the plugin's live-panel SSE server.
 *
 * The plugin binds `listen(0)` (random port) and writes the coordinates to
 * `<projectRoot>/.agentry/panel.json`. A crashed plugin never deletes that
 * file, so a stale one WILL be read eventually — connecting to a dead port is
 * the exact failure mode D1 tells us to defend against. Phase 1 has no Rust
 * beyond `read_text_file`, so we cannot check `pid` liveness; instead we
 * authoritatively probe the port over HTTP — identity-first via `GET /health`
 * (see {@link probePanel}) — before anyone opens an EventSource to it, and fall
 * back to the {@link STALE_MAX_AGE_MS} age heuristic only when the probe is
 * inconclusive.
 */
export interface PanelInfo {
  port: number;
  runId: string;
  /**
   * Read but deliberately unused: liveness-by-pid needs a process API the
   * Tauri backend doesn't expose in phase 1 (only read/write_text_file).
   * Kept for phase 2 / diagnostics — do not "clean it up".
   */
  pid?: number;
  startedAt?: string;
}

export type PanelDiscovery =
  | { status: 'found'; panel: PanelInfo }
  | { status: 'stale'; panel: PanelInfo }
  | { status: 'not-found' };

/**
 * Fallback only — consulted AFTER probing, never before: when the port answers
 * but cannot prove identity (an opaque response, e.g. a plugin build predating
 * `GET /health`), a panel.json older than 24h is presumed stale. An
 * identity-verified live server is never stale, however old the file is.
 */
export const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Probe budget; the plugin answers `GET /health` / `GET /` locally well under this. */
export const PROBE_TIMEOUT_MS = 1500;

/**
 * Identity marker the plugin's `GET /health` payload must carry (`app` field).
 * A foreign server that reused our recorded port fails the probe either by not
 * sending `Access-Control-Allow-Origin` (the fetch rejects) or by not returning
 * this marker — both mean "not our panel".
 */
export const HEALTH_APP_MARKER = 'agentry';

const PROJECT_ROOT_STORAGE_KEY = 'agentry.observe.projectRoot';

export function getStoredProjectRoot(): string {
  try {
    return localStorage.getItem(PROJECT_ROOT_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function storeProjectRoot(root: string): void {
  try {
    localStorage.setItem(PROJECT_ROOT_STORAGE_KEY, root);
  } catch (error) {
    console.warn('agentry: failed to persist project root', error);
  }
}

function panelJsonPath(projectRoot: string): string {
  return `${projectRoot.replace(/[\\/]+$/, '')}/.agentry/panel.json`;
}

async function readPanelText(projectRoot: string): Promise<string | null> {
  const path = panelJsonPath(projectRoot);
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('read_text_file', { path });
    } catch {
      return null;
    }
  }
  // Web dev fallback: no filesystem access, so the root must be an http(s)
  // base serving the project directory. Anything else resolves to not-found.
  if (!/^https?:\/\//i.test(projectRoot)) return null;
  try {
    const response = await fetch(path, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function parsePanelInfo(text: string): PanelInfo | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<Record<keyof PanelInfo, unknown>>;
  if (
    typeof candidate.port !== 'number' ||
    !Number.isInteger(candidate.port) ||
    candidate.port <= 0 ||
    candidate.port > 65535 ||
    typeof candidate.runId !== 'string'
  ) {
    return null;
  }
  return {
    port: candidate.port,
    runId: candidate.runId,
    pid: typeof candidate.pid === 'number' ? candidate.pid : undefined,
    startedAt: typeof candidate.startedAt === 'string' ? candidate.startedAt : undefined,
  };
}

export type PanelProbe =
  | 'ours' // /health answered with our app marker — definitely our panel
  | 'foreign' // the port answered readably but it is NOT our panel
  | 'opaque' // something answered but was unreadable (no CORS) — inconclusive
  | 'unreachable'; // nothing answered — dead port

/**
 * Authoritative port check, identity first.
 *
 * A SIGKILL leaves panel.json behind and the OS can hand the recorded port to a
 * FOREIGN process, so "something answered" is not enough — the old opaque
 * `no-cors` probe reported such a port as found, and the EventSource then
 * failed against it forever. `GET /health` is the plugin's cheap identity
 * endpoint: CORS-readable JSON carrying {@link HEALTH_APP_MARKER}. Verification
 * is deliberately defensive — only the marker is required, extra or missing
 * optional fields (port, runId, …) are tolerated — so the payload can grow
 * without breaking discovery.
 *
 * The opaque `no-cors` `GET /` probe survives as the LIVENESS fallback for
 * ports where /health is unreadable: it distinguishes a dead port
 * ('unreachable') from a server that answers but cannot prove identity
 * ('opaque', e.g. a plugin build predating /health, whose `GET /` sends no
 * `Access-Control-Allow-Origin`).
 */
export async function probePanel(port: number): Promise<PanelProbe> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (
      response.ok &&
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { app?: unknown }).app === HEALTH_APP_MARKER
    ) {
      return 'ours';
    }
    return 'foreign';
  } catch {
    // Unreadable /health: dead port, or a server without CORS — probe liveness.
  }
  try {
    await fetch(`http://127.0.0.1:${port}/`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return 'opaque';
  } catch {
    return 'unreachable';
  }
}

/**
 * Make the live panel wear the editor's theme (decision D13). Best-effort: a
 * plain-text body keeps it a CORS "simple" request (no preflight), and a panel
 * built before `/api/theme` just ignores it.
 */
export async function pushPanelTheme(port: number, theme: string): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}/api/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ theme }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch {
    // the panel keeps its own theme — nothing to recover
  }
}

export async function discoverPanel(projectRoot: string): Promise<PanelDiscovery> {
  if (!projectRoot.trim()) return { status: 'not-found' };
  const text = await readPanelText(projectRoot);
  if (text === null) return { status: 'not-found' };
  const panel = parsePanelInfo(text);
  if (!panel) return { status: 'not-found' };

  // Probe FIRST: an identity-verified live server is never stale, no matter how
  // old panel.json is (startedAt only refreshes on server start / run start, so
  // an idle-but-live session would otherwise be declared stale unasked). The
  // age heuristic is a fallback for the one inconclusive probe outcome.
  const probe = await probePanel(panel.port);
  if (probe === 'ours') return { status: 'found', panel };
  if (probe === 'foreign' || probe === 'unreachable') return { status: 'stale', panel };

  if (panel.startedAt) {
    const startedAt = Date.parse(panel.startedAt);
    if (Number.isFinite(startedAt) && Date.now() - startedAt > STALE_MAX_AGE_MS) {
      return { status: 'stale', panel };
    }
  }
  return { status: 'found', panel };
}
