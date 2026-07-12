#!/usr/bin/env node
/** Validate independent golden expectations against behavior-complete IR. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';
import { resolveBehaviorInputs } from '../framework/core/input-resolution.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const { behaviorSpec } = loadNovaWorkflowModel(root);
const dataset = JSON.parse(readFileSync(resolve(root, 'evals/behavior-golden/cases.json'), 'utf8'));
const behaviors = new Map(behaviorSpec.behaviors.map((behavior) => [behavior.id, behavior]));
const failures = [];

assert.equal(dataset.schemaVersion, 1);
assert.equal(dataset.executionMode, 'deterministic-ir-golden');
for (const suite of ['route', 'review', 'implement']) {
  assert.ok(dataset.cases.filter((entry) => entry.suite === suite).length >= 9, `${suite}: expected at least 9 golden cases`);
}

function contains(values, expected) {
  return values.some((value) => value.toLocaleLowerCase('en-US').includes(expected.toLocaleLowerCase('en-US')));
}

for (const entry of dataset.cases) {
  const behavior = behaviors.get(entry.workflow);
  if (!behavior) {
    failures.push(`${entry.id}: workflow missing`);
    continue;
  }
  const resolved = resolveBehaviorInputs(behavior, entry.providedInputs);
  try {
    for (const [name, value] of Object.entries(entry.expectedNormalized ?? {})) assert.deepEqual(resolved.normalizedInputs[name], value, `${name} normalized value`);
    if (entry.expectedMissingInput) assert.ok(resolved.missingRequired.includes(entry.expectedMissingInput), `missing ${entry.expectedMissingInput}`);
    if (entry.expectedInvalidInput) assert.ok(resolved.invalidExactValues.some((item) => item.input === entry.expectedInvalidInput), `invalid ${entry.expectedInvalidInput}`);
    if (entry.expectedDecisionRoute) assert.ok(behavior.decisionTable.some((item) => item.route === entry.expectedDecisionRoute), `decision route ${entry.expectedDecisionRoute}`);
    if (entry.expectedOutputOrder) assert.deepEqual(behavior.output.order, entry.expectedOutputOrder, 'output order');
    if (entry.expectedSeverityLevels) assert.deepEqual(behavior.output.severityLevels, entry.expectedSeverityLevels, 'severity levels');
    if (entry.expectedInvariantContains) assert.ok(contains(behavior.invariants, entry.expectedInvariantContains), `invariant signal ${entry.expectedInvariantContains}`);
    if (entry.expectedStopContains) assert.ok(contains(behavior.stopConditions, entry.expectedStopContains), `stop signal ${entry.expectedStopContains}`);
    if (entry.expectedValidationContains) assert.ok(contains(behavior.validation, entry.expectedValidationContains), `validation signal ${entry.expectedValidationContains}`);
    if (entry.expectedDeviationMode) assert.equal(behavior.deviationPolicy.mode, entry.expectedDeviationMode, 'deviation mode');
  } catch (error) {
    failures.push(`${entry.id}: ${error.message}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`ERROR ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`OK behavior IR golden suites (${dataset.cases.length}/${dataset.cases.length}, false negatives 0)`);
}
