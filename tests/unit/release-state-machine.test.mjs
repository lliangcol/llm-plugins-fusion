import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReleaseTransition, createTransitionEvent, planReleaseTransitions, reconcileReleaseAssets, releaseStates } from '../../scripts/lib/release-state-machine.mjs';

test('release state machine covers every legal transition exactly once', () => {
  const transitions = planReleaseTransitions('DRAFT', 'INSTALL_PROVEN');
  assert.equal(transitions.length, 9);
  assert.deepEqual(transitions.map((entry) => entry.to), releaseStates.slice(1));
  for (const transition of transitions) assert.equal(assertReleaseTransition(transition.from, transition.to), true);
  assert.throws(() => assertReleaseTransition('DRAFT', 'PROMOTION_READY'), /illegal/);
  assert.throws(() => planReleaseTransitions('INSTALL_PROVEN', 'DRAFT'), /invalid/);
});

test('transition events form a deterministic digest chain', () => {
  const identity = { stableTag: 'v4.0.0', candidateTag: 'v4.0.0-rc.1', sourceCommit: 'a'.repeat(40), candidateManifestSha256: 'b'.repeat(64), controlBundleSha256: 'c'.repeat(64) };
  const first = createTransitionEvent({ transition: { from: 'DRAFT', to: 'CANDIDATE_TAGGED' }, identity, mode: 'promote', runId: '1', createdAt: '2026-07-12T00:00:00Z' });
  const second = createTransitionEvent({ transition: { from: 'CANDIDATE_TAGGED', to: 'CANDIDATE_VERIFIED' }, identity, mode: 'promote', runId: '1', createdAt: '2026-07-12T00:00:01Z', previousEventSha256: first.sha256 });
  assert.match(first.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(first.event.mode, 'promote');
  assert.equal(second.event.previousEventSha256, first.sha256);
  assert.throws(() => createTransitionEvent({ transition: { from: 'DRAFT', to: 'CANDIDATE_TAGGED' }, identity, runId: '1', createdAt: '2026-07-12T00:00:00Z' }), /unknown release mode/u);
});

test('asset reconciliation reuses identical bytes and quarantines conflicts', () => {
  const expected = [{ name: 'a.tgz', sha256: 'a', bytes: 1 }, { name: 'b.json', sha256: 'b', bytes: 2 }];
  assert.deepEqual(reconcileReleaseAssets(expected, [{ ...expected[0] }]), { upload: [expected[1]], reuse: [expected[0]], quarantine: [], publishable: true });
  const conflict = reconcileReleaseAssets(expected, [{ name: 'a.tgz', sha256: 'x', bytes: 1 }]);
  assert.equal(conflict.publishable, false);
  assert.equal(conflict.quarantine[0].reason, 'same-name-different-content');
});
