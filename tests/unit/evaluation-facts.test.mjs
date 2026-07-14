import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deriveEvaluationFacts } from '../../scripts/lib/evaluation-facts.mjs';

test('evaluation facts derive each plan from its own dataset identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'nova-evaluation-facts-'));
  try {
    mkdirSync(join(root, 'evals/live'), { recursive: true });
    mkdirSync(join(root, 'evals/critical-live'), { recursive: true });
    mkdirSync(join(root, 'benchmarks'), { recursive: true });
    writeFileSync(join(root, 'evals/live/cases.json'), JSON.stringify({ cases: [
      { language: 'en', kind: 'route' },
      { language: 'zh', kind: 'approval' },
    ] }));
    writeFileSync(join(root, 'evals/critical-live/cases.json'), JSON.stringify({ cases: [{}] }));
    writeFileSync(join(root, 'benchmarks/real-tasks.json'), JSON.stringify({
      conditions: ['raw', 'wrapper-full', 'wrapper-compact'],
      tasks: [{}, {}, {}],
    }));

    const facts = deriveEvaluationFacts(root);
    assert.equal(facts.livePaired.caseCount, 2);
    assert.equal(facts.livePaired.plannedInvocations, 12);
    assert.deepEqual(facts.livePaired.languageCounts, { en: 1, zh: 1 });
    assert.equal(facts.realTask.taskCount, 3);
    assert.equal(facts.realTask.plannedInvocations, 54);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
