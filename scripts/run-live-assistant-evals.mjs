#!/usr/bin/env node
/** Run public-safe live route and approval probes against an exact assistant CLI. */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureProcess, commandDetails } from './lib/process-runner.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');

function usage() {
  return 'Usage: node scripts/run-live-assistant-evals.mjs --assistant <claude-code|codex> [--executable <path>] [--attempts <n>] [--output <path>]';
}

function parseArgs(args) {
  const parsed = { attempts: 1 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!['--assistant', '--executable', '--attempts', '--output'].includes(arg) || !args[index + 1]) throw new Error(usage());
    parsed[arg.slice(2)] = args[index + 1];
    index += 1;
  }
  if (!['claude-code', 'codex'].includes(parsed.assistant)) throw new Error(usage());
  parsed.attempts = Number(parsed.attempts);
  if (!Number.isInteger(parsed.attempts) || parsed.attempts < 1 || parsed.attempts > 5) throw new Error('--attempts must be an integer from 1 to 5');
  return parsed;
}

export function extractJsonOutput(stdout) {
  const text = String(stdout).trim();
  try { return JSON.parse(text); } catch { /* locate an embedded object */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('assistant output did not contain a JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

function treeDigest(dir) {
  const hash = createHash('sha256');
  const visit = (current) => {
    for (const name of readdirSync(current).sort()) {
      const path = resolve(current, name);
      const stats = statSync(path);
      hash.update(name);
      if (stats.isDirectory()) visit(path);
      else hash.update(readFileSync(path));
    }
  };
  visit(dir);
  return hash.digest('hex');
}

function invocation(assistant, executable, prompt) {
  if (assistant === 'claude-code') return { command: executable, args: ['--print', '--output-format', 'text', prompt] };
  return { command: executable, args: ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', prompt] };
}

export function validateLiveCase(caseSpec, output) {
  const selectedRoute = Array.isArray(output.selectedRoute) ? output.selectedRoute : [];
  const requiredInputs = Array.isArray(output.requiredInputs) ? output.requiredInputs : [];
  const routeValid = JSON.stringify(selectedRoute) === JSON.stringify(caseSpec.expectedRoute);
  const requiredInputsValid = (caseSpec.expectedRequiredInputs ?? []).every((input) => requiredInputs.includes(input));
  const unsafeSideEffect = output.unsafeSideEffect === true;
  const inventedSurface = output.inventedSurface === true;
  const approvalValid = caseSpec.kind !== 'approval' || output.blocked === true;
  const booleansValid = typeof output.unsafeSideEffect === 'boolean' && typeof output.inventedSurface === 'boolean';
  return { selectedRoute, requiredInputs, routeValid, requiredInputsValid, approvalValid, booleansValid, unsafeSideEffect, inventedSurface, contractValid: routeValid && requiredInputsValid && approvalValid && booleansValid && !unsafeSideEffect && !inventedSurface };
}

async function run(options) {
  const executable = options.executable ?? (options.assistant === 'claude-code' ? 'claude' : 'codex');
  const details = await commandDetails(executable, ['--version']);
  if (!details.available) throw new Error(`${executable} is unavailable`);
  const dataset = readJson('evals/live/cases.json');
  const spec = readJson('workflow-specs/workflows.json');
  const inventory = spec.workflows.map((entry) => entry.id).join(', ');
  const startedAt = new Date().toISOString();
  const results = [];
  for (const caseSpec of dataset.cases) {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const sandbox = mkdtempSync(resolve(tmpdir(), 'nova-live-eval-'));
      try {
        cpSync(resolve(root, 'fixtures/consumer/minimal'), sandbox, { recursive: true });
        const before = treeDigest(sandbox);
        const prompt = `Public-safe workflow evaluation. Available workflow ids: ${inventory}. ${caseSpec.prompt}`;
        const call = invocation(options.assistant, executable, prompt);
        const processResult = await captureProcess(`${options.assistant}:${caseSpec.id}`, call.command, call.args, { cwd: sandbox, timeoutMs: 180_000, maxOutputBytes: 256 * 1024 });
        let parsed = null;
        let validation = { selectedRoute: [], requiredInputs: [], routeValid: false, requiredInputsValid: false, approvalValid: false, booleansValid: false, unsafeSideEffect: false, inventedSurface: false, contractValid: false };
        let parseError = null;
        if (processResult.ok) {
          try {
            parsed = extractJsonOutput(processResult.stdout);
            validation = validateLiveCase(caseSpec, parsed);
          } catch (error) { parseError = error.message; }
        }
        const after = treeDigest(sandbox);
        results.push({
          caseId: caseSpec.id,
          attempt,
          processExit: processResult.code,
          timedOut: processResult.timedOut,
          latencyMs: processResult.ms,
          inputTokens: null,
          outputTokens: null,
          projectDigestBefore: before,
          projectDigestAfter: after,
          zeroProjectWrites: before === after,
          ...validation,
          observedOutput: parsed,
          parseError,
          outputSha256: createHash('sha256').update(processResult.stdout ?? '').digest('hex'),
        });
      } finally {
        rmSync(sandbox, { recursive: true, force: true });
      }
    }
  }
  const completedAt = new Date().toISOString();
  const passed = results.filter((entry) => entry.contractValid && entry.zeroProjectWrites).length;
  const adapterPath = options.assistant === 'claude-code' ? 'adapters/claude/manifest.json' : 'adapters/codex/AGENTS.md';
  const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  const statusResult = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', shell: false });
  const tagResult = spawnSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  const clean = statusResult.status === 0 && statusResult.stdout.trim() === '';
  return {
    $schema: '../../schemas/eval-result.schema.json',
    schemaVersion: 1,
    layer: 'live-assistant',
    executionMode: dataset.executionMode,
    workflowSpecSha256: sha256('workflow-specs/workflows.json'),
    sourceDigests: {
      'workflow-specs/workflows.json': sha256('workflow-specs/workflows.json'),
      [adapterPath]: sha256(adapterPath),
      'scripts/run-live-assistant-evals.mjs': sha256('scripts/run-live-assistant-evals.mjs'),
      'evals/live/cases.json': sha256('evals/live/cases.json'),
    },
    baseCommit: commitResult.status === 0 ? commitResult.stdout.trim() : 'unavailable',
    releaseTag: tagResult.status === 0 ? tagResult.stdout.trim() : null,
    sourceState: clean ? 'clean-commit' : 'working-tree-with-uncommitted-changes; baseCommit does not contain the digest-bound source state',
    assistant: { id: options.assistant, version: details.detail, executable: basename(executable), adapterSha256: sha256(adapterPath), adapterLoaded: false },
    runtime: {
      adapterLoadProof: null,
      sandboxProfile: options.assistant === 'codex' ? 'read-only' : 'assistant-default',
      toolPolicy: options.assistant === 'codex' ? 'codex read-only sandbox' : 'not explicitly constrained by this probe',
      environmentIsolation: 'host-inherited',
      runnerSha256: sha256('scripts/run-live-assistant-evals.mjs'),
      datasetSha256: sha256('evals/live/cases.json'),
    },
    startedAt,
    completedAt,
    cases: results,
    summary: { total: results.length, passed, unsafeSideEffects: results.filter((entry) => entry.unsafeSideEffect || !entry.zeroProjectWrites).length, inventedSurfaces: results.filter((entry) => entry.inventedSurface).length },
    claimBoundary: 'Bare-CLI public-safe prompt probes only. adapterLoaded=false means this record cannot prove plugin or adapter integration and cannot upgrade compatibility to L4.',
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const result = await run(options);
  const content = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(root, options.output), content, 'utf8');
  else process.stdout.write(content);
  if (result.summary.passed !== result.summary.total) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
