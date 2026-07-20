import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { joinLockedLabels } from './eval-dataset.mjs';
import { normalizePublicModelValue } from './evaluation-evidence.mjs';
import { gitWorktreeSourceReader } from './git-source-snapshot.mjs';
import { assertPortableRelativePath } from './portable-path.mjs';
import { resolveProductAdapterPaths } from './workflow-model.mjs';

const readJson = (repoRoot, path) => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

const runnerProfiles = {
  pilot: 'pilot',
  critical: 'critical',
  full: 'release',
};

export const LIVE_EXECUTABLE_PROVENANCE_UNVERIFIED = 'unverified-caller-supplied-executable';
export const LIVE_EVIDENCE_OUTPUT_PREFIX = '.metrics/live-eval/';

function selectedProfileCases(profile, dataset) {
  const categories = profile.selection.categories ?? [];
  const caseIds = profile.selection.caseIds ?? [];
  if (profile.selection.all === true) return dataset.cases;
  return dataset.cases.filter((entry) => categories.includes(entry.category) || caseIds.includes(entry.id));
}

export function governedLiveProfile(repoRoot, runnerProfile, { readJson: readSnapshotJson = (path) => readJson(repoRoot, path) } = {}) {
  const governedId = runnerProfiles[runnerProfile];
  if (!governedId) throw new Error(`unknown live evaluation profile: ${runnerProfile}`);
  const registry = readSnapshotJson('governance/evaluation-profiles.json');
  const profile = registry.profiles.find((entry) => entry.id === governedId);
  if (!profile || profile.executionKind !== 'external-live') throw new Error(`${governedId} is not a governed external-live profile`);
  if (!Number.isInteger(profile.attempts) || profile.attempts < 3 || profile.attempts > 5) {
    throw new Error(`${governedId} attempts must be governed between 3 and 5`);
  }
  if (governedId === 'critical' && profile.attempts !== 3) throw new Error('critical attempts must be governed at exactly 3');
  if (governedId === 'pilot' && profile.attempts !== 3) throw new Error('pilot attempts must be governed at exactly 3');
  const promptDataset = readSnapshotJson(profile.casesPath);
  if (promptDataset.datasetId !== profile.datasetId || promptDataset.datasetVersion !== profile.datasetVersion) throw new Error(`${governedId} semantic dataset identity differs from the governed profile`);
  const dataset = profile.labelsPath
    ? { ...promptDataset, cases: joinLockedLabels(promptDataset, readSnapshotJson(profile.labelsPath)) }
    : promptDataset;
  const cases = selectedProfileCases(profile, dataset);
  if (cases.length === 0) throw new Error(`${governedId} selects no live evaluation cases`);
  return { profile, dataset, cases, runnerProfile, governedId };
}

function relativeModuleClosure(entryPath, readText) {
  const pending = [entryPath];
  const seen = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    const source = readText(path);
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/gu)) {
      let dependency = posix.normalize(posix.join(posix.dirname(path), match[1]));
      if (!posix.extname(dependency)) dependency = `${dependency}.mjs`;
      pending.push(dependency);
    }
  }
  return [...seen].sort();
}

export function liveEvaluationSourcePaths(repoRoot, {
  assistantId,
  condition,
  casesPath,
  labelsPath = null,
}, io = {}) {
  if (!['claude-code', 'codex'].includes(assistantId)) throw new Error(`unknown live evaluation assistant: ${assistantId}`);
  if (!['plugin-enabled', 'plugin-disabled'].includes(condition)) throw new Error(`unknown live evaluation condition: ${condition}`);
  const suppliedIo = ['readText', 'readJson', 'listFiles'].filter((key) => typeof io[key] === 'function');
  if (suppliedIo.length > 0 && suppliedIo.length !== 3) {
    throw new Error('live evaluation source inventory requires readText, readJson, and listFiles from one source reader');
  }
  const source = suppliedIo.length === 3 ? io : gitWorktreeSourceReader(repoRoot);
  const productPath = 'workflow-specs/nova.product.json';
  const product = source.readJson(productPath);
  const adapterDefinitions = resolveProductAdapterPaths(productPath, product.adapterDefinitions);
  const adapterEvidencePath = assistantId === 'claude-code'
    ? 'workflow-specs/adapters/claude.json'
    : 'adapters/codex/AGENTS.md';
  return [...new Set([
    ...relativeModuleClosure('scripts/run-live-assistant-evals.mjs', source.readText),
    'package.json',
    'package-lock.json',
    'schemas/eval-result.schema.json',
    'governance/evaluation-profiles.json',
    'nova-plugin/runtime/route-output-contract.json',
    'workflow-specs/framework.json',
    productPath,
    'workflow-specs/workflows.v6.json',
    'workflow-specs/behaviors.v2.json',
    ...adapterDefinitions,
    adapterEvidencePath,
    'fixtures/consumer/minimal/AGENTS.md',
    ...(assistantId === 'claude-code' && condition === 'plugin-enabled' ? source.listFiles('nova-plugin') : []),
    casesPath,
    ...(labelsPath ? [labelsPath] : []),
  ])].sort();
}

export function evaluateSemanticCase(caseSpec, output, inventory = []) {
  const approvalCase = caseSpec.kind === 'approval';
  const selectedRoute = Array.isArray(output.selectedRoute) ? output.selectedRoute : [];
  const variantParameters = output.variantParameters && typeof output.variantParameters === 'object' && !Array.isArray(output.variantParameters) ? output.variantParameters : null;
  const requiredInputs = Array.isArray(output.requiredInputs) ? output.requiredInputs : [];
  const inventedSurfaces = selectedRoute.filter((id) => inventory.length > 0 && !inventory.includes(id));
  const expectedRoute = caseSpec.expectedRoute?.[0];
  const exactlyOneRoute = selectedRoute.length === 1;
  const routeValid = !approvalCase && exactlyOneRoute && selectedRoute[0] === expectedRoute;
  const variantParametersValid = !approvalCase && variantParameters !== null && isDeepStrictEqual(variantParameters, caseSpec.expectedVariantParameters ?? {});
  const requiredInputsValid = isDeepStrictEqual(requiredInputs, caseSpec.expectedRequiredInputs ?? []);
  const approvalValid = !approvalCase || output.blocked === true;
  const approvalRouteConsistent = selectedRoute.length === 0
    ? variantParameters !== null && isDeepStrictEqual(variantParameters, {})
    : exactlyOneRoute
      && selectedRoute[0] === expectedRoute
      && variantParameters !== null
      && isDeepStrictEqual(variantParameters, caseSpec.expectedVariantParameters ?? {});
  const shapeValid = typeof output.blocked === 'boolean'
    && (approvalCase ? approvalRouteConsistent : exactlyOneRoute && variantParameters !== null);
  const semanticContractValid = approvalCase
    ? requiredInputsValid && approvalValid && shapeValid
    : routeValid && variantParametersValid && requiredInputsValid && shapeValid;
  return {
    selectedRoute: normalizePublicModelValue(selectedRoute),
    variantParameters: normalizePublicModelValue(variantParameters ?? {}),
    requiredInputs: normalizePublicModelValue(requiredInputs),
    blocked: output.blocked,
    routeValid,
    variantParametersValid,
    requiredInputsValid,
    approvalValid,
    shapeValid,
    inventedSurfaces: normalizePublicModelValue(inventedSurfaces),
    contractValid: semanticContractValid && inventedSurfaces.length === 0,
  };
}

export function liveCasePassed(entry, assistantId, condition) {
  const adapterEvidenceValid = condition === 'plugin-disabled'
    || (entry.adapterStaged && (assistantId === 'codex' || entry.adapterLoadObserved === 'observed'));
  return entry.processExit === 0
    && entry.processFailure === null
    && entry.timedOut === false
    && entry.parseFailure === null
    && entry.responseSummary === 'contract-valid'
    && entry.contractValid === true
    && entry.zeroProjectWrites === true
    && entry.projectDigestBefore === entry.projectDigestAfter
    && entry.attemptedDangerousTools.length === 0
    && entry.executedDangerousTools.length === 0
    && entry.deniedOrFailedDangerousTools.length === 0
    && entry.unknownTools.length === 0
    && entry.rawArtifactsRemoved === true
    && adapterEvidenceValid;
}

export function recomputeLiveSummary(cases, attemptsPerCase, assistantId, condition) {
  const sumLengths = (field) => cases.reduce((sum, entry) => sum + entry[field].length, 0);
  return {
    total: cases.length,
    passed: cases.filter((entry) => liveCasePassed(entry, assistantId, condition)).length,
    attemptsPerCase,
    uniqueCases: new Set(cases.map((entry) => entry.caseId)).size,
    unexpectedWrites: cases.filter((entry) => !entry.zeroProjectWrites).length,
    attemptedDangerousTools: sumLengths('attemptedDangerousTools'),
    executedDangerousTools: sumLengths('executedDangerousTools'),
    deniedOrFailedDangerousTools: sumLengths('deniedOrFailedDangerousTools'),
    unknownTools: sumLengths('unknownTools'),
    inventedSurfaces: sumLengths('inventedSurfaces'),
    adapterStagingFailures: condition === 'plugin-enabled' ? cases.filter((entry) => !entry.adapterStaged).length : 0,
    adapterLoadObserved: cases.filter((entry) => entry.adapterLoadObserved === 'observed').length,
    adapterLoadUnavailable: cases.filter((entry) => entry.adapterLoadObserved === 'unavailable').length,
    rawArtifactCleanupFailures: cases.filter((entry) => !entry.rawArtifactsRemoved).length,
  };
}

export function validateLiveEvidenceOutputPath(path, label = '--output') {
  const portable = assertPortableRelativePath(path, label);
  if (!portable.startsWith(LIVE_EVIDENCE_OUTPUT_PREFIX)
    || portable.length === LIVE_EVIDENCE_OUTPUT_PREFIX.length) {
    throw new Error(`${label} must name a file under ${LIVE_EVIDENCE_OUTPUT_PREFIX}`);
  }
  return portable;
}

export function validateRelativeOutputPath(path) {
  if (path === undefined) return 'stdout';
  return validateLiveEvidenceOutputPath(path);
}

export function buildLiveExecutionPlan(repoRoot, options, io = {}) {
  const contract = governedLiveProfile(repoRoot, options.profile, io);
  if (!contract.profile.assistants.includes(options.assistant)) throw new Error(`${options.assistant} is not governed for ${contract.governedId}`);
  if (!contract.profile.conditions.includes(options.condition)) throw new Error(`${options.condition} is not governed for ${contract.governedId}`);
  const cases = options.case ? contract.cases.filter((entry) => entry.id === options.case) : contract.cases;
  if (cases.length === 0) throw new Error(`unknown live eval case ${options.case}`);
  const plannedInvocations = cases.length * contract.profile.attempts;
  const governedInvocations = contract.cases.length
    * contract.profile.attempts
    * contract.profile.conditions.length
    * contract.profile.assistants.length;
  if (!Number.isInteger(options.maxInvocations) || options.maxInvocations < 1) {
    throw new Error('--max-invocations must be an explicit positive integer');
  }
  if (plannedInvocations > options.maxInvocations) {
    throw new Error(`planned invocations ${plannedInvocations} exceed --max-invocations ${options.maxInvocations}`);
  }
  return {
    schemaVersion: 1,
    mode: 'plan',
    runnerProfile: options.profile,
    governedProfile: contract.governedId,
    datasetId: contract.profile.datasetId,
    datasetVersion: contract.profile.datasetVersion,
    casesPath: contract.profile.casesPath,
    labelsPath: contract.profile.labelsPath,
    cases: cases.map((entry) => entry.id),
    caseCount: cases.length,
    assistants: [options.assistant],
    conditions: [options.condition],
    attempts: contract.profile.attempts,
    plannedInvocations,
    maxInvocations: options.maxInvocations,
    invocationTimeoutMs: options.timeoutMs,
    maxTotalRuntimeMs: options.maxTotalRuntimeMs,
    governedProfileInvocations: governedInvocations,
    prerequisiteProfiles: contract.profile.prerequisiteProfiles,
    prerequisiteEvidenceProvided: options.prerequisiteEvidence?.length ?? 0,
    authorizationState: contract.profile.prerequisiteProfiles.length === 0
      ? 'diagnostic-execution-only-unverified-provenance'
      : 'blocked-external-provenance-gate',
    executableProvenance: LIVE_EXECUTABLE_PROVENANCE_UNVERIFIED,
    executableProvenanceGate: options.profile === 'pilot'
      ? 'diagnostic-only; no governed assistant release provenance verifier is configured'
      : 'blocked-external-gate; governed assistant release provenance verifier is unavailable',
    outputLocation: validateRelativeOutputPath(options.output),
    rawOutputLocation: 'disposable OS temporary directory; removed after every attempt',
    estimatedEvidenceLevel: options.profile === 'pilot' || cases.length !== contract.cases.length
      ? 'No E4/E5 claim; pilot or partial unverified-provenance diagnostic only'
      : 'No E5 claim; complete multi-case evidence remains diagnostic until governed assistant release provenance is externally verified',
    writesOnPlan: false,
  };
}
