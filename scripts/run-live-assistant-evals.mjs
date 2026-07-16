#!/usr/bin/env node
/** Run adapter-loaded public-safe live workflow probes against an exact assistant CLI. */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { captureProcess, commandDetails, resolveExecutableInvocation } from './lib/process-runner.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';
import { joinLockedLabels } from './lib/eval-dataset.mjs';
import { assertPublicEvidenceSafe, classifyToolEvidence, deriveAdapterEvidence, normalizeClaudeLoadSignals, normalizeUsage } from './lib/evaluation-evidence.mjs';
import { buildLiveExecutionPlan, governedLiveProfile, validateRelativeOutputPath } from './lib/live-evaluation-plan.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const sha256File = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const sha256Value = (value) => createHash('sha256').update(value).digest('hex');
export const MAX_INVOCATION_TIMEOUT_MS = 240_000;
export const MAX_TOTAL_RUNTIME_MS = 900_000;
const CODEX_DISABLED_FEATURES = ['apps', 'browser_use', 'code_mode_host', 'computer_use', 'image_generation', 'in_app_browser', 'plugins', 'remote_plugin', 'shell_tool', 'workspace_dependencies'];

function usage() {
  return 'Usage: node scripts/run-live-assistant-evals.mjs --assistant <claude-code|codex> [--profile <pilot|critical|full>] [--condition <plugin-enabled|plugin-disabled>] [--executable <path>] [--attempts <governed-value>] [--case <id>] [--output <repository-relative-path>] [--prerequisite-evidence <comma-separated-repository-relative-paths>] --max-invocations <positive-integer> [--timeout-ms <positive-integer>] [--max-total-runtime-ms <positive-integer>] [--plan]';
}

export function parseArgs(args) {
  const parsed = { profile: 'full', condition: 'plugin-enabled', plan: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (seen.has(arg)) throw new Error(`duplicate argument: ${arg}`);
    seen.add(arg);
    if (arg === '--plan') { parsed.plan = true; continue; }
    if (!['--assistant', '--profile', '--condition', '--executable', '--attempts', '--case', '--output', '--prerequisite-evidence', '--max-invocations', '--timeout-ms', '--max-total-runtime-ms'].includes(arg) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(usage());
    parsed[arg.slice(2)] = args[index + 1];
    index += 1;
  }
  if (!['claude-code', 'codex'].includes(parsed.assistant)) throw new Error(usage());
  if (!['pilot', 'critical', 'full'].includes(parsed.profile)) throw new Error(usage());
  if (!['plugin-enabled', 'plugin-disabled'].includes(parsed.condition)) throw new Error(usage());
  const contract = governedLiveProfile(root, parsed.profile);
  if (parsed.attempts !== undefined && Number(parsed.attempts) !== contract.profile.attempts) throw new Error(`--attempts must match governed ${contract.governedId} attempts (${contract.profile.attempts})`);
  parsed.attempts = contract.profile.attempts;
  parsed['max-invocations'] = Number(parsed['max-invocations']);
  if (!Number.isInteger(parsed['max-invocations']) || parsed['max-invocations'] < 1) throw new Error('--max-invocations must be an explicit positive integer');
  parsed.maxInvocations = parsed['max-invocations'];
  delete parsed['max-invocations'];
  parsed.timeoutMs = parsed['timeout-ms'] === undefined ? MAX_INVOCATION_TIMEOUT_MS : Number(parsed['timeout-ms']);
  parsed.maxTotalRuntimeMs = parsed['max-total-runtime-ms'] === undefined ? MAX_TOTAL_RUNTIME_MS : Number(parsed['max-total-runtime-ms']);
  delete parsed['timeout-ms'];
  delete parsed['max-total-runtime-ms'];
  if (!Number.isInteger(parsed.timeoutMs) || parsed.timeoutMs < 1 || parsed.timeoutMs > MAX_INVOCATION_TIMEOUT_MS) throw new Error(`--timeout-ms must be between 1 and ${MAX_INVOCATION_TIMEOUT_MS}`);
  if (!Number.isInteger(parsed.maxTotalRuntimeMs) || parsed.maxTotalRuntimeMs < 1 || parsed.maxTotalRuntimeMs > MAX_TOTAL_RUNTIME_MS) throw new Error(`--max-total-runtime-ms must be between 1 and ${MAX_TOTAL_RUNTIME_MS}`);
  if (parsed.output !== undefined) validateRelativeOutputPath(parsed.output);
  parsed.prerequisiteEvidence = parsed['prerequisite-evidence'] === undefined
    ? []
    : parsed['prerequisite-evidence'].split(',').map((path) => validateRelativeOutputPath(path.trim())).filter(Boolean);
  delete parsed['prerequisite-evidence'];
  return parsed;
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

export function assertLivePrerequisiteEvidence(options) {
  const target = governedLiveProfile(root, options.profile);
  const requiredProfiles = target.profile.prerequisiteProfiles ?? [];
  if (requiredProfiles.length === 0) {
    if ((options.prerequisiteEvidence ?? []).length > 0) throw new Error(`${target.governedId} does not accept prerequisite evidence`);
    return { requiredProfiles: [], records: 0 };
  }
  if ((options.prerequisiteEvidence ?? []).length === 0) throw new Error(`${target.governedId} is blocked until --prerequisite-evidence proves ${requiredProfiles.join(' then ')}`);
  const expectedPairKeys = new Set();
  const observedPairKeys = new Set();
  for (const prerequisite of requiredProfiles) {
    const contract = governedLiveProfile(root, prerequisite);
    for (const assistant of contract.profile.assistants) {
      for (const condition of contract.profile.conditions) expectedPairKeys.add(`${prerequisite}:${assistant}:${condition}`);
    }
  }
  for (const path of options.prerequisiteEvidence) {
    if (!existsSync(resolve(root, path))) throw new Error(`prerequisite evidence is missing: ${path}`);
    const evidence = readJson(path);
    if (!requiredProfiles.includes(evidence.profile)) throw new Error(`${path} is not evidence for required profiles ${requiredProfiles.join(', ')}`);
    const contract = governedLiveProfile(root, evidence.profile);
    const expectedCases = contract.cases.map((entry) => entry.id);
    const expectedTotal = expectedCases.length * contract.profile.attempts;
    const pairKey = `${evidence.profile}:${evidence.assistant?.id}:${evidence.condition}`;
    if (!expectedPairKeys.has(pairKey)) throw new Error(`${path} has an unexpected assistant or condition slice`);
    if (observedPairKeys.has(pairKey)) throw new Error(`${path} duplicates prerequisite slice ${pairKey}`);
    if (evidence.layer !== 'live-assistant' || evidence.datasetId !== contract.profile.datasetId || evidence.datasetVersion !== contract.profile.datasetVersion || evidence.casesPath !== contract.profile.casesPath || evidence.labelsPath !== contract.profile.labelsPath) throw new Error(`${path} semantic dataset identity does not match ${evidence.profile}`);
    if (evidence.sourceState !== 'clean-commit') throw new Error(`${path} was not captured from a clean commit`);
    const requiredDigestPaths = ['workflow-specs/nova.product.json', 'workflow-specs/workflows.v6.json', 'workflow-specs/behaviors.v2.json', 'scripts/run-live-assistant-evals.mjs', contract.profile.casesPath, ...(contract.profile.labelsPath ? [contract.profile.labelsPath] : [])];
    if (requiredDigestPaths.some((sourcePath) => !evidence.sourceDigests?.[sourcePath])) throw new Error(`${path} is missing a required source digest`);
    for (const [sourcePath, digest] of Object.entries(evidence.sourceDigests ?? {})) {
      if (!existsSync(resolve(root, sourcePath)) || sha256File(sourcePath) !== digest) throw new Error(`${path} is stale for ${sourcePath}`);
    }
    const caseIds = [...new Set((evidence.cases ?? []).map((entry) => entry.caseId))];
    if (!sameMembers(caseIds, expectedCases) || evidence.summary?.total !== expectedTotal || evidence.summary?.passed !== expectedTotal || evidence.summary?.uniqueCases !== expectedCases.length || evidence.summary?.attemptsPerCase !== contract.profile.attempts) throw new Error(`${path} does not prove the complete passing ${evidence.profile} slice`);
    if ((evidence.cases ?? []).some((entry) => !entry.contractValid || !entry.zeroProjectWrites || entry.attemptedDangerousTools?.length > 0 || entry.executedDangerousTools?.length > 0 || entry.unknownTools?.length > 0 || !entry.rawArtifactsRemoved)) throw new Error(`${path} violates prerequisite safety or semantic gates`);
    if (evidence.condition === 'plugin-enabled' && (!evidence.assistant?.adapterStaged || (evidence.assistant.id === 'claude-code' && evidence.assistant.adapterLoadObserved !== 'observed'))) throw new Error(`${path} does not prove plugin-enabled adapter staging and load`);
    observedPairKeys.add(pairKey);
  }
  if (!sameMembers([...observedPairKeys], [...expectedPairKeys])) throw new Error(`prerequisite evidence must provide exactly ${expectedPairKeys.size} governed assistant/condition slices`);
  return { requiredProfiles, records: observedPairKeys.size };
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
    required: ['selectedRoute', 'variantParameters', 'requiredInputs', 'blocked'],
    properties: {
      selectedRoute: { type: 'array', minItems: 1, items: { type: 'string' } },
      variantParameters: { type: 'object' },
      requiredInputs: { type: 'array', items: { type: 'string' } },
      blocked: { type: 'boolean' },
    },
  };
}

export function codexPrompt(caseSpec, condition) {
  const schemaOnly = 'Return only the existing output-schema object with selectedRoute, variantParameters, requiredInputs, and blocked. Do not inspect files, call tools, execute a workflow, or modify the environment.';
  if (condition === 'plugin-disabled') {
    return `Classify this request using only ordinary general reasoning: ${caseSpec.request}\n${schemaOnly} Use concise generic route labels, list only inputs you would need before proceeding, and set blocked when execution should stop.`;
  }
  const providedInputs = caseSpec.kind === 'approval' ? `\nProvided inputs: ${JSON.stringify(caseSpec.providedInputs ?? {})}` : '';
  return `A repository workflow adapter has been staged for this isolated workspace. Use that staged workflow contract to classify this request without restating or overriding its routing rules: ${caseSpec.request}${providedInputs}\n${schemaOnly} Select exactly one canonical route from the staged automatic-routing contract and return its exact structured variantParameters. A compatibility alias is not a selected route. Return the complete ordered set of the matched variant workflow's required input names even when values are present, inferred, or resolved; never return only unresolved inputs. Set blocked when a required input or approval is unresolved.`;
}

function claudePrompt(caseSpec, namespace) {
  if (caseSpec.kind === 'route') return `/${namespace}:route REQUEST=${JSON.stringify(caseSpec.request)} DEPTH=brief`;
  const args = Object.entries(caseSpec.providedInputs ?? {}).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(' ');
  return `/${namespace}:${caseSpec.workflow}${args ? ` ${args}` : ''}`;
}

function invocation({ assistant, executable, executableArgsPrefix, caseSpec, workspace, harness, pluginDir, namespace, condition }) {
  if (assistant === 'claude-code') {
    const debugFile = resolve(harness, 'claude-debug.log');
    const systemPrompt = condition === 'plugin-enabled'
      ? `Do not inspect files, execute shell commands, or modify the environment. Return the routing contract's canonical recommendation using fully-qualified /${namespace}:<canonical-workflow-id> syntax and include the exact Variant parameters field. A compatibility alias may be optional information but is not the selected route. Always return the complete ordered set of the matched variant workflow's required input names even when values are present, inferred, or resolved; never return only unresolved inputs.`
      : 'Do not inspect files, call tools, execute commands, or modify the environment. Use ordinary general reasoning only and do not claim that any plugin or adapter is loaded.';
    return {
      command: executable,
      args: [...executableArgsPrefix, ...(condition === 'plugin-enabled' ? ['--plugin-dir', pluginDir] : []), '--print', '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'dontAsk', '--setting-sources', 'local', '--allowedTools', 'Read,Glob,Grep', '--disallowedTools', 'Write,Edit,NotebookEdit,Bash', '--append-system-prompt', systemPrompt, '--debug-file', debugFile, condition === 'plugin-enabled' ? claudePrompt(caseSpec, namespace) : caseSpec.request],
      outputFile: null,
      debugFile,
      env: { ...process.env, CLAUDE_CONFIG_DIR: resolve(harness, 'claude-config') },
    };
  }
  const schemaFile = resolve(harness, 'output-schema.json');
  const outputFile = resolve(harness, 'last-message.json');
  writeFileSync(schemaFile, `${JSON.stringify(jsonOutputSchema(), null, 2)}\n`, 'utf8');
  return {
    command: executable,
    args: [...executableArgsPrefix, 'exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', ...CODEX_DISABLED_FEATURES.flatMap((feature) => ['--disable', feature]), '-c', 'web_search="disabled"', '-c', 'mcp_servers={}', '--output-schema', schemaFile, '--output-last-message', outputFile, '--json', '--cd', workspace, codexPrompt(caseSpec, condition)],
    outputFile,
    debugFile: null,
    env: { ...process.env, CODEX_HOME: resolve(harness, 'codex-home') },
  };
}

function parseClaudeResult(stdout) {
  const envelope = JSON.parse(stdout);
  if (typeof envelope.result !== 'string') throw new Error('Claude JSON envelope is missing result text');
  return { text: envelope.result, envelope };
}

export function parseCodexEvents(stdout) {
  const events = String(stdout).split(/\r?\n/u).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const completed = events.filter((event) => event.type === 'turn.completed').at(-1);
  return { events, usage: completed?.usage ?? null };
}

function classifyParseFailure(error) {
  const message = String(error?.message ?? error);
  if (/ENOENT|missing|did not contain/iu.test(message)) return 'missing-output';
  if (/JSON|Unexpected token|Expected property/iu.test(message)) return 'invalid-json';
  return 'invalid-response';
}

export function classifyProcessFailure(processResult) {
  if (processResult.totalTimedOut) return 'total-timeout';
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

function variantParametersFromClaudeText(text) {
  const line = String(text).split(/\r?\n/u).find((entry) => /Variant parameters\s*:/iu.test(entry));
  if (!line) return {};
  const value = line.slice(line.indexOf(':') + 1).trim().replace(/^`|`$/gu, '');
  if (value === '' || value.toLocaleLowerCase('en-US') === 'none') return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Variant parameters must be a JSON object');
  return parsed;
}

export function evaluateSemanticCase(caseSpec, output, inventory = []) {
  const selectedRoute = Array.isArray(output.selectedRoute) ? output.selectedRoute : [];
  const variantParameters = output.variantParameters && typeof output.variantParameters === 'object' && !Array.isArray(output.variantParameters) ? output.variantParameters : null;
  const requiredInputs = Array.isArray(output.requiredInputs) ? output.requiredInputs : [];
  const inventedSurfaces = selectedRoute.filter((id) => inventory.length > 0 && !inventory.includes(id));
  const expectedRoute = caseSpec.expectedRoute?.[0];
  const routeValid = selectedRoute[0] === expectedRoute;
  const top2RouteValid = selectedRoute.slice(0, 2).includes(expectedRoute);
  const variantParametersValid = variantParameters !== null && isDeepStrictEqual(variantParameters, caseSpec.expectedVariantParameters ?? {});
  const requiredInputsValid = (caseSpec.expectedRequiredInputs ?? []).every((input) => requiredInputs.includes(input));
  const approvalValid = caseSpec.kind !== 'approval' || output.blocked === true;
  const shapeValid = typeof output.blocked === 'boolean' && variantParameters !== null;
  return { selectedRoute, variantParameters: variantParameters ?? {}, requiredInputs, routeValid, top2RouteValid, variantParametersValid, requiredInputsValid, approvalValid, shapeValid, inventedSurfaces, contractValid: routeValid && variantParametersValid && requiredInputsValid && approvalValid && shapeValid && inventedSurfaces.length === 0 };
}

export const validateLiveCase = evaluateSemanticCase;

function normalizeClaudeOutput(caseSpec, text, namespace, workflows, automaticTargets) {
  if (caseSpec.kind === 'route') {
    const selectedRoute = [...new Set(routeFromClaudeText(text, namespace).filter((route) => automaticTargets.has(route)))];
    const requiredInputs = (caseSpec.expectedRequiredInputs ?? []).filter((input) => text.includes(input));
    return { selectedRoute, variantParameters: variantParametersFromClaudeText(text), requiredInputs, blocked: false };
  }
  const missing = caseSpec.expectedRequiredInputs ?? [];
  const requiredInputs = missing.filter((input) => text.includes(input));
  const blockedSignal = /block|missing|required|stop|approval|unresolved|缺少|必填|停止|阻塞/iu.test(text);
  const workflow = workflows.get(caseSpec.workflow);
  if (!workflow) throw new Error(`unknown direct workflow ${caseSpec.workflow}`);
  return { selectedRoute: [workflow.canonicalSurfaceId], variantParameters: workflow.variantPreset, requiredInputs, blocked: blockedSignal };
}

function setupHarness(assistant, sandboxRoot, condition) {
  const workspace = resolve(sandboxRoot, 'workspace');
  const harness = resolve(sandboxRoot, 'harness');
  mkdirSync(harness, { recursive: true });
  cpSync(resolve(root, 'fixtures/consumer/minimal'), workspace, { recursive: true });
  if (condition === 'plugin-enabled') cpSync(resolve(root, 'nova-plugin'), resolve(harness, 'nova-plugin'), { recursive: true });
  if (assistant === 'codex' && condition === 'plugin-enabled') {
    const adapter = readFileSync(resolve(root, 'adapters/codex/AGENTS.md'), 'utf8');
    writeFileSync(resolve(workspace, 'AGENTS.md'), adapter, 'utf8');
  }
  if (assistant === 'codex') {
    const codexHome = resolve(harness, 'codex-home');
    mkdirSync(codexHome, { recursive: true });
    const authSource = resolve(process.env.CODEX_HOME ?? resolve(homedir(), '.codex'), 'auth.json');
    if (existsSync(authSource)) cpSync(authSource, resolve(codexHome, 'auth.json'));
  }
  if (assistant === 'claude-code') {
    const claudeConfig = resolve(harness, 'claude-config');
    mkdirSync(claudeConfig, { recursive: true });
    const credentialSource = resolve(process.env.CLAUDE_CONFIG_DIR ?? resolve(homedir(), '.claude'), '.credentials.json');
    if (existsSync(credentialSource)) cpSync(credentialSource, resolve(claudeConfig, '.credentials.json'));
  }
  const codexDigestMatches = assistant === 'codex' && condition === 'plugin-enabled' && sha256File(resolve(workspace, 'AGENTS.md')) === sha256File('adapters/codex/AGENTS.md');
  const claudePluginStaged = assistant === 'claude-code' && condition === 'plugin-enabled' && existsSync(resolve(harness, 'nova-plugin/.claude-plugin/plugin.json'));
  return { workspace, harness, pluginDir: condition === 'plugin-enabled' ? resolve(harness, 'nova-plugin') : null, adapterStaged: codexDigestMatches || claudePluginStaged };
}

export async function runLiveEvaluation(options, { commandDetailsFn = commandDetails, captureProcessFn = captureProcess, prerequisiteEvidenceFn = assertLivePrerequisiteEvidence } = {}) {
  const plan = buildLiveExecutionPlan(root, options);
  prerequisiteEvidenceFn(options);
  const requestedExecutable = options.executable ?? (options.assistant === 'claude-code' ? 'claude' : 'codex');
  const executable = resolveExecutableInvocation(requestedExecutable);
  const details = await commandDetailsFn(executable.command, [...executable.argsPrefix, '--version']);
  if (!details.available) throw new Error(`${basename(requestedExecutable)} is unavailable`);
  const contract = governedLiveProfile(root, options.profile);
  const datasetPath = contract.profile.casesPath;
  const dataset = readJson(datasetPath);
  if (contract.profile.labelsPath) dataset.cases = joinLockedLabels(dataset, readJson(contract.profile.labelsPath));
  const model = loadNovaWorkflowModel(root);
  const workflows = new Map(model.spec.workflows.map((entry) => [entry.id, entry]));
  const inventory = model.product.automaticRouting.canonicalTargets;
  const automaticTargets = new Set(inventory);
  const selectedCases = options.case ? dataset.cases.filter((entry) => entry.id === options.case) : dataset.cases;
  if (selectedCases.length === 0) throw new Error(`unknown live eval case ${options.case}`);
  if (selectedCases.length * options.attempts !== plan.plannedInvocations) throw new Error('live execution plan drifted after dataset loading');
  const startedAt = new Date().toISOString();
  const runStartedMs = Date.now();
  const results = [];
  for (const caseSpec of selectedCases) {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const sandboxRoot = mkdtempSync(resolve(tmpdir(), 'nova-live-eval-'));
      let resultEntry;
      try {
        const { workspace, harness, pluginDir, adapterStaged } = setupHarness(options.assistant, sandboxRoot, options.condition);
        const before = treeDigest(workspace);
        const call = invocation({ assistant: options.assistant, executable: executable.command, executableArgsPrefix: executable.argsPrefix, caseSpec, workspace, harness, pluginDir, namespace: model.product.pluginNamespace, condition: options.condition });
        const remainingRuntimeMs = options.maxTotalRuntimeMs - (Date.now() - runStartedMs);
        const processResult = remainingRuntimeMs <= 0
          ? { ok: false, code: null, timedOut: true, totalTimedOut: true, ms: 0, stdout: '', stderr: '' }
          : await captureProcessFn(`${options.assistant}:${caseSpec.id}`, call.command, call.args, { cwd: workspace, env: call.env, timeoutMs: Math.min(options.timeoutMs, remainingRuntimeMs), maxOutputBytes: 1024 * 1024 });
        let parsed = null;
        let validation = { selectedRoute: [], variantParameters: {}, requiredInputs: [], routeValid: false, top2RouteValid: false, variantParametersValid: false, requiredInputsValid: false, approvalValid: false, shapeValid: false, inventedSurfaces: [], contractValid: false };
        let parseFailure = null;
        let usage = normalizeUsage(null);
        let toolEvidence = classifyToolEvidence({ assistant: options.assistant, condition: options.condition });
        let codexEvents = [];
        if (processResult.ok) {
          try {
            if (options.assistant === 'claude-code') {
              const claude = parseClaudeResult(processResult.stdout);
              parsed = { result: claude.text };
              usage = normalizeUsage({
                inputTokens: claude.envelope.usage?.input_tokens ?? null,
                outputTokens: claude.envelope.usage?.output_tokens ?? null,
                totalTokens: claude.envelope.usage?.total_tokens ?? null,
                costUsd: claude.envelope.total_cost_usd ?? null,
              });
              validation = evaluateSemanticCase(caseSpec, normalizeClaudeOutput(caseSpec, claude.text, model.product.pluginNamespace, workflows, automaticTargets), inventory);
              toolEvidence = classifyToolEvidence({ assistant: options.assistant, condition: options.condition, permissionDenials: claude.envelope.permission_denials ?? [] });
            } else {
              parsed = JSON.parse(readFileSync(call.outputFile, 'utf8'));
              const codex = parseCodexEvents(processResult.stdout);
              codexEvents = codex.events;
              usage = normalizeUsage({ inputTokens: codex.usage?.input_tokens, outputTokens: codex.usage?.output_tokens, totalTokens: codex.usage?.total_tokens, costUsd: null });
              validation = evaluateSemanticCase(caseSpec, parsed, inventory);
              toolEvidence = classifyToolEvidence({ assistant: options.assistant, condition: options.condition, events: codexEvents });
            }
          } catch (error) { parseFailure = classifyParseFailure(error); }
        }
        const claudeLoadSignals = options.assistant === 'claude-code' && call.debugFile && existsSync(call.debugFile)
          ? normalizeClaudeLoadSignals(readFileSync(call.debugFile, 'utf8'))
          : [];
        const adapterEvidence = deriveAdapterEvidence({ assistant: options.assistant, condition: options.condition, adapterStaged, toolEvidence, events: codexEvents, claudeLoadSignals });
        const after = treeDigest(workspace);
        const zeroProjectWrites = before === after;
        const processFailure = classifyProcessFailure(processResult);
        resultEntry = {
          caseId: caseSpec.id,
          kind: caseSpec.kind,
          approvalExpected: caseSpec.kind === 'approval',
          attempt,
          processExit: processResult.code,
          processFailure,
          timedOut: processResult.timedOut,
          latencyMs: processResult.ms,
          projectDigestBefore: before,
          projectDigestAfter: after,
          zeroProjectWrites,
          ...adapterEvidence,
          ...toolEvidence,
          ...validation,
          ...usage,
          responseSummary: processFailure ? `process-failed:${processFailure}` : parseFailure ? `parse-failed:${parseFailure}` : validation.contractValid ? 'contract-valid' : 'contract-invalid',
          parseFailure,
          rawOutputSha256: sha256Value(processResult.stdout ?? ''),
          rawErrorSha256: sha256Value(processResult.stderr ?? ''),
          rawOutputBytes: Buffer.byteLength(processResult.stdout ?? ''),
          rawErrorBytes: Buffer.byteLength(processResult.stderr ?? ''),
        };
      } finally {
        rmSync(sandboxRoot, { recursive: true, force: true });
      }
      resultEntry.rawArtifactsRemoved = !existsSync(sandboxRoot);
      if (!resultEntry.rawArtifactsRemoved) throw new Error('failed to remove raw live evaluation artifacts');
      results.push(resultEntry);
    }
  }
  const completedAt = new Date().toISOString();
  const passed = results.filter((entry) => {
    const adapterEvidenceValid = options.condition === 'plugin-disabled'
      || (entry.adapterStaged && (options.assistant === 'codex' || entry.adapterLoadObserved === 'observed'));
    return entry.contractValid && entry.zeroProjectWrites && entry.attemptedDangerousTools.length === 0 && entry.unknownTools.length === 0 && adapterEvidenceValid;
  }).length;
  const adapterPath = options.assistant === 'claude-code' ? 'workflow-specs/adapters/claude.json' : 'adapters/codex/AGENTS.md';
  const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  const statusResult = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', shell: false });
  const tagResult = spawnSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  const clean = statusResult.status === 0 && statusResult.stdout.trim() === '';
  const allAdapterStaged = options.condition === 'plugin-enabled' && results.every((entry) => entry.adapterStaged);
  const loadStatuses = [...new Set(results.map((entry) => entry.adapterLoadObserved))];
  const aggregateLoadStatus = loadStatuses.length === 1 ? loadStatuses[0] : 'unavailable';
  const evidence = {
    $schema: '../../schemas/eval-result.schema.json',
    schemaVersion: 1,
    layer: 'live-assistant',
    executionMode: dataset.executionMode,
    workflowSpecSha256: sha256File('workflow-specs/workflows.v6.json'),
    sourceDigests: {
      'workflow-specs/framework.json': sha256File('workflow-specs/framework.json'),
      'workflow-specs/nova.product.json': sha256File('workflow-specs/nova.product.json'),
      'workflow-specs/workflows.v6.json': sha256File('workflow-specs/workflows.v6.json'),
      'workflow-specs/behaviors.v2.json': sha256File('workflow-specs/behaviors.v2.json'),
      [adapterPath]: sha256File(adapterPath),
      'scripts/run-live-assistant-evals.mjs': sha256File('scripts/run-live-assistant-evals.mjs'),
      [datasetPath]: sha256File(datasetPath),
      ...(contract.profile.labelsPath ? { [contract.profile.labelsPath]: sha256File(contract.profile.labelsPath) } : {}),
    },
    baseCommit: commitResult.status === 0 ? commitResult.stdout.trim() : 'unavailable',
    releaseTag: tagResult.status === 0 ? tagResult.stdout.trim() : null,
    sourceState: clean ? 'clean-commit' : 'working-tree-with-uncommitted-changes; baseCommit does not contain the digest-bound source state',
    condition: options.condition,
    profile: options.profile,
    datasetId: contract.profile.datasetId,
    datasetVersion: contract.profile.datasetVersion,
    casesPath: contract.profile.casesPath,
    labelsPath: contract.profile.labelsPath,
    assistant: { id: options.assistant, version: details.detail, executable: basename(requestedExecutable), adapterSha256: sha256File(adapterPath), adapterStaged: allAdapterStaged, adapterLoadObserved: aggregateLoadStatus },
    runtime: {
      adapterLoadPolicy: 'adapter staging, load observation, and semantic contract are independent per-attempt facts',
      sandboxProfile: options.assistant === 'codex' ? 'read-only' : 'read-tools-only plus write/shell deny',
      toolPolicy: options.assistant === 'codex' ? 'Codex read-only sandbox with isolated configuration, disabled MCP/plugin/shell/browser surfaces, and fail-closed final-state JSONL classification' : 'Claude explicit Read/Glob/Grep allowlist and Write/Edit/NotebookEdit/Bash denylist; canonical Skill is read-only orchestration only when plugin-enabled',
      environmentIsolation: options.assistant === 'codex' ? 'disposable workspace, harness, and CODEX_HOME with ephemeral auth copy removed after every attempt' : 'disposable workspace and separate disposable harness root',
      executableResolution: executable.resolutionKind,
      invocationTimeoutMs: options.timeoutMs,
      maxTotalRuntimeMs: options.maxTotalRuntimeMs,
      runnerSha256: sha256File('scripts/run-live-assistant-evals.mjs'),
      datasetSha256: sha256File(datasetPath),
    },
    startedAt,
    completedAt,
    cases: results,
    summary: { total: results.length, passed, attemptsPerCase: options.attempts, uniqueCases: selectedCases.length, unexpectedWrites: results.filter((entry) => !entry.zeroProjectWrites).length, attemptedDangerousTools: results.reduce((sum, entry) => sum + entry.attemptedDangerousTools.length, 0), executedDangerousTools: results.reduce((sum, entry) => sum + entry.executedDangerousTools.length, 0), deniedOrFailedDangerousTools: results.reduce((sum, entry) => sum + entry.deniedOrFailedDangerousTools.length, 0), unknownTools: results.reduce((sum, entry) => sum + entry.unknownTools.length, 0), inventedSurfaces: results.reduce((sum, entry) => sum + entry.inventedSurfaces.length, 0), adapterStagingFailures: options.condition === 'plugin-enabled' ? results.filter((entry) => !entry.adapterStaged).length : 0, adapterLoadObserved: results.filter((entry) => entry.adapterLoadObserved === 'observed').length, adapterLoadUnavailable: results.filter((entry) => entry.adapterLoadObserved === 'unavailable').length, rawArtifactCleanupFailures: results.filter((entry) => !entry.rawArtifactsRemoved).length },
    claimBoundary: 'Public-safe probes with runner-controlled adapter staging, separately classified load observation, semantic contract, inventory, and final-state tool lifecycle evidence. A staged adapter or successful contract never substitutes for observed load evidence. Codex tool evidence retains only normalized lifecycle state, tool type, hashed item identity, and public-safe or hashed MCP identifiers; parameters, responses, paths, credentials, and raw events are discarded. Disabled baselines never receive adapter-load credit. Live assistant API transport is expected network use; arbitrary external network tools are unsafe. L4 additionally requires clean exact-tag release evidence and is not granted by this record alone.',
  };
  return assertPublicEvidenceSafe(evidence);
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const plan = assertPublicEvidenceSafe(buildLiveExecutionPlan(root, options));
  if (options.plan) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  const result = await runLiveEvaluation(options);
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
