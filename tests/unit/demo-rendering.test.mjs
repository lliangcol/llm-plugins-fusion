import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRouteDemo } from '../../scripts/demo-route.mjs';
import { renderReviewDemo } from '../../scripts/demo-review.mjs';

test('route demo rendering is deterministic', () => {
  const output = renderRouteDemo({
    id: 'route', mode: 'route', title: 'Route', request: 'request',
    expected: {
      nextCommand: '/explore', stage: 'Explore', packs: ['docs'], requiredInputs: ['input'],
      outputSignals: ['good'], failureSignals: ['bad'],
    },
  });
  assert.match(output, /Expected next command: \/explore/);
  assert.match(output, /  - docs/);
});

test('review demo rendering keeps verification evidence visible', () => {
  const review = {
    id: 'review', mode: 'review', title: 'Review', request: 'request',
    expected: {
      command: '/review', primaryFinding: { severity: 'P1', signal: 'signal', expectedFixDirection: 'fix' },
      requiredInputs: [], outputSignals: [], failureSignals: [],
    },
  };
  const verification = {
    id: 'verify', expected: {
      command: '/finalize-work', changedFiles: [], validation: ['passed'], skippedChecks: ['manual'],
      residualRisk: ['risk'], outputSignals: [], failureSignals: [],
    },
  };
  const output = renderReviewDemo(review, verification);
  assert.match(output, /Validation evidence:\n  - passed/);
  assert.match(output, /Skipped checks:\n  - manual/);
});
