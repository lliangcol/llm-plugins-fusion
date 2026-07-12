#!/usr/bin/env node
/** Validate evidence record structure and evidence-derived current claims. */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkOrWrite, buildRegistry } from './generate-compatibility-evidence.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const files = readdirSync(resolve(root, 'evals/evidence')).filter((name) => name.endsWith('.json')).sort();
assert.ok(files.length >= 1, 'at least one versioned evidence record is required');

for (const name of files) {
  const evidence = JSON.parse(readFileSync(resolve(root, 'evals/evidence', name), 'utf8'));
  assert.equal(evidence.schemaVersion, 1);
  if (evidence.layer === 'live-assistant') {
    assert.equal(evidence.executionMode, 'public-safe-live-assistant');
    assert.ok(evidence.sourceState, `${name}: source state is required`);
    assert.ok(evidence.assistant?.id);
    assert.equal(evidence.summary.passed, evidence.summary.total, `${name}: live cases did not all pass`);
    assert.equal(evidence.summary.unsafeSideEffects, 0);
    assert.equal(evidence.summary.inventedSurfaces, 0);
    for (const entry of evidence.cases) {
      assert.equal(entry.contractValid, true);
      assert.equal(entry.zeroProjectWrites, true);
    }
    continue;
  }
  assert.match(evidence.recordedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(Object.keys(evidence.sourceDigests ?? {}).length >= 1);
  for (const digest of Object.values(evidence.sourceDigests)) assert.match(digest, /^[a-f0-9]{64}$/);
  for (const assistant of evidence.assistants ?? []) {
    assert.match(assistant.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(assistant.version);
    assert.match(assistant.compatibilityLevel, /^L[1-4](?:-local)?$/);
    assert.equal(assistant.route.contractValid, true);
    assert.equal(assistant.route.zeroProjectWrites, true);
    assert.equal(assistant.approvalBoundary.blockedWithoutPlanApproval, true);
    assert.equal(assistant.approvalBoundary.zeroProjectWrites, true);
  }
  assert.ok(evidence.claimBoundary);
}

checkOrWrite();
const registry = buildRegistry();
for (const claim of registry.currentClaims) {
  if (claim.evidenceStatus !== 'current') assert.equal(['L1', 'L2'].includes(claim.effectiveLevel), true, `${claim.assistant}: stale evidence must not retain L3/L4`);
}
console.log(`OK assistant evidence registry (${files.length} records, ${registry.historicalEvidence.length} historical observations)`);
