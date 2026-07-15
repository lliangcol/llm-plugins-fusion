import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deriveEvaluationFacts } from '../../scripts/lib/evaluation-facts.mjs';

test('evaluation facts derive each plan from its own dataset identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'nova-evaluation-facts-'));
  try {
    mkdirSync(join(root, 'evals/live/v5'), { recursive: true });
    mkdirSync(join(root, 'evals/critical-live/v5'), { recursive: true });
    mkdirSync(join(root, 'benchmarks'), { recursive: true });
    mkdirSync(join(root, 'governance'), { recursive: true });
    writeFileSync(join(root, 'evals/live/v5/cases.json'), JSON.stringify({ datasetId: 'live-paired', datasetVersion: 5, cases: [
      { language: 'en', kind: 'route' },
      { language: 'zh', kind: 'approval' },
    ] }));
    writeFileSync(join(root, 'evals/critical-live/v5/cases.json'), JSON.stringify({ datasetId: 'critical-live', datasetVersion: 5, cases: [{}] }));
    writeFileSync(join(root, 'benchmarks/real-tasks.json'), JSON.stringify({
      conditions: ['raw', 'wrapper-full', 'wrapper-compact'],
      tasks: [{}, {}, {}],
    }));
    writeFileSync(join(root, 'governance/evaluation-profiles.json'), JSON.stringify({ profiles: [
      { id: 'pilot', datasetId: 'critical-live', datasetVersion: 5, casesPath: 'evals/critical-live/v5/cases.json', labelsPath: null, selection: { caseIds: ['case'] }, attempts: 3, conditions: ['plugin-enabled', 'plugin-disabled'], assistants: ['claude-code', 'codex'] },
      { id: 'critical', datasetId: 'critical-live', datasetVersion: 5, casesPath: 'evals/critical-live/v5/cases.json', labelsPath: null, selection: { all: true }, attempts: 3, conditions: ['plugin-enabled', 'plugin-disabled'], assistants: ['claude-code', 'codex'] },
      { id: 'release', datasetId: 'live-paired', datasetVersion: 5, casesPath: 'evals/live/v5/cases.json', labelsPath: 'evals/live/v5/labels.locked.json', selection: { all: true }, attempts: 3, conditions: ['plugin-enabled', 'plugin-disabled'], assistants: ['claude-code', 'codex'] },
    ] }));

    const facts = deriveEvaluationFacts(root);
    assert.equal(facts.livePaired.caseCount, 2);
    assert.equal(facts.livePaired.plannedInvocations, 24);
    assert.deepEqual(facts.livePaired.assistants, ['claude-code', 'codex']);
    assert.equal(facts.criticalLive.plannedInvocations, 12);
    assert.deepEqual(facts.livePaired.languageCounts, { en: 1, zh: 1 });
    assert.equal(facts.realTask.taskCount, 3);
    assert.equal(facts.realTask.plannedInvocations, 54);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
