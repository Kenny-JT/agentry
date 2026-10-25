#!/usr/bin/env node
// One version for the whole repo: every package.json, the Tauri config, the desktop crate
// (Cargo.toml + its Cargo.lock entry) and the version the MCP server reports. Releases are
// tagged vX.Y.Z from this number.
//
//   node scripts/version.mjs                     list every file's version
//   node scripts/version.mjs --check             exit 1 unless all files agree
//   node scripts/version.mjs --check --expect v0.2.0   ...and equal the tag (release CI)
//   node scripts/version.mjs set 0.2.0           write 0.2.0 everywhere
//   node scripts/version.mjs bump patch|minor|major

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

// First top-level "version" key of a JSON file; [package] version of the crate; the app's lock entry.
const jsonVersion = /("version"\s*:\s*")([^"]+)(")/;
const cargoVersion = /(\[package\][^[]*?\nversion\s*=\s*")([^"]+)(")/;
const lockVersion = /(\[\[package\]\]\r?\nname = "app"\r?\nversion = ")([^"]+)(")/;
const serverInfoVersion = /(SERVER_INFO = \{ name: 'agentry', version: ')([^']+)(')/;

const packageJsons = ['package.json', ...fs.readdirSync(path.join(root, 'packages'))
  .map((dir) => `packages/${dir}/package.json`)
  .filter((file) => fs.existsSync(path.join(root, file)))];

const targets = [
  ...packageJsons.map((file) => ({ file, pattern: jsonVersion })),
  { file: 'packages/app/src-tauri/tauri.conf.json', pattern: jsonVersion },
  { file: 'packages/app/src-tauri/Cargo.toml', pattern: cargoVersion },
  { file: 'packages/app/src-tauri/Cargo.lock', pattern: lockVersion },
  { file: 'packages/mcp/src/server.ts', pattern: serverInfoVersion },
];

function read() {
  return targets.map(({ file, pattern }) => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const match = text.match(pattern);
    if (!match) throw new Error(`${file}: no version field found`);
    return { file, pattern, text, version: match[2] };
  });
}

function bump(version, part) {
  const [major, minor, patch] = version.split('-')[0].split('.').map(Number);
  if (part === 'major') return `${major + 1}.0.0`;
  if (part === 'minor') return `${major}.${minor + 1}.0`;
  if (part === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`bump expects patch | minor | major, got "${part}"`);
}

const args = process.argv.slice(2);
const entries = read();
const versions = new Set(entries.map((entry) => entry.version));

if (args[0] === 'set' || args[0] === 'bump') {
  if (versions.size !== 1 && args[0] === 'bump') {
    console.error('versions disagree; use `set <version>` first:');
    for (const { file, version } of entries) console.error(`  ${version.padEnd(12)} ${file}`);
    process.exit(1);
  }
  const next = args[0] === 'set' ? args[1] : bump([...versions][0], args[1]);
  if (!next || !SEMVER.test(next)) {
    console.error(`not a semantic version: "${next ?? ''}"`);
    process.exit(1);
  }
  for (const { file, pattern, text } of entries) {
    fs.writeFileSync(path.join(root, file), text.replace(pattern, `$1${next}$3`));
  }
  console.log(`version -> ${next} (${entries.length} files)`);
  process.exit(0);
}

for (const { file, version } of entries) console.log(`${version.padEnd(12)} ${file}`);

if (args.includes('--check')) {
  if (versions.size !== 1) {
    console.error('\nversions disagree - run: node scripts/version.mjs set <version>');
    process.exit(1);
  }
  const expectAt = args.indexOf('--expect');
  if (expectAt >= 0) {
    const expected = String(args[expectAt + 1] ?? '').replace(/^refs\/tags\//, '').replace(/^v/, '');
    const actual = [...versions][0];
    if (expected !== actual) {
      console.error(`\ntag says ${expected || '(nothing)'} but the repo is at ${actual}`);
      process.exit(1);
    }
  }
  console.log(`\nall ${entries.length} files at ${[...versions][0]}`);
}
