import assert from 'node:assert/strict';
import test from 'node:test';
import { appendReleaseLedger, createReleaseLedger, verifyReleaseLedger } from '../../scripts/lib/release-state-machine.mjs';

const identity = { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit: 'a'.repeat(40), candidateManifestSha256: 'b'.repeat(64), controlBundleSha256: 'c'.repeat(64) };
const transition = { from: 'DRAFT', to: 'CANDIDATE_TAGGED' };

test('release ledger rejects tamper replay reorder and duplicate transitions', () => {
  const ledger = appendReleaseLedger(createReleaseLedger(identity), { transition, identity, inputDigests: {}, outputDigests: {}, runId: '1', createdAt: '2026-07-13T00:00:00Z' }, 'promote');
  assert.equal(verifyReleaseLedger(ledger).headState, 'CANDIDATE_TAGGED');
  const tampered = structuredClone(ledger); tampered.events[0].event.runId = 'changed';
  assert.throws(() => verifyReleaseLedger(tampered), /digest/u);
  const replayed = structuredClone(ledger); replayed.events.push(structuredClone(replayed.events[0])); replayed.headSha256 = replayed.events[1].sha256;
  assert.throws(() => verifyReleaseLedger(replayed), /duplicate|chain|transition/u);
  const reordered = structuredClone(ledger); reordered.events.unshift(structuredClone(reordered.events[0]));
  assert.throws(() => verifyReleaseLedger(reordered), /duplicate|chain|transition/u);
});

test('release mode constrains transitions', () => {
  let ledger = createReleaseLedger(identity);
  ledger = appendReleaseLedger(ledger, { transition, identity, runId: '1', createdAt: '2026-07-13T00:00:00Z' }, 'drill');
  ledger = appendReleaseLedger(ledger, { transition: { from: 'CANDIDATE_TAGGED', to: 'CANDIDATE_VERIFIED' }, identity, runId: '1', createdAt: '2026-07-13T00:00:01Z' }, 'drill');
  ledger = appendReleaseLedger(ledger, { transition: { from: 'CANDIDATE_VERIFIED', to: 'PROMOTION_READY' }, identity, runId: '1', createdAt: '2026-07-13T00:00:02Z' }, 'drill');
  assert.throws(() => appendReleaseLedger(ledger, { transition: { from: 'PROMOTION_READY', to: 'STABLE_TAG_VERIFIED' }, identity, runId: '1', createdAt: '2026-07-13T00:00:03Z' }, 'drill'), /drill mode/u);
  assert.throws(() => appendReleaseLedger(createReleaseLedger(identity), { transition, identity, runId: '1', createdAt: '2026-07-13T00:00:00Z' }, 'recover'), /recover mode/u);
});
