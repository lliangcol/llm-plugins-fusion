import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyProcessFailure, codexPrompt, deriveAdapterLoadEvidence, evaluateSemanticCase, extractJsonOutput, validateLiveCase } from '../../scripts/run-live-assistant-evals.mjs';

test('live eval parser accepts plain and embedded JSON', () => {
  assert.deepEqual(extractJsonOutput('{"selectedRoute":["review-only"]}'), { selectedRoute: ['review-only'] });
  assert.deepEqual(extractJsonOutput('result:\n{"blocked":true}\n'), { blocked: true });
});

test('live eval prompts distinguish route inventory from direct blocked workflows', () => {
  const route = codexPrompt({ kind: 'route', request: 'Route a review request.' });
  assert.match(route, /every canonical required input/u);
  assert.doesNotMatch(route, /list only unresolved/u);
  assert.doesNotMatch(route, /adapterProof|proof token/iu);
  const approval = codexPrompt({ kind: 'approval', workflow: 'implement-plan', request: 'Run it.', providedInputs: { PLAN_INPUT_PATH: 'plan.md' } });
  assert.match(approval, /selectedRoute to exactly \["implement-plan"\]/u);
  assert.match(approval, /PLAN_INPUT_PATH/u);
  assert.match(approval, /blocked=true/u);
});

test('live eval records safe process failure categories without raw diagnostics', () => {
  assert.equal(classifyProcessFailure({ ok: true }), null);
  assert.equal(classifyProcessFailure({ ok: false, timedOut: true }), 'timeout');
  assert.equal(classifyProcessFailure({ ok: false, timedOut: false, stderr: 'HTTP 429 rate limit' }), 'rate-limit');
  assert.equal(classifyProcessFailure({ ok: false, timedOut: false, stderr: 'Authentication failed' }), 'authentication');
  assert.equal(classifyProcessFailure({ ok: false, timedOut: false, stderr: 'unexpected failure' }), 'nonzero-exit');
});

test('live eval case validation rejects unsafe, invented, or unblocked results', () => {
  const spec = { kind: 'approval', expectedRoute: ['implement-plan'], expectedRequiredInputs: ['PLAN_APPROVED'] };
  const base = { selectedRoute: ['implement-plan'], requiredInputs: ['PLAN_APPROVED'], blocked: true };
  assert.equal(validateLiveCase(spec, base, ['implement-plan']).contractValid, true);
  assert.equal(validateLiveCase(spec, { ...base, blocked: false }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, requiredInputs: [] }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, selectedRoute: ['invented'] }, ['implement-plan']).inventedSurfaces.length, 1);
});

test('shared semantic evaluator distinguishes exact match from top-two recall', () => {
  const spec = { kind: 'route', expectedRoute: ['review-only'], expectedRequiredInputs: [] };
  const result = evaluateSemanticCase(spec, { selectedRoute: ['review-fix', 'review-only'], requiredInputs: [], blocked: false }, ['review-only', 'review-fix']);
  assert.equal(result.routeValid, false);
  assert.equal(result.top2RouteValid, true);
  assert.equal(result.contractValid, false);
});

test('adapter load evidence cannot validate a disabled baseline', () => {
  const enabled = deriveAdapterLoadEvidence({ condition: 'plugin-enabled', stagedAdapterSha256: 'a'.repeat(64), expectedAdapterSha256: 'a'.repeat(64), contractValid: true });
  assert.equal(enabled.loaded, true);
  assert.match(enabled.proof, /staged-adapter-sha256/u);
  const disabled = deriveAdapterLoadEvidence({ condition: 'plugin-disabled', stagedAdapterSha256: 'a'.repeat(64), expectedAdapterSha256: 'a'.repeat(64), contractValid: true });
  assert.deepEqual(disabled, { loaded: false, proof: 'plugin-disabled baseline' });
});
