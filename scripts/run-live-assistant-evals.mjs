#!/usr/bin/env node
/** Run public-safe live workflow probes against an exact assistant CLI. */

import { createHash } from 'node:crypto';
import { accessSync, closeSync, constants as fsConstants, cpSync, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, delimiter, dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { captureProcess, commandDetails, resolveExecutableInvocation } from './lib/process-runner.mjs';
import { resolveCompiledVariantContract } from '../framework/compiler/compile-runtime-contracts.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModelV6FromReader } from './lib/workflow-model.mjs';
import { assertPublicEvidenceSafe, classifyToolEvidence, deriveAdapterEvidence, normalizeClaudeLoadSignals, normalizePublicAssistantVersion, normalizeUsage } from './lib/evaluation-evidence.mjs';
import { assertCleanGitRepository, gitExactTag, gitHead, gitSnapshotReader, gitWorktreeSourceReader } from './lib/git-source-snapshot.mjs';
import { buildLiveExecutionPlan, evaluateSemanticCase, governedLiveProfile, LIVE_EXECUTABLE_PROVENANCE_UNVERIFIED, liveEvaluationSourcePaths, recomputeLiveSummary, validateRelativeOutputPath } from './lib/live-evaluation-plan.mjs';
import { createPhysicalReadBoundary, preparePhysicalFileWrite, readPhysicalFile, writePhysicalFileAtomically } from './lib/physical-read-boundary.mjs';
import { assertPortableRelativePath } from './lib/portable-path.mjs';
import { compileStandardSchema, formatAjvErrors } from './lib/schema-engine.mjs';
import { stageRepositoryFile, stageRepositoryTree } from './lib/source-tree-staging.mjs';

const root = repoRoot(import.meta.url);
const sha256File = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const sha256Value = (value) => createHash('sha256').update(value).digest('hex');
export const MAX_INVOCATION_TIMEOUT_MS = 240_000;
export const MAX_TOTAL_RUNTIME_MS = 900_000;
const CODEX_DISABLED_FEATURES = ['apps', 'browser_use', 'code_mode_host', 'computer_use', 'image_generation', 'in_app_browser', 'plugins', 'remote_plugin', 'shell_tool', 'workspace_dependencies'];
const LIVE_CONSUMER_POLICY_PATH = 'fixtures/consumer/minimal/AGENTS.md';
export const LIVE_PROCESS_ENVIRONMENT_POLICY = 'minimal allowlisted process environment with isolated HOME and assistant config; endpoint, provider, model, proxy, shell-startup, and runtime injection overrides are not inherited';

export function loadLiveRoutingSemantics(sourceReader = gitWorktreeSourceReader(root)) {
  const routeOutputContract = sourceReader.readJson('nova-plugin/runtime/route-output-contract.json');
  const product = sourceReader.readJson('workflow-specs/nova.product.json');
  return Object.freeze({
    routeOutputContract,
    routeFieldLabels: Object.freeze(routeOutputContract.fields.map((field) => String(field.label).replace(/:$/u, ''))),
    agentInventory: new Set(product.agents),
    packInventory: new Set(product.packs),
  });
}

export function loadLiveEvaluationSemantics(sourceReader = gitWorktreeSourceReader(root)) {
  return Object.freeze({
    ...loadLiveRoutingSemantics(sourceReader),
    validateEvidence: compileStandardSchema(sourceReader.readJson('schemas/eval-result.schema.json')),
  });
}

export function composeCodexAgents(neutralPolicy, generatedAdapter) {
  if (typeof neutralPolicy !== 'string' || neutralPolicy.trim() === '') throw new TypeError('neutral consumer policy must be non-empty text');
  if (typeof generatedAdapter !== 'string' || generatedAdapter.trim() === '') throw new TypeError('generated Codex adapter must be non-empty text');
  return `${neutralPolicy.trimEnd()}\n\n<!-- Generated Nova adapter: plugin-enabled condition only. -->\n\n${generatedAdapter.trimStart()}`;
}

function usage() {
  return 'Usage: node scripts/run-live-assistant-evals.mjs --assistant <claude-code|codex> [--profile <pilot|critical|full>] [--condition <plugin-enabled|plugin-disabled>] [--executable <path>] [--attempts <governed-value>] [--case <id>] [--output <.metrics/live-eval/file.json>] [--prerequisite-evidence <comma-separated-repository-relative-paths>] --max-invocations <positive-integer> [--timeout-ms <positive-integer>] [--max-total-runtime-ms <positive-integer>] [--plan]';
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
  if (parsed.output !== undefined) parsed.output = validateRelativeOutputPath(parsed.output);
  parsed.prerequisiteEvidence = parsed['prerequisite-evidence'] === undefined
    ? []
    : parsed['prerequisite-evidence'].split(',').map((path) => assertPortableRelativePath(path.trim(), '--prerequisite-evidence')).filter(Boolean);
  delete parsed['prerequisite-evidence'];
  if (parsed.output !== undefined && parsed.prerequisiteEvidence.includes(parsed.output)) {
    throw new Error('--output must not alias --prerequisite-evidence');
  }
  return parsed;
}

function liveArtifactPath(repoRoot, path, label) {
  return resolve(repoRoot, assertPortableRelativePath(path, label));
}

export function readLivePrerequisiteEvidence(repoRoot, path, boundary = createPhysicalReadBoundary(repoRoot, 'live evaluation repository')) {
  let record;
  try {
    record = readPhysicalFile(
      boundary,
      liveArtifactPath(repoRoot, path, 'prerequisite evidence path'),
      `prerequisite evidence ${path}`,
    );
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`prerequisite evidence is missing: ${path}`);
    throw error;
  }
  return JSON.parse(record.buffer.toString('utf8'));
}

export function writeLiveEvaluationOutput(repoRoot, path, content, preparation = null) {
  const boundary = preparation?.boundary ?? createPhysicalReadBoundary(repoRoot, 'live evaluation repository');
  return writePhysicalFileAtomically(
    boundary,
    liveArtifactPath(repoRoot, path, 'live evaluation output path'),
    content,
    `live evaluation output ${path}`,
    { preparation },
  );
}

export function prepareLiveEvaluationOutput(repoRoot, path) {
  if (path === undefined) return null;
  const normalized = validateRelativeOutputPath(path);
  const boundary = createPhysicalReadBoundary(repoRoot, 'live evaluation repository');
  return preparePhysicalFileWrite(
    boundary,
    liveArtifactPath(repoRoot, normalized, 'live evaluation output path'),
    `live evaluation output ${normalized}`,
  );
}

function assertLiveArtifactSeparation(repoRoot, prerequisitePaths, outputPreparation) {
  if (!outputPreparation?.targetIdentity || prerequisitePaths.length === 0) return;
  for (const path of prerequisitePaths) {
    const portable = assertPortableRelativePath(path, '--prerequisite-evidence');
    const record = readPhysicalFile(
      outputPreparation.boundary,
      liveArtifactPath(repoRoot, portable, 'prerequisite evidence path'),
      `prerequisite evidence ${portable}`,
    );
    if (record.dev === outputPreparation.targetIdentity.dev && record.ino === outputPreparation.targetIdentity.ino) {
      throw new Error('--output must not physically alias --prerequisite-evidence');
    }
  }
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

const PREREQUISITE_SEMANTIC_FIELDS = Object.freeze([
  'routeValid',
  'variantParametersValid',
  'requiredInputsValid',
  'approvalValid',
  'shapeValid',
  'inventedSurfaces',
  'contractValid',
]);
const PREREQUISITE_ADAPTER_FIELDS = Object.freeze(['adapterStaged', 'adapterLoadObserved', 'adapterLoadReasonCode', 'adapterLoadSignals']);

function assertPrerequisiteAdapterEvidence(path, entry, assistantId, condition) {
  const expected = condition === 'plugin-disabled' || assistantId === 'claude-code' || entry.adapterStaged === false
    ? deriveAdapterEvidence({
        assistant: assistantId,
        condition,
        adapterStaged: entry.adapterStaged,
        claudeLoadSignals: entry.adapterLoadSignals,
      })
    : {
        adapterStaged: true,
        adapterLoadObserved: 'unavailable',
        adapterLoadReasonCode: 'codex-load-event-unavailable',
        adapterLoadSignals: entry.adapterLoadSignals,
      };
  const driftedFields = PREREQUISITE_ADAPTER_FIELDS.filter((field) => !isDeepStrictEqual(entry[field], expected[field]));
  if (driftedFields.length > 0) {
    throw new Error(`${path} case ${entry.caseId}:${entry.attempt} adapter fields differ from recomputation: ${driftedFields.join(', ')}`);
  }
}

function disabledPrerequisiteCasePassed(entry) {
  return entry.processExit === 0
    && entry.processFailure === null
    && entry.timedOut === false
    && entry.parseFailure === null
    && entry.zeroProjectWrites === true
    && entry.projectDigestBefore === entry.projectDigestAfter
    && entry.adapterStaged === false
    && entry.adapterLoadObserved === 'not-applicable'
    && entry.adapterLoadSignals.length === 0
    && !entry.observedTools.includes('Skill')
    && entry.attemptedDangerousTools.length === 0
    && entry.executedDangerousTools.length === 0
    && entry.deniedOrFailedDangerousTools.length === 0
    && entry.unknownTools.length === 0
    && entry.rawArtifactsRemoved === true;
}

export function liveEvaluationSucceeded(evidence) {
  if (evidence?.condition === 'plugin-disabled') {
    return Array.isArray(evidence.cases)
      && evidence.cases.length > 0
      && evidence.cases.every(disabledPrerequisiteCasePassed);
  }
  return Number.isInteger(evidence?.summary?.passed)
    && Number.isInteger(evidence?.summary?.total)
    && evidence.summary.passed === evidence.summary.total;
}

function assertPrerequisiteCaseEvidence(path, evidence, contract, product) {
  const expectedAttemptKeys = contract.cases.flatMap((caseSpec) => Array.from(
    { length: contract.profile.attempts },
    (_unused, index) => `${caseSpec.id}:${index + 1}`,
  ));
  const actualAttemptKeys = evidence.cases.map((entry) => `${entry.caseId}:${entry.attempt}`);
  if (!sameMembers(actualAttemptKeys, expectedAttemptKeys)) {
    throw new Error(`${path} does not contain the exact governed caseId and attempt inventory`);
  }
  const caseById = new Map(contract.cases.map((caseSpec) => [caseSpec.id, caseSpec]));
  for (const entry of evidence.cases) {
    const caseSpec = caseById.get(entry.caseId);
    if (entry.zeroProjectWrites !== (entry.projectDigestBefore === entry.projectDigestAfter)) {
      throw new Error(`${path} case ${entry.caseId}:${entry.attempt} zeroProjectWrites differs from project digests`);
    }
    assertPrerequisiteAdapterEvidence(path, entry, evidence.assistant.id, evidence.condition);
    const semantic = evaluateSemanticCase(caseSpec, entry, product.automaticRouting.canonicalTargets);
    if (entry.kind !== caseSpec.kind || entry.approvalExpected !== (caseSpec.kind === 'approval')) {
      throw new Error(`${path} case ${entry.caseId}:${entry.attempt} kind metadata differs from the governed case`);
    }
    const driftedFields = PREREQUISITE_SEMANTIC_FIELDS.filter((field) => !isDeepStrictEqual(entry[field], semantic[field]));
    if (driftedFields.length > 0) {
      throw new Error(`${path} case ${entry.caseId}:${entry.attempt} semantic fields differ from recomputation: ${driftedFields.join(', ')}`);
    }
  }
  const recomputedSummary = recomputeLiveSummary(
    evidence.cases,
    contract.profile.attempts,
    evidence.assistant.id,
    evidence.condition,
  );
  const summaryDrift = Object.entries(recomputedSummary)
    .filter(([field, value]) => !isDeepStrictEqual(evidence.summary[field], value))
    .map(([field]) => field);
  if (summaryDrift.length > 0) {
    throw new Error(`${path} summary differs from recomputed case evidence: ${summaryDrift.join(', ')}`);
  }
  if (evidence.condition === 'plugin-enabled' && recomputedSummary.passed !== expectedAttemptKeys.length) {
    throw new Error(`${path} contains an enabled case that does not pass the recomputed prerequisite safety and exact semantic gates`);
  }
  if (evidence.condition === 'plugin-disabled' && !evidence.cases.every(disabledPrerequisiteCasePassed)) {
    throw new Error(`${path} contains a disabled baseline case that does not pass prerequisite completeness, process, parsing, safety, zero-write, and no-plugin gates`);
  }
  const expectedAdapterStaged = evidence.condition === 'plugin-enabled' && evidence.cases.every((entry) => entry.adapterStaged);
  const loadStatuses = [...new Set(evidence.cases.map((entry) => entry.adapterLoadObserved))];
  const expectedLoadStatus = loadStatuses.length === 1 ? loadStatuses[0] : 'unavailable';
  if (evidence.assistant.adapterStaged !== expectedAdapterStaged || evidence.assistant.adapterLoadObserved !== expectedLoadStatus) {
    throw new Error(`${path} assistant adapter aggregate differs from per-attempt evidence`);
  }
  return recomputedSummary;
}

function validateLivePrerequisiteEvidence(options, context = {}) {
  const head = context.baseCommit ?? gitHead(root);
  const sourceReader = context.sourceReader ?? gitSnapshotReader(root, head);
  const target = governedLiveProfile(root, options.profile, { readJson: sourceReader.readJson });
  const product = sourceReader.readJson('workflow-specs/nova.product.json');
  const validateEvalResultEvidence = compileStandardSchema(sourceReader.readJson('schemas/eval-result.schema.json'));
  const requiredProfiles = target.profile.prerequisiteProfiles ?? [];
  if (requiredProfiles.length === 0) {
    if ((options.prerequisiteEvidence ?? []).length > 0) throw new Error(`${target.governedId} does not accept prerequisite evidence`);
    return { requiredProfiles: [], records: 0 };
  }
  if ((options.prerequisiteEvidence ?? []).length === 0) throw new Error(`${target.governedId} is blocked until --prerequisite-evidence proves ${requiredProfiles.join(' then ')}`);
  const evidenceBoundary = createPhysicalReadBoundary(root, 'live evaluation repository');
  const expectedPairKeys = new Set();
  const observedPairKeys = new Set();
  for (const prerequisite of requiredProfiles) {
    const contract = governedLiveProfile(root, prerequisite, { readJson: sourceReader.readJson });
    for (const assistant of contract.profile.assistants) {
      for (const condition of contract.profile.conditions) expectedPairKeys.add(`${prerequisite}:${assistant}:${condition}`);
    }
  }
  for (const path of options.prerequisiteEvidence) {
    const evidence = readLivePrerequisiteEvidence(root, path, evidenceBoundary);
    const schemaValid = validateEvalResultEvidence(evidence);
    if (!schemaValid) {
      throw new Error(`${path} does not match the evaluation result schema: ${formatAjvErrors(validateEvalResultEvidence.errors).join('; ')}`);
    }
    if (normalizePublicAssistantVersion(evidence.assistant?.version) !== evidence.assistant?.version) {
      throw new Error(`${path} assistant version is not a normalized public identity`);
    }
    if (!requiredProfiles.includes(evidence.profile)) throw new Error(`${path} is not evidence for required profiles ${requiredProfiles.join(', ')}`);
    const contract = governedLiveProfile(root, evidence.profile, { readJson: sourceReader.readJson });
    const expectedCases = contract.cases.map((entry) => entry.id);
    const expectedTotal = expectedCases.length * contract.profile.attempts;
    const pairKey = `${evidence.profile}:${evidence.assistant?.id}:${evidence.condition}`;
    if (!expectedPairKeys.has(pairKey)) throw new Error(`${path} has an unexpected assistant or condition slice`);
    if (observedPairKeys.has(pairKey)) throw new Error(`${path} duplicates prerequisite slice ${pairKey}`);
    if (evidence.layer !== 'live-assistant' || evidence.datasetId !== contract.profile.datasetId || evidence.datasetVersion !== contract.profile.datasetVersion || evidence.casesPath !== contract.profile.casesPath || evidence.labelsPath !== contract.profile.labelsPath) throw new Error(`${path} semantic dataset identity does not match ${evidence.profile}`);
    if (evidence.sourceState !== 'clean-commit') throw new Error(`${path} was not captured from a clean commit`);
    if (evidence.baseCommit !== head) throw new Error(`${path} base commit does not match the current repository HEAD`);
    const adapterPath = evidence.assistant.id === 'claude-code' ? 'workflow-specs/adapters/claude.json' : 'adapters/codex/AGENTS.md';
    const requiredDigestPaths = liveEvaluationSourcePaths(root, {
      assistantId: evidence.assistant.id,
      condition: evidence.condition,
      casesPath: contract.profile.casesPath,
      labelsPath: contract.profile.labelsPath,
    }, { readText: sourceReader.readText, readJson: sourceReader.readJson, listFiles: sourceReader.listFiles });
    if (!sameMembers(Object.keys(evidence.sourceDigests ?? {}), requiredDigestPaths)) throw new Error(`${path} does not contain the exact governed source digest inventory`);
    for (const [sourcePath, digest] of Object.entries(evidence.sourceDigests ?? {})) {
      if (sourceReader.sha256(sourcePath) !== digest) throw new Error(`${path} is stale for ${sourcePath}`);
    }
    if (evidence.workflowSpecSha256 !== evidence.sourceDigests['workflow-specs/workflows.v6.json']
      || evidence.assistant.adapterSha256 !== evidence.sourceDigests[adapterPath]
      || evidence.runtime?.runnerSha256 !== evidence.sourceDigests['scripts/run-live-assistant-evals.mjs']
      || evidence.runtime?.datasetSha256 !== evidence.sourceDigests[contract.profile.casesPath]) {
      throw new Error(`${path} digest aggregates differ from the verified governed source digests`);
    }
    assertPrerequisiteCaseEvidence(path, evidence, contract, product);
    const enabledSemanticPass = evidence.condition !== 'plugin-enabled' || evidence.summary.passed === expectedTotal;
    if (evidence.summary.total !== expectedTotal || !enabledSemanticPass || evidence.summary.uniqueCases !== expectedCases.length || evidence.summary.attemptsPerCase !== contract.profile.attempts) throw new Error(`${path} does not prove the complete governed ${evidence.profile} slice`);
    observedPairKeys.add(pairKey);
  }
  if (!sameMembers([...observedPairKeys], [...expectedPairKeys])) throw new Error(`prerequisite evidence must provide exactly ${expectedPairKeys.size} governed assistant/condition slices`);
  return { requiredProfiles, records: observedPairKeys.size };
}

export function inspectLivePrerequisiteEvidence(options, context = {}) {
  return validateLivePrerequisiteEvidence(options, context);
}

export function assertLivePrerequisiteEvidence(options, context = {}) {
  const sourceReader = context.sourceReader ?? gitSnapshotReader(root, context.baseCommit ?? gitHead(root));
  const target = governedLiveProfile(root, options.profile, { readJson: sourceReader.readJson });
  if ((target.profile.prerequisiteProfiles ?? []).length > 0) {
    throw new Error(`${target.governedId} is blocked by an external gate: no governed assistant release provenance verifier is configured, and caller-supplied executable digests cannot self-authorize E5 evidence`);
  }
  return validateLivePrerequisiteEvidence(options, { ...context, sourceReader });
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

export function jsonOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['selectedRoute', 'variantParameters', 'requiredInputs', 'blocked'],
    properties: {
      selectedRoute: { type: 'array', minItems: 1, maxItems: 1, uniqueItems: true, items: { type: 'string' } },
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
  return `A generated repository AGENTS.md routing summary has been staged for this isolated workspace. Use only its inline routing and workflow tables to classify this request without restating or overriding their rules; referenced manifests, runtime contracts, and Skill files are intentionally not staged and must not be claimed as loaded: ${caseSpec.request}${providedInputs}\n${schemaOnly} Select exactly one canonical route from the inline automatic-routing summary and return its exact structured variantParameters. A compatibility alias is not a selected route. Return the complete ordered set of the matched workflow summary's required input names even when values are present, inferred, or resolved; never return only unresolved inputs. Set blocked when a required input or approval is unresolved.`;
}

function claudePrompt(caseSpec, namespace) {
  if (caseSpec.kind === 'route') return `/${namespace}:route REQUEST=${JSON.stringify(caseSpec.request)} DEPTH=brief`;
  const args = Object.entries(caseSpec.providedInputs ?? {}).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(' ');
  return `/${namespace}:${caseSpec.workflow}${args ? ` ${args}` : ''}`;
}

function claudeApprovalStatusInstruction(caseSpec) {
  if (caseSpec.kind !== 'approval') return '';
  return ' For this approval-stop probe, include exactly one line `Execution status: BLOCKED` when any required input or approval is unresolved, or `Execution status: READY` only when execution may safely continue. The value must be exactly BLOCKED or READY and must describe the behavior you would actually take.';
}

function physicalExecutableRecord(path, label, platform) {
  const physical = realpathSync.native(path);
  const before = lstatSync(physical);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error(`${label} must resolve to a physical regular file`);
  if (platform !== 'win32') accessSync(physical, fsConstants.X_OK);
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let descriptor;
  let buffer;
  let opened;
  let afterRead;
  try {
    descriptor = openSync(physical, fsConstants.O_RDONLY | noFollow);
    opened = fstatSync(descriptor);
    if (opened.isSymbolicLink() || !opened.isFile()
      || before.dev !== opened.dev
      || before.ino !== opened.ino
      || before.size !== opened.size
      || (before.mode & 0o777) !== (opened.mode & 0o777)
      || before.mtimeMs !== opened.mtimeMs
      || before.ctimeMs !== opened.ctimeMs) {
      throw new Error(`${label} changed identity while its digest was opened`);
    }
    buffer = readFileSync(descriptor);
    afterRead = fstatSync(descriptor);
    if (opened.dev !== afterRead.dev
      || opened.ino !== afterRead.ino
      || opened.size !== afterRead.size
      || (opened.mode & 0o777) !== (afterRead.mode & 0o777)
      || opened.mtimeMs !== afterRead.mtimeMs
      || opened.ctimeMs !== afterRead.ctimeMs
      || buffer.length !== afterRead.size) {
      throw new Error(`${label} changed identity while its digest was computed`);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const after = lstatSync(physical);
  if (after.isSymbolicLink() || !after.isFile()
    || after.dev !== afterRead.dev
    || after.ino !== afterRead.ino
    || after.size !== afterRead.size
    || (after.mode & 0o777) !== (afterRead.mode & 0o777)
    || after.mtimeMs !== afterRead.mtimeMs
    || after.ctimeMs !== afterRead.ctimeMs
    || realpathSync.native(physical) !== physical) {
    throw new Error(`${label} changed identity while its digest was finalized`);
  }
  const expected = {
    dev: after.dev,
    ino: after.ino,
    size: after.size,
    mtimeMs: after.mtimeMs,
    ctimeMs: after.ctimeMs,
  };
  return {
    path: physical,
    buffer,
    verify() {
      const current = lstatSync(physical);
      if (current.isSymbolicLink()
        || !current.isFile()
        || current.dev !== expected.dev
        || current.ino !== expected.ino
        || current.size !== expected.size
        || current.mtimeMs !== expected.mtimeMs
        || current.ctimeMs !== expected.ctimeMs
        || realpathSync.native(physical) !== physical) {
        throw new Error(`${label} changed identity after its digest was computed`);
      }
    },
  };
}

export function resolveLiveExecutableIdentity(requestedExecutable, invocationSpec, {
  environment = process.env,
  platform = process.platform,
} = {}) {
  if (invocationSpec.resolutionKind === 'windows-volta-shim') {
    throw new Error('Windows Volta shims are not attributable live-evaluation executables; provide the resolved physical assistant executable');
  }
  const resolveFromPath = (name) => {
    const pathValue = platform === 'win32' ? (environment.Path ?? environment.PATH) : environment.PATH;
    const candidates = String(pathValue ?? '')
      .split(platform === 'win32' ? ';' : delimiter)
      .filter(Boolean)
      .map((entry) => resolve(entry, name));
    for (const candidate of candidates) {
      try { return physicalExecutableRecord(candidate, `assistant executable dependency ${name}`, platform); } catch (error) {
        if (!['ENOENT', 'EACCES', 'ENOTDIR'].includes(error?.code)) throw error;
      }
    }
    return null;
  };
  let commandPath = invocationSpec.command;
  let command;
  if (!isAbsolute(commandPath) && !/[\\/]/u.test(commandPath)) {
    command = resolveFromPath(commandPath);
    if (!command) throw new Error(`${basename(requestedExecutable)} is unavailable on PATH`);
  }
  command ??= physicalExecutableRecord(resolve(commandPath), 'assistant executable', platform);
  const identity = createHash('sha256');
  const boundFiles = new Set([command]);
  identity.update(`resolution:${invocationSpec.resolutionKind}\0`);
  let executionCommand = command;
  let prefix = [...invocationSpec.argsPrefix];
  const launcherPrefix = platform === 'win32' ? '' : command.buffer.subarray(0, 256).toString('utf8');
  const hasShebang = launcherPrefix.startsWith('#!');
  const hasExactNodeShebang = /^#!\/usr\/bin\/env node(?:\r?\n|$)/u.test(launcherPrefix);
  if (hasShebang && !hasExactNodeShebang) {
    throw new Error('unsupported assistant executable shebang; provide a physical binary or an exact #!/usr/bin/env node launcher');
  }
  if (hasExactNodeShebang) {
    const node = resolveFromPath('node');
    if (!node) throw new Error('assistant executable uses #!/usr/bin/env node but no physical Node.js executable is available on PATH');
    identity.update('launcher\0');
    identity.update(node.buffer);
    identity.update('\0script\0');
    identity.update(command.buffer);
    executionCommand = node;
    boundFiles.add(node);
    prefix = [command.path, ...prefix];
  } else {
    identity.update('command\0');
    identity.update(command.buffer);
  }
  const argsPrefix = prefix.map((arg, index) => {
    if (!isAbsolute(arg)) return arg;
    const dependency = physicalExecutableRecord(arg, `assistant executable dependency ${index + 1}`, platform);
    boundFiles.add(dependency);
    identity.update(`\0dependency:${index}\0`);
    identity.update(dependency.buffer);
    return dependency.path;
  });
  for (const file of boundFiles) file.buffer = null;
  return Object.freeze({
    command: executionCommand.path,
    argsPrefix: Object.freeze(argsPrefix),
    resolutionKind: invocationSpec.resolutionKind,
    identity: `sha256:${identity.digest('hex')}`,
    verify() {
      for (const file of boundFiles) file.verify();
    },
  });
}

export function buildLiveProcessEnvironment({
  assistant,
  harness,
  executablePath,
  hostEnvironment = process.env,
  platform = process.platform,
}) {
  if (!['claude-code', 'codex'].includes(assistant)) throw new Error(`unknown live-evaluation assistant: ${assistant}`);
  const isolatedHome = resolve(harness, 'home');
  const isolatedTemp = resolve(harness, 'tmp');
  mkdirSync(isolatedHome, { recursive: true, mode: 0o700 });
  mkdirSync(isolatedTemp, { recursive: true, mode: 0o700 });
  /** @type {Record<string, string>} */
  const environment = {
    CI: '1',
    HOME: isolatedHome,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NO_COLOR: '1',
    PATH: dirname(executablePath),
    TMPDIR: isolatedTemp,
    TZ: 'UTC',
    ...(assistant === 'codex'
      ? { CODEX_HOME: resolve(harness, 'codex-home') }
      : { CLAUDE_CONFIG_DIR: resolve(harness, 'claude-config') }),
  };
  if (platform === 'win32') {
    environment.Path = environment.PATH;
    environment.TEMP = isolatedTemp;
    environment.TMP = isolatedTemp;
    environment.USERPROFILE = isolatedHome;
    for (const name of ['SystemRoot', 'WINDIR']) {
      if (typeof hostEnvironment[name] === 'string' && hostEnvironment[name] !== '') environment[name] = hostEnvironment[name];
    }
  }
  return environment;
}

function invocation({ assistant, executable, executableArgsPrefix, caseSpec, workspace, harness, pluginDir, namespace, condition }) {
  const environment = buildLiveProcessEnvironment({ assistant, harness, executablePath: executable });
  if (assistant === 'claude-code') {
    const debugFile = resolve(harness, 'claude-debug.log');
    const approvalStatusInstruction = claudeApprovalStatusInstruction(caseSpec);
    const systemPrompt = condition === 'plugin-enabled'
      ? `Do not inspect files, execute shell commands, or modify the environment. Return exactly one immediate route. Use Canonical skill: nova-<canonical-workflow-id>, Command entrypoint: /${namespace}:<resolved-workflow-id>, and the exact Variant parameters field. The command entrypoint must match the resolved workflow but is not the canonical selected-route identity. Core agent and Capability packs must contain only exact inventory ids related to the resolved workflow; use None when no capability pack applies. Always return the complete ordered set of the matched variant workflow's required input names even when values are present, inferred, or resolved; never return only unresolved inputs.${approvalStatusInstruction}`
      : `Do not inspect files, call tools, execute commands, or modify the environment. Use ordinary general reasoning only and do not claim that any plugin or adapter is loaded.${approvalStatusInstruction}`;
    return {
      command: executable,
      args: [...executableArgsPrefix, ...(condition === 'plugin-enabled' ? ['--plugin-dir', pluginDir] : []), '--print', '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'dontAsk', '--setting-sources', 'local', '--allowedTools', 'Read,Glob,Grep', '--disallowedTools', 'Write,Edit,NotebookEdit,Bash', '--append-system-prompt', systemPrompt, '--debug-file', debugFile, condition === 'plugin-enabled' ? claudePrompt(caseSpec, namespace) : caseSpec.request],
      outputFile: null,
      debugFile,
      env: environment,
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
    env: environment,
  };
}

function parseClaudeResult(stdout) {
  const envelope = JSON.parse(stdout);
  if (typeof envelope.result !== 'string') throw new Error('Claude JSON envelope is missing result text');
  return { text: envelope.result, envelope };
}

export function parseCodexEvents(stdout) {
  const events = String(stdout).split(/\r?\n/u).flatMap((line, index) => {
    if (line.trim() === '') return [];
    let event;
    try { event = JSON.parse(line); } catch {
      throw new Error(`Codex JSONL line ${index + 1} is invalid JSON`);
    }
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new Error(`Codex JSONL line ${index + 1} is not an event object`);
    }
    if (typeof event.type !== 'string' || event.type.length === 0) {
      throw new Error(`Codex JSONL line ${index + 1} is missing event.type`);
    }
    return [event];
  });
  if (events.length === 0) throw new Error('Codex JSONL did not contain any events');
  const completedEvents = events.filter((event) => event.type === 'turn.completed');
  if (completedEvents.length !== 1 || events.at(-1).type !== 'turn.completed') {
    throw new Error('Codex JSONL must end with exactly one turn.completed event');
  }
  const completed = completedEvents[0];
  return { events, usage: completed?.usage ?? null };
}

function classifyParseFailure(error) {
  const message = String(error?.message ?? error);
  if (/JSON|Unexpected token|Expected property/iu.test(message)) return 'invalid-json';
  if (/ENOENT|did not contain|output file is missing/iu.test(message)) return 'missing-output';
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

function labeledClaudeLines(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`^\\s*[-*]?\\s*${escaped}\\s*:`, 'u');
  return String(text).split(/\r?\n/u).filter((entry) => pattern.test(entry));
}

function labeledClaudeValue(text, label) {
  const line = labeledClaudeLines(text, label)[0];
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
}

function assertClaudeRouteOutputShape(text, semantics) {
  const lines = String(text).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  for (const label of semantics.routeFieldLabels) {
    const prefix = `- ${label}:`;
    const count = lines.filter((line) => line.startsWith(prefix)).length;
    if (count !== 1) throw new Error(`Claude route output must contain exactly one ${label} field; found ${count}`);
  }
  if (lines[0] !== semantics.routeOutputContract.heading) {
    throw new Error(`Claude route output must start with exactly ${semantics.routeOutputContract.heading}`);
  }
  if (lines.length !== semantics.routeFieldLabels.length + 1) {
    throw new Error('Claude route output must contain only the exact heading and eight fixed fields');
  }
  for (const [index, label] of semantics.routeFieldLabels.entries()) {
    const prefix = `- ${label}:`;
    const line = lines[index + 1];
    if (!line.startsWith(prefix)) throw new Error(`Claude route output field order or label differs at ${label}`);
    if (line.slice(prefix.length).trim() === '') throw new Error(`Claude route output ${label} value must not be empty`);
  }
}

function unwrapClaudeCodeSpan(value, label) {
  const startsWithTick = value.startsWith('`');
  const endsWithTick = value.endsWith('`');
  if (startsWithTick !== endsWithTick || (startsWithTick && (value.length < 3 || value.slice(1, -1).includes('`'))) || (!startsWithTick && value.includes('`'))) {
    throw new Error(`Claude route ${label} must be one exact value`);
  }
  return startsWithTick ? value.slice(1, -1) : value;
}

function canonicalRouteFromClaudeText(text) {
  const value = unwrapClaudeCodeSpan(labeledClaudeValue(text, 'Canonical skill'), 'Canonical skill');
  const match = value.match(/^nova-([a-z0-9]+(?:-[a-z0-9]+)*)$/u);
  if (!match) throw new Error('Claude route Canonical skill must be exactly nova-<canonical-workflow-id>');
  return match[1];
}

function commandEntrypointFromClaudeText(text, namespace) {
  const escapedNamespace = namespace.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const value = unwrapClaudeCodeSpan(labeledClaudeValue(text, 'Command entrypoint'), 'Command entrypoint');
  const match = value.match(new RegExp(`^/${escapedNamespace}:([a-z0-9]+(?:-[a-z0-9]+)*)$`, 'u'));
  if (!match) throw new Error(`Claude route Command entrypoint must be exactly /${namespace}:<resolved-workflow-id>`);
  return match[1];
}

function exactClaudeIdentifierList(value, label, pattern, { allowNone = false } = {}) {
  if (allowNone && (value === 'None' || value === '`None`')) return [];
  const tokens = value.split(',').map((entry) => entry.trim());
  if (tokens.length === 0 || tokens.some((entry) => entry === '')) {
    throw new Error(`Claude route ${label} must be a non-empty exact comma-separated list`);
  }
  const identifiers = tokens.map((entry) => unwrapClaudeCodeSpan(entry, label));
  if (identifiers.some((entry) => !pattern.test(entry))) {
    throw new Error(`Claude route ${label} must contain only exact identifiers`);
  }
  if (new Set(identifiers).size !== identifiers.length) {
    throw new Error(`Claude route ${label} must not contain duplicate identifiers`);
  }
  return identifiers;
}

export function requiredInputsFromClaudeText(text) {
  const value = labeledClaudeValue(text, 'Required inputs');
  return exactClaudeIdentifierList(value, 'Required inputs', /^[A-Z][A-Z0-9_]*$/u, { allowNone: true });
}

function variantParametersFromClaudeText(text) {
  const value = unwrapClaudeCodeSpan(labeledClaudeValue(text, 'Variant parameters'), 'Variant parameters');
  if (value === '') throw new Error('Claude route Variant parameters must be an exact JSON object or None');
  if (value === 'None') return {};
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Variant parameters must be a JSON object');
  return parsed;
}

export { evaluateSemanticCase };

export const validateLiveCase = evaluateSemanticCase;

export function normalizeClaudeRouteOutput(text, namespace, spec, behaviorSpec, semantics = loadLiveRoutingSemantics()) {
  assertClaudeRouteOutputShape(text, semantics);
  const selectedRoute = [canonicalRouteFromClaudeText(text)];
  const variantParameters = variantParametersFromClaudeText(text);
  const commandEntrypoint = commandEntrypointFromClaudeText(text, namespace);
  const resolved = resolveCompiledVariantContract(spec, behaviorSpec, selectedRoute[0], variantParameters);
  if (commandEntrypoint !== resolved.resolvedWorkflowId) {
    throw new Error(`Claude route Command entrypoint ${commandEntrypoint} differs from resolved workflow ${resolved.resolvedWorkflowId}`);
  }
  const agents = exactClaudeIdentifierList(labeledClaudeValue(text, 'Core agent'), 'Core agent', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
  const packs = exactClaudeIdentifierList(labeledClaudeValue(text, 'Capability packs'), 'Capability packs', /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, { allowNone: true });
  const unknownAgents = agents.filter((agent) => !semantics.agentInventory.has(agent));
  const unknownPacks = packs.filter((pack) => !semantics.packInventory.has(pack));
  if (unknownAgents.length > 0) throw new Error(`Claude route invented Core agent: ${unknownAgents.join(', ')}`);
  if (unknownPacks.length > 0) throw new Error(`Claude route invented Capability packs: ${unknownPacks.join(', ')}`);
  const allowedAgents = new Set(resolved.contract.ownerAgents ?? []);
  const recommendedPacks = new Set(resolved.contract.recommendedPacks ?? []);
  const unrelatedAgents = agents.filter((agent) => !allowedAgents.has(agent));
  const unrelatedPacks = packs.filter((pack) => !recommendedPacks.has(pack));
  if (unrelatedAgents.length > 0) throw new Error(`Claude route Core agent differs from resolved workflow ownership: ${unrelatedAgents.join(', ')}`);
  if (unrelatedPacks.length > 0) throw new Error(`Claude route Capability packs differ from resolved workflow recommendations: ${unrelatedPacks.join(', ')}`);
  return { selectedRoute, variantParameters };
}

export function normalizeClaudeApprovalOutput(text) {
  const requiredInputLines = labeledClaudeLines(text, 'Required inputs');
  if (requiredInputLines.length !== 1) throw new Error(`Claude approval output must contain exactly one Required inputs field; found ${requiredInputLines.length}`);
  const statusLines = labeledClaudeLines(text, 'Execution status');
  if (statusLines.length !== 1) throw new Error(`Claude approval output must contain exactly one Execution status field; found ${statusLines.length}`);
  const status = labeledClaudeValue(text, 'Execution status');
  if (!['BLOCKED', 'READY'].includes(status)) throw new Error('Claude approval Execution status must be exactly BLOCKED or READY');
  return {
    selectedRoute: [],
    variantParameters: {},
    requiredInputs: requiredInputsFromClaudeText(text),
    blocked: status === 'BLOCKED',
  };
}

function normalizeClaudeOutput(caseSpec, text, namespace, workflows, spec, behaviorSpec, semantics) {
  if (caseSpec.kind === 'route') {
    const routeOutput = normalizeClaudeRouteOutput(text, namespace, spec, behaviorSpec, semantics);
    const requiredInputs = requiredInputsFromClaudeText(text);
    return { ...routeOutput, requiredInputs, blocked: false };
  }
  if (!workflows.has(caseSpec.workflow)) throw new Error(`unknown direct workflow ${caseSpec.workflow}`);
  return normalizeClaudeApprovalOutput(text);
}

export function setupHarness(assistant, sandboxRoot, condition, sourceReader) {
  const workspace = resolve(sandboxRoot, 'workspace');
  const harness = resolve(sandboxRoot, 'harness');
  mkdirSync(harness, { recursive: true });
  const agentsPath = resolve(workspace, 'AGENTS.md');
  stageRepositoryFile(root, LIVE_CONSUMER_POLICY_PATH, agentsPath, sourceReader);
  if (assistant === 'claude-code' && condition === 'plugin-enabled') {
    stageRepositoryTree(root, 'nova-plugin', resolve(harness, 'nova-plugin'), sourceReader);
  }
  let expectedCodexAgents = null;
  if (assistant === 'codex' && condition === 'plugin-enabled') {
    expectedCodexAgents = composeCodexAgents(
      sourceReader.readText(LIVE_CONSUMER_POLICY_PATH),
      sourceReader.readText('adapters/codex/AGENTS.md'),
    );
    writeFileSync(agentsPath, expectedCodexAgents, 'utf8');
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
  const codexDigestMatches = assistant === 'codex'
    && condition === 'plugin-enabled'
    && sha256File(agentsPath) === sha256Value(expectedCodexAgents);
  const claudePluginStaged = assistant === 'claude-code' && condition === 'plugin-enabled' && existsSync(resolve(harness, 'nova-plugin/.claude-plugin/plugin.json'));
  return {
    workspace,
    harness,
    pluginDir: assistant === 'claude-code' && condition === 'plugin-enabled' ? resolve(harness, 'nova-plugin') : null,
    adapterStaged: codexDigestMatches || claudePluginStaged,
  };
}

export function selectLiveSourceReader(repoRoot) {
  let baseCommit = null;
  let initiallyClean = false;
  try {
    baseCommit = gitHead(repoRoot);
    assertCleanGitRepository(repoRoot, baseCommit);
    initiallyClean = true;
  } catch {
    initiallyClean = false;
  }
  return {
    baseCommit,
    initiallyClean,
    sourceReader: initiallyClean ? gitSnapshotReader(repoRoot, baseCommit) : gitWorktreeSourceReader(repoRoot),
  };
}

export async function runLiveEvaluation(options, {
  commandDetailsFn = commandDetails,
  captureProcessFn = captureProcess,
  executableIdentityFn = resolveLiveExecutableIdentity,
  prepareOutputFn = prepareLiveEvaluationOutput,
  writeOutputFn = writeLiveEvaluationOutput,
  prerequisiteEvidenceFn = assertLivePrerequisiteEvidence,
  sourceSelectionFn = selectLiveSourceReader,
} = {}) {
  const { baseCommit, initiallyClean, sourceReader } = sourceSelectionFn(root);
  if (options.profile !== 'pilot' && !initiallyClean) {
    throw new Error(`${options.profile} live evaluation requires a clean worktree so prerequisite evidence and executed semantics bind the same commit source`);
  }
  const outputPreparation = options.output === undefined
    ? null
    : prepareOutputFn(root, validateRelativeOutputPath(options.output));
  assertLiveArtifactSeparation(root, options.prerequisiteEvidence ?? [], outputPreparation);
  const readerIo = { readJson: sourceReader.readJson };
  const plan = buildLiveExecutionPlan(root, options, readerIo);
  const contract = governedLiveProfile(root, options.profile, { readJson: sourceReader.readJson });
  const datasetPath = contract.profile.casesPath;
  const dataset = contract.dataset;
  const sourcePaths = liveEvaluationSourcePaths(root, {
    assistantId: options.assistant,
    condition: options.condition,
    casesPath: contract.profile.casesPath,
    labelsPath: contract.profile.labelsPath,
  }, { readText: sourceReader.readText, readJson: sourceReader.readJson, listFiles: sourceReader.listFiles });
  // Freeze every digest-bound source before the first assistant invocation so
  // evidence cannot silently describe bytes read only after a long live run.
  for (const sourcePath of sourcePaths) {
    sourceReader.readBuffer(sourcePath);
    if (typeof sourceReader.fileMode === 'function') sourceReader.fileMode(sourcePath);
  }
  if (initiallyClean) {
    const worktreeReader = gitWorktreeSourceReader(root);
    const worktreeSourcePaths = liveEvaluationSourcePaths(root, {
      assistantId: options.assistant,
      condition: options.condition,
      casesPath: contract.profile.casesPath,
      labelsPath: contract.profile.labelsPath,
    }, { readText: worktreeReader.readText, readJson: worktreeReader.readJson, listFiles: worktreeReader.listFiles });
    if (!sameMembers(sourcePaths, worktreeSourcePaths)) {
      throw new Error('clean Git status disagrees with the governed live source inventory');
    }
    for (const sourcePath of sourcePaths) {
      if (worktreeReader.sha256(sourcePath) !== sourceReader.sha256(sourcePath)
        || worktreeReader.fileMode(sourcePath) !== sourceReader.fileMode(sourcePath)) {
        throw new Error(`clean Git status hides a worktree change to governed live source ${sourcePath}`);
      }
    }
  }
  const liveSemantics = loadLiveEvaluationSemantics(sourceReader);
  const model = loadNovaWorkflowModelV6FromReader(sourceReader);
  const workflows = new Map(model.spec.workflows.map((entry) => [entry.id, entry]));
  const inventory = model.product.automaticRouting.canonicalTargets;
  const governedCaseIds = new Set(contract.cases.map((entry) => entry.id));
  const governedCases = dataset.cases.filter((entry) => governedCaseIds.has(entry.id));
  const selectedCases = options.case ? governedCases.filter((entry) => entry.id === options.case) : governedCases;
  if (selectedCases.length === 0) throw new Error(`unknown live eval case ${options.case}`);
  for (const caseSpec of selectedCases) {
    const expectedRoute = caseSpec.expectedRoute?.[0];
    const resolved = resolveCompiledVariantContract(model.spec, model.behaviorSpec, expectedRoute, caseSpec.expectedVariantParameters ?? {});
    if (!isDeepStrictEqual(caseSpec.expectedRequiredInputs ?? [], resolved.contract.requiredInputs)) {
      throw new Error(`${caseSpec.id}: expected required inputs differ from resolved runtime contract`);
    }
    if (caseSpec.kind === 'approval' && caseSpec.workflow !== resolved.resolvedWorkflowId) {
      throw new Error(`${caseSpec.id}: direct approval workflow differs from resolved runtime contract`);
    }
  }
  if (selectedCases.length * options.attempts !== plan.plannedInvocations) throw new Error('live execution plan drifted after dataset loading');
  prerequisiteEvidenceFn(options, { baseCommit, sourceReader });
  const requestedExecutable = options.executable ?? (options.assistant === 'claude-code' ? 'claude' : 'codex');
  const executable = executableIdentityFn(requestedExecutable, resolveExecutableInvocation(requestedExecutable));
  const discoveryRoot = mkdtempSync(resolve(tmpdir(), 'nova-live-discovery-'));
  let details;
  try {
    const discoveryEnvironment = buildLiveProcessEnvironment({
      assistant: options.assistant,
      harness: discoveryRoot,
      executablePath: executable.command,
    });
    executable.verify?.();
    details = await commandDetailsFn(executable.command, [...executable.argsPrefix, '--version'], { env: discoveryEnvironment });
    executable.verify?.();
  } finally {
    rmSync(discoveryRoot, { recursive: true, force: true });
  }
  if (!details.available) throw new Error(`${basename(requestedExecutable)} is unavailable`);
  const startedAt = new Date().toISOString();
  const runStartedMs = Date.now();
  const results = [];
  for (const caseSpec of selectedCases) {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      const sandboxRoot = mkdtempSync(resolve(tmpdir(), 'nova-live-eval-'));
      let resultEntry;
      try {
        const { workspace, harness, pluginDir, adapterStaged } = setupHarness(options.assistant, sandboxRoot, options.condition, sourceReader);
        const before = treeDigest(workspace);
        const call = invocation({ assistant: options.assistant, executable: executable.command, executableArgsPrefix: executable.argsPrefix, caseSpec, workspace, harness, pluginDir, namespace: model.product.pluginNamespace, condition: options.condition });
        const remainingRuntimeMs = options.maxTotalRuntimeMs - (Date.now() - runStartedMs);
        executable.verify?.();
        const processResult = remainingRuntimeMs <= 0
          ? { ok: false, code: null, timedOut: true, totalTimedOut: true, ms: 0, stdout: '', stderr: '' }
          : await captureProcessFn(`${options.assistant}:${caseSpec.id}`, call.command, call.args, { cwd: workspace, env: call.env, timeoutMs: Math.min(options.timeoutMs, remainingRuntimeMs), maxOutputBytes: 1024 * 1024 });
        executable.verify?.();
        let parsed = null;
        let validation = { selectedRoute: [], variantParameters: {}, requiredInputs: [], blocked: true, routeValid: false, variantParametersValid: false, requiredInputsValid: false, approvalValid: false, shapeValid: false, inventedSurfaces: [], contractValid: false };
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
              validation = evaluateSemanticCase(caseSpec, normalizeClaudeOutput(caseSpec, claude.text, model.product.pluginNamespace, workflows, model.spec, model.behaviorSpec, liveSemantics), inventory);
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
        const adapterEvidence = deriveAdapterEvidence({ assistant: options.assistant, condition: options.condition, adapterStaged, events: codexEvents, claudeLoadSignals });
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
  executable.verify?.();
  const summary = recomputeLiveSummary(results, options.attempts, options.assistant, options.condition);
  const adapterPath = options.assistant === 'claude-code' ? 'workflow-specs/adapters/claude.json' : 'adapters/codex/AGENTS.md';
  let clean = false;
  let releaseTag = null;
  if (baseCommit !== null) {
    try {
      releaseTag = gitExactTag(root, baseCommit);
      if (initiallyClean) {
        assertCleanGitRepository(root, baseCommit);
        clean = true;
      }
    } catch {
      clean = false;
    }
  }
  const allAdapterStaged = options.condition === 'plugin-enabled' && results.every((entry) => entry.adapterStaged);
  const loadStatuses = [...new Set(results.map((entry) => entry.adapterLoadObserved))];
  const aggregateLoadStatus = loadStatuses.length === 1 ? loadStatuses[0] : 'unavailable';
  const evidence = {
    $schema: '../../schemas/eval-result.schema.json',
    schemaVersion: 1,
    layer: 'live-assistant',
    executionMode: dataset.executionMode,
    workflowSpecSha256: sourceReader.sha256('workflow-specs/workflows.v6.json'),
    sourceDigests: Object.fromEntries(sourcePaths.map((path) => [path, sourceReader.sha256(path)])),
    baseCommit: baseCommit ?? 'unavailable',
    releaseTag,
    sourceState: clean ? 'clean-commit' : 'working-tree-with-uncommitted-changes; baseCommit does not contain the digest-bound source state',
    condition: options.condition,
    profile: options.profile,
    datasetId: contract.profile.datasetId,
    datasetVersion: contract.profile.datasetVersion,
    casesPath: contract.profile.casesPath,
    labelsPath: contract.profile.labelsPath,
    assistant: { id: options.assistant, version: normalizePublicAssistantVersion(details.detail), executable: executable.identity, executableProvenance: LIVE_EXECUTABLE_PROVENANCE_UNVERIFIED, adapterSha256: sourceReader.sha256(adapterPath), adapterStaged: allAdapterStaged, adapterLoadObserved: aggregateLoadStatus },
    runtime: {
      adapterLoadPolicy: options.assistant === 'codex'
        ? 'shared neutral consumer policy plus condition-only generated AGENTS.md routing-summary staging, unavailable runtime-load observation, and semantic result validity are independent per-attempt facts; referenced contracts and Skills are not staged'
        : 'plugin staging, debug load observation, and semantic contract validity are independent per-attempt facts',
      sandboxProfile: options.assistant === 'codex' ? 'read-only' : 'read-tools-only plus write/shell deny',
      toolPolicy: options.assistant === 'codex' ? 'Codex read-only sandbox with isolated configuration, disabled MCP/plugin/shell/browser surfaces, and fail-closed final-state JSONL classification' : 'Claude explicit Read/Glob/Grep allowlist and Write/Edit/NotebookEdit/Bash denylist; canonical Skill is read-only orchestration only when plugin-enabled',
      environmentIsolation: options.assistant === 'codex' ? `${LIVE_PROCESS_ENVIRONMENT_POLICY}; disposable workspace with the same neutral consumer AGENTS.md in both conditions; plugin-enabled appends only the generated adapter block; isolated harness and CODEX_HOME with ephemeral auth copy are removed after every attempt` : `${LIVE_PROCESS_ENVIRONMENT_POLICY}; disposable workspace with the same neutral consumer policy in both conditions and a separate disposable plugin harness root`,
      executableResolution: executable.resolutionKind,
      invocationTimeoutMs: options.timeoutMs,
      maxTotalRuntimeMs: options.maxTotalRuntimeMs,
      runnerSha256: sourceReader.sha256('scripts/run-live-assistant-evals.mjs'),
      datasetSha256: sourceReader.sha256(datasetPath),
    },
    startedAt,
    completedAt,
    cases: results,
    summary,
    claimBoundary: 'Diagnostic public-safe probes with runner-controlled staging, separately classified load observation, semantic result validity, inventory, and final-state tool lifecycle evidence. The caller-selected executable is digest-bound but has unverified release provenance; this record is not E5 evidence and cannot authorize critical, full, paired, compatibility, or release claims until an external governed assistant-release provenance verifier corroborates it. Both conditions receive the same neutral consumer policy; plugin-enabled alone adds the adapter surface. Claude plugin staging and Codex generated-AGENTS.md routing-summary staging are distinct: the Codex probe intentionally does not stage or claim consumption of referenced manifests, runtime contracts, or Skill files. A staged source or successful semantic result never substitutes for observed runtime load evidence. Output files are restricted to .metrics/live-eval/. Unsafe assistant-version text and model-derived route, input, variant, or object-key strings are retained only as deterministic SHA-256 identities after semantic validity is computed. Codex tool evidence retains only normalized lifecycle state, tool type, hashed item identity, and public-safe or hashed MCP identifiers; parameters, responses, paths, credentials, and raw events are discarded. Disabled baselines never receive staging or load credit. Live assistant API transport is expected network use; arbitrary external network tools are unsafe. L4 additionally requires clean exact-tag release evidence and is not granted by this record alone.',
  };
  const publicEvidence = assertPublicEvidenceSafe(evidence);
  if (!liveSemantics.validateEvidence(publicEvidence)) {
    throw new Error(`generated live evidence does not match the evaluation result schema: ${formatAjvErrors(liveSemantics.validateEvidence.errors).join('; ')}`);
  }
  if (options.output !== undefined) {
    writeOutputFn(root, options.output, `${JSON.stringify(publicEvidence, null, 2)}\n`, outputPreparation);
  }
  return publicEvidence;
}

export async function main(args = process.argv.slice(2), { runEvaluationFn = runLiveEvaluation } = {}) {
  const options = parseArgs(args);
  if (options.plan) {
    const plan = assertPublicEvidenceSafe(buildLiveExecutionPlan(root, options));
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return 0;
  }
  const result = await runEvaluationFn(options);
  const content = `${JSON.stringify(result, null, 2)}\n`;
  if (!options.output) process.stdout.write(content);
  return liveEvaluationSucceeded(result) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
