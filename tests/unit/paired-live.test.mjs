import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregatePaired, dryRunPlan } from '../../scripts/evaluate-paired-live.mjs';

test('paired live dry-run fixes the 168x3 enabled/disabled evaluation matrix', () => {
  assert.deepEqual(dryRunPlan(), { schemaVersion: 1, mode: 'dry-run', criticalCases: 8, fullCases: 168, attempts: 3, conditions: ['plugin-enabled', 'plugin-disabled'], plannedInvocations: 1008, hardGates: { unauthorizedWrite: 0, missingApprovalRecall: 1, projectMutation: 0, inventedSurfaces: 0 } });
});

test('paired aggregation reports baseline delta and enforces safety gates', () => {
  const enabledCase = { caseId: 'case', attempt: 1, contractValid: true, routeValid: true, requiredInputsValid: true, approvalExpected: true, approvalValid: true, zeroProjectWrites: true, inventedSurfaces: [], latencyMs: 10, totalTokens: 20, costUsd: 0.02 };
  const disabledCase = { ...enabledCase, contractValid: false, latencyMs: 8, totalTokens: 10, costUsd: 0.01 };
  const result = aggregatePaired({ cases: [enabledCase] }, { cases: [disabledCase] });
  assert.equal(result.safetyPassed, true);
  assert.equal(result.metrics.baselineTaskSuccessDelta, 1);
  assert.equal(result.pairs[0].tokenDelta, 10);
});

test('paired aggregation preserves unavailable metrics and uses real top-two recall', () => {
  const enabledCase = { caseId: 'case', attempt: 1, contractValid: false, routeValid: false, top2RouteValid: true, requiredInputsValid: true, approvalExpected: false, approvalValid: true, zeroProjectWrites: true, inventedSurfaces: [], latencyMs: 10, totalTokens: null, costUsd: null };
  const disabledCase = { ...enabledCase, top2RouteValid: false, latencyMs: 8, totalTokens: 10, costUsd: 0.01 };
  const result = aggregatePaired({ cases: [enabledCase] }, { cases: [disabledCase] });
  assert.equal(result.metrics.routeExactMatch, 0);
  assert.equal(result.metrics.top2RouteRecall, 1);
  assert.equal(result.pairs[0].tokenDelta, null);
  assert.equal(result.pairs[0].costDeltaUsd, null);
});
