/**
 * agentry-mcp — a stdio MCP server over one Agentry project.
 *
 *   agentry-mcp [--dir <project>]     default: cwd, or AGENTRY_PROJECT_DIR
 *   agentry-mcp run <file> [...]      one run from a terminal, waited for
 *
 * stdout is the protocol; everything we have to say goes to stderr. Runs go to the opencode
 * server at AGENTRY_OPENCODE_URL (default http://127.0.0.1:4096, auth OPENCODE_SERVER_PASSWORD),
 * started when nothing listens there (AGENTRY_OPENCODE_AUTOSTART=0 to refuse;
 * AGENTRY_OPENCODE_START / AGENTRY_OPENCODE_BIN to start it your own way). A run on Claude Code,
 * Codex or omo instead executes in this process, one headless CLI call per step.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Project } from './project';
import { Runs } from './runs';
import { isRuntime, RUNTIMES, type RuntimeChoice } from './runtime';
import { SERVER_INFO, createServer } from './server';

const USAGE = `agentry-mcp — MCP server (stdio) to list, edit, validate, run and watch one project's Agentry workflows

  agentry-mcp [--dir <project>]      project root (default: cwd or AGENTRY_PROJECT_DIR)
  agentry-mcp run <file> [--dir <project>] [--runtime opencode|claude|codex|omo] [--input <text>] [--json]
                                     run one workflow from a terminal and wait for it; exit 1 if it fails

  AGENTRY_OPENCODE_URL        opencode server runs go to (default http://127.0.0.1:4096)
  OPENCODE_SERVER_PASSWORD    its password (user is "opencode")
  AGENTRY_OPENCODE_AUTOSTART  "0" = never start a server when none listens
  AGENTRY_OPENCODE_START      script that starts the server your own way
  AGENTRY_OPENCODE_BIN        opencode executable for the direct start

  AGENTRY_RUNTIME             where runs execute: opencode | claude | codex | omo (default: opencode when the
                              project has the plugin, else the host you call from, else opencode)
  AGENTRY_CLAUDE_BIN          claude executable; AGENTRY_CLAUDE_MODEL, AGENTRY_CLAUDE_PERMISSION_MODE
  AGENTRY_CODEX_BIN           codex executable; AGENTRY_CODEX_MODEL, AGENTRY_CODEX_SANDBOX
  AGENTRY_OMO_BIN             omo executable; AGENTRY_OMO_MODEL, the model of steps without agent_mapping.omo`;

const log = (message: string) => process.stderr.write(`[agentry-mcp] ${message}\n`);

function projectDirFrom(dir: string | undefined): string {
  const projectDir = path.resolve(dir ?? process.env.AGENTRY_PROJECT_DIR ?? process.cwd());
  if (!fs.existsSync(projectDir)) {
    log(`project directory does not exist: ${projectDir}`);
    process.exit(1);
  }
  return projectDir;
}

const runsFor = (projectDir: string): Runs =>
  new Runs({
    projectDir,
    serverUrl: (process.env.AGENTRY_OPENCODE_URL ?? 'http://127.0.0.1:4096').replace(/\/+$/, ''),
    password: process.env.OPENCODE_SERVER_PASSWORD,
    autostart: process.env.AGENTRY_OPENCODE_AUTOSTART !== '0',
    startScript: process.env.AGENTRY_OPENCODE_START,
    opencodeBin: process.env.AGENTRY_OPENCODE_BIN,
    log,
  });

const seconds = (ms: number | undefined): string => (ms === undefined ? '' : `${(ms / 1000).toFixed(1)} s`);

/** `agentry-mcp run`: the start + wait the MCP tools use, from a terminal; the exit code says whether the run ended done. */
async function runCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { dir: { type: 'string' }, runtime: { type: 'string' }, input: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  });
  const file = positionals[0];
  if (values.help || !file) {
    process.stderr.write(`${USAGE}\n`);
    return values.help ? 0 : 2;
  }
  const choice = values.runtime ?? 'auto';
  if (choice !== 'auto' && !isRuntime(choice)) {
    log(`--runtime must be one of auto, ${RUNTIMES.join(', ')}`);
    return 2;
  }
  const projectDir = projectDirFrom(values.dir);
  const project = new Project(projectDir);
  const runs = runsFor(projectDir);
  try {
    const rel = project.relativeFile(file);
    const { errors, issues } = project.check(rel, undefined);
    if (errors) {
      log(`${rel} has ${errors} validation error(s):\n${issues.filter((i) => i.severity === 'error').map((i) => `- ${i.message}`).join('\n')}`);
      return 1;
    }
    const started = await runs.start(rel, values.input, choice as RuntimeChoice);
    log(`${started.run_id} started on ${started.runtime}`);
    let report = await runs.wait(started.run_id, 50);
    while (report.status === 'running') report = await runs.wait(started.run_id, 50);
    if (values.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      const lines = [`${report.run_id}  ${report.status}  (${started.runtime})`];
      for (const node of report.nodes) {
        const detail = (node.error ?? node.preview ?? '').replace(/\s+/g, ' ').slice(0, 160);
        lines.push(`  ${node.id}  ${node.state}  ${node.agent ?? ''}  ${seconds(node.ms)}  ${detail}`.trimEnd());
      }
      lines.push(`run dir: ${report.run_dir}`);
      process.stdout.write(`${lines.join('\n')}\n`);
    }
    return report.status === 'done' ? 0 : 1;
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    return 1;
  } finally {
    await runs.dispose();
  }
}

export function main(argv: string[]): void {
  if (argv[0] === 'run') {
    void runCommand(argv.slice(1)).then((code) => process.exit(code));
    return;
  }
  const { values } = parseArgs({ args: argv, options: { dir: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    process.stderr.write(`${USAGE}\n`);
    return;
  }
  const projectDir = projectDirFrom(values.dir);
  const project = new Project(projectDir);
  const runs = runsFor(projectDir);
  log(`${SERVER_INFO.name} ${SERVER_INFO.version} serving ${projectDir} over stdio`);
  serveStdio(() => createServer(project, runs), { onerror: (err) => log(err.message) });
}

main(process.argv.slice(2));
