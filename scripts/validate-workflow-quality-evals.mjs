#!/usr/bin/env node
/** Validate the public workflow-quality dataset and metric coverage. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataset = JSON.parse(readFileSync(resolve(root, 'evals/workflow-quality/cases.json'), 'utf8'));
assert.equal(dataset.schemaVersion, 1);
assert.equal(dataset.executionMode, 'public-dataset');
for (const category of ['routing', 'planning', 'review', 'implementation', 'cost']) {
  assert.ok(dataset.metrics[category]?.length >= 5, `missing ${category} metrics`);
}
for (const category of ['planning', 'review', 'implementation', 'safety', 'finalize', 'trigger']) {
  assert.ok(dataset.cases.some((entry) => entry.category === category), `missing ${category} eval case`);
}
for (const entry of dataset.cases) {
  assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(entry.input || entry.inputText, `${entry.id}: input missing`);
  if (entry.input) assert.equal(existsSync(resolve(root, 'evals/workflow-quality', entry.input)), true, `${entry.id}: input file missing`);
  assert.ok((entry.expectedSignals?.length ?? entry.seededDefects?.length ?? 0) >= 1, `${entry.id}: expected signals missing`);
  assert.ok(entry.forbiddenSignals?.length >= 1, `${entry.id}: forbidden signals missing`);
}
console.log(`OK workflow quality dataset passed (${dataset.cases.length} cases)`);
