import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationProfiles } from '../../scripts/generate-evaluation-profiles.mjs';

const datasets = {
  live: [{ category: 'direct' }, { category: 'pressure' }],
  critical: [{ category: 'critical' }],
};

const profiles = [
  { id: 'critical', datasetId: 'critical', selection: { all: true }, executionKind: 'external-live', attempts: 1, conditions: ['on'], assistants: ['codex'] },
  { id: 'pr', datasetId: 'live', selection: { categories: ['direct'] }, executionKind: 'plan-only', attempts: 1, conditions: ['dry-run'], assistants: [] },
  { id: 'nightly', datasetId: 'live', selection: { categories: ['pressure'] }, executionKind: 'simulation', attempts: 1, conditions: ['simulation'], assistants: [] },
  { id: 'release', datasetId: 'live', selection: { all: true }, executionKind: 'external-live', attempts: 2, conditions: ['on', 'off'], assistants: ['codex'] },
  { id: 'manual', datasetId: 'live', selection: { all: true }, executionKind: 'external-live', attempts: 1, conditions: ['on'], assistants: ['codex'] },
];

test('evaluation profiles require the exact governed inventory and derive planned work', () => {
  const rows = buildEvaluationProfiles({ profiles }, datasets);
  assert.equal(rows.find((row) => row.id === 'pr').planned, 1);
  assert.equal(rows.find((row) => row.id === 'release').planned, 8);
  assert.equal(rows.find((row) => row.id === 'release').blocked, 8);
  assert.throws(() => buildEvaluationProfiles({ profiles: profiles.slice(1) }, datasets), /each governed profile exactly once/u);
});

test('evaluation profiles reject ambiguous, empty, and unsupported selections', () => {
  const replace = (id, value) => profiles.map((profile) => profile.id === id ? { ...profile, ...value } : profile);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pr', { selection: {} }) }, datasets), /either all cases or/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pr', { selection: { all: true, categories: ['direct'] } }) }, datasets), /either all cases or/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pr', { selection: { categories: ['missing'] } }) }, datasets), /unknown category/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('release', { assistants: [] }) }, datasets), /requires assistants/u);
});
