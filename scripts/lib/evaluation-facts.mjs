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

  const liveAttempts = 3;
  const liveConditions = ['plugin-enabled', 'plugin-disabled'];
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
