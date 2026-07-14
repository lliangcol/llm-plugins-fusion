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
import { resolveBashCommand } from './lib/bash-command.mjs';
import {
  captureProcess,
  commandDetails,
  commandExists,
  runProcess,
} from './lib/process-runner.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry, writeDiagnosticReport } from './lib/diagnostics.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const maxConcurrency = Number.parseInt(process.env.NOVA_VALIDATE_CONCURRENCY ?? '3', 10);
const writeTimings = process.argv.includes('--write-timings') || process.env.NOVA_VALIDATE_WRITE_TIMINGS === '1';
const outputJsonAt = process.argv.indexOf('--output-json');
const outputJson = outputJsonAt === -1 ? null : requireOptionValue(process.argv, outputJsonAt, '--output-json');
const runId = process.env.GITHUB_RUN_ID ?? `local-${process.pid}-${Date.now()}`;
const bashCommand = resolveBashCommand();

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
  /** @type {Array<[string, string]>} */
  const commands = [
    ['Git', 'git'],
    ['Claude CLI', 'claude'],
    ['Codex CLI', 'codex'],
    ['Bash', bashCommand],
  ];
  const tools = await Promise.all(commands.map(async ([label, command]) => /** @type {const} */ ([
    label,
    await commandDetails(command, ['--version'], {
      cwd: root,
      timeoutMs: 10_000,
    }),
  ])));

  console.log('\n== environment summary ==');
  console.log(`Node.js: ${process.version}`);
  for (const [label, detail] of tools) {
    console.log(`${label}: ${detail.available ? detail.detail : 'not available'}`);
  }
  console.log(`Commit: ${await gitValue(['rev-parse', '--short', 'HEAD']) ?? 'unknown'}`);
  console.log(`Exact tag: ${await gitValue(['describe', '--tags', '--exact-match', 'HEAD']) ?? 'none'}`);

  return Object.fromEntries(tools.map(([label, detail]) => [label, detail.available]));
}

function nodeTask(id, label, script, timeoutMs = 120_000, options = {}) {
  return {
    id,
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
          id,
          skipped: true,
        };
      }
      return { ...result, id };
    },
  };
}

function commandTask(id, label, command, args, timeoutMs = 120_000) {
  return {
    id,
    label,
    run: async () => ({ ...await runProcess(label, command, args, {
      cwd: root,
      timeoutMs,
    }), id }),
  };
}

function skippedTask(id, label, message) {
  return {
    label,
    run: async () => ({
      label,
      id,
      ok: true,
      skipped: true,
      warning: message,
      stdout: '',
      stderr: '',
      ms: 0,
    }),
  };
}

function failedTask(id, label, message) {
  return {
    label,
    run: async () => ({
      label,
      id,
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
    return commandTask('agents.verify', 'verify agents', bashCommand, ['scripts/verify-agents.sh']);
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
    return failedTask('agents.verify', 'verify agents', 'neither powershell nor pwsh was found');
  }

  return commandTask('agents.verify', 'verify agents', shell, [
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
        skippedTask('hooks.syntax.all', 'hook shell syntax', 'WARNING hook shell syntax: bash not found; skipping local bash -n checks'),
      ];
    }
    return [
      failedTask('hooks.syntax.all', 'hook shell syntax', 'bash not found; bash -n checks are required outside Windows'),
    ];
  }

  return [
    commandTask('hooks.syntax.prewrite', 'hook shell syntax nova-plugin/hooks/scripts/pre-write-check.sh', bashCommand, [
      '-n',
      'nova-plugin/hooks/scripts/pre-write-check.sh',
    ], 30_000),
    commandTask('hooks.syntax.prebash', 'hook shell syntax nova-plugin/hooks/scripts/pre-bash-check.sh', bashCommand, [
      '-n',
      'nova-plugin/hooks/scripts/pre-bash-check.sh',
    ], 30_000),
    commandTask('hooks.syntax.audit', 'hook shell syntax nova-plugin/hooks/scripts/post-audit-log.sh', bashCommand, [
      '-n',
      'nova-plugin/hooks/scripts/post-audit-log.sh',
    ], 30_000),
  ];
}

function buildRuntimeSmokeTask(hasBash) {
  if (hasBash) {
    return nodeTask('runtime.smoke', 'validate runtime smoke', 'scripts/validate-runtime-smoke.mjs');
  }
  if (process.platform === 'win32') {
    return skippedTask('runtime.smoke', 'validate runtime smoke', 'WARNING runtime smoke: bash not found; skipping local Bash runtime smoke checks');
  }
  return failedTask('runtime.smoke', 'validate runtime smoke', 'bash not found; Bash runtime smoke is required outside Windows');
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
    timings.push({ id: result.id, label: result.label, status: 'skipped', durationMs: result.ms, reasonCode: 'LOCAL_RUNTIME_UNAVAILABLE' });
    return;
  }

  if (!result.ok) {
    const message = result.errorMessage
      ?? (result.code == null ? 'failed' : `exited with ${result.code}`);
    console.error(`ERROR ${result.label}: ${message}`);
    failed += 1;
  }

  timings.push({
    id: result.id,
    label: result.label,
    status: result.ok ? 'passed' : 'failed',
    durationMs: result.ms,
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
    const seconds = (timing.durationMs / 1000).toFixed(2);
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
      schemaVersion: 1,
      runId,
      generatedAt: new Date().toISOString(),
      failed,
      skipped,
      gates: timings,
    }, null, 2)}\n`,
    'utf8',
  );
}

function writeDiagnosticsSummary() {
  if (!outputJson) return;
  const registry = loadReasonRegistry(root);
  const results = timings.map((timing) => diagnosticResult({
    command: 'validate-all',
    check: timing.id,
    status: timing.status,
    reasonCode: timing.reasonCode ?? (timing.status === 'passed' ? 'CHECK_PASSED' : 'VALIDATION_FAILED'),
    actual: { label: timing.label, durationMs: timing.durationMs },
    skippedReason: timing.status === 'skipped' ? 'The required local runtime was unavailable.' : undefined,
  }, registry));
  writeDiagnosticReport(resolve(root, outputJson), diagnosticReport('validate-all', results));
}

async function main() {
  const environment = await environmentSummary();
  const hasBash = environment.Bash;

  const agentTask = await buildAgentVerificationTask();
  const hookSyntaxTasks = buildHookSyntaxTasks(hasBash);
  const runtimeSmokeTask = buildRuntimeSmokeTask(hasBash);

  await runTaskGroup([
    commandTask('js.typecheck', 'typecheck JavaScript package boundaries', process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.checkjs.json']),
    nodeTask('packages.workspaces', 'validate private workspace boundaries', 'scripts/validate-workspaces.mjs'),
    nodeTask('schema.validate', 'validate schemas', 'scripts/validate-schemas.mjs'),
    nodeTask('project.state', 'validate project state', 'scripts/validate-project-state.mjs'),
    nodeTask('registry.fixtures', 'validate registry fixtures', 'scripts/validate-registry-fixtures.mjs'),
    nodeTask(
      'claude.manifest.static',
      'validate Claude compatibility',
      'scripts/validate-claude-compat.mjs',
      120_000,
      { skippedPattern: /skipping live claude plugin validate checks/i },
    ),
    nodeTask('frontmatter.lint', 'lint frontmatter', 'scripts/lint-frontmatter.mjs'),
    nodeTask('workflow.permissions', 'validate workflow permissions', 'scripts/generate-workflow-permissions.mjs'),
    nodeTask('workflow.contract.v5', 'validate workflow capability contract v5', 'scripts/validate-workflow-contract-v5.mjs'),
    nodeTask('workflow.contract.v6.projection', 'validate deterministic Contract v6 projection', 'scripts/migrate-v6-contracts.mjs'),
    nodeTask('workflow.eval.corpus.projection', 'validate deterministic bilingual eval corpus', 'scripts/generate-eval-corpus.mjs'),
    nodeTask('workflow.behavior.surfaces', 'validate generated behavior surfaces', 'scripts/generate-behavior-surfaces.mjs'),
    nodeTask('workflow.runtime.contracts', 'validate behavior-complete runtime contracts', 'scripts/generate-runtime-contracts.mjs'),
    nodeTask('workflow.runtime.behavior', 'validate direct command behavior contracts', 'scripts/validate-runtime-behavior-contracts.mjs'),
    nodeTask('workflow.behavior.golden', 'validate behavior IR golden suites', 'scripts/validate-behavior-golden.mjs'),
    nodeTask('workflow.live.dataset', 'validate live eval dataset', 'scripts/validate-live-eval-dataset.mjs'),
    nodeTask('workflow.real-task.benchmark', 'validate real-task benchmark plan and report', 'scripts/run-real-task-benchmark.mjs'),
    nodeTask('workflow.second-product', 'validate second-product full chain', 'scripts/validate-second-product-fixture.mjs'),
    nodeTask('schemas.differential', 'validate standard schema engine differential', 'scripts/validate-schema-engine-differential.mjs'),
    nodeTask('release.operations', 'validate release operations governance', 'scripts/validate-release-operations.mjs'),
    nodeTask('governance.freshness', 'validate governed fact freshness', 'scripts/validate-governance-freshness.mjs'),
    nodeTask('release.channels', 'validate release-channel facts', 'scripts/validate-release-channel-facts.mjs'),
    nodeTask('control.complexity', 'validate control-plane complexity budget', 'scripts/validate-control-plane-complexity.mjs'),
    nodeTask('control.task.catalog', 'validate maintainer task catalog', 'scripts/generate-task-catalog.mjs'),
    nodeTask('facts.graph', 'validate generated fact graph', 'scripts/generate-fact-graph.mjs'),
    nodeTask('platform.file.urls', 'validate portable file URL handling', 'scripts/validate-portable-paths.mjs'),
    nodeTask('workflow.surface.normalization', 'validate normalized workflow surfaces', 'scripts/normalize-workflow-surfaces.mjs'),
  ]);

  await runTaskGroup([
    agentTask,
    nodeTask('packs.validate', 'validate packs', 'scripts/validate-packs.mjs'),
    nodeTask('hooks.policy', 'validate hooks', 'scripts/validate-hooks.mjs'),
    nodeTask('github.workflows', 'validate GitHub workflows', 'scripts/validate-github-workflows.mjs'),
    ...hookSyntaxTasks,
  ]);

  await runTaskGroup([
    runtimeSmokeTask,
    nodeTask('surface.budget', 'validate surface budget', 'scripts/validate-surface-budget.mjs'),
    nodeTask('surface.inventory', 'validate surface inventory', 'scripts/generate-surface-inventory.mjs'),
    nodeTask('distribution.risk', 'scan distribution risk', 'scripts/scan-distribution-risk.mjs'),
    nodeTask('regression.validate', 'validate regression', 'scripts/validate-regression.mjs'),
    nodeTask('workflow.fixtures', 'validate workflow fixtures', 'scripts/validate-workflow-fixtures.mjs'),
    nodeTask('workflow.route.conformance', 'validate route conformance cases', 'scripts/validate-route-conformance.mjs'),
    nodeTask('workflow.static.contract', 'validate static contract baseline', 'scripts/evaluate-static-contracts.mjs'),
    nodeTask('workflow.adapter.simulation', 'validate adapter simulation baseline', 'scripts/evaluate-adapter-simulation.mjs'),
    nodeTask('workflow.surface.ab', 'validate workflow surface A/B evidence', 'scripts/evaluate-workflow-surfaces.mjs'),
    nodeTask('assistant.adapters', 'validate assistant adapter conformance', 'scripts/validate-adapter-conformance.mjs'),
    nodeTask('workflow.quality.dataset', 'validate workflow quality dataset', 'scripts/validate-workflow-quality-evals.mjs'),
    commandTask('workflow.paired.dry-run', 'validate paired live evaluation plan', process.execPath, ['scripts/evaluate-paired-live.mjs', '--dry-run']),
    nodeTask('assistant.live.evidence', 'validate assistant live evidence', 'scripts/validate-assistant-evidence.mjs'),
    nodeTask('assistant.compatibility.registry', 'validate compatibility evidence registry', 'scripts/generate-compatibility-evidence.mjs'),
    nodeTask('quality.public.report', 'validate public quality report', 'scripts/generate-quality-report.mjs'),
    nodeTask('community.governance', 'validate community governance', 'scripts/validate-community-governance.mjs'),
    nodeTask('critical.mutation', 'validate critical mutation score', 'scripts/run-critical-mutations.mjs'),
    nodeTask('docs.validate', 'validate docs', 'scripts/validate-docs.mjs'),
    nodeTask('docs.command.generated', 'validate generated command docs', 'scripts/generate-command-docs.mjs'),
    nodeTask('docs.governance.generated', 'validate document governance outputs', 'scripts/generate-doc-governance.mjs'),
    nodeTask('docs.migrations', 'validate documentation compatibility migrations', 'scripts/migrate-documentation-layout.mjs'),
    nodeTask('security.dependency-audit', 'validate dependency audit evidence', 'scripts/audit-dependencies.mjs'),
  ]);

  printTimingSummary();
  await maybeWriteTimings();
  writeDiagnosticsSummary();

  console.log(`\nSummary: failed=${failed} skipped=${skipped}`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`ERROR repository validation: ${error.message}`);
  process.exit(1);
});
