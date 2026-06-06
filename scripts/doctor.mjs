#!/usr/bin/env node
/**
 * Read-only repository doctor for maintainers and first-time contributors.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_NODE_MAJOR, nodeMajorVersion } from './lib/node-version.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

let warnings = 0;
let errors = 0;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function commandResult(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return {
    ok: !result.error && result.status === 0,
    detail: output || (result.error ? result.error.message : 'not available'),
    status: result.status,
  };
}

function gitValue(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function runCheck(label, fn) {
  const result = fn();
  const status = result.status ?? (result.ok ? 'OK' : 'WARN');
  if (status === 'ERROR') errors += 1;
  if (status === 'WARN') warnings += 1;
  console.log(`${status} ${label}: ${result.detail}`);
}

const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
const packageJson = readJson('package.json');
const metadata = readJson('.claude-plugin/marketplace.metadata.json');
const metadataEntry = metadata.plugins?.find((entry) => entry.name === plugin.name);

console.log('== llm-plugins-fusion doctor ==');

runCheck('Node.js', () => {
  const major = nodeMajorVersion();
  return {
    status: major !== null && major >= REQUIRED_NODE_MAJOR ? 'OK' : 'ERROR',
    detail: `${process.version}; required >=${REQUIRED_NODE_MAJOR}`,
  };
});

for (const [label, command] of [
  ['Git', 'git'],
  ['Bash', 'bash'],
  ['Claude CLI', 'claude'],
  ['Codex CLI', 'codex'],
]) {
  runCheck(label, () => {
    const result = commandResult(command);
    const optional = label === 'Claude CLI' || label === 'Codex CLI' || label === 'Bash';
    return {
      status: result.ok ? 'OK' : (optional ? 'WARN' : 'ERROR'),
      detail: result.ok ? result.detail : 'not available',
    };
  });
}

runCheck('Package/plugin version', () => ({
  status: packageJson.version === plugin.version ? 'OK' : 'ERROR',
  detail: `package=${packageJson.version}; plugin=${plugin.version}`,
}));

runCheck('Registry metadata date', () => ({
  status: metadataEntry?.['last-updated'] ? 'OK' : 'WARN',
  detail: metadataEntry?.['last-updated'] ?? 'missing last-updated',
}));

runCheck('Git working tree', () => {
  const status = gitValue(['status', '--short']);
  return {
    status: status ? 'WARN' : 'OK',
    detail: status ? 'working tree has changes' : 'clean',
  };
});

runCheck('Exact release tag', () => {
  const tag = gitValue(['describe', '--tags', '--exact-match', 'HEAD']);
  return {
    status: tag ? 'OK' : 'WARN',
    detail: tag ?? 'HEAD is not an exact release tag; treat as development snapshot',
  };
});

runCheck('Generated registry drift', () => {
  const result = commandResult(process.execPath, ['scripts/generate-registry.mjs']);
  return {
    status: result.ok ? 'OK' : 'ERROR',
    detail: result.ok ? 'generated outputs are current' : result.detail,
  };
});

console.log(`\nSummary: errors=${errors} warnings=${warnings}`);
if (errors > 0) process.exit(1);
