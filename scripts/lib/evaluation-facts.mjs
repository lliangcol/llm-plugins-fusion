import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readJson = (repoRoot, path) => JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));

const countBy = (entries, key) => Object.fromEntries(
  [...new Set(entries.map((entry) => entry[key]))]
    .sort()
    .map((value) => [value, entries.filter((entry) => entry[key] === value).length]),
);

export function deriveEvaluationFacts(repoRoot) {
  const liveDataset = readJson(repoRoot, 'evals/live/cases.json');
  const criticalDataset = readJson(repoRoot, 'evals/critical-live/cases.json');
  const realTaskDataset = readJson(repoRoot, 'benchmarks/real-tasks.json');
  const evaluationProfiles = readJson(repoRoot, 'governance/evaluation-profiles.json').profiles;

  const releaseProfile = evaluationProfiles.find((entry) => entry.id === 'release');
  const criticalProfile = evaluationProfiles.find((entry) => entry.id === 'critical');
  if (!releaseProfile || !criticalProfile) throw new Error('governed release and critical evaluation profiles are required');
  const liveAttempts = releaseProfile.attempts;
  const liveConditions = releaseProfile.conditions;
  const realTaskAssistants = ['claude-code', 'codex'];
  const realTaskAttempts = 3;

  return {
    livePaired: {
      datasetId: 'live-paired',
      sourcePath: 'evals/live/cases.json',
      caseCount: liveDataset.cases.length,
      languageCounts: countBy(liveDataset.cases, 'language'),
      kindCounts: countBy(liveDataset.cases, 'kind'),
      profileCaseCounts: {
        critical: criticalDataset.cases.length,
        full: liveDataset.cases.length,
      },
      conditions: liveConditions,
      attempts: liveAttempts,
      plannedInvocations: liveDataset.cases.length * liveConditions.length * liveAttempts,
    },
    criticalLive: {
      datasetId: criticalProfile.datasetId,
      sourcePath: 'evals/critical-live/cases.json',
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
