/**
 * The five `on:` watchers. Each turns one trigger block into TriggerEvents through `fire`, and
 * keeps whatever it must remember (files already seen, a page's last text, git refs, the mail
 * history point) in a StateSlot so a restart neither re-fires old news nor misses what happened
 * while the watcher was down.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  asPatternList,
  fileTriggerAccepts,
  matchesGlob,
  nextScheduleTime,
  parseDuration,
  parseScheduleAt,
  TRIGGER_DEFAULTS,
  type FileTrigger,
  type GitCommitSummary,
  type GitTrigger,
  type MailSummary,
  type MailTrigger,
  type ScheduleTrigger,
  type TriggerEvent,
  type WebTrigger,
} from '@agentry/core';
import type { GmailApi } from './google';

export type Fire = (event: TriggerEvent) => void;
export type Log = (message: string) => void;

export interface Watcher {
  stop(): void;
}

export interface StateSlot<T> {
  get(): T | undefined;
  set(value: T): void;
}

const now = () => new Date().toISOString();
const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** `~/x`, absolute, or relative to the project root. */
export function expandPath(p: string, root: string): string {
  const expanded = p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? path.join(os.homedir(), p.slice(1)) : p;
  return path.resolve(root, expanded);
}

// ── file ──

const FILE_POLL_MS = 500;
/** A new file counts as finished once its size has held still this long and it opens for reading. */
const FILE_STABLE_MS = 700;

function readable(file: string): boolean {
  try {
    fs.closeSync(fs.openSync(file, 'r'));
    return true;
  } catch {
    return false;
  }
}

export function watchFolder(trigger: FileTrigger, root: string, fire: Fire, state: StateSlot<{ known: string[] }>, log: Log): Watcher {
  const folder = expandPath(trigger.path, root);
  const settleMs = parseDuration(trigger.settle ?? TRIGGER_DEFAULTS.fileSettle) ?? 3000;
  const known = new Set(state.get()?.known ?? []);
  // no memory yet: what is in the folder now is the baseline, not news
  let baselined = state.get() !== undefined;
  const growing = new Map<string, { size: number; since: number }>();
  let batch: string[] = [];
  let batchTimer: NodeJS.Timeout | undefined;
  let fsWatcher: fs.FSWatcher | undefined;
  let missingLogged = false;
  let stopped = false;

  const save = () => state.set({ known: [...known] });

  const flush = () => {
    batchTimer = undefined;
    if (!batch.length) return;
    const files = batch.map((name) => path.join(folder, name));
    batch = [];
    save();
    fire({ trigger: 'file', at: now(), folder, files });
  };

  const attach = () => {
    if (fsWatcher) return;
    try {
      fsWatcher = fs.watch(folder, () => setTimeout(scan, 60));
      fsWatcher.on('error', () => {
        fsWatcher?.close();
        fsWatcher = undefined;
      });
    } catch {
      // folder missing — the poll keeps looking and attaches once it exists
    }
  };

  const scan = () => {
    if (stopped) return;
    let names: string[];
    try {
      names = fs.readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name);
      missingLogged = false;
      attach();
    } catch {
      if (!missingLogged) log(`file: ${folder} does not exist (yet) — waiting for it`);
      missingLogged = true;
      return;
    }
    const present = new Set(names);
    let forgot = false;
    // a file that left the folder (the workflow moved it) fires again if it ever comes back
    for (const name of [...known]) {
      if (!present.has(name)) {
        known.delete(name);
        forgot = true;
      }
    }
    if (!baselined) {
      for (const name of names) known.add(name);
      baselined = true;
      save();
      return;
    }
    const t = Date.now();
    for (const name of names) {
      if (known.has(name) || !fileTriggerAccepts(trigger, name)) continue;
      const full = path.join(folder, name);
      let size: number;
      try {
        size = fs.statSync(full).size;
      } catch {
        continue;
      }
      const seen = growing.get(name);
      if (!seen || seen.size !== size) {
        growing.set(name, { size, since: t });
        continue;
      }
      if (t - seen.since < FILE_STABLE_MS || !readable(full)) continue;
      growing.delete(name);
      known.add(name);
      batch.push(name);
      clearTimeout(batchTimer);
      batchTimer = setTimeout(flush, settleMs);
    }
    for (const name of [...growing.keys()]) if (!present.has(name)) growing.delete(name);
    if (forgot && !batchTimer) save();
  };

  const poll = setInterval(scan, FILE_POLL_MS);
  scan();
  return {
    stop() {
      stopped = true;
      clearInterval(poll);
      clearTimeout(batchTimer);
      fsWatcher?.close();
    },
  };
}

// ── schedule ──

const CLOCK_TICK_MS = 1000;

export function watchClock(trigger: ScheduleTrigger, fire: Fire): Watcher {
  if (trigger.at) {
    const at = parseScheduleAt(trigger.at);
    if (!at) throw new Error(`schedule.at "${trigger.at}" is not a time`);
    let next = nextScheduleTime(at, new Date());
    // a 1s tick instead of one long timer: it survives sleep / clock changes without drifting
    const tick = setInterval(() => {
      const current = new Date();
      if (current < next) return;
      next = nextScheduleTime(at, current);
      fire({ trigger: 'schedule', at: current.toISOString(), spec: trigger.at! });
    }, CLOCK_TICK_MS);
    return { stop: () => clearInterval(tick) };
  }
  const every = parseDuration(trigger.every);
  if (!every) throw new Error(`schedule.every "${String(trigger.every)}" is not a duration`);
  const timer = setInterval(() => fire({ trigger: 'schedule', at: now(), spec: `every ${trigger.every}` }), every);
  return { stop: () => clearInterval(timer) };
}

// ── web ──

const MIN_POLL_MS = 5000;
const MAX_DIFF_LINES = 200;

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

/** A page's visible text, one line per block element; table cells joined by " | ". */
export function visibleLines(html: string): string[] {
  return html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<(br|hr)\b[^>]*>|<\/(p|div|li|tr|h[1-6]|section|article|header|footer|table|ul|ol|dt|dd|caption|main|nav)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (entity) => ENTITIES[entity] ?? entity)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').replace(/(\s*\|\s*)+$/, '').replace(/^(\s*\|\s*)+/, '').trim())
    .filter(Boolean);
}

export function watchPage(trigger: WebTrigger, fire: Fire, state: StateSlot<{ hash: string; lines: string[] }>, log: Log): Watcher {
  const every = Math.max(MIN_POLL_MS, parseDuration(trigger.every ?? TRIGGER_DEFAULTS.webEvery) ?? 300_000);
  let busy = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(trigger.url, { headers: { 'User-Agent': 'agentry-watch', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        log(`web: ${trigger.url} answered ${res.status}`);
        return;
      }
      const lines = visibleLines(await res.text());
      const hash = createHash('sha256').update(lines.join('\n')).digest('hex');
      const before = state.get();
      if (before?.hash === hash) return;
      state.set({ hash, lines });
      if (!before) {
        if (trigger.initial) fire({ trigger: 'web', at: now(), url: trigger.url, first: true, added: lines.slice(0, MAX_DIFF_LINES), removed: [] });
        return;
      }
      const old = new Set(before.lines);
      const fresh = new Set(lines);
      fire({
        trigger: 'web',
        at: now(),
        url: trigger.url,
        first: false,
        added: lines.filter((line) => !old.has(line)).slice(0, MAX_DIFF_LINES),
        removed: before.lines.filter((line) => !fresh.has(line)).slice(0, MAX_DIFF_LINES),
      });
    } catch (err) {
      log(`web: ${trigger.url}: ${errorText(err)}`);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void poll(), every);
  void poll();
  return { stop: () => clearInterval(timer) };
}

// ── git ──

const GIT_POLL_MS = 2000;

function git(repo: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['-C', repo, ...args], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

async function commitsBetween(repo: string, before: string | null, after: string): Promise<GitCommitSummary[]> {
  const range = before ? [`${before}..${after}`] : ['-n', '10', after];
  try {
    const out = await git(repo, ['log', '--format=%H%x1f%an%x1f%s', '--max-count=50', ...range]);
    return out.split('\n').filter(Boolean).map((line) => {
      const [sha = '', author = '', subject = ''] = line.split('\x1f');
      return { sha, author, subject };
    });
  } catch {
    // e.g. a force-push dropped `before` from the object store
    return [];
  }
}

export function watchRepo(trigger: GitTrigger, root: string, fire: Fire, state: StateSlot<{ refs: Record<string, string> }>, log: Log): Watcher {
  const repo = expandPath(trigger.repo, root);
  const event = trigger.event ?? 'push';
  const prefix = event === 'push' ? 'refs/remotes/' : 'refs/heads/';
  const branches = asPatternList(trigger.branch);
  const branchOf = (ref: string) => (event === 'push' ? ref.slice(prefix.length).replace(/^[^/]+\//, '') : ref.slice(prefix.length));
  let busy = false;
  let failing = false;
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const out = await git(repo, ['for-each-ref', '--format=%(refname) %(objectname)', prefix]);
      failing = false;
      const refs: Record<string, string> = {};
      for (const line of out.split('\n')) {
        const [ref, sha] = line.trim().split(' ');
        if (!ref || !sha || ref.endsWith('/HEAD')) continue;
        if (branches.length && !branches.some((b) => matchesGlob(branchOf(ref), b))) continue;
        refs[ref] = sha;
      }
      const before = state.get()?.refs;
      state.set({ refs });
      if (!before) return;
      for (const [ref, sha] of Object.entries(refs)) {
        if (before[ref] === sha) continue;
        const previous = before[ref] ?? null;
        fire({ trigger: 'git', at: now(), repo, event, ref: branchOf(ref), before: previous, after: sha, commits: await commitsBetween(repo, previous, sha) });
      }
    } catch (err) {
      if (!failing) log(`git: ${repo}: ${errorText(err)}`);
      failing = true;
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void poll(), GIT_POLL_MS);
  void poll();
  return { stop: () => clearInterval(timer) };
}

// ── mail ──

/** After new mail, look again this soon; mail that arrives together fires as one batch. */
const MAIL_FOLLOW_UP_MS = 2000;
/** ...but never hold a batch back longer than this while mail keeps coming. */
const MAIL_BATCH_MAX_MS = 15_000;

export function watchMailbox(trigger: MailTrigger, api: GmailApi, fire: Fire, state: StateSlot<{ historyId: string }>, log: Log): Watcher {
  const every = Math.max(MIN_POLL_MS, parseDuration(trigger.every ?? TRIGGER_DEFAULTS.mailEvery) ?? 15_000);
  let busy = false;
  let failing = false;
  let pending: MailSummary[] = [];
  let pendingSince = 0;
  let followUp: NodeJS.Timeout | undefined;
  const flush = () => {
    const batch = pending;
    pending = [];
    if (batch.length) fire({ trigger: 'mail', at: now(), messages: batch });
  };
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const start = state.get()?.historyId;
      if (!start) {
        state.set({ historyId: await api.historyId() });
        return;
      }
      const result = await api.added(start);
      if (result === 'expired') {
        state.set({ historyId: await api.historyId() });
        log('mail: the saved Gmail history point expired — starting over from now');
        return;
      }
      const matching = result.ids.length && trigger.query ? await api.search(trigger.query) : null;
      const messages: MailSummary[] = [];
      for (const id of result.ids) {
        if (matching && !matching.has(id)) continue;
        const { labels, ...message } = await api.message(id);
        // only mail that arrived: not the drafts and replies a workflow writes itself
        if (!labels.includes('INBOX') || labels.includes('DRAFT') || labels.includes('SENT')) continue;
        messages.push(message);
      }
      // advance only after every message was read, so a failed fetch is retried next poll
      state.set({ historyId: result.historyId });
      failing = false;
      // several messages sent at once rarely land in a single poll: hold them, look again shortly,
      // and fire the batch once a look finds nothing more
      if (messages.length) {
        if (!pending.length) pendingSince = Date.now();
        pending.push(...messages);
        clearTimeout(followUp);
        if (Date.now() - pendingSince >= MAIL_BATCH_MAX_MS) flush();
        else followUp = setTimeout(() => void poll(), MAIL_FOLLOW_UP_MS);
      } else {
        flush();
      }
    } catch (err) {
      if (!failing) log(`mail: ${errorText(err)}`);
      failing = true;
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void poll(), every);
  void poll();
  return {
    stop() {
      clearInterval(timer);
      clearTimeout(followUp);
    },
  };
}
