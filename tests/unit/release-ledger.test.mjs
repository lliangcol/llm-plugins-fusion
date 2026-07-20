import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';
import { appendReleaseLedger, createReleaseLedger, verifyReleaseLedger } from '../../scripts/lib/release-state-machine.mjs';

const identity = { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit: 'a'.repeat(40), candidateManifestSha256: 'b'.repeat(64), controlBundleSha256: 'c'.repeat(64) };
const transition = { from: 'DRAFT', to: 'CANDIDATE_TAGGED' };

test('release ledger rejects tamper replay reorder and duplicate transitions', () => {
  const ledger = appendReleaseLedger(createReleaseLedger(identity), { transition, identity, inputDigests: {}, outputDigests: {}, runId: '1', createdAt: '2026-07-13T00:00:00Z' }, 'promote');
  assert.equal(verifyReleaseLedger(ledger).headState, 'CANDIDATE_TAGGED');
  const tampered = structuredClone(ledger); tampered.events[0].event.runId = 'changed';
  assert.throws(() => verifyReleaseLedger(tampered), /digest/u);
  const relabeled = structuredClone(ledger); relabeled.events[0].mode = 'drill';
  assert.throws(() => verifyReleaseLedger(relabeled), /mode mismatch/u);
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

test('release ledger rejects malformed records, disconnected identity, stale heads, and non-continuing appends', () => {
  assert.throws(() => verifyReleaseLedger(null), /invalid release ledger structure/u);
  const malformed = createReleaseLedger(identity);
  malformed.events.push({});
  assert.throws(() => verifyReleaseLedger(malformed), /invalid release ledger record/u);

  const ledger = appendReleaseLedger(createReleaseLedger(identity), {
    transition,
    identity,
    runId: '1',
    createdAt: '2026-07-13T00:00:00Z',
  }, 'promote');
  const disconnected = structuredClone(ledger);
  disconnected.events[0].event.previousEventSha256 = 'f'.repeat(64);
  disconnected.events[0].sha256 = canonicalSha256(disconnected.events[0].event);
  disconnected.headSha256 = disconnected.events[0].sha256;
  assert.throws(() => verifyReleaseLedger(disconnected), /reordered or disconnected/u);

  const identityMismatch = structuredClone(ledger);
  identityMismatch.identity.stableTag = 'v9.9.9';
  assert.throws(() => verifyReleaseLedger(identityMismatch), /release identity|identity mismatch for stableTag/u);

  const staleHead = structuredClone(ledger);
  staleHead.headState = 'DRAFT';
  assert.throws(() => verifyReleaseLedger(staleHead), /head mismatch/u);

  assert.throws(() => appendReleaseLedger(ledger, {
    transition,
    identity,
    runId: '2',
    createdAt: '2026-07-13T00:00:01Z',
  }, 'promote'), /does not continue the ledger head/u);

  for (const [label, mutate, expected] of [
    ['extra field', (event) => { event.unexpected = true; }, /field inventory/u],
    ['bad timestamp', (event) => { event.createdAt = 'not-a-time'; }, /createdAt/u],
    ['invalid calendar timestamp', (event) => { event.createdAt = '2026-02-31T00:00:00Z'; }, /createdAt/u],
    ['bad digest map', (event) => { event.inputDigests = { source: 'not-a-digest' }; }, /digest entry/u],
    ['non-string digest map', (event) => { event.inputDigests = { source: ['a'.repeat(64)] }; }, /digest entry/u],
    ['empty run id', (event) => { event.runId = ''; }, /runId/u],
  ]) {
    const invalid = structuredClone(ledger);
    mutate(invalid.events[0].event);
    invalid.events[0].sha256 = canonicalSha256(invalid.events[0].event);
    invalid.headSha256 = invalid.events[0].sha256;
    assert.throws(() => verifyReleaseLedger(invalid), expected, label);
  }
});
