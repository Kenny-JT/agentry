/**
 * Getting a fired trigger into a run: make sure an opencode server is up (start one if not),
 * wake the project's instance on it (that loads the Agentry plugin, whose panel server comes up
 * with it and publishes .agentry/panel.json), then POST /api/run with the panel's token. No
 * model call decides whether the run happens.
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

export interface DispatchOptions {
  /** Project root: where workflows/ and .opencode/plugins/agentry.js live. */
  projectDir: string;
  /** The opencode server to run in, e.g. http://127.0.0.1:4096. */
  serverUrl: string;
  /** OPENCODE_SERVER_PASSWORD of that server (username is always "opencode"). */
  password?: string;
  /** Start the server when nothing listens on serverUrl. */
  autostart: boolean;
  /** Script that starts the server your own way (Windows: launched minimized). Else `opencode serve` directly. */
  startScript?: string;
  /** opencode executable for the direct start. */
  opencodeBin?: string;
  log: (message: string) => void;
}

interface PanelInfo {
  port: number;
  token: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function listening(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function defaultOpencodeBin(): string {
  if (process.platform === 'win32' && process.env.APPDATA) {
    const exe = path.join(process.env.APPDATA, 'npm', 'node_modules', 'opencode-ai', 'bin', 'opencode.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return 'opencode';
}

export class Dispatcher {
  private readonly host: string;
  private readonly port: number;

  constructor(private readonly opts: DispatchOptions) {
    const url = new URL(opts.serverUrl);
    this.host = url.hostname;
    this.port = Number(url.port || 80);
  }

  private authHeader(): Record<string, string> {
    return this.opts.password ? { Authorization: `Basic ${Buffer.from(`opencode:${this.opts.password}`).toString('base64')}` } : {};
  }

  async ensureServer(): Promise<void> {
    if (await listening(this.host, this.port)) return;
    if (!this.opts.autostart) throw new Error(`no opencode server on ${this.opts.serverUrl} (autostart is off)`);
    this.opts.log(`no opencode server on ${this.opts.serverUrl} — starting one`);
    this.startServer();
    for (let i = 0; i < 40; i += 1) {
      await sleep(500);
      if (await listening(this.host, this.port)) {
        this.opts.log(`opencode server is up on ${this.opts.serverUrl}`);
        return;
      }
    }
    throw new Error(`started an opencode server but nothing listens on ${this.opts.serverUrl} after 20s`);
  }

  private startServer() {
    const { startScript } = this.opts;
    if (startScript) {
      if (process.platform === 'win32') {
        // Start-Process gives the script its own console that outlives us (the user's convention for
        // the shared 4096 server). The PowerShell in between must NOT be `detached`: without a console
        // its Start-Process exits 0 and starts nothing (measured).
        const quoted = startScript.replace(/'/g, "''");
        spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process -FilePath '${quoted}' -WindowStyle Minimized`], { stdio: 'ignore', windowsHide: true }).unref();
      } else {
        spawn(startScript, [], { detached: true, stdio: 'ignore' }).unref();
      }
      return;
    }
    const logFile = path.join(this.opts.projectDir, '.agentry', 'opencode-serve.log');
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const out = fs.openSync(logFile, 'a');
    spawn(this.opts.opencodeBin ?? defaultOpencodeBin(), ['serve', '--port', String(this.port), '--hostname', this.host], {
      cwd: os.homedir(),
      detached: true,
      stdio: ['ignore', out, out],
      windowsHide: true,
    }).unref();
    fs.closeSync(out);
  }

  /**
   * Any request naming the directory makes the server load that project (plugins included).
   * opencode 2 names it as an API location (`/api/...?location[directory]=`); opencode 1 answers
   * `/path?directory=`. A 2.x server answers that old path too — with its web app, loading
   * nothing — so the 2.x route goes first and only a reply that is not its JSON falls back.
   * The first load of a project can also install the plugin's dependency into `.opencode/`,
   * which takes a minute or two, hence the long wait.
   */
  private async wakeProject(): Promise<void> {
    const dir = encodeURIComponent(this.opts.projectDir);
    const v2 = await this.wakeRequest(`${this.opts.serverUrl}/api/agent?location[directory]=${dir}`);
    if (v2.ok && v2.headers.get('content-type')?.includes('application/json')) return;
    const v1 = await this.wakeRequest(`${this.opts.serverUrl}/path?directory=${dir}`);
    if (!v1.ok) throw new Error(`opencode server ${this.opts.serverUrl} answered ${v1.status} for ${v1.url}`);
  }

  private async wakeRequest(url: string): Promise<Response> {
    const wakeMs = 5 * 60_000;
    let res: Response;
    try {
      res = await fetch(url, { headers: this.authHeader(), signal: AbortSignal.timeout(wakeMs) });
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new Error(`opencode did not finish loading ${this.opts.projectDir} within ${wakeMs / 60_000} minutes (the first start of a project installs the plugin's dependency; try again once it is done)`);
      }
      throw err;
    }
    if (res.status === 401) {
      throw new Error(this.opts.password
        ? `opencode server ${this.opts.serverUrl} rejected the password (OPENCODE_SERVER_PASSWORD)`
        : `opencode server ${this.opts.serverUrl} wants a password: start it with OPENCODE_SERVER_PASSWORD set and give Agentry the same value`);
    }
    return res;
  }

  private readPanelFile(): PanelInfo | null {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(this.opts.projectDir, '.agentry', 'panel.json'), 'utf8')) as Partial<PanelInfo>;
      return typeof raw.port === 'number' && typeof raw.token === 'string' && raw.token ? { port: raw.port, token: raw.token } : null;
    } catch {
      return null;
    }
  }

  private async health(port: number): Promise<{ app?: string; busy?: boolean; runId?: string } | null> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok ? ((await res.json()) as { app?: string; busy?: boolean; runId?: string }) : null;
    } catch {
      return null;
    }
  }

  /** The live Agentry panel of this project, waking the project on the server if needed. */
  async panel(): Promise<PanelInfo> {
    const live = async () => {
      const info = this.readPanelFile();
      return info && (await this.health(info.port))?.app === 'agentry' ? info : null;
    };
    const ready = await live();
    if (ready) return ready;
    await this.ensureServer();
    await this.wakeProject();
    for (let i = 0; i < 60; i += 1) {
      const info = await live();
      if (info) return info;
      await sleep(500);
    }
    throw new Error(`the project loaded but no Agentry panel came up — is .opencode/plugins/agentry.js in ${this.opts.projectDir}?`);
  }

  /** Start one run; resolves with its id once the plugin accepted it (it then runs on its own). */
  async run(workflow: string, input: string): Promise<{ runId: string; port: number }> {
    let retriedAuth = false;
    for (;;) {
      const panel = await this.panel();
      const res = await fetch(`http://127.0.0.1:${panel.port}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Agentry-Token': panel.token },
        body: JSON.stringify({ workflow, input }),
      });
      const body = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
      if (res.status === 202 && body.runId) return { runId: body.runId, port: panel.port };
      if (res.status === 409) {
        this.opts.log(`a run is already going (${body.runId ?? '?'}) — waiting for it`);
        await this.waitUntilIdle(panel.port);
        continue;
      }
      if (res.status === 401 && !retriedAuth) {
        retriedAuth = true; // the panel restarted with a new token since we read panel.json
        continue;
      }
      throw new Error(`run refused (${res.status}): ${body.error ?? 'no reason given'}`);
    }
  }

  /** 'idle' once the panel's run ended; 'gone' when the panel stops answering — its opencode server died mid-run. */
  async waitUntilIdle(port: number, timeoutMs = 2 * 60 * 60_000): Promise<'idle' | 'gone'> {
    const until = Date.now() + timeoutMs;
    let misses = 0;
    while (Date.now() < until) {
      const state = await this.health(port);
      if (state?.busy === false) return 'idle';
      misses = state ? 0 : misses + 1;
      if (misses >= 3) return 'gone';
      await sleep(1000);
    }
    throw new Error('the run did not finish within 2 hours');
  }
}
