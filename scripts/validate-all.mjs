#!/usr/bin/env node
/**
 * Run the repository validation suite from one entry point.
 *
 * Bash hook syntax checks are required in CI/Linux. On Windows developer
 * machines without Bash, they are skipped with a warning so local checks can
 * still run.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

let failed = 0;
let skipped = 0;

function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function commandDetails(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    return { available: false, detail: 'not available' };
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return { available: true, detail: output || 'available' };
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

function printEnvironmentSummary() {
  console.log('\n== environment summary ==');
  console.log(`Node.js: ${process.version}`);
  for (const [label, command] of [
    ['Git', 'git'],
    ['Claude CLI', 'claude'],
    ['Codex CLI', 'codex'],
    ['Bash', 'bash'],
  ]) {
    const { available, detail } = commandDetails(command);
    console.log(`${label}: ${available ? detail : 'not available'}`);
  }
  console.log(`Commit: ${gitValue(['rev-parse', '--short', 'HEAD']) ?? 'unknown'}`);
  console.log(`Exact tag: ${gitValue(['describe', '--tags', '--exact-match', 'HEAD']) ?? 'none'}`);
}

function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`ERROR ${label}: ${result.error.message}`);
    failed += 1;
    return false;
  }
  if (result.status !== 0) {
    console.error(`ERROR ${label}: exited with ${result.status}`);
    failed += 1;
    return false;
  }
  return true;
}

function runNode(label, script) {
  return run(label, process.execPath, [script]);
}

function runAgentVerification() {
  if (process.platform === 'win32') {
    const shell = commandExists('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'])
      ? 'powershell'
      : (commandExists('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']) ? 'pwsh' : null);
    if (!shell) {
      console.error('ERROR agent verification: neither powershell nor pwsh was found');
      failed += 1;
      return false;
    }
    return run('verify agents', shell, [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'scripts/verify-agents.ps1',
    ]);
  }
  return run('verify agents', 'bash', ['scripts/verify-agents.sh']);
}

function runHookSyntaxChecks() {
  if (!commandExists('bash')) {
    if (process.platform === 'win32') {
      console.warn('\nWARNING hook shell syntax: bash not found; skipping local bash -n checks');
      skipped += 1;
      return true;
    }
    console.error('\nERROR hook shell syntax: bash not found; bash -n checks are required outside Windows');
    failed += 1;
    return false;
  }
  const scripts = [
    'nova-plugin/hooks/scripts/pre-write-check.sh',
    'nova-plugin/hooks/scripts/post-audit-log.sh',
  ];
  let ok = true;
  for (const script of scripts) {
    ok = run(`hook shell syntax ${script}`, 'bash', ['-n', script]) && ok;
  }
  return ok;
}

printEnvironmentSummary();
runNode('validate schemas', 'scripts/validate-schemas.mjs');
runNode('validate registry fixtures', 'scripts/validate-registry-fixtures.mjs');
runNode('validate Claude compatibility', 'scripts/validate-claude-compat.mjs');
runNode('lint frontmatter', 'scripts/lint-frontmatter.mjs');
runAgentVerification();
runNode('validate packs', 'scripts/validate-packs.mjs');
runNode('validate hooks', 'scripts/validate-hooks.mjs');
runHookSyntaxChecks();
runNode('validate docs', 'scripts/validate-docs.mjs');

console.log(`\nSummary: failed=${failed} skipped=${skipped}`);
if (failed > 0) process.exit(1);
