import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';
import { assertReleaseReady, evaluateReleaseCorrections } from '../../scripts/lib/release-corrections.mjs';
import { loadReleaseCorrections } from '../../scripts/lib/release-corrections.mjs';

const identity = { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit: 'a'.repeat(40) };
const base = {
  id: 'REL-001', issue: 73, affectedCommits: ['b'.repeat(40)],
  stableRelease: { tag: 'v4.0.0', commit: 'c'.repeat(40), state: 'INSTALL_PROVEN' },
};
const evaluate = (corrections, options = {}) => evaluateReleaseCorrections({
  mode: 'candidate', ...identity, corrections, correctionsSha256: canonicalSha256({ corrections }), ...options,
});

test('an active release hold blocks every new candidate identity', () => {
  const result = evaluate([{ ...base, status: 'active-release-hold' }]);
  assert.equal(result.status, 'BLOCKED_POLICY');
  assert.equal(result.reasonCode, 'ACTIVE_RELEASE_HOLD');
  assert.equal(result.maximumPermittedState, 'DRAFT');
  assert.throws(() => assertReleaseReady(result), /ACTIVE_RELEASE_HOLD/u);
});

test('candidate authorization binds exact tags while runtime evidence binds the source commit', () => {
  const correction = { ...base, status: 'authorized-for-new-candidate', targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } };
  const result = evaluate([correction], { independentReview: { passed: true } });
  assert.equal(result.status, 'READY');
  assert.equal(result.correctionIds[0], 'REL-001');
  assert.equal(assertReleaseReady(result), result);
  assert.equal(evaluate([correction], { candidateTag: 'v4.1.0-rc.2', independentReview: { passed: true } }).reasonCode, 'CORRECTION_IDENTITY_MISMATCH');
});

test('promotion fails closed for unverified candidate or missing operational evidence', () => {
  const authorized = { ...base, status: 'authorized-for-new-candidate', targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } };
  assert.equal(evaluate([authorized], { mode: 'promote' }).reasonCode, 'CANDIDATE_NOT_VERIFIED');
  const runtimeVerified = evaluate([authorized], {
    mode: 'promote', independentReview: { passed: true }, candidateVerification: { passed: true }, protectedPublication: { passed: true },
  });
  assert.equal(runtimeVerified.status, 'READY');
  const verified = { ...authorized, status: 'candidate-verified' };
  const missing = evaluate([verified], { mode: 'promote' });
  assert.equal(missing.status, 'BLOCKED_EXTERNAL_GATE');
  assert.ok(missing.missingEvidence.includes('INDEPENDENT_REVIEW_REQUIRED'));
  const ready = evaluate([verified], {
    mode: 'promote', independentReview: { passed: true }, protectedPublication: { passed: true }, candidateVerification: { passed: true },
  });
  assert.equal(ready.status, 'READY');
  const candidateMissingReview = evaluate([verified], { mode: 'candidate' });
  assert.equal(candidateMissingReview.maximumPermittedState, 'CANDIDATE_TAGGED');
  const promotionMissingReview = evaluate([verified], { mode: 'promote', protectedPublication: { passed: true } });
  assert.equal(promotionMissingReview.maximumPermittedState, 'CANDIDATE_VERIFIED');
});

test('drill mode can never advance beyond PROMOTION_READY', () => {
  const correction = { ...base, status: 'candidate-verified', targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } };
  const result = evaluate([correction], { mode: 'drill', independentReview: { passed: true } });
  assert.equal(result.status, 'READY');
  assert.equal(result.maximumPermittedState, 'PROMOTION_READY');
});

test('correction evaluator rejects malformed inputs and unsafe source paths', () => {
  for (const change of [
    { mode: 'unknown' }, { stableTag: '4.1.0' }, { candidateTag: 'v4.1.0' },
    { sourceCommit: 'short' }, { corrections: null }, { correctionsSha256: 'short' },
  ]) assert.throws(() => evaluate([], change));
  assert.throws(() => loadReleaseCorrections(process.cwd(), '../outside.json'), /contained/u);
  assert.throws(() => loadReleaseCorrections(process.cwd(), 'package.json'), /schemaVersion 3/u);
});

test('correction loading verifies evidence digests and rejects self-reference', () => {
    assert.equal(loadReleaseCorrections(process.cwd()).document.schemaVersion, 3);
  const directory = mkdtempSync(resolve(tmpdir(), 'correction-evidence-'));
  try {
    const path = resolve(directory, 'corrections.json');
    const document = { schemaVersion: 3, corrections: [{ id: 'X', auditTrail: [{ evidence: { path: 'corrections.json', sha256: '0'.repeat(64) } }] }] };
    writeFileSync(path, JSON.stringify(document));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /cannot reference/u);
    writeFileSync(resolve(directory, 'evidence.txt'), 'actual');
    document.corrections[0].auditTrail[0].evidence.path = 'evidence.txt';
    writeFileSync(path, JSON.stringify(document));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /digest differs/u);
    const evidence = 'verified evidence';
    const sha256 = createHash('sha256').update(evidence).digest('hex');
    writeFileSync(resolve(directory, 'evidence.txt'), evidence);
    document.corrections[0] = { id: 'X', authorizationEvidence: { path: 'evidence.txt', sha256 } };
    writeFileSync(path, JSON.stringify(document));
    assert.equal(loadReleaseCorrections(directory, 'corrections.json').document.corrections[0].id, 'X');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('resolved and unrelated corrections do not block while recovery requires protected publication', () => {
  const resolved = { ...base, status: 'resolved-by-governed-release' };
  assert.equal(evaluate([resolved], { independentReview: { passed: true } }).status, 'READY');
  const unrelated = { ...base, status: 'authorized-for-new-candidate', affectedCommits: ['f'.repeat(40)], stableRelease: { tag: 'v3.0.0' }, targetRelease: { stableTag: 'v3.1.0', candidateTag: 'v3.1.0-rc.1' } };
  assert.equal(evaluate([unrelated], { independentReview: { passed: true } }).status, 'READY');
  const affectedButResolved = { id: 'REL-AFFECTED', status: 'resolved-by-governed-release', affectedCommits: [identity.sourceCommit] };
  assert.deepEqual(evaluate([affectedButResolved], { independentReview: { passed: true } }).correctionIds, ['REL-AFFECTED']);
  const verified = { ...base, status: 'candidate-verified', targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } };
  const recovery = evaluate([verified], { mode: 'recover', independentReview: { passed: true } });
  assert.equal(recovery.reasonCode, 'PROTECTED_PUBLICATION_REQUIRED');
  assert.equal(recovery.maximumPermittedState, 'ASSETS_RECONCILED');
});
