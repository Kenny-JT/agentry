/**
 * agentry-watch — starts a project's workflows by themselves when their `on:` triggers fire.
 *
 *   agentry-watch [--dir <project>]            watch every workflows/*.yaml with an `on:` block
 *   agentry-watch list [--dir <project>]       show what would be watched
 *   agentry-watch fire <workflow.yaml> [--input <text>] [--wait]
 *   agentry-watch auth google [--client <client.json>] [--browser <exe>] [--browser-profile <dir>]
 *
 * Runs go to the opencode server at --server (default http://127.0.0.1:4096, OPENCODE_SERVER_PASSWORD
 * for auth), which is started when nothing listens there (--no-autostart to refuse). Set
 * AGENTRY_OPENCODE_START to a script that starts it your own way.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseYaml } from 'yaml';
import { activeTriggerKinds, checkTriggers, describeTrigger, type TriggerEvent, type TriggerKind, type WorkflowTriggers } from '@agentry/core';
import { Dispatcher } from './dispatch';
import { DEFAULT_SCOPES, authorizeGoogle, defaultGoogleFiles, gmailApi, googleAccess } from './google';
import { watchClock, watchFolder, watchMailbox, watchPage, watchRepo, type StateSlot, type Watcher } from './watchers';

export { Dispatcher } from './dispatch';
export { DEFAULT_SCOPES, authorizeGoogle, defaultGoogleFiles, gmailApi, googleAccess } from './google';
export { visibleLines, watchClock, watchFolder, watchMailbox, watchPage, watchRepo } from './watchers';

const USAGE = `agentry-watch — start a project's workflows when their \`on:\` triggers fire

  agentry-watch [--dir <project>] [--dry-run]     watch every workflows/*.yaml that has an on: block
  agentry-watch list [--dir <project>]            show what would be watched
  agentry-watch fire <workflow.yaml> [--input <text>] [--wait]
  agentry-watch auth google [--client <client.json>] [--browser <exe>] [--browser-profile <dir>]

  --server <url>     opencode server to run in (default http://127.0.0.1:4096; auth: OPENCODE_SERVER_PASSWORD)
  --no-autostart     do not start the server when nothing listens there
  AGENTRY_OPENCODE_START=<script>   start the server with your own script instead of \`opencode serve\``;

const stamp = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

function makeLogger(projectDir: string) {
  const file = path.join(projectDir, '.agentry', 'watch.log');
  return (message: string) => {
    const line = `[${stamp()}] ${message}`;
    console.log(line);
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
    } catch {
      // the console line is enough
    }
  };
}

/** One JSON file of watcher memory per project; writes are coalesced. */
class StateStore {
  private data: Record<string, unknown>;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly file: string) {
    try {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch {
      this.data = {};
    }
  }

  slot<T>(key: string): StateSlot<T> {
    return {
      get: () => this.data[key] as T | undefined,
      set: (value) => {
        this.data[key] = value;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 200);
      },
    };
  }

  flush() {
    clearTimeout(this.timer);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

interface WatchedWorkflow {
  /** Path relative to the project root, as handed to the plugin. */
  file: string;
  on: WorkflowTriggers;
}

function loadWatched(projectDir: string, log: (m: string) => void): WatchedWorkflow[] {
  const dir = path.join(projectDir, 'workflows');
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).sort();
  } catch {
    log(`no workflows/ folder in ${projectDir}`);
    return [];
  }
  const watched: WatchedWorkflow[] = [];
  for (const name of files) {
    const rel = path.posix.join('workflows', name);
    let raw: unknown;
    try {
      raw = parseYaml(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      log(`${rel}: YAML error — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    const on = (raw as { on?: unknown } | null)?.on;
    if (on === undefined) continue;
    const problems = checkTriggers(on);
    if (problems.length) {
      for (const p of problems) log(`${rel}: ${p.message} — not watched`);
      continue;
    }
    if (activeTriggerKinds(on as WorkflowTriggers).length) watched.push({ file: rel, on: on as WorkflowTriggers });
  }
  return watched;
}

const endLine = (runId: string, end: 'idle' | 'gone') =>
  end === 'idle'
    ? `■ ${runId} finished`
    : `✗ ${runId} lost: the opencode server stopped answering mid-run — its checkpoint is in .agentry/runs/${runId} (Resume in the panel, or fire again)`;

function summarize(event: TriggerEvent): string {
  switch (event.trigger) {
    case 'file':
      return `${event.files.length} new file(s): ${event.files.map((f) => path.basename(f)).join(', ')}`;
    case 'schedule':
      return `it is ${event.spec}`;
    case 'web':
      return event.first ? `first look at ${event.url}` : `${event.url} changed (+${event.added.length} / -${event.removed.length} lines)`;
    case 'mail':
      return `${event.messages.length} new mail: ${event.messages.map((m) => `"${m.subject}"`).join(', ')}`;
    case 'git':
      return `${event.event} to ${event.ref} (${event.commits.length} commit(s))`;
    case 'manual':
      return 'started by hand';
  }
}

function makeDispatcher(projectDir: string, values: { server?: string; 'no-autostart'?: boolean }, log: (m: string) => void) {
  return new Dispatcher({
    projectDir,
    serverUrl: (values.server ?? process.env.AGENTRY_OPENCODE_URL ?? 'http://127.0.0.1:4096').replace(/\/+$/, ''),
    password: process.env.OPENCODE_SERVER_PASSWORD,
    autostart: !values['no-autostart'],
    startScript: process.env.AGENTRY_OPENCODE_START,
    opencodeBin: process.env.AGENTRY_OPENCODE_BIN,
    log,
  });
}

/** One watcher per project — a second would double every run. */
function takeLock(projectDir: string): boolean {
  const file = path.join(projectDir, '.agentry', 'watch.lock');
  try {
    const pid = Number(fs.readFileSync(file, 'utf8'));
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        // stale lock from a dead watcher
      }
    }
  } catch {
    // no lock yet
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(process.pid));
  process.once('exit', () => {
    try {
      if (fs.readFileSync(file, 'utf8') === String(process.pid)) fs.unlinkSync(file);
    } catch {
      // already gone
    }
  });
  return true;
}

async function watch(projectDir: string, values: { server?: string; 'no-autostart'?: boolean; 'dry-run'?: boolean }) {
  const log = makeLogger(projectDir);
  if (!takeLock(projectDir)) {
    log(`another agentry-watch already watches ${projectDir} — exiting`);
    process.exit(1);
  }
  const store = new StateStore(path.join(projectDir, '.agentry', 'trigger-state.json'));
  const dispatcher = makeDispatcher(projectDir, values, log);
  const queue: Array<{ file: string; event: TriggerEvent }> = [];
  let draining = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    while (queue.length) {
      const item = queue.shift()!;
      try {
        const { runId, port } = await dispatcher.run(item.file, JSON.stringify(item.event, null, 2));
        log(`▶ ${item.file} → ${runId}`);
        log(endLine(runId, await dispatcher.waitUntilIdle(port)));
      } catch (err) {
        log(`✗ ${item.file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    draining = false;
  };

  let watchers: Watcher[] = [];
  let google: ReturnType<typeof gmailApi> | null = null;
  const start = () => {
    const list = loadWatched(projectDir, log);
    for (const wf of list) {
      for (const kind of activeTriggerKinds(wf.on)) {
        const config = wf.on[kind];
        // a changed trigger (say, another folder) starts from a fresh baseline
        const key = `${wf.file}#${kind}#${createHash('sha1').update(JSON.stringify(config)).digest('hex').slice(0, 8)}`;
        const fire = (event: TriggerEvent) => {
          log(`⚡ ${wf.file}: ${summarize(event)}`);
          if (values['dry-run']) return;
          queue.push({ file: wf.file, event });
          void drain();
        };
        try {
          watchers.push(startOne(kind, wf, fire, key));
          log(`watching ${wf.file}: ${describeTrigger(kind, wf.on)}`);
        } catch (err) {
          log(`${wf.file}: cannot watch ${kind} — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
    if (!list.length) log('nothing to watch yet — add an `on:` block to a workflow in workflows/');
  };
  const startOne = (kind: TriggerKind, wf: WatchedWorkflow, fire: (e: TriggerEvent) => void, key: string): Watcher => {
    switch (kind) {
      case 'file':
        return watchFolder(wf.on.file!, projectDir, fire, store.slot(key), log);
      case 'schedule':
        return watchClock(wf.on.schedule!, fire);
      case 'web':
        return watchPage(wf.on.web!, fire, store.slot(key), log);
      case 'git':
        return watchRepo(wf.on.git!, projectDir, fire, store.slot(key), log);
      case 'mail': {
        const files = defaultGoogleFiles();
        if (!fs.existsSync(files.token)) throw new Error(`no Google token at ${files.token} — run: agentry-watch auth google`);
        google ??= gmailApi(googleAccess(files));
        return watchMailbox(wf.on.mail!, google, fire, store.slot(key), log);
      }
    }
  };
  const stop = () => {
    for (const w of watchers) w.stop();
    watchers = [];
  };

  log(`agentry-watch ${projectDir}${values['dry-run'] ? ' (dry run: events are only logged)' : ''}`);
  start();
  let reload: NodeJS.Timeout | undefined;
  try {
    fs.watch(path.join(projectDir, 'workflows'), () => {
      clearTimeout(reload);
      reload = setTimeout(() => {
        log('workflows changed — reloading');
        stop();
        start();
      }, 800);
    });
  } catch {
    // no workflows/ folder: nothing to reload
  }
  const quit = () => {
    stop();
    store.flush();
    process.exit(0);
  };
  process.on('SIGINT', quit);
  process.on('SIGTERM', quit);
}

function openWith(browser: string | undefined, profile: string | undefined): (url: string) => void {
  return (url) => {
    if (browser) {
      spawn(browser, [...(profile ? [`--user-data-dir=${profile}`] : []), url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '""', url.replace(/&/g, '^&')], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else {
      spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  };
}

export async function main(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      server: { type: 'string' },
      'no-autostart': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      input: { type: 'string' },
      wait: { type: 'boolean' },
      client: { type: 'string' },
      browser: { type: 'string' },
      'browser-profile': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const projectDir = path.resolve(values.dir ?? process.cwd());
  const [command, arg] = positionals;

  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (!command) return watch(projectDir, values);

  const log = (message: string) => console.log(`[${stamp()}] ${message}`);
  if (command === 'list') {
    const watched = loadWatched(projectDir, log);
    for (const wf of watched) for (const kind of activeTriggerKinds(wf.on)) console.log(`${wf.file}  ${describeTrigger(kind, wf.on)}`);
    if (!watched.length) console.log('(no workflow in workflows/ has an `on:` block)');
    return;
  }
  if (command === 'fire') {
    if (!arg) throw new Error('usage: agentry-watch fire <workflow.yaml> [--input <text>] [--wait]');
    const dispatcher = makeDispatcher(projectDir, values, log);
    const input = values.input ?? JSON.stringify({ trigger: 'manual', at: new Date().toISOString() } satisfies TriggerEvent, null, 2);
    const { runId, port } = await dispatcher.run(arg.replace(/\\/g, '/'), input);
    log(`▶ ${arg} → ${runId}`);
    if (values.wait) log(endLine(runId, await dispatcher.waitUntilIdle(port)));
    return;
  }
  if (command === 'auth' && arg === 'google') {
    const files = { ...defaultGoogleFiles(), ...(values.client ? { client: path.resolve(values.client) } : {}) };
    if (values.client && files.client !== defaultGoogleFiles().client) {
      // remember the client next to the token, so the watcher and the tools find both
      fs.mkdirSync(path.dirname(defaultGoogleFiles().client), { recursive: true });
      fs.copyFileSync(files.client, defaultGoogleFiles().client);
      files.client = defaultGoogleFiles().client;
    }
    await authorizeGoogle(files, DEFAULT_SCOPES, openWith(values.browser, values['browser-profile']), log);
    return;
  }
  throw new Error(`unknown command "${command}" — try --help`);
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((err: unknown) => {
    console.error(`agentry-watch: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
