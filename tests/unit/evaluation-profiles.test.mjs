import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationProfiles } from '../../scripts/generate-quality-report.mjs';

const datasets = {
  live: [{ id: 'direct-case', category: 'direct' }, { id: 'pressure-case', category: 'pressure' }],
  'critical-live': [{ id: 'pilot-case', category: 'critical' }],
};

const identity = (datasetId, casesPath, labelsPath = null) => ({ datasetId, datasetVersion: 5, casesPath, labelsPath });
const profiles = [
  { id: 'pilot', ...identity('critical-live', 'critical-live'), selection: { caseIds: ['pilot-case'] }, executionKind: 'external-live', attempts: 3, conditions: ['on', 'off'], assistants: ['claude-code', 'codex'], prerequisiteProfiles: [] },
  { id: 'critical', ...identity('critical-live', 'critical-live'), selection: { all: true }, executionKind: 'external-live', attempts: 3, conditions: ['on', 'off'], assistants: ['claude-code', 'codex'], prerequisiteProfiles: ['pilot'] },
  { id: 'pr', ...identity('live', 'live', 'labels'), selection: { categories: ['direct'] }, executionKind: 'plan-only', attempts: 1, conditions: ['dry-run'], assistants: [], prerequisiteProfiles: [] },
  { id: 'nightly', ...identity('live', 'live', 'labels'), selection: { categories: ['pressure'] }, executionKind: 'simulation', attempts: 1, conditions: ['simulation'], assistants: [], prerequisiteProfiles: [] },
  { id: 'release', ...identity('live', 'live', 'labels'), selection: { all: true }, executionKind: 'external-live', attempts: 3, conditions: ['on', 'off'], assistants: ['codex'], prerequisiteProfiles: ['pilot', 'critical'] },
  { id: 'manual', ...identity('live', 'live', 'labels'), selection: { all: true }, executionKind: 'external-live', attempts: 3, conditions: ['on'], assistants: ['codex'], prerequisiteProfiles: ['pilot', 'critical'] },
];

test('evaluation profiles require the exact governed inventory and derive planned work', () => {
  const rows = buildEvaluationProfiles({ profiles }, datasets);
  assert.equal(rows.find((row) => row.id === 'pilot').planned, 12);
  assert.equal(rows.find((row) => row.id === 'pr').planned, 1);
  assert.equal(rows.find((row) => row.id === 'critical').planned, 12);
  assert.equal(rows.find((row) => row.id === 'release').planned, 12);
  assert.equal(rows.find((row) => row.id === 'release').blocked, 12);
  assert.deepEqual(rows.find((row) => row.id === 'release').prerequisiteProfiles, ['pilot', 'critical']);
  assert.throws(() => buildEvaluationProfiles({ profiles: profiles.slice(1) }, datasets), /each governed profile exactly once/u);
});

test('evaluation profiles reject ambiguous, empty, and unsupported selections', () => {
  const replace = (id, value) => profiles.map((profile) => profile.id === id ? { ...profile, ...value } : profile);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pr', { selection: {} }) }, datasets), /select all cases, categories, or case ids/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pr', { selection: { all: true, categories: ['direct'] } }) }, datasets), /select all cases, categories, or case ids/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pr', { selection: { categories: ['missing'] } }) }, datasets), /unknown category/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('pilot', { selection: { caseIds: ['missing'] } }) }, datasets), /unknown case/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('release', { assistants: [] }) }, datasets), /requires assistants/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('critical', { attempts: 4 }) }, datasets), /exactly 3 attempts/u);
  assert.throws(() => buildEvaluationProfiles({ profiles: replace('critical', { prerequisiteProfiles: [] }) }, datasets), /prerequisite profile/u);
});
