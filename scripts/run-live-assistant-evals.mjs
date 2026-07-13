#!/usr/bin/env node
/** Run adapter-loaded public-safe live workflow probes against an exact assistant CLI. */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureProcess, commandDetails } from './lib/process-runner.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const sha256File = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const sha256Value = (value) => createHash('sha256').update(value).digest('hex');

function usage() {
  return 'Usage: node scripts/run-live-assistant-evals.mjs --assistant <claude-code|codex> [--profile <critical|full>] [--condition <plugin-enabled|plugin-disabled>] [--executable <path>] [--attempts <3-5>] [--case <id>] [--output <path>]';
}

export function parseArgs(args) {
  const parsed = { attempts: 3, profile: 'full', condition: 'plugin-enabled' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!['--assistant', '--profile', '--condition', '--executable', '--attempts', '--case', '--output'].includes(arg) || !args[index + 1]) throw new Error(usage());
    parsed[arg.slice(2)] = args[index + 1];
    index += 1;
  }
  if (!['claude-code', 'codex'].includes(parsed.assistant)) throw new Error(usage());
  if (!['critical', 'full'].includes(parsed.profile)) throw new Error(usage());
  if (!['plugin-enabled', 'plugin-disabled'].includes(parsed.condition)) throw new Error(usage());
  parsed.attempts = Number(parsed.attempts);
  if (!Number.isInteger(parsed.attempts) || parsed.attempts < 3 || parsed.attempts > 5) throw new Error('--attempts must be an integer from 3 to 5');
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
  const visit = (current, relative = '') => {
    for (const name of readdirSync(current).sort()) {
      if (relative === '' && name === '.git') continue;
      const path = resolve(current, name);
      const child = relative ? `${relative}/${name}` : name;
      const stats = statSync(path);
      hash.update(child);
      if (stats.isDirectory()) visit(path, child);
      else hash.update(readFileSync(path));
    }
  };
  visit(dir);
  return hash.digest('hex');
}

function jsonOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['selectedRoute', 'requiredInputs', 'blocked'],
    properties: {
      selectedRoute: { type: 'array', minItems: 1, items: { type: 'string' } },
      requiredInputs: { type: 'array', items: { type: 'string' } },
      blocked: { type: 'boolean' },
    },
  };
}

export function codexPrompt(caseSpec) {
  if (caseSpec.kind === 'approval') {
    return `Use the automatically loaded repository workflow adapter to evaluate the direct workflow ${caseSpec.workflow}. Request: ${caseSpec.request}\nProvided inputs: ${JSON.stringify(caseSpec.providedInputs ?? {})}\nReturn only the output-schema object. Set selectedRoute to exactly ["${caseSpec.workflow}"], list only unresolved or invalid canonical required inputs, and set blocked=true. Do not route to a different workflow, execute the workflow, or modify files.`;
  }
  return `Use the automatically loaded repository workflow adapter to evaluate this routing request: ${caseSpec.request}\nReturn only the output-schema object. Select the shortest safe workflow route and list every canonical required input of the selected downstream workflow, including inputs whose values may be inferred from the request. Set blocked only when a required input or approval cannot be resolved. Do not execute the selected workflow and do not modify files.`;
}

function claudePrompt(caseSpec, namespace) {
  if (caseSpec.kind === 'route') return `/${namespace}:route REQUEST=${JSON.stringify(caseSpec.request)} DEPTH=brief`;
  const args = Object.entries(caseSpec.providedInputs ?? {}).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(' ');
  return `/${namespace}:${caseSpec.workflow}${args ? ` ${args}` : ''}`;
}

function invocation({ assistant, executable, caseSpec, workspace, harness, pluginDir, namespace, condition }) {
  if (assistant === 'claude-code') {
    const debugFile = resolve(harness, 'claude-debug.log');
    return {
      command: executable,
      args: [...(condition === 'plugin-enabled' ? ['--plugin-dir', pluginDir] : []), '--print', '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'dontAsk', '--allowedTools', 'Read,Glob,Grep', '--disallowedTools', 'Write,Edit,NotebookEdit,Bash', '--append-system-prompt', 'Do not modify files or execute shell commands. Return the safest routing decision supported by the available instructions.', '--debug-file', debugFile, condition === 'plugin-enabled' ? claudePrompt(caseSpec, namespace) : caseSpec.request],
      outputFile: null,
      debugFile,
    };
  }
  const schemaFile = resolve(harness, 'output-schema.json');
  const outputFile = resolve(harness, 'last-message.json');
  writeFileSync(schemaFile, `${JSON.stringify(jsonOutputSchema(), null, 2)}\n`, 'utf8');
  return {
    command: executable,
    args: ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--output-schema', schemaFile, '--output-last-message', outputFile, '--json', '--cd', workspace, codexPrompt(caseSpec)],
    outputFile,
    debugFile: null,
  };
}

function parseClaudeResult(stdout) {
  const envelope = JSON.parse(stdout);
  if (typeof envelope.result !== 'string') throw new Error('Claude JSON envelope is missing result text');
  return { text: envelope.result, envelope };
}

function parseCodexEvents(stdout) {
  const events = String(stdout).split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const toolEvents = events.filter((event) => /command|tool|file_change|mcp/iu.test(String(event.type ?? event.item?.type ?? '')));
  return { events, toolEvents };
}

export function classifyProcessFailure(processResult) {
  if (processResult.ok) return null;
  if (processResult.timedOut) return 'timeout';
  const diagnostics = `${processResult.stderr ?? ''}\n${processResult.stdout ?? ''}`;
  if (/\b(?:429|rate[ -]?limit|usage limit|credit balance)\b/iu.test(diagnostics)) return 'rate-limit';
  if (/\b(?:401|403|unauthorized|authentication|login required|not logged in)\b/iu.test(diagnostics)) return 'authentication';
  return 'nonzero-exit';
}

function routeFromClaudeText(text, namespace) {
  return [...text.matchAll(new RegExp(`/${namespace}:([a-z0-9]+(?:-[a-z0-9]+)*)`, 'gu'))].map((match) => match[1]);
}

export function evaluateSemanticCase(caseSpec, output, inventory = []) {
  const selectedRoute = Array.isArray(output.selectedRoute) ? output.selectedRoute : [];
  const requiredInputs = Array.isArray(output.requiredInputs) ? output.requiredInputs : [];
  const inventedSurfaces = selectedRoute.filter((id) => inventory.length > 0 && !inventory.includes(id));
  const expectedRoute = caseSpec.expectedRoute?.[0];
  const routeValid = selectedRoute[0] === expectedRoute;
  const top2RouteValid = selectedRoute.slice(0, 2).includes(expectedRoute);
  const requiredInputsValid = (caseSpec.expectedRequiredInputs ?? []).every((input) => requiredInputs.includes(input));
  const approvalValid = caseSpec.kind !== 'approval' || output.blocked === true;
  const shapeValid = typeof output.blocked === 'boolean';
  return { selectedRoute, requiredInputs, routeValid, top2RouteValid, requiredInputsValid, approvalValid, shapeValid, inventedSurfaces, contractValid: routeValid && requiredInputsValid && approvalValid && shapeValid && inventedSurfaces.length === 0 };
}

export const validateLiveCase = evaluateSemanticCase;

function normalizeClaudeOutput(caseSpec, text, namespace) {
  if (caseSpec.kind === 'route') {
    const selectedRoute = [...new Set(routeFromClaudeText(text, namespace))];
    const requiredInputs = (caseSpec.expectedRequiredInputs ?? []).filter((input) => text.includes(input));
    return { selectedRoute, requiredInputs, blocked: false };
  }
  const missing = caseSpec.expectedRequiredInputs ?? [];
  const requiredInputs = missing.filter((input) => text.includes(input));
  const blockedSignal = /block|missing|required|stop|approval|unresolved|缺少|必填|停止|阻塞/iu.test(text);
  return { selectedRoute: [caseSpec.workflow], requiredInputs, blocked: blockedSignal };
}

function setupHarness(assistant, sandboxRoot, condition) {
  const workspace = resolve(sandboxRoot, 'workspace');
  const harness = resolve(sandboxRoot, 'harness');
  cpSync(resolve(root, 'fixtures/consumer/minimal'), workspace, { recursive: true });
  if (condition === 'plugin-enabled') cpSync(resolve(root, 'nova-plugin'), resolve(harness, 'nova-plugin'), { recursive: true });
  if (assistant === 'codex' && condition === 'plugin-enabled') {
    const adapter = readFileSync(resolve(root, 'adapters/codex/AGENTS.md'), 'utf8');
    writeFileSync(resolve(workspace, 'AGENTS.md'), adapter, 'utf8');
  }
  const stagedAdapterSha256 = assistant === 'codex' && condition === 'plugin-enabled' ? sha256File(resolve(workspace, 'AGENTS.md')) : null;
  return { workspace, harness, pluginDir: condition === 'plugin-enabled' ? resolve(harness, 'nova-plugin') : null, stagedAdapterSha256 };
}

export function deriveAdapterLoadEvidence({ condition, stagedAdapterSha256, expectedAdapterSha256, contractValid }) {
  if (condition === 'plugin-disabled') return { loaded: false, proof: 'plugin-disabled baseline' };
  const digestValid = typeof stagedAdapterSha256 === 'string' && stagedAdapterSha256 === expectedAdapterSha256;
  return { loaded: digestValid && contractValid, proof: `staged-adapter-sha256:${stagedAdapterSha256 ?? 'unavailable'};source-digest-match:${digestValid};semantic-contract-valid:${contractValid}` };
}

function claudeLoadProof(debugFile, pluginDir, resultText) {
  if (!debugFile || !statSync(debugFile, { throwIfNoEntry: false })) return { loaded: false, proof: null };
  const debug = readFileSync(debugFile, 'utf8');
  const pluginMentioned = debug.includes(pluginDir) || /nova-plugin/iu.test(debug);
  const commandContractObserved = /## Recommended Route|PLAN_APPROVED|PLAN_OUTPUT_PATH|REVIEW_FILE|CONTEXT|WORK_SUMMARY/u.test(resultText);
  return { loaded: pluginMentioned && commandContractObserved, proof: `debug-sha256:${sha256Value(debug)};plugin-path-observed:${pluginMentioned};contract-output-observed:${commandContractObserved}` };
}

async function run(options) {
  const executable = options.executable ?? (options.assistant === 'claude-code' ? 'claude' : 'codex');
  const details = await commandDetails(executable, ['--version']);
  if (!details.available) throw new Error(`${executable} is unavailable`);
  const datasetPath = options.profile === 'critical' ? 'evals/critical-live/cases.json' : 'evals/live/cases.json';
  const dataset = readJson(datasetPath);
  const model = loadNovaWorkflowModel(root);
  const inventory = model.spec.workflows.map((entry) => entry.id);
  const selectedCases = options.case ? dataset.cases.filter((entry) => entry.id === options.case) : dataset.cases;
  if (selectedCases.length === 0) throw new Error(`unknown live eval case ${options.case}`);
  const startedAt = new Date().toISOString();
  const results = [];
  for (const caseSpec of selectedCases) {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const sandboxRoot = mkdtempSync(resolve(tmpdir(), 'nova-live-eval-'));
      try {
        const { workspace, harness, pluginDir, stagedAdapterSha256 } = setupHarness(options.assistant, sandboxRoot, options.condition);
        const before = treeDigest(workspace);
        const call = invocation({ assistant: options.assistant, executable, caseSpec, workspace, harness, pluginDir, namespace: model.product.pluginNamespace, condition: options.condition });
        const processResult = await captureProcess(`${options.assistant}:${caseSpec.id}`, call.command, call.args, { cwd: workspace, timeoutMs: 240_000, maxOutputBytes: 1024 * 1024 });
        let parsed = null;
        let validation = { selectedRoute: [], requiredInputs: [], routeValid: false, top2RouteValid: false, requiredInputsValid: false, approvalValid: false, shapeValid: false, inventedSurfaces: [], contractValid: false };
        let parseError = null;
        let adapterLoad = { loaded: false, proof: null };
        let unexpectedToolUse = [];
        if (processResult.ok) {
          try {
            if (options.assistant === 'claude-code') {
              const claude = parseClaudeResult(processResult.stdout);
              parsed = { result: claude.text };
              validation = evaluateSemanticCase(caseSpec, normalizeClaudeOutput(caseSpec, claude.text, model.product.pluginNamespace), inventory);
              adapterLoad = options.condition === 'plugin-enabled' ? claudeLoadProof(call.debugFile, pluginDir, claude.text) : { loaded: false, proof: 'plugin-disabled baseline' };
              unexpectedToolUse = (claude.envelope.permission_denials ?? []).map((entry) => entry.tool_name ?? 'denied-tool');
            } else {
              parsed = JSON.parse(readFileSync(call.outputFile, 'utf8'));
              validation = evaluateSemanticCase(caseSpec, parsed, inventory);
              adapterLoad = deriveAdapterLoadEvidence({ condition: options.condition, stagedAdapterSha256, expectedAdapterSha256: sha256File('adapters/codex/AGENTS.md'), contractValid: validation.contractValid });
              unexpectedToolUse = parseCodexEvents(processResult.stdout).toolEvents.map((event) => String(event.type ?? event.item?.type ?? 'tool-event'));
            }
          } catch (error) { parseError = error.message; }
        }
        const after = treeDigest(workspace);
        const zeroProjectWrites = before === after;
        results.push({
          caseId: caseSpec.id,
          kind: caseSpec.kind,
          approvalExpected: caseSpec.kind === 'approval',
          attempt,
          processExit: processResult.code,
          processFailure: classifyProcessFailure(processResult),
          timedOut: processResult.timedOut,
          latencyMs: processResult.ms,
          projectDigestBefore: before,
          projectDigestAfter: after,
          zeroProjectWrites,
          adapterLoaded: adapterLoad.loaded,
          adapterLoadProof: adapterLoad.proof,
          unexpectedToolUse,
          unexpectedNetworkUse: false,
          ...validation,
          inputTokens: parsed?.usage?.input_tokens ?? null,
          outputTokens: parsed?.usage?.output_tokens ?? null,
          totalTokens: parsed?.usage?.total_tokens ?? null,
          costUsd: parsed?.total_cost_usd ?? null,
          observedOutput: parsed,
          parseError,
          outputSha256: sha256Value(processResult.stdout ?? ''),
        });
      } finally {
        rmSync(sandboxRoot, { recursive: true, force: true });
      }
    }
  }
  const completedAt = new Date().toISOString();
  const passed = results.filter((entry) => entry.contractValid && entry.zeroProjectWrites && (options.condition === 'plugin-disabled' || entry.adapterLoaded) && entry.unexpectedToolUse.length === 0).length;
  const adapterPath = options.assistant === 'claude-code' ? 'workflow-specs/adapters/claude.json' : 'adapters/codex/AGENTS.md';
  const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  const statusResult = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', shell: false });
  const tagResult = spawnSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  const clean = statusResult.status === 0 && statusResult.stdout.trim() === '';
  const allAdapterLoaded = results.every((entry) => entry.adapterLoaded);
  return {
    $schema: '../../schemas/eval-result.schema.json',
    schemaVersion: 1,
    layer: 'live-assistant',
    executionMode: dataset.executionMode,
    workflowSpecSha256: sha256File('workflow-specs/workflows.json'),
    sourceDigests: {
      'workflow-specs/framework.json': sha256File('workflow-specs/framework.json'),
      'workflow-specs/nova.product.json': sha256File('workflow-specs/nova.product.json'),
      'workflow-specs/workflows.json': sha256File('workflow-specs/workflows.json'),
      'workflow-specs/behaviors.json': sha256File('workflow-specs/behaviors.json'),
      [adapterPath]: sha256File(adapterPath),
      'scripts/run-live-assistant-evals.mjs': sha256File('scripts/run-live-assistant-evals.mjs'),
      [datasetPath]: sha256File(datasetPath),
    },
    baseCommit: commitResult.status === 0 ? commitResult.stdout.trim() : 'unavailable',
    releaseTag: tagResult.status === 0 ? tagResult.stdout.trim() : null,
    sourceState: clean ? 'clean-commit' : 'working-tree-with-uncommitted-changes; baseCommit does not contain the digest-bound source state',
    condition: options.condition,
    profile: options.profile,
    assistant: { id: options.assistant, version: details.detail, executable: basename(executable), adapterSha256: sha256File(adapterPath), adapterLoaded: allAdapterLoaded },
    runtime: {
      adapterLoadProof: allAdapterLoaded ? 'per-attempt derived proof recorded in cases' : 'one or more adapter-load proofs failed',
      sandboxProfile: options.assistant === 'codex' ? 'read-only' : 'read-tools-only plus write/shell deny',
      toolPolicy: options.assistant === 'codex' ? 'Codex read-only sandbox with event-derived tool observation' : 'Claude explicit Read/Glob/Grep allowlist and Write/Edit/NotebookEdit/Bash denylist',
      environmentIsolation: 'disposable workspace and separate disposable harness root',
      runnerSha256: sha256File('scripts/run-live-assistant-evals.mjs'),
      datasetSha256: sha256File(datasetPath),
    },
    startedAt,
    completedAt,
    cases: results,
    summary: { total: results.length, passed, attemptsPerCase: options.attempts, uniqueCases: selectedCases.length, unexpectedWrites: results.filter((entry) => !entry.zeroProjectWrites).length, unexpectedToolUses: results.reduce((sum, entry) => sum + entry.unexpectedToolUse.length, 0), inventedSurfaces: results.reduce((sum, entry) => sum + entry.inventedSurfaces.length, 0), adapterLoadFailures: results.filter((entry) => !entry.adapterLoaded).length },
    claimBoundary: 'Public-safe probes with runner-controlled adapter staging, semantic contract, inventory, and tool-boundary evidence. Staging plus contract validity is not an independent model-attestation mechanism. Disabled baselines never receive adapter-load credit. Live assistant API transport is expected network use; arbitrary external network tools are unavailable. L4 additionally requires clean exact-tag release evidence and is not granted by this record alone.',
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
