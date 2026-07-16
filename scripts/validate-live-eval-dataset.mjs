#!/usr/bin/env node
/** Validate bilingual corpus scale, locked-label integrity, duplicates, and workflow inventory. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { joinLockedLabels } from './lib/eval-dataset.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const dataset = read('evals/live/v5/cases.json');
const locked = read('evals/live/v5/labels.locked.json');
const critical = read('evals/critical-live/v5/cases.json');
const joined = joinLockedLabels(dataset, locked);
const workflows = new Map(loadNovaWorkflowModelV6(root).spec.workflows.map((entry) => [entry.id, entry]));
const canonicalTargets = new Set(loadNovaWorkflowModelV6(root).product.automaticRouting.canonicalTargets);
const snapshotDigests = {
  'evals/live/v4/cases.json': '50dcfcc856523e39c2e122b5984d39ec4b4e11215548ce398726f87e69211e88',
  'evals/live/v4/labels.locked.json': '2660fe263cf2ca1b7fa630ae366ce278abfa5ee23036b6b0e1768abc42baeb3e',
  'evals/critical-live/v4/cases.json': 'ba35f4546f2fb145a93de523e274b29041bc37ec8d6d7581e1dba2d394eb9893',
};

assert.equal(dataset.schemaVersion, 3);
assert.equal(locked.schemaVersion, 3);
assert.equal(dataset.datasetId, 'live-paired');
assert.equal(dataset.datasetVersion, 5);
assert.equal(locked.datasetId, dataset.datasetId);
assert.equal(locked.datasetVersion, dataset.datasetVersion);
assert.ok(joined.length >= 150 && joined.length <= 300, 'live eval must contain 150-300 cases');
assert.equal(new Set(joined.map((entry) => entry.id)).size, joined.length, 'case ids must be unique');
assert.equal(new Set(joined.map((entry) => entry.request.replace(/\s+/gu, ' ').trim().toLowerCase())).size, joined.length, 'normalized prompts must be unique');
assert.ok(joined.filter((entry) => entry.language === 'en').length >= 70, 'English coverage is insufficient');
assert.ok(joined.filter((entry) => entry.language === 'zh').length >= 70, 'Chinese coverage is insufficient');
assert.ok(joined.filter((entry) => entry.kind === 'adversarial').length >= 80, 'adversarial coverage is insufficient');
assert.ok(joined.filter((entry) => entry.kind === 'approval').length >= 40, 'approval coverage is insufficient');
for (const entry of joined) {
  assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
  assert.ok(entry.request.length >= (entry.language === 'zh' ? 24 : 40), `${entry.id}: request must be meaningful`);
  assert.ok(entry.expectedRoute.length === 1 && canonicalTargets.has(entry.expectedRoute[0]), `${entry.id}: preferred route is not canonical`);
  assert.equal(entry.expectedVariantParameters !== null && typeof entry.expectedVariantParameters === 'object' && !Array.isArray(entry.expectedVariantParameters), true, `${entry.id}: structured variant parameters missing`);
  assert.ok(entry.acceptableRoutes.every((route) => workflows.has(route)), `${entry.id}: acceptable route invalid`);
  assert.ok(entry.forbiddenRoutes.every((route) => workflows.has(route)), `${entry.id}: forbidden route invalid`);
  assert.equal(entry.expectedRoute.some((route) => entry.forbiddenRoutes.includes(route)), false, `${entry.id}: preferred route is forbidden`);
  if (entry.kind === 'approval') {
    const direct = workflows.get(entry.workflow);
    assert.ok(direct, `${entry.id}: approval workflow missing`);
    assert.equal(direct.canonicalSurfaceId, entry.expectedRoute[0], `${entry.id}: approval canonical route drift`);
    assert.deepEqual(direct.variantPreset, entry.expectedVariantParameters, `${entry.id}: approval variant parameters drift`);
  }
  assert.equal(/preferredRoutes|acceptableRoutes|forbiddenRoutes|expectedVariantParameters|expectedRequiredInputs|unsafeSideEffect|inventedSurface/u.test(entry.request), false, `${entry.id}: hidden labels leaked into request`);
}
assert.equal(JSON.stringify(dataset).includes('preferredRoutes'), false, 'locked route labels leaked into prompt corpus');
assert.equal(JSON.stringify(dataset).includes('expectedRequiredInputs'), false, 'locked input labels leaked into prompt corpus');
assert.equal(critical.datasetId, 'critical-live');
assert.equal(critical.datasetVersion, 5);
assert.equal(critical.cases.length, 8);
for (const entry of critical.cases) {
  assert.ok(entry.expectedRoute.length === 1 && canonicalTargets.has(entry.expectedRoute[0]), `${entry.id}: critical route is not canonical`);
  assert.equal(entry.expectedVariantParameters !== null && typeof entry.expectedVariantParameters === 'object' && !Array.isArray(entry.expectedVariantParameters), true, `${entry.id}: critical variant parameters missing`);
}
for (const [path, expected] of Object.entries(snapshotDigests)) {
  const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  assert.equal(actual, expected, `${path}: immutable semantic v4 snapshot changed`);
}
console.log(`OK semantic v5 live eval datasets (${joined.length} public-safe full cases; 8 critical cases; immutable v4 snapshots)`);
