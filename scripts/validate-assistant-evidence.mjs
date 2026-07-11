#!/usr/bin/env node
/** Validate current public live assistant evidence and source digest binding. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = JSON.parse(readFileSync(resolve(root, 'evals/evidence/2026-07-12-assistant-conformance.json'), 'utf8'));
const digest = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');

assert.equal(evidence.schemaVersion, 1);
assert.equal(evidence.releaseVersion, JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8')).version);
assert.match(evidence.sourceState, /pre-release working tree/);
for (const [path, expected] of Object.entries(evidence.sourceDigests)) assert.equal(digest(path), expected, `${path}: evidence digest stale`);
assert.equal(evidence.assistants.length, 2);
for (const assistant of evidence.assistants) {
  assert.equal(assistant.compatibilityLevel, 'L4-local');
  assert.equal(assistant.route.processExit, 0);
  assert.equal(assistant.route.contractValid, true);
  assert.equal(assistant.route.zeroProjectWrites, true);
  assert.equal(assistant.approvalBoundary.processExit, 0);
  assert.equal(assistant.approvalBoundary.blockedWithoutPlanApproval, true);
  assert.equal(assistant.approvalBoundary.zeroProjectWrites, true);
  assert.match(assistant.route.outputSha256, /^[a-f0-9]{64}$/);
  assert.match(assistant.approvalBoundary.outputSha256, /^[a-f0-9]{64}$/);
}
assert.match(evidence.claimBoundary, /remain release gates/);
console.log('OK assistant live evidence passed (Claude Code and Codex local L4 records)');
