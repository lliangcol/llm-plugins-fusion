#!/usr/bin/env node
/**
 * Read-only repository doctor for maintainers and first-time contributors.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_NODE_MAJOR, nodeMajorVersion } from './lib/node-version.mjs';
import { captureProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

let warnings = 0;
let errors = 0;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

async function commandResult(command, args = ['--version']) {
  const result = await captureProcess(`doctor ${command}`, command, args, {
    cwd: root,
    timeoutMs: 30_000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return {
    ok: result.ok,
    detail: output || result.errorMessage || 'not available',
    status: result.code,
  };
}

async function gitValue(args) {
  const result = await captureProcess(`git ${args.join(' ')}`, 'git', args, {
    cwd: root,
    timeoutMs: 30_000,
  });
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

async function runCheck(label, fn) {
  const result = await fn();
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

await runCheck('Node.js', () => {
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
  await runCheck(label, async () => {
    const result = await commandResult(command);
    const optional = label === 'Claude CLI' || label === 'Codex CLI' || label === 'Bash';
    return {
      status: result.ok ? 'OK' : (optional ? 'WARN' : 'ERROR'),
      detail: result.ok ? result.detail : 'not available',
    };
  });
}

await runCheck('Package/plugin version', () => ({
  status: packageJson.version === plugin.version ? 'OK' : 'ERROR',
  detail: `package=${packageJson.version}; plugin=${plugin.version}`,
}));

await runCheck('Registry metadata date', () => ({
  status: metadataEntry?.['last-updated'] ? 'OK' : 'WARN',
  detail: metadataEntry?.['last-updated'] ?? 'missing last-updated',
}));

await runCheck('Git working tree', async () => {
  const status = await gitValue(['status', '--short']);
  return {
    status: status ? 'WARN' : 'OK',
    detail: status ? 'working tree has changes' : 'clean',
  };
});

await runCheck('Exact release tag', async () => {
  const tag = await gitValue(['describe', '--tags', '--exact-match', 'HEAD']);
  return {
    status: tag ? 'OK' : 'WARN',
    detail: tag ?? 'HEAD is not an exact release tag; treat as development snapshot',
  };
});

await runCheck('Generated registry drift', async () => {
  const result = await commandResult(process.execPath, ['scripts/generate-registry.mjs']);
  return {
    status: result.ok ? 'OK' : 'ERROR',
    detail: result.ok ? 'generated outputs are current' : result.detail,
  };
});

console.log(`\nSummary: errors=${errors} warnings=${warnings}`);
if (errors > 0) process.exit(1);
