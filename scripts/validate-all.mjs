#!/usr/bin/env node
/** Registry-driven repository validation with fail-closed incremental selection. */
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { resolveBashCommand } from './lib/bash-command.mjs';
import { captureProcess, commandDetails } from './lib/process-runner.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry, writeDiagnosticReport } from './lib/diagnostics.mjs';
import { createRunnableTasks, registryMetadata, validationTaskDefinitions } from './lib/validation-task-registry.mjs';
import { changedFilesSince, createValidationCache, expandFileArguments, selectValidationTasks, trackedAndUntrackedFiles } from './lib/validation-selection.mjs';
import { validationEvidenceDigests, validationProfile } from './lib/validation-performance-profile.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bashCommand = resolveBashCommand();
const runId = process.env.GITHUB_RUN_ID ?? `local-${process.pid}-${Date.now()}`;

assertNodeVersion({ label: 'repository validation' });

export function parseArgs(args) {
  const options = { full: false, changedSince: null, files: [], explain: false, cache: false, shadow: false, writeTimings: process.env.NOVA_VALIDATE_WRITE_TIMINGS === '1', outputJson: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--full') options.full = true;
    else if (arg === '--changed-since') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('--changed-since requires a revision');
      options.changedSince = args[++index];
    } else if (arg === '--files') {
      while (args[index + 1] && !args[index + 1].startsWith('--')) options.files.push(args[++index]);
      if (options.files.length === 0) throw new Error('--files requires at least one repo-relative path or glob');
    } else if (arg === '--output-json') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('--output-json requires a path');
      options.outputJson = args[++index];
    } else if (arg === '--write-timings') options.writeTimings = true;
    else if (arg === '--explain') options.explain = true;
    else if (arg === '--cache') options.cache = true;
    else if (arg === '--no-cache') options.cache = false;
    else if (arg === '--shadow') options.shadow = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (options.changedSince && options.files.length > 0) throw new Error('--changed-since and --files are mutually exclusive');
  if (options.full && (options.changedSince || options.files.length > 0)) throw new Error('--full cannot be combined with --changed-since or --files');
  if (options.shadow && !options.changedSince && options.files.length === 0) throw new Error('--shadow requires --changed-since or --files');
  return options;
}

function normalizeConcurrency(value) {
  const parsed = Number.parseInt(value ?? '3', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
}

async function gitValue(args) {
  const result = await captureProcess(`git ${args.join(' ')}`, 'git', args, { cwd: root, timeoutMs: 10_000 });
  return result.ok ? result.stdout.trim() || null : null;
}

async function environmentSummary({ probeTools = true } = {}) {
  if (!probeTools) {
    console.log('\n== environment summary ==');
    console.log(`Node.js: ${process.version}`);
    console.log('Capability probes: not selected by incremental task set');
    return { Bash: false };
  }
  const commands = [['Git', 'git'], ['Claude CLI', 'claude'], ['Codex CLI', 'codex'], ['Bash', bashCommand]];
  const tools = await Promise.all(commands.map(async ([label, command]) => ({ label, detail: await commandDetails(command, ['--version'], { cwd: root, timeoutMs: 10_000 }) })));
  console.log('\n== environment summary ==');
  console.log(`Node.js: ${process.version}`);
  for (const { label, detail } of tools) console.log(`${label}: ${detail.available ? detail.detail : 'not available'}`);
  console.log(`Commit: ${await gitValue(['rev-parse', '--short', 'HEAD']) ?? 'unknown'}`);
  console.log(`Exact tag: ${await gitValue(['describe', '--tags', '--exact-match', 'HEAD']) ?? 'none'}`);
  return Object.fromEntries(tools.map(({ label, detail }) => [label, detail.available]));
}

function selectionIncludes(selectedIds, taskId) {
  return selectedIds.some((id) => taskId === id || taskId.startsWith(`${id}.`));
}

export async function main(args = process.argv.slice(2)) {
  const started = performance.now();
  const options = parseArgs(args);
  const maxConcurrency = normalizeConcurrency(process.env.NOVA_VALIDATE_CONCURRENCY);
  const repoFiles = await trackedAndUntrackedFiles(root);
  let requestedFiles = [];
  if (options.changedSince) requestedFiles = await changedFilesSince(root, options.changedSince);
  else if (options.files.length > 0) requestedFiles = expandFileArguments(options.files, repoFiles);
  const boundedSelection = selectValidationTasks(validationTaskDefinitions, requestedFiles, { forceFull: options.full || (!options.changedSince && options.files.length === 0) });
  const executionSelection = options.shadow ? selectValidationTasks(validationTaskDefinitions, [], { forceFull: true }) : boundedSelection;
  const mode = options.shadow ? 'shadow' : executionSelection.full ? 'full' : 'incremental';
  const capabilityTaskIds = ['agents.verify', 'hooks.syntax', 'runtime.smoke'];
  const environment = await environmentSummary({ probeTools: executionSelection.full || capabilityTaskIds.some((id) => executionSelection.selectedIds.includes(id)) });
  if (options.explain || mode !== 'full') {
    console.log('\n== validation selection ==');
    console.log(`Mode: ${mode}`);
    console.log(`Reason: ${executionSelection.reason}`);
    console.log(`Selected: ${executionSelection.selectedIds.length}/${validationTaskDefinitions.length}`);
    if (options.shadow) console.log(`Shadow incremental selection: ${boundedSelection.selectedIds.join(', ')}`);
    else console.log(executionSelection.selectedIds.join(', '));
  }

  const groups = await createRunnableTasks({ root, bashCommand, hasBash: environment.Bash, selectedIds: executionSelection.selectedIds });
  for (const [group, tasks] of groups) groups.set(group, tasks.filter((task) => selectionIncludes(executionSelection.selectedIds, task.id)));
  const cache = createValidationCache({ root, definitions: validationTaskDefinitions, repoFiles, enabled: options.cache });
  let failed = 0;
  let skipped = 0;
  let cacheHitCount = 0;
  const timings = [];

  function printResult(result) {
    if (result.warning) console.warn(`\n${result.warning}`);
    else console.log(`\n== ${result.label} ==`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.cached) cacheHitCount += 1;
    if (result.skipped) {
      skipped += 1;
      timings.push({ id: result.id, label: result.label, status: 'skipped', durationMs: result.ms, reasonCode: result.reasonCode ?? 'LOCAL_RUNTIME_UNAVAILABLE', cached: false });
      return;
    }
    if (!result.ok) {
      console.error(`ERROR ${result.label}: ${result.errorMessage ?? (result.code == null ? 'failed' : `exited with ${result.code}`)}`);
      failed += 1;
    }
    timings.push({ id: result.id, label: result.label, status: result.ok ? 'passed' : 'failed', durationMs: result.ms, cached: result.cached === true });
  }

  async function runGroup(tasks) {
    const results = new Array(tasks.length);
    let next = 0;
    async function worker() {
      while (next < tasks.length) {
        const index = next++;
        const task = tasks[index];
        results[index] = cache.lookup(task) ?? await task.run();
        cache.store(task, results[index]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(maxConcurrency, tasks.length) }, () => worker()));
    for (const result of results) printResult(result);
  }

  for (const group of [1, 2, 3]) await runGroup(groups.get(group));
  const elapsedWallMs = Math.round(performance.now() - started);
  const sumTaskMs = timings.reduce((sum, timing) => sum + timing.durationMs, 0);
  const runtimeSmokeMs = timings.find((timing) => timing.id === 'runtime.smoke')?.durationMs ?? 0;
  const summary = {
    elapsedWallMs, sumTaskMs, runtimeSmokeMs, selectedTaskCount: timings.length, cacheHitCount, mode,
    profile: validationProfile({ concurrency: maxConcurrency }),
    digests: validationEvidenceDigests(root),
  };

  console.log('\n== validation timings ==');
  for (const timing of timings) console.log(`${timing.status.padEnd(7)} ${(timing.durationMs / 1000).toFixed(2).padStart(7)}s  ${timing.label}${timing.cached ? ' [cache]' : ''}`);
  console.log(`Observed elapsed=${elapsedWallMs}ms sum=${sumTaskMs}ms mode=${mode} selected=${timings.length} cacheHits=${cacheHitCount}`);

  if (options.writeTimings) {
    await mkdir(resolve(root, '.metrics'), { recursive: true });
    await writeFile(resolve(root, '.metrics/validation-timings.json'), `${JSON.stringify({ schemaVersion: 2, runId, generatedAt: new Date().toISOString(), failed, skipped, summary, gates: timings }, null, 2)}\n`, 'utf8');
  }
  if (options.outputJson) {
    const registry = loadReasonRegistry(root);
    const results = timings.map((timing) => diagnosticResult({
      command: 'validate-all', check: timing.id, status: timing.status,
      reasonCode: timing.reasonCode ?? (timing.status === 'passed' ? 'CHECK_PASSED' : 'VALIDATION_FAILED'),
      actual: { label: timing.label, durationMs: timing.durationMs, cached: timing.cached },
      skippedReason: timing.status === 'skipped' ? 'The required local runtime was unavailable.' : undefined,
    }, registry));
    const report = { ...diagnosticReport('validate-all', results), schemaVersion: 2, summary };
    writeDiagnosticReport(resolve(root, options.outputJson), report);
  }
  console.log(`\nSummary: failed=${failed} skipped=${skipped}`);
  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`ERROR repository validation: ${error.message}`); process.exitCode = 1; });
}

export { registryMetadata };
