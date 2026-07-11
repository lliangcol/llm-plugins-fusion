#!/usr/bin/env node
/**
 * Run the repository validation suite from one entry point.
 *
 * Bash hook syntax and runtime smoke checks are required in CI/Linux. On
 * Windows developer machines without Bash, they are skipped with warnings so
 * local checks can still run.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import {
  captureProcess,
  commandDetails,
  commandExists,
  runProcess,
} from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const maxConcurrency = Number.parseInt(process.env.NOVA_VALIDATE_CONCURRENCY ?? '3', 10);
const writeTimings = process.argv.includes('--write-timings') || process.env.NOVA_VALIDATE_WRITE_TIMINGS === '1';

assertNodeVersion({ label: 'repository validation' });

let failed = 0;
let skipped = 0;
const timings = [];

function normalizeConcurrency(value) {
  return Number.isInteger(value) && value > 0 ? value : 3;
}

async function gitValue(args) {
  const result = await captureProcess(`git ${args.join(' ')}`, 'git', args, {
    cwd: root,
    timeoutMs: 10_000,
  });
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

async function environmentSummary() {
  const tools = await Promise.all([
    ['Git', 'git'],
    ['Claude CLI', 'claude'],
    ['Codex CLI', 'codex'],
    ['Bash', 'bash'],
  ].map(async ([label, command]) => [label, await commandDetails(command, ['--version'], {
    cwd: root,
    timeoutMs: 10_000,
  })]));

  console.log('\n== environment summary ==');
  console.log(`Node.js: ${process.version}`);
  for (const [label, detail] of tools) {
    console.log(`${label}: ${detail.available ? detail.detail : 'not available'}`);
  }
  console.log(`Commit: ${await gitValue(['rev-parse', '--short', 'HEAD']) ?? 'unknown'}`);
  console.log(`Exact tag: ${await gitValue(['describe', '--tags', '--exact-match', 'HEAD']) ?? 'none'}`);

  return Object.fromEntries(tools.map(([label, detail]) => [label, detail.available]));
}

function nodeTask(label, script, timeoutMs = 120_000, options = {}) {
  return {
    label,
    run: async () => {
      const result = await runProcess(label, process.execPath, [script], {
        cwd: root,
        timeoutMs,
      });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      if (result.ok && options.skippedPattern?.test(output)) {
        return {
          ...result,
          skipped: true,
        };
      }
      return result;
    },
  };
}

function commandTask(label, command, args, timeoutMs = 120_000) {
  return {
    label,
    run: () => runProcess(label, command, args, {
      cwd: root,
      timeoutMs,
    }),
  };
}

function skippedTask(label, message) {
  return {
    label,
    run: async () => ({
      label,
      ok: true,
      skipped: true,
      warning: message,
      stdout: '',
      stderr: '',
      ms: 0,
    }),
  };
}

function failedTask(label, message) {
  return {
    label,
    run: async () => ({
      label,
      ok: false,
      errorMessage: message,
      stdout: '',
      stderr: '',
      ms: 0,
    }),
  };
}

async function buildAgentVerificationTask() {
  if (process.platform !== 'win32') {
    return commandTask('verify agents', 'bash', ['scripts/verify-agents.sh']);
  }

  const powershellAvailable = await commandExists('powershell', [
    '-NoProfile',
    '-Command',
    '$PSVersionTable.PSVersion.ToString()',
  ], { cwd: root, timeoutMs: 10_000 });
  const pwshAvailable = powershellAvailable ? false : await commandExists('pwsh', [
    '-NoProfile',
    '-Command',
    '$PSVersionTable.PSVersion.ToString()',
  ], { cwd: root, timeoutMs: 10_000 });
  const shell = powershellAvailable ? 'powershell' : (pwshAvailable ? 'pwsh' : null);

  if (!shell) {
    return failedTask('verify agents', 'neither powershell nor pwsh was found');
  }

  return commandTask('verify agents', shell, [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'scripts/verify-agents.ps1',
  ]);
}

function buildHookSyntaxTasks(hasBash) {
  if (!hasBash) {
    if (process.platform === 'win32') {
      return [
        skippedTask('hook shell syntax', 'WARNING hook shell syntax: bash not found; skipping local bash -n checks'),
      ];
    }
    return [
      failedTask('hook shell syntax', 'bash not found; bash -n checks are required outside Windows'),
    ];
  }

  return [
    commandTask('hook shell syntax nova-plugin/hooks/scripts/pre-write-check.sh', 'bash', [
      '-n',
      'nova-plugin/hooks/scripts/pre-write-check.sh',
    ], 30_000),
    commandTask('hook shell syntax nova-plugin/hooks/scripts/post-audit-log.sh', 'bash', [
      '-n',
      'nova-plugin/hooks/scripts/post-audit-log.sh',
    ], 30_000),
  ];
}

function buildRuntimeSmokeTask(hasBash) {
  if (hasBash) {
    return nodeTask('validate runtime smoke', 'scripts/validate-runtime-smoke.mjs');
  }
  if (process.platform === 'win32') {
    return skippedTask('validate runtime smoke', 'WARNING runtime smoke: bash not found; skipping local Bash runtime smoke checks');
  }
  return failedTask('validate runtime smoke', 'bash not found; Bash runtime smoke is required outside Windows');
}

function printResult(result) {
  if (result.warning) {
    console.warn(`\n${result.warning}`);
  } else {
    console.log(`\n== ${result.label} ==`);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.skipped) {
    skipped += 1;
    timings.push({ label: result.label, status: 'skipped', ms: result.ms });
    return;
  }

  if (!result.ok) {
    const message = result.errorMessage
      ?? (result.code == null ? 'failed' : `exited with ${result.code}`);
    console.error(`ERROR ${result.label}: ${message}`);
    failed += 1;
  }

  timings.push({
    label: result.label,
    status: result.ok ? 'passed' : 'failed',
    ms: result.ms,
  });
}

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await tasks[index].run();
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(normalizeConcurrency(limit), tasks.length) },
    () => worker(),
  ));
  return results;
}

async function runTaskGroup(tasks) {
  const results = await runWithConcurrency(tasks, maxConcurrency);
  for (const result of results) printResult(result);
}

function printTimingSummary() {
  console.log('\n== validation timings ==');
  for (const timing of timings) {
    const seconds = (timing.ms / 1000).toFixed(2);
    console.log(`${timing.status.padEnd(7)} ${seconds.padStart(7)}s  ${timing.label}`);
  }
}

async function maybeWriteTimings() {
  if (!writeTimings) return;
  const metricsDir = resolve(root, '.metrics');
  await mkdir(metricsDir, { recursive: true });
  await writeFile(
    resolve(metricsDir, 'validation-timings.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      failed,
      skipped,
      timings,
    }, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  const environment = await environmentSummary();
  const hasBash = environment.Bash;

  const agentTask = await buildAgentVerificationTask();
  const hookSyntaxTasks = buildHookSyntaxTasks(hasBash);
  const runtimeSmokeTask = buildRuntimeSmokeTask(hasBash);

  await runTaskGroup([
    nodeTask('validate schemas', 'scripts/validate-schemas.mjs'),
    nodeTask('validate registry fixtures', 'scripts/validate-registry-fixtures.mjs'),
    nodeTask(
      'validate Claude compatibility',
      'scripts/validate-claude-compat.mjs',
      120_000,
      { skippedPattern: /skipping live claude plugin validate checks/i },
    ),
    nodeTask('lint frontmatter', 'scripts/lint-frontmatter.mjs'),
    nodeTask('validate workflow permissions', 'scripts/generate-workflow-permissions.mjs'),
  ]);

  await runTaskGroup([
    agentTask,
    nodeTask('validate packs', 'scripts/validate-packs.mjs'),
    nodeTask('validate hooks', 'scripts/validate-hooks.mjs'),
    nodeTask('validate GitHub workflows', 'scripts/validate-github-workflows.mjs'),
    ...hookSyntaxTasks,
  ]);

  await runTaskGroup([
    runtimeSmokeTask,
    nodeTask('validate surface budget', 'scripts/validate-surface-budget.mjs'),
    nodeTask('validate surface inventory', 'scripts/generate-surface-inventory.mjs'),
    nodeTask('scan distribution risk', 'scripts/scan-distribution-risk.mjs'),
    nodeTask('validate regression', 'scripts/validate-regression.mjs'),
    nodeTask('validate workflow fixtures', 'scripts/validate-workflow-fixtures.mjs'),
    nodeTask('validate docs', 'scripts/validate-docs.mjs'),
  ]);

  printTimingSummary();
  await maybeWriteTimings();

  console.log(`\nSummary: failed=${failed} skipped=${skipped}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`ERROR repository validation: ${error.message}`);
  process.exit(1);
});
