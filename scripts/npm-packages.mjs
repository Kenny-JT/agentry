#!/usr/bin/env node
// Turn a release's three files into npm packages, one folder each, ready for `npm publish`:
//   agentry-mcp       the MCP server      (bin agentry-mcp)       from agentry-mcp.mjs
//   agentry-watch     the trigger daemon  (bin agentry-watch)     from agentry-watch.mjs
//   opencode-agentry  the opencode plugin (opencode.json plugin)  from agentry.js
//
//   node scripts/npm-packages.mjs <folder with the three files> <version or tag> <out folder>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [from, versionArg, out] = process.argv.slice(2);
if (!from || !versionArg || !out) {
  console.error('usage: node scripts/npm-packages.mjs <files folder> <version> <out folder>');
  process.exit(1);
}
const version = versionArg.replace(/^v/, '');
const repo = 'https://github.com/Kenny-JT/agentry';
const pluginApi = JSON.parse(fs.readFileSync(path.join(root, 'packages/plugin/package.json'), 'utf8')).dependencies['@opencode-ai/plugin'];

const packages = [
  {
    name: 'agentry-mcp',
    file: 'agentry-mcp.mjs',
    bin: 'agentry-mcp',
    description: 'MCP server that lets Claude Code, Codex, Cursor, opencode and other agents list, edit, validate, run and follow Agentry workflows.',
    keywords: ['mcp', 'model-context-protocol', 'ai-agents', 'workflow', 'claude-code', 'codex', 'opencode'],
    extra: [['packages/mcp/skill/SKILL.md', 'skill/SKILL.md']],
    readme: [
      'Register it in your agent host and point it at a project that has a `workflows/` folder:',
      '',
      '```sh',
      'claude mcp add agentry -- npx -y agentry-mcp --dir .',
      '```',
      '',
      `Setup for other hosts and the list of tools: ${repo}/tree/main/packages/mcp`,
    ],
  },
  {
    name: 'agentry-watch',
    file: 'agentry-watch.mjs',
    bin: 'agentry-watch',
    description: 'Starts Agentry workflows by themselves when their on: triggers fire (new files, a schedule, a web page, a mailbox, a git push).',
    keywords: ['ai-agents', 'workflow', 'automation', 'triggers', 'opencode'],
    extra: [],
    readme: [
      '```sh',
      'npx -y agentry-watch --dir path/to/your/project',
      '```',
      '',
      `How triggers work: ${repo}#start-workflows-automatically`,
    ],
  },
  {
    name: 'opencode-agentry',
    file: 'agentry.js',
    main: true,
    dependencies: { '@opencode-ai/plugin': pluginApi },
    description: 'opencode plugin that runs Agentry workflows (workflow.yaml) with a live panel, checkpoints and resume.',
    keywords: ['opencode', 'opencode-plugin', 'ai-agents', 'workflow'],
    extra: [],
    readme: [
      'Add it to the `plugin` list in your project\'s `opencode.json`:',
      '',
      '```json',
      '{ "plugin": ["opencode-agentry"] }',
      '```',
      '',
      `Then ask opencode to run a workflow from \`workflows/\` with agentry. Workflow format and examples: ${repo}`,
    ],
  },
];

for (const pkg of packages) {
  const dir = path.join(out, pkg.name);
  fs.mkdirSync(dir, { recursive: true });
  const source = path.join(from, pkg.file);
  if (!fs.existsSync(source)) throw new Error(`missing ${source}`);
  fs.copyFileSync(source, path.join(dir, pkg.file));
  for (const [rel, target] of pkg.extra) {
    fs.mkdirSync(path.dirname(path.join(dir, target)), { recursive: true });
    fs.copyFileSync(path.join(root, rel), path.join(dir, target));
  }
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(dir, 'LICENSE'));
  const manifest = {
    name: pkg.name,
    version,
    description: pkg.description,
    keywords: pkg.keywords,
    license: 'MIT',
    homepage: repo,
    repository: { type: 'git', url: `git+${repo}.git` },
    bugs: `${repo}/issues`,
    type: 'module',
    engines: { node: '>=22.6' },
    ...(pkg.bin ? { bin: { [pkg.bin]: pkg.file } } : {}),
    ...(pkg.main ? { main: pkg.file, exports: { '.': `./${pkg.file}` } } : {}),
    ...(pkg.dependencies ? { dependencies: pkg.dependencies } : {}),
    files: [pkg.file, 'LICENSE', 'README.md', ...pkg.extra.map(([, target]) => target)],
  };
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, 'README.md'), [`# ${pkg.name}`, '', pkg.description, '', ...pkg.readme, '', `Part of [Agentry](${repo}). MIT licensed.`, ''].join('\n'));
  console.log(`${pkg.name}@${version} -> ${dir}`);
}
