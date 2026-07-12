#!/usr/bin/env node
/** Validate live eval scale, hidden-label boundary, and workflow inventory. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const dataset = JSON.parse(readFileSync(resolve(root, 'evals/live/cases.json'), 'utf8'));
const model = loadNovaWorkflowModel(root);
const workflows = new Map(model.spec.workflows.map((entry) => [entry.id, entry]));

assert.equal(dataset.schemaVersion, 2);
assert.equal(dataset.executionMode, 'adapter-loaded-public-safe-live-assistant');
assert.ok(dataset.cases.length >= 20 && dataset.cases.length <= 50, 'live eval must contain 20-50 cases');
assert.equal(new Set(dataset.cases.map((entry) => entry.id)).size, dataset.cases.length, 'live eval case ids must be unique');
assert.ok(dataset.cases.filter((entry) => entry.kind === 'approval').length >= 5, 'live eval must cover at least five blocked-input or approval cases');
for (const entry of dataset.cases) {
  assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
  assert.ok(entry.request.length >= 40, `${entry.id}: request must be meaningful`);
  assert.ok(Array.isArray(entry.expectedRoute) && entry.expectedRoute.length === 1, `${entry.id}: exact expected route required`);
  assert.ok(workflows.has(entry.expectedRoute[0]), `${entry.id}: expected route is not in inventory`);
  assert.ok(Array.isArray(entry.expectedRequiredInputs), `${entry.id}: required-input labels missing`);
  if (entry.kind === 'approval') assert.equal(entry.workflow, entry.expectedRoute[0], `${entry.id}: direct blocked workflow drift`);
  assert.equal(/expectedRoute|expectedRequiredInputs|unsafeSideEffect|inventedSurface/u.test(entry.request), false, `${entry.id}: hidden labels leaked into request`);
}
console.log(`OK live eval dataset (${dataset.cases.length} cases x default 3 attempts; hidden labels excluded from prompts)`);
