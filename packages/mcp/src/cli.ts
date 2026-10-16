/**
 * agentry-mcp — a stdio MCP server over one Agentry project.
 *
 *   agentry-mcp [--dir <project>]     default: cwd, or AGENTRY_PROJECT_DIR
 *
 * stdout is the protocol; everything we have to say goes to stderr. Runs go to the opencode
 * server at AGENTRY_OPENCODE_URL (default http://127.0.0.1:4096, auth OPENCODE_SERVER_PASSWORD),
 * started when nothing listens there (AGENTRY_OPENCODE_AUTOSTART=0 to refuse;
 * AGENTRY_OPENCODE_START / AGENTRY_OPENCODE_BIN to start it your own way).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Project } from './project';
import { Runs } from './runs';
import { SERVER_INFO, createServer } from './server';

const USAGE = `agentry-mcp — MCP server (stdio) to list, edit, validate, run and watch one project's Agentry workflows

  agentry-mcp [--dir <project>]      project root (default: cwd or AGENTRY_PROJECT_DIR)

  AGENTRY_OPENCODE_URL        opencode server runs go to (default http://127.0.0.1:4096)
  OPENCODE_SERVER_PASSWORD    its password (user is "opencode")
  AGENTRY_OPENCODE_AUTOSTART  "0" = never start a server when none listens
  AGENTRY_OPENCODE_START      script that starts the server your own way
  AGENTRY_OPENCODE_BIN        opencode executable for the direct start`;

const log = (message: string) => process.stderr.write(`[agentry-mcp] ${message}\n`);

export function main(argv: string[]): void {
  const { values } = parseArgs({ args: argv, options: { dir: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) {
    process.stderr.write(`${USAGE}\n`);
    return;
  }
  const projectDir = path.resolve(values.dir ?? process.env.AGENTRY_PROJECT_DIR ?? process.cwd());
  if (!fs.existsSync(projectDir)) {
    log(`project directory does not exist: ${projectDir}`);
    process.exit(1);
  }
  const project = new Project(projectDir);
  const runs = new Runs({
    projectDir,
    serverUrl: (process.env.AGENTRY_OPENCODE_URL ?? 'http://127.0.0.1:4096').replace(/\/+$/, ''),
    password: process.env.OPENCODE_SERVER_PASSWORD,
    autostart: process.env.AGENTRY_OPENCODE_AUTOSTART !== '0',
    startScript: process.env.AGENTRY_OPENCODE_START,
    opencodeBin: process.env.AGENTRY_OPENCODE_BIN,
    log,
  });
  log(`${SERVER_INFO.name} ${SERVER_INFO.version} serving ${projectDir} over stdio`);
  serveStdio(() => createServer(project, runs), { onerror: (err) => log(err.message) });
}

main(process.argv.slice(2));
