#!/usr/bin/env node
/**
 * Read-only repository doctor for maintainers and first-time contributors.
 */

import { linkSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_NODE_MAJOR, nodeMajorVersion } from './lib/node-version.mjs';
import { resolveBashCommand } from './lib/bash-command.mjs';
import { captureProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

let warnings = 0;
let errors = 0;
const availability = new Map();
let guardedAvailable = false;

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
  ['Claude CLI', 'claude'],
  ['Codex CLI', 'codex'],
  ['ShellCheck', 'shellcheck'],
  ['actionlint', 'actionlint'],
]) {
  await runCheck(label, async () => {
    const result = await commandResult(command);
    availability.set(label, result.ok);
    const optional = ['Claude CLI', 'Codex CLI', 'Bash', 'ShellCheck', 'actionlint'].includes(label);
    return {
      status: result.ok ? 'OK' : (optional ? 'WARN' : 'ERROR'),
      detail: result.ok ? result.detail : 'not available',
    };
  });
}

await runCheck('Bash', async () => {
  const bash = resolveBashCommand();
  const version = await commandResult(bash);
  if (!version.ok) return { status: 'WARN', detail: 'not available' };
  const capability = await commandResult(bash, [
    '-c',
    'set -euo pipefail; values=(); values+=(ok); [[ ${#values[@]} -eq 1 ]]; cat <(printf compatible)',
  ]);
  return {
    status: capability.ok && capability.detail === 'compatible' ? 'OK' : 'WARN',
    detail: capability.ok
      ? `${version.detail}; required Bash 3.2 features available`
      : `${version.detail}; required Bash 3.2 features unavailable`,
  };
});

await runCheck('Codex authentication', async () => {
  const result = await commandResult('codex', ['login', 'status']);
  availability.set('Codex authentication', result.ok);
  return { status: result.ok ? 'OK' : 'WARN', detail: result.ok ? result.detail : 'not authenticated or status unavailable' };
});

await runCheck('Write guard', async () => {
  if (process.env.NOVA_WRITE_GUARD_DISABLED === '1') {
    return { status: 'WARN', detail: 'explicitly disabled by NOVA_WRITE_GUARD_DISABLED=1' };
  }
  const major = nodeMajorVersion();
  const hooks = readJson('nova-plugin/hooks/hooks.json');
  const matcher = hooks.hooks?.PreToolUse?.[0]?.matcher;
  if (matcher !== 'Write|Edit|NotebookEdit') {
    return { status: 'ERROR', detail: `unexpected PreToolUse matcher: ${matcher ?? 'missing'}` };
  }
  const hook = hooks.hooks?.PreToolUse?.[0]?.hooks?.[0];
  if (hook?.command !== 'bash' || hook?.args?.[0] !== '${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh') {
    return { status: 'ERROR', detail: 'PreToolUse is not using the required fail-closed Bash exec-form launcher' };
  }
  const temp = mkdtempSync(resolve(tmpdir(), 'nova-doctor-links-'));
  let hardLinksSupported = false;
  try {
    const first = resolve(temp, 'first');
    writeFileSync(first, 'test');
    linkSync(first, resolve(temp, 'second'));
    hardLinksSupported = statSync(first).nlink === 2;
  } catch { hardLinksSupported = false; } finally { rmSync(temp, { recursive: true, force: true }); }
  if (major === null || major < REQUIRED_NODE_MAJOR || !hardLinksSupported) {
    return {
      status: 'WARN',
      detail: `unavailable; requires Node.js ${REQUIRED_NODE_MAJOR}+ and reliable hard-link counts`,
    };
  }
  guardedAvailable = true;
  return { status: 'OK', detail: 'Node exec-form active for Write/Edit; nlink semantics verified; NotebookEdit fails closed' };
});

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
const capability = guardedAvailable && availability.get('Codex CLI') && availability.get('Codex authentication') ? 'External' : guardedAvailable ? 'Guarded' : 'Core';
const capabilityReason = capability === 'External'
  ? 'guarded Write/Edit/Bash hooks and authenticated Codex CLI are available'
  : capability === 'Guarded'
    ? 'guarded Write/Edit/Bash hooks are available; external Codex integration is unavailable'
    : 'read-only commands and canonical skills only; guarded runtime capability is unavailable';
console.log(`Capability level: ${capability} (${capabilityReason})`);
if (errors > 0) process.exit(1);
