import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readJson = (repoRoot, path) => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

const countBy = (entries, key) => Object.fromEntries(
  [...new Set(entries.map((entry) => entry[key]))]
    .sort()
    .map((value) => [value, entries.filter((entry) => entry[key] === value).length]),
);

export function deriveEvaluationFacts(repoRoot) {
  const realTaskDataset = readJson(repoRoot, 'benchmarks/real-tasks.json');
  const evaluationProfiles = readJson(repoRoot, 'governance/evaluation-profiles.json').profiles;

  const releaseProfile = evaluationProfiles.find((entry) => entry.id === 'release');
  const criticalProfile = evaluationProfiles.find((entry) => entry.id === 'critical');
  const pilotProfile = evaluationProfiles.find((entry) => entry.id === 'pilot');
  if (!releaseProfile || !criticalProfile || !pilotProfile) throw new Error('governed pilot, release, and critical evaluation profiles are required');
  const liveDataset = readJson(repoRoot, releaseProfile.casesPath);
  const criticalDataset = readJson(repoRoot, criticalProfile.casesPath);
  const liveAttempts = releaseProfile.attempts;
  const liveConditions = releaseProfile.conditions;
  const realTaskAssistants = ['claude-code', 'codex'];
  const realTaskAttempts = 3;

  return {
    livePaired: {
      datasetId: 'live-paired',
      datasetVersion: releaseProfile.datasetVersion,
      sourcePath: releaseProfile.casesPath,
      labelsPath: releaseProfile.labelsPath,
      caseCount: liveDataset.cases.length,
      languageCounts: countBy(liveDataset.cases, 'language'),
      kindCounts: countBy(liveDataset.cases, 'kind'),
      profileCaseCounts: {
        pilot: pilotProfile.selection.caseIds.length,
        critical: criticalDataset.cases.length,
        full: liveDataset.cases.length,
      },
      assistants: releaseProfile.assistants,
      conditions: liveConditions,
      attempts: liveAttempts,
      plannedInvocations: liveDataset.cases.length
        * releaseProfile.assistants.length
        * liveConditions.length
        * liveAttempts,
    },
    criticalLive: {
      datasetId: criticalProfile.datasetId,
      datasetVersion: criticalProfile.datasetVersion,
      sourcePath: criticalProfile.casesPath,
      caseCount: criticalDataset.cases.length,
      assistants: criticalProfile.assistants,
      conditions: criticalProfile.conditions,
      attempts: criticalProfile.attempts,
      plannedInvocations: criticalDataset.cases.length
        * criticalProfile.assistants.length
        * criticalProfile.conditions.length
        * criticalProfile.attempts,
    },
    realTask: {
      datasetId: 'real-task-benchmark',
      sourcePath: 'benchmarks/real-tasks.json',
      taskCount: realTaskDataset.tasks.length,
      assistants: realTaskAssistants,
      conditions: realTaskDataset.conditions,
      attempts: realTaskAttempts,
      plannedInvocations: realTaskDataset.tasks.length
        * realTaskDataset.conditions.length
        * realTaskAssistants.length
        * realTaskAttempts,
    },
  };
}
