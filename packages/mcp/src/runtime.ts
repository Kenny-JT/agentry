/**
 * Which host executes a run. `opencode` goes through the opencode server and the plugin
 * (the dispatcher); `claude` and `codex` run the same scheduler in this process, each
 * node a headless CLI call on the user's own account.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ToolError } from './project';

export type Runtime = 'opencode' | 'claude' | 'codex';
export type RuntimeChoice = Runtime | 'auto';

export const RUNTIMES: readonly Runtime[] = ['opencode', 'claude', 'codex'];

export const isRuntime = (v: string): v is Runtime => (RUNTIMES as readonly string[]).includes(v);

/** The MCP client name from `initialize`: Claude Code, Codex and opencode each map to themselves; any other host to nothing. */
export function runtimeFromClientName(name: string | undefined): Runtime | null {
  const lower = (name ?? '').toLowerCase();
  if (/claude[-_ ]?code/.test(lower)) return 'claude';
  if (lower.includes('codex')) return 'codex';
  if (lower.includes('opencode')) return 'opencode';
  return null;
}

/** The project carries the opencode plugin (`.opencode/plugins/agentry.js`, or `.ts` in a dev checkout). */
export function hasOpencodePlugin(projectDir: string): boolean {
  const dir = path.join(projectDir, '.opencode', 'plugins');
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => /^agentry\.(js|ts)$/.test(f));
}

export interface RuntimeContext {
  projectDir: string;
  /** The connected MCP client's name. */
  clientName?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * `auto` takes AGENTRY_RUNTIME first (set in the server's config, so it is the user's own
 * choice); a project set up for opencode stays there, whoever calls; otherwise the MCP client
 * that connected picks its own CLI, and anything else goes to opencode as before.
 */
export function resolveRuntime(choice: RuntimeChoice | undefined, ctx: RuntimeContext): Runtime {
  if (choice && choice !== 'auto') return choice;
  const env = ctx.env ?? process.env;
  const fromEnv = env.AGENTRY_RUNTIME?.trim().toLowerCase();
  if (fromEnv) {
    if (fromEnv === 'claude_code' || fromEnv === 'claude-code') return 'claude';
    if (isRuntime(fromEnv)) return fromEnv;
    throw new ToolError(`AGENTRY_RUNTIME="${env.AGENTRY_RUNTIME}" is not one of ${RUNTIMES.join(', ')}`);
  }
  if (hasOpencodePlugin(ctx.projectDir)) return 'opencode';
  return runtimeFromClientName(ctx.clientName) ?? 'opencode';
}
