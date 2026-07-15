import { readFileSync } from 'node:fs';
import { posix, resolve, win32 } from 'node:path';

const readJson = (repoRoot, path) => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

const runnerProfiles = {
  pilot: 'pilot',
  critical: 'critical',
  full: 'release',
};

function selectedProfileCases(profile, dataset) {
  const categories = profile.selection.categories ?? [];
  const caseIds = profile.selection.caseIds ?? [];
  if (profile.selection.all === true) return dataset.cases;
  return dataset.cases.filter((entry) => categories.includes(entry.category) || caseIds.includes(entry.id));
}

export function governedLiveProfile(repoRoot, runnerProfile) {
  const governedId = runnerProfiles[runnerProfile];
  if (!governedId) throw new Error(`unknown live evaluation profile: ${runnerProfile}`);
  const registry = readJson(repoRoot, 'governance/evaluation-profiles.json');
  const profile = registry.profiles.find((entry) => entry.id === governedId);
  if (!profile || profile.executionKind !== 'external-live') throw new Error(`${governedId} is not a governed external-live profile`);
  if (!Number.isInteger(profile.attempts) || profile.attempts < 3 || profile.attempts > 5) {
    throw new Error(`${governedId} attempts must be governed between 3 and 5`);
  }
  if (governedId === 'critical' && profile.attempts !== 3) throw new Error('critical attempts must be governed at exactly 3');
  if (governedId === 'pilot' && profile.attempts !== 3) throw new Error('pilot attempts must be governed at exactly 3');
  const dataset = readJson(repoRoot, profile.casesPath);
  if (dataset.datasetId !== profile.datasetId || dataset.datasetVersion !== profile.datasetVersion) throw new Error(`${governedId} semantic dataset identity differs from the governed profile`);
  const cases = selectedProfileCases(profile, dataset);
  if (cases.length === 0) throw new Error(`${governedId} selects no live evaluation cases`);
  return { profile, dataset, cases, runnerProfile, governedId };
}

export function validateRelativeOutputPath(path) {
  if (path === undefined) return 'stdout';
  if (win32.isAbsolute(path) || posix.isAbsolute(path) || path.split(/[\\/]/u).includes('..')) {
    throw new Error('--output must be a repository-relative path without parent traversal');
  }
  return path.replace(/\\/gu, '/');
}

export function buildLiveExecutionPlan(repoRoot, options) {
  const contract = governedLiveProfile(repoRoot, options.profile);
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
    authorizationState: contract.profile.prerequisiteProfiles.length === 0 ? 'no-prerequisite' : 'blocked-until-prerequisite-evidence-validates',
    outputLocation: validateRelativeOutputPath(options.output),
    rawOutputLocation: 'disposable OS temporary directory; removed after every attempt',
    estimatedEvidenceLevel: cases.length === contract.cases.length ? 'E4 component; E5 requires the complete governed multi-assistant paired profile' : 'E4 pilot',
    writesOnPlan: false,
  };
}
