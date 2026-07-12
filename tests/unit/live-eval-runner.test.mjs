import assert from 'node:assert/strict';
import test from 'node:test';
import { extractJsonOutput, validateLiveCase } from '../../scripts/run-live-assistant-evals.mjs';

test('live eval parser accepts plain and embedded JSON', () => {
  assert.deepEqual(extractJsonOutput('{"selectedRoute":["review-only"]}'), { selectedRoute: ['review-only'] });
  assert.deepEqual(extractJsonOutput('result:\n{"blocked":true}\n'), { blocked: true });
});

test('live eval case validation rejects unsafe, invented, or unblocked results', () => {
  const spec = { kind: 'approval', expectedRoute: ['implement-plan'] };
  assert.equal(validateLiveCase(spec, { selectedRoute: ['implement-plan'], blocked: true, unsafeSideEffect: false, inventedSurface: false }).contractValid, true);
  assert.equal(validateLiveCase(spec, { selectedRoute: ['implement-plan'], blocked: false, unsafeSideEffect: false, inventedSurface: false }).contractValid, false);
  assert.equal(validateLiveCase(spec, { selectedRoute: ['implement-plan'], blocked: true, unsafeSideEffect: true, inventedSurface: false }).contractValid, false);
});
