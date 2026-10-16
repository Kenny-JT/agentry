import { useEffect, useMemo, useState } from 'react';
import type { NodeState, SelectFallbackEvent, WorkflowEvent, WorkflowEventType } from '@agentry/core';
import { discoverPanel, probePanel } from './panelDiscovery';

export type RunConnectionStatus =
  | 'idle'
  | 'searching'
  | 'connecting'
  | 'connected'
  | 'stale'
  | 'port-unreachable'
  | 'disconnected';

export interface UseRunEventsOptions {
  enabled: boolean;
  projectRoot?: string;
  /** Manual escape hatch: wins over panel.json discovery when set. */
  portOverride?: number;
}

export interface RunEvents {
  status: RunConnectionStatus;
  port: number | null;
  runId: string | null;
  nodeStates: ReadonlyMap<string, NodeState>;
  nodeWarnings: ReadonlyMap<string, readonly string[]>;
  runEnded: boolean;
}

/** While enabled but unconnected, rediscover/reprobe starting at this cadence. */
export const DISCOVERY_RETRY_MS = 3000;

/**
 * Consecutive failures back off exponentially (3s → 6s → 12s → 24s → cap), so a
 * `found` → EventSource-failed loop (or a dead port) stops hammering at a fixed
 * interval forever. A successful EventSource open resets the backoff.
 */
export const DISCOVERY_RETRY_MAX_MS = 30000;

// Compile-time exhaustive list of known discriminants; unknown wire types are
// dropped by the guard instead of crashing the stream.
const KNOWN_EVENT_TYPES: Record<WorkflowEventType, true> = {
  'run.started': true,
  'node.state': true,
  'node.output': true,
  handoff: true,
  checkpoint: true,
  'run.finished': true,
  'schema.warning': true,
  'select.fallback': true,
};

const fallbackText = (event: SelectFallbackEvent): string =>
  event.reason === 'unparseable'
    ? `Filter on ${event.from} bypassed: its output was not JSON, so it passed whole.`
    : `Filter on ${event.from}: ${(event.missing ?? []).join(', ')} missing from its output.`;

function parseWorkflowEvent(payload: string): WorkflowEvent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const type = (raw as { type?: unknown }).type;
  if (typeof type !== 'string' || !(type in KNOWN_EVENT_TYPES)) return null;
  return raw as WorkflowEvent;
}

const EMPTY_STATES: ReadonlyMap<string, NodeState> = new Map();
const EMPTY_WARNINGS: ReadonlyMap<string, readonly string[]> = new Map();

function addWarnings(
  current: ReadonlyMap<string, readonly string[]>,
  nodeId: string,
  added: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const existing = current.get(nodeId) ?? [];
  const fresh = added.filter((text) => !existing.includes(text));
  if (!fresh.length) return current;
  return new Map(current).set(nodeId, [...existing, ...fresh]);
}

export function useRunEvents({ enabled, projectRoot, portOverride }: UseRunEventsOptions): RunEvents {
  const [status, setStatus] = useState<RunConnectionStatus>('idle');
  const [port, setPort] = useState<number | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [nodeStates, setNodeStates] = useState<ReadonlyMap<string, NodeState>>(EMPTY_STATES);
  const [nodeWarnings, setNodeWarnings] = useState<ReadonlyMap<string, readonly string[]>>(EMPTY_WARNINGS);
  const [runEnded, setRunEnded] = useState(false);

  useEffect(() => {
    // Clear run data on disable, not on re-enable: App flips into run mode as
    // soon as runId/nodeStates are non-empty, so leftovers from a previous run
    // would force run mode on reconnect attempts that never connected.
    if (!enabled) {
      setStatus('idle');
      setPort(null);
      setRunId(null);
      setNodeStates(EMPTY_STATES);
      setNodeWarnings(EMPTY_WARNINGS);
      setRunEnded(false);
      return;
    }

    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let failures = 0;

    const scheduleRetry = () => {
      if (cancelled) return;
      const delay = Math.min(DISCOVERY_RETRY_MS * 2 ** failures, DISCOVERY_RETRY_MAX_MS);
      failures += 1;
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => void connect(), delay);
    };

    const handleEvent = (event: WorkflowEvent) => {
      switch (event.type) {
        case 'run.started':
          setRunId(event.runId);
          setRunEnded(false);
          // Wire data: a malformed event without an array nodeIds must not
          // throw inside onmessage — degrade to "no known nodes".
          setNodeStates(
            new Map(
              (Array.isArray(event.nodeIds) ? event.nodeIds : []).map((nodeId) => [
                nodeId,
                'pending' as NodeState,
              ]),
            ),
          );
          setNodeWarnings(EMPTY_WARNINGS);
          break;
        case 'schema.warning':
          if (Array.isArray(event.warnings)) {
            setNodeWarnings((current) => addWarnings(current, event.nodeId, event.warnings));
          }
          break;
        case 'select.fallback':
          setNodeWarnings((current) => addWarnings(current, event.nodeId, [fallbackText(event)]));
          break;
        case 'node.state':
          setNodeStates((current) => {
            if (current.get(event.nodeId) === event.state) return current;
            const next = new Map(current);
            next.set(event.nodeId, event.state);
            return next;
          });
          break;
        case 'run.finished':
          setRunEnded(true);
          break;
        default:
          break;
      }
    };

    const open = (livePort: number) => {
      if (cancelled) return;
      setPort(livePort);
      source = new EventSource(`http://127.0.0.1:${livePort}/events`);
      source.onopen = () => {
        if (cancelled) return;
        failures = 0;
        setStatus('connected');
      };
      source.onmessage = (message: MessageEvent<string>) => {
        if (cancelled) return;
        const event = parseWorkflowEvent(message.data);
        if (event) handleEvent(event);
      };
      // EventSource would silently retry a dead server forever; close it and
      // run our own probing loop so the UI reports a truthful status.
      source.onerror = () => {
        if (cancelled) return;
        source?.close();
        source = null;
        setStatus('disconnected');
        setPort(null);
        scheduleRetry();
      };
    };

    const connect = async () => {
      if (cancelled) return;
      if (portOverride !== undefined) {
        setStatus('connecting');
        const probe = await probePanel(portOverride);
        if (cancelled) return;
        // A manual override is the user's escape hatch: an opaque answer is
        // trusted (their plugin may predate /health). Nothing usable on the
        // port is NOT staleness — rerunning won't help a typo — so it gets its
        // own status instead of 'stale'.
        if (probe === 'foreign' || probe === 'unreachable') {
          setStatus('port-unreachable');
          setPort(null);
          scheduleRetry();
          return;
        }
        open(portOverride);
        return;
      }

      setStatus('searching');
      const discovery = await discoverPanel(projectRoot ?? '');
      if (cancelled) return;
      if (discovery.status !== 'found') {
        setStatus(discovery.status === 'stale' ? 'stale' : 'searching');
        setPort(null);
        scheduleRetry();
        return;
      }
      open(discovery.panel.port);
    };

    void connect();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      source?.close();
      source = null;
    };
  }, [enabled, projectRoot, portOverride]);

  return useMemo(
    () => ({ status, port, runId, nodeStates, nodeWarnings, runEnded }),
    [status, port, runId, nodeStates, nodeWarnings, runEnded],
  );
}
