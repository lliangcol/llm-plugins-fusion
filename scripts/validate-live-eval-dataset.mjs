#!/usr/bin/env node
/** Validate bilingual corpus scale, locked-label integrity, duplicates, and workflow inventory. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { joinLockedLabels } from './lib/eval-dataset.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const dataset = read('evals/live/cases.json');
const locked = read('evals/live/labels.locked.json');
const joined = joinLockedLabels(dataset, locked);
const workflows = new Map(loadNovaWorkflowModelV6(root).spec.workflows.map((entry) => [entry.id, entry]));

assert.equal(dataset.schemaVersion, 3);
assert.equal(locked.schemaVersion, 3);
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
  assert.ok(entry.expectedRoute.length === 1 && workflows.has(entry.expectedRoute[0]), `${entry.id}: preferred route invalid`);
  assert.ok(entry.acceptableRoutes.every((route) => workflows.has(route)), `${entry.id}: acceptable route invalid`);
  assert.ok(entry.forbiddenRoutes.every((route) => workflows.has(route)), `${entry.id}: forbidden route invalid`);
  assert.equal(entry.expectedRoute.some((route) => entry.forbiddenRoutes.includes(route)), false, `${entry.id}: preferred route is forbidden`);
  if (entry.kind === 'approval') assert.equal(entry.workflow, entry.expectedRoute[0], `${entry.id}: approval workflow drift`);
  assert.equal(/preferredRoutes|acceptableRoutes|forbiddenRoutes|expectedRequiredInputs|unsafeSideEffect|inventedSurface/u.test(entry.request), false, `${entry.id}: hidden labels leaked into request`);
}
assert.equal(JSON.stringify(dataset).includes('preferredRoutes'), false, 'locked route labels leaked into prompt corpus');
assert.equal(JSON.stringify(dataset).includes('expectedRequiredInputs'), false, 'locked input labels leaked into prompt corpus');
console.log(`OK live eval dataset (${joined.length} public-safe cases; bilingual, adversarial, locked labels, no duplicates)`);
