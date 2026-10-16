/**
 * Workflow-level triggers — the top-level `on:` block: WHEN a workflow starts
 * by itself. `agentry-watch` (packages/trigger) watches for these and
 * dispatches the run; the editor shows / edits them on the IN port. The plugin
 * runner never reads `on:` — it receives the fired {@link TriggerEvent} as the
 * run's input, handed to the entry nodes.
 *
 * Pure: types, parsers and checks only, so the editor and the watcher share
 * one definition of what a valid trigger is.
 */

/** Folder watch: fires when new files land (and finish downloading) in `path`. */
export interface FileTrigger {
  /** Folder to watch: absolute, `~/…`, or relative to the project root. */
  path: string;
  /** Only file names matching one of these globs fire (`*.pdf`). Default: every file. */
  match?: string | string[];
  /** File names that never fire, on top of in-progress downloads (see {@link PARTIAL_FILE_GLOBS}). */
  ignore?: string | string[];
  /** Files arriving within this window start ONE run together. Duration, default "3s". */
  settle?: string;
}

/** Clock: a calendar time (`at`) or a fixed interval (`every`) — exactly one of them. */
export interface ScheduleTrigger {
  /** Local time, optionally with days: "17:00", "Fri 17:00", "Mon-Fri 08:30", "Mon,Wed 09:00". */
  at?: string;
  /** Fixed interval: "30s", "15m", "2h". */
  every?: string;
}

/** Web page watch: fires when the page's visible text changes. */
export interface WebTrigger {
  /** Page to watch (http/https). */
  url: string;
  /** Poll interval, default "5m". */
  every?: string;
  /** Also fire once when the watcher starts (a first full sync), not only on later changes. */
  initial?: boolean;
}

/** Mailbox watch: fires when new mail arrives. */
export interface MailTrigger {
  /** Mailbox provider. v1: Gmail through the OAuth token in ~/.agentry/google-token.json. */
  provider?: 'gmail';
  /** Only new mail matching this search fires (Gmail query syntax), e.g. "in:inbox -category:promotions". */
  query?: string;
  /** Poll interval, default "15s". */
  every?: string;
}

/** Git repository watch: fires when a branch moves. */
export interface GitTrigger {
  /** Repository to watch: absolute, `~/…`, or relative to the project root. */
  repo: string;
  /** "push" (default): a remote-tracking branch moved — you pushed. "commit": a local branch moved. */
  event?: 'push' | 'commit';
  /** Only these branches fire. Default: every branch. */
  branch?: string | string[];
}

/** The top-level `on:` block. Several kinds may be set; any one of them starts the workflow. */
export interface WorkflowTriggers {
  file?: FileTrigger;
  schedule?: ScheduleTrigger;
  web?: WebTrigger;
  mail?: MailTrigger;
  git?: GitTrigger;
}

export type TriggerKind = keyof WorkflowTriggers;

export const TRIGGER_KINDS: readonly TriggerKind[] = ['file', 'schedule', 'web', 'mail', 'git'];

/** Names a browser or editor gives a file while it is still being written; never fired. */
export const PARTIAL_FILE_GLOBS: readonly string[] = ['*.crdownload', '*.part', '*.partial', '*.download', '*.tmp', '~$*', '.~lock.*', 'desktop.ini', '.DS_Store', 'Thumbs.db'];

export const TRIGGER_DEFAULTS = {
  fileSettle: '3s',
  webEvery: '5m',
  mailEvery: '15s',
} as const;

/** One message as the mail trigger reports it. */
export interface MailSummary {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  /** Plain-text body, trimmed to a few thousand characters. */
  body: string;
}

export interface GitCommitSummary {
  sha: string;
  author: string;
  subject: string;
}

/** What a fired trigger hands the run (as its input, JSON). `at` = ISO time it fired. */
export type TriggerEvent =
  | { trigger: 'file'; at: string; folder: string; files: string[] }
  | { trigger: 'schedule'; at: string; spec: string }
  | { trigger: 'web'; at: string; url: string; first: boolean; added: string[]; removed: string[] }
  | { trigger: 'mail'; at: string; messages: MailSummary[] }
  | { trigger: 'git'; at: string; repo: string; event: 'push' | 'commit'; ref: string; before: string | null; after: string; commits: GitCommitSummary[] }
  | { trigger: 'manual'; at: string; note?: string };

// ── parsers ──

const DURATION_RE = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)\s*$/i;
const UNIT_MS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "30s" / "15m" / "2h" / "1d" / "500ms" → milliseconds; null when malformed or not positive. */
export function parseDuration(text: string | undefined): number | null {
  if (typeof text !== 'string') return null;
  const match = DURATION_RE.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const ms = Number(match[1]) * (UNIT_MS[match[2].toLowerCase()] ?? NaN);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
}

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const dayIndex = (token: string): number => DAY_NAMES.indexOf(token.slice(0, 3).toLowerCase());

/** A parsed `schedule.at`: local hour/minute plus the weekdays it fires on (0 = Sunday). */
export interface ScheduleAt {
  hour: number;
  minute: number;
  /** null = every day. */
  days: ReadonlySet<number> | null;
}

/** "17:00" | "Fri 17:00" | "Mon-Fri 08:30" | "Mon,Wed,Fri 09:00" | "weekdays 08:00" | "daily 07:00" → parsed; null when malformed. */
export function parseScheduleAt(text: string | undefined): ScheduleAt | null {
  if (typeof text !== 'string') return null;
  const match = /^\s*(?:([A-Za-z][A-Za-z,\- ]*?)\s+)?(\d{1,2}):(\d{2})\s*$/.exec(text);
  if (!match?.[2] || !match[3]) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) return null;
  const dayText = match[1]?.trim().toLowerCase();
  if (!dayText || dayText === 'daily' || dayText === 'every day') return { hour, minute, days: null };
  if (dayText === 'weekdays') return { hour, minute, days: new Set([1, 2, 3, 4, 5]) };
  if (dayText === 'weekends') return { hour, minute, days: new Set([0, 6]) };
  const days = new Set<number>();
  for (const part of dayText.split(',').map((p) => p.trim()).filter(Boolean)) {
    const range = part.split('-').map((p) => p.trim());
    if (range.length === 2 && range[0] && range[1]) {
      const from = dayIndex(range[0]);
      const to = dayIndex(range[1]);
      if (from < 0 || to < 0) return null;
      for (let d = from; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === to) break;
      }
    } else if (range.length === 1 && range[0]) {
      const d = dayIndex(range[0]);
      if (d < 0) return null;
      days.add(d);
    } else {
      return null;
    }
  }
  return days.size ? { hour, minute, days } : null;
}

/** The first moment strictly after `after` that matches `at` (local time). */
export function nextScheduleTime(at: ScheduleAt, after: Date): Date {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(after.getFullYear(), after.getMonth(), after.getDate() + offset, at.hour, at.minute, 0, 0);
    if (candidate.getTime() <= after.getTime()) continue;
    if (at.days && !at.days.has(candidate.getDay())) continue;
    return candidate;
  }
  // unreachable for a valid ScheduleAt (some day within 8 matches); keep the type total
  return new Date(after.getTime() + 86_400_000);
}

/** Normalize a `string | string[]` option to a list. */
export const asPatternList = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : (Array.isArray(value) ? value : [value]).filter((p) => typeof p === 'string' && p.trim() !== '');

/** Case-insensitive glob over a single file NAME: `*` any run, `?` one char. */
export function matchesGlob(name: string, glob: string): boolean {
  let re = '^';
  for (const ch of glob) {
    if (ch === '*') re += '.*';
    else if (ch === '?') re += '.';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${re}$`, 'i').test(name);
}

/** Does a new file with this name start a run of a `file:` trigger? */
export function fileTriggerAccepts(trigger: FileTrigger, name: string): boolean {
  if (PARTIAL_FILE_GLOBS.some((g) => matchesGlob(name, g))) return false;
  if (asPatternList(trigger.ignore).some((g) => matchesGlob(name, g))) return false;
  const match = asPatternList(trigger.match);
  return match.length === 0 || match.some((g) => matchesGlob(name, g));
}

/** A one-line human summary of a trigger, e.g. for the canvas IN port and logs. */
export function describeTrigger(kind: TriggerKind, triggers: WorkflowTriggers): string {
  switch (kind) {
    case 'file': {
      const t = triggers.file;
      const match = asPatternList(t?.match);
      return `New file in ${t?.path ?? '?'}${match.length ? ` (${match.join(', ')})` : ''}`;
    }
    case 'schedule': {
      const t = triggers.schedule;
      return t?.at ? `At ${t.at}` : `Every ${t?.every ?? '?'}`;
    }
    case 'web': {
      const t = triggers.web;
      let host = t?.url ?? '?';
      try {
        if (t?.url) host = new URL(t.url).host;
      } catch {
        // keep the raw text; validation reports the bad URL
      }
      return `${host} changes`;
    }
    case 'mail': {
      const t = triggers.mail;
      return `New mail${t?.query ? ` (${t.query})` : ''}`;
    }
    case 'git': {
      const t = triggers.git;
      const event = t?.event ?? 'push';
      const branches = asPatternList(t?.branch);
      return `${event === 'push' ? 'Push' : 'Commit'} to ${t?.repo ?? '?'}${branches.length ? ` @ ${branches.join(', ')}` : ''}`;
    }
  }
}

export interface TriggerProblem {
  kind: TriggerKind | 'on';
  field?: string;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringList = (value: unknown): boolean =>
  value === undefined || typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'));

/** Structural check of a parsed `on:` block. Empty list = valid. */
export function checkTriggers(raw: unknown): TriggerProblem[] {
  const problems: TriggerProblem[] = [];
  if (raw === undefined) return problems;
  if (!isRecord(raw)) return [{ kind: 'on', message: '`on` must map a trigger kind (file, schedule, web, mail, git) to its settings.' }];

  for (const key of Object.keys(raw)) {
    if (!(TRIGGER_KINDS as readonly string[]).includes(key)) {
      problems.push({ kind: 'on', field: key, message: `Unknown trigger "${key}" — expected one of ${TRIGGER_KINDS.join(', ')}.` });
    }
  }
  const settings = (kind: TriggerKind): Record<string, unknown> | null => {
    const value = raw[kind];
    if (value === undefined) return null;
    if (!isRecord(value)) {
      problems.push({ kind, message: `on.${kind} must be an object of settings.` });
      return null;
    }
    return value;
  };
  const duration = (kind: TriggerKind, field: string, value: unknown) => {
    if (value === undefined) return;
    if (typeof value !== 'string' || parseDuration(value) === null) {
      problems.push({ kind, field, message: `on.${kind}.${field} "${String(value)}" is not a duration like 30s, 15m or 2h.` });
    }
  };

  const file = settings('file');
  if (file) {
    if (typeof file.path !== 'string' || !file.path.trim()) problems.push({ kind: 'file', field: 'path', message: 'on.file needs the folder to watch (path).' });
    if (!isStringList(file.match)) problems.push({ kind: 'file', field: 'match', message: 'on.file.match must be a glob or a list of globs.' });
    if (!isStringList(file.ignore)) problems.push({ kind: 'file', field: 'ignore', message: 'on.file.ignore must be a glob or a list of globs.' });
    duration('file', 'settle', file.settle);
  }

  const schedule = settings('schedule');
  if (schedule) {
    const hasAt = schedule.at !== undefined;
    const hasEvery = schedule.every !== undefined;
    if (hasAt === hasEvery) {
      problems.push({ kind: 'schedule', message: 'on.schedule needs exactly one of `at` (a time like "Fri 17:00") or `every` (an interval like "15m").' });
    } else if (hasAt && (typeof schedule.at !== 'string' || !parseScheduleAt(schedule.at))) {
      problems.push({ kind: 'schedule', field: 'at', message: `on.schedule.at "${String(schedule.at)}" is not a time like "17:00", "Fri 17:00" or "Mon-Fri 08:30".` });
    } else {
      duration('schedule', 'every', schedule.every);
    }
  }

  const web = settings('web');
  if (web) {
    let ok = false;
    if (typeof web.url === 'string') {
      try {
        const url = new URL(web.url);
        ok = url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        ok = false;
      }
    }
    if (!ok) problems.push({ kind: 'web', field: 'url', message: 'on.web needs an http(s) url to watch.' });
    duration('web', 'every', web.every);
    if (web.initial !== undefined && typeof web.initial !== 'boolean') problems.push({ kind: 'web', field: 'initial', message: 'on.web.initial must be true or false.' });
  }

  const mail = settings('mail');
  if (mail) {
    if (mail.provider !== undefined && mail.provider !== 'gmail') problems.push({ kind: 'mail', field: 'provider', message: `on.mail.provider "${String(mail.provider)}" is not supported (only gmail).` });
    if (mail.query !== undefined && typeof mail.query !== 'string') problems.push({ kind: 'mail', field: 'query', message: 'on.mail.query must be a search string.' });
    duration('mail', 'every', mail.every);
  }

  const git = settings('git');
  if (git) {
    if (typeof git.repo !== 'string' || !git.repo.trim()) problems.push({ kind: 'git', field: 'repo', message: 'on.git needs the repository to watch (repo).' });
    if (git.event !== undefined && git.event !== 'push' && git.event !== 'commit') problems.push({ kind: 'git', field: 'event', message: `on.git.event "${String(git.event)}" must be push or commit.` });
    if (!isStringList(git.branch)) problems.push({ kind: 'git', field: 'branch', message: 'on.git.branch must be a branch name or a list of them.' });
  }

  return problems;
}

/** The trigger kinds that are actually set, in canonical order. */
export const activeTriggerKinds = (triggers: WorkflowTriggers | undefined): TriggerKind[] =>
  triggers ? TRIGGER_KINDS.filter((kind) => triggers[kind] !== undefined) : [];
