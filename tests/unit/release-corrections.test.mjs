import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';
import { assertReleaseReady, evaluateReleaseCorrections, ReleaseReadinessError } from '../../scripts/lib/release-corrections.mjs';
import { loadReleaseCorrections } from '../../scripts/lib/release-corrections.mjs';

const identity = { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit: 'a'.repeat(40) };
const recordedAt = '2026-07-16T00:00:00Z';
const evidence = { path: 'governance/evidence/test.md', sha256: 'd'.repeat(64), recordedAt };
const auditActionsByStatus = {
  'active-release-hold': ['created'],
  'authorized-for-new-candidate': ['created', 'authorized'],
  'candidate-verified': ['created', 'authorized', 'candidate-verified'],
  'resolved-by-governed-release': ['created', 'authorized', 'candidate-verified', 'closed'],
};
const base = {
  id: 'REL-001', issue: 73, affectedCommits: ['b'.repeat(40)],
  stableRelease: { tag: 'v4.0.0', commit: 'c'.repeat(40), state: 'INSTALL_PROVEN' },
  decision: { authorizedByIssue: 73, nonRetroactive: true, summary: 'test correction' },
  releaseBoundary: {
    mayPublishStable: false,
    requiresNewCandidate: true,
    requiresCurrentIndependentReview: true,
    requiresProtectedPublicationEvidence: true,
    requiresInstallProof: true,
  },
  authorizationEvidence: evidence,
  candidateEvidence: evidence,
  resolutionEvidence: evidence,
};
const correction = (status, overrides = {}) => ({
  ...base,
  status,
  auditTrail: auditActionsByStatus[status].map((action) => ({
    action, actorRole: 'maintainer', recordedAt, evidence,
  })),
  ...overrides,
});
const evaluate = (corrections, options = {}) => evaluateReleaseCorrections({
  mode: 'candidate', ...identity, corrections, correctionsSha256: canonicalSha256({ corrections }), ...options,
});

test('an active release hold blocks every new candidate identity', () => {
  const result = evaluate([correction('active-release-hold')]);
  assert.equal(result.status, 'BLOCKED_POLICY');
  assert.equal(result.reasonCode, 'ACTIVE_RELEASE_HOLD');
  assert.equal(result.maximumPermittedState, 'DRAFT');
  assert.throws(() => assertReleaseReady(result), (error) => {
    assert.equal(error instanceof ReleaseReadinessError, true);
    assert.equal(error.code, 'ACTIVE_RELEASE_HOLD');
    assert.equal(error.readiness, result);
    return true;
  });
});

test('candidate authorization binds exact tags while runtime evidence binds the source commit', () => {
  const record = correction('authorized-for-new-candidate', { targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } });
  const result = evaluate([record], { independentReview: { passed: true } });
  assert.equal(result.status, 'READY');
  assert.equal(result.correctionIds[0], 'REL-001');
  assert.equal(assertReleaseReady(result), result);
  assert.equal(evaluate([record], { candidateTag: 'v4.1.0-rc.2', independentReview: { passed: true } }).reasonCode, 'CORRECTION_IDENTITY_MISMATCH');
});

test('promotion fails closed for unverified candidate or missing operational evidence', () => {
  const authorized = correction('authorized-for-new-candidate', { targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } });
  assert.equal(evaluate([authorized], { mode: 'promote' }).reasonCode, 'CANDIDATE_NOT_VERIFIED');
  const runtimeVerified = evaluate([authorized], {
    mode: 'promote', independentReview: { passed: true }, candidateVerification: { passed: true }, protectedPublication: { passed: true },
  });
  assert.equal(runtimeVerified.status, 'READY');
  const verified = correction('candidate-verified', { targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } });
  const missingRuntimeEvidence = evaluate([verified], { mode: 'promote' });
  assert.equal(missingRuntimeEvidence.status, 'BLOCKED_POLICY');
  assert.equal(missingRuntimeEvidence.reasonCode, 'CANDIDATE_NOT_VERIFIED');
  const missing = evaluate([verified], { mode: 'promote', candidateVerification: { passed: true } });
  assert.equal(missing.status, 'BLOCKED_EXTERNAL_GATE');
  assert.ok(missing.missingEvidence.includes('INDEPENDENT_REVIEW_REQUIRED'));
  const ready = evaluate([verified], {
    mode: 'promote', independentReview: { passed: true }, protectedPublication: { passed: true }, candidateVerification: { passed: true },
  });
  assert.equal(ready.status, 'READY');
  const candidateMissingReview = evaluate([verified], { mode: 'candidate' });
  assert.equal(candidateMissingReview.maximumPermittedState, 'CANDIDATE_TAGGED');
  const promotionMissingReview = evaluate([verified], {
    mode: 'promote',
    protectedPublication: { passed: true },
    candidateVerification: { passed: true },
  });
  assert.equal(promotionMissingReview.maximumPermittedState, 'CANDIDATE_VERIFIED');
});

test('global release gates apply without an active correction', () => {
  const resolved = correction('resolved-by-governed-release', {
    releaseBoundary: { ...base.releaseBoundary, mayPublishStable: true },
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
  });
  for (const corrections of [[], [resolved]]) {
    const candidate = evaluate(corrections);
    assert.equal(candidate.status, 'BLOCKED_EXTERNAL_GATE');
    assert.equal(candidate.reasonCode, 'INDEPENDENT_REVIEW_REQUIRED');
    assert.equal(candidate.maximumPermittedState, 'CANDIDATE_TAGGED');

    const unverified = evaluate(corrections, { mode: 'promote' });
    assert.equal(unverified.status, 'BLOCKED_POLICY');
    assert.equal(unverified.reasonCode, 'CANDIDATE_NOT_VERIFIED');
    assert.deepEqual(unverified.missingEvidence, ['CANDIDATE_VERIFICATION_REQUIRED']);

    const unpublished = evaluate(corrections, {
      mode: 'promote',
      candidateVerification: { passed: true },
      independentReview: { passed: true },
    });
    assert.equal(unpublished.status, 'BLOCKED_EXTERNAL_GATE');
    assert.equal(unpublished.reasonCode, 'PROTECTED_PUBLICATION_REQUIRED');
    assert.equal(unpublished.maximumPermittedState, 'ASSETS_RECONCILED');
  }
});

test('drill mode can never advance beyond PROMOTION_READY', () => {
  const record = correction('candidate-verified', { targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } });
  const result = evaluate([record], { mode: 'drill', independentReview: { passed: true } });
  assert.equal(result.status, 'READY');
  assert.equal(result.maximumPermittedState, 'PROMOTION_READY');
});

test('drill keeps an authorized candidate blocked until runtime verification succeeds', () => {
  const record = correction('authorized-for-new-candidate', { targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } });
  const blocked = evaluate([record], { mode: 'drill', independentReview: { passed: true } });
  assert.equal(blocked.reasonCode, 'CANDIDATE_NOT_VERIFIED');
  const ready = evaluate([record], {
    mode: 'drill',
    independentReview: { passed: true },
    candidateVerification: { passed: true },
  });
  assert.equal(ready.status, 'READY');
  assert.equal(ready.maximumPermittedState, 'PROMOTION_READY');
});

test('correction evaluator rejects malformed inputs and unsafe source paths', () => {
  for (const change of [
    { mode: 'unknown' }, { stableTag: '4.1.0' }, { candidateTag: 'v4.1.0' },
    { stableTag: 'v04.1.0', candidateTag: 'v04.1.0-rc.1' },
    { stableTag: 'v4.1.0', candidateTag: 'v4.2.0-rc.1' },
    { sourceCommit: 'short' }, { corrections: null }, { correctionsSha256: 'short' },
  ]) assert.throws(() => evaluate([], change));
  const valid = correction('authorized-for-new-candidate', {
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
  });
  for (const malformed of [
    null,
    { ...valid, id: '' },
    { ...valid, status: 'not-a-real-status' },
    { ...valid, issue: 0 },
    { ...valid, affectedCommits: [] },
    { ...valid, affectedCommits: ['short'] },
    { ...valid, stableRelease: { ...valid.stableRelease, commit: 'short' } },
    { ...valid, decision: { ...valid.decision, nonRetroactive: false } },
    { ...valid, authorizationEvidence: undefined },
    { ...valid, authorizationEvidence: { ...valid.authorizationEvidence, recordedAt: '0' } },
    { ...valid, authorizationEvidence: { ...valid.authorizationEvidence, recordedAt: '2026-02-31T00:00:00Z' } },
    { ...valid, authorizationEvidence: { ...valid.authorizationEvidence, recordedAt: '2026-07-16T00:00:00+24:00' } },
    { ...valid, status: 'candidate-verified', candidateEvidence: undefined },
    {
      ...valid,
      status: 'resolved-by-governed-release',
      releaseBoundary: { ...valid.releaseBoundary, mayPublishStable: true },
      resolutionEvidence: undefined,
    },
    {
      ...valid,
      status: 'resolved-by-governed-release',
      releaseBoundary: { ...valid.releaseBoundary, mayPublishStable: false },
    },
    { ...valid, releaseBoundary: { ...valid.releaseBoundary, requiresInstallProof: false } },
    { ...valid, auditTrail: [] },
    { ...valid, auditTrail: valid.auditTrail.map((entry, index) => index === 0 ? { ...entry, actorRole: 'outsider' } : entry) },
    { ...valid, auditTrail: [correction('active-release-hold').auditTrail[0]] },
    { ...valid, targetRelease: undefined },
    { ...valid, targetRelease: { stableTag: identity.stableTag, candidateTag: 'v4.2.0-rc.1' } },
  ]) assert.throws(() => evaluate([malformed]), /release correction record/u);
  assert.throws(() => evaluate([valid, { ...valid }]), /unique correction id/u);
  const offsetTimestamp = '2026-07-16T00:00:00+23:59';
  assert.equal(evaluate([{
    ...valid,
    authorizationEvidence: { ...valid.authorizationEvidence, recordedAt: offsetTimestamp },
  }], { independentReview: { passed: true } }).status, 'READY');
  assert.throws(() => loadReleaseCorrections(process.cwd(), '../outside.json'), /contained/u);
  assert.throws(() => loadReleaseCorrections(process.cwd(), '.'), /contained/u);
  assert.throws(() => loadReleaseCorrections(process.cwd(), 'package.json'), /schemaVersion 3/u);
});

test('correction runtime shape and audit history fail closed like the schema', () => {
  const resolved = correction('resolved-by-governed-release', {
    releaseBoundary: { ...base.releaseBoundary, mayPublishStable: true },
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
  });
  const later = '2026-07-17T00:00:00Z';
  const reopened = {
    action: 'reopened', actorRole: 'maintainer', recordedAt: later,
    evidence: { ...evidence, recordedAt: later },
  };
  assert.throws(() => evaluate([{ ...resolved, auditTrail: [...resolved.auditTrail, reopened] }]), /terminal action/u);
  assert.throws(() => evaluate([{ ...resolved, auditTrail: [reopened, ...resolved.auditTrail] }]), /illegal action sequence/u);
  assert.throws(() => evaluate([correction('authorized-for-new-candidate', {
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
    auditTrail: [
      { ...correction('authorized-for-new-candidate').auditTrail[0], recordedAt: later },
      correction('authorized-for-new-candidate').auditTrail[1],
    ],
  })]), /non-decreasing/u);
  assert.throws(() => evaluate([{ ...correction('authorized-for-new-candidate', {
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
  }), auditTrail: [
    correction('authorized-for-new-candidate').auditTrail[0],
    {
      ...correction('authorized-for-new-candidate').auditTrail[1],
      evidence: { ...evidence, recordedAt: later },
    },
  ] }]), /cannot postdate/u);
  assert.throws(() => evaluate([{ ...correction('authorized-for-new-candidate', {
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
  }), auditTrail: [
    correction('authorized-for-new-candidate').auditTrail[0],
    resolved.auditTrail.at(-1),
    correction('authorized-for-new-candidate').auditTrail.at(-1),
  ] }]), /illegal action sequence/u);
  assert.throws(() => evaluate([correction('authorized-for-new-candidate', {
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
    authorizationEvidence: { ...evidence, recordedAt: later },
  })]), /cannot postdate the terminal audit/u);
  const reopenedHold = correction('active-release-hold', {
    auditTrail: [...resolved.auditTrail, reopened],
  });
  assert.equal(evaluate([reopenedHold]).reasonCode, 'ACTIVE_RELEASE_HOLD');

  for (const record of [
    { ...resolved, unexpected: true },
    { ...resolved, decision: { ...resolved.decision, unexpected: true } },
    { ...resolved, releaseBoundary: { ...resolved.releaseBoundary, unexpected: true } },
    { ...resolved, targetRelease: { ...resolved.targetRelease, unexpected: true } },
    { ...resolved, resolutionEvidence: { ...resolved.resolutionEvidence, unexpected: true } },
    { ...resolved, auditTrail: resolved.auditTrail.map((entry, index) => index === 0 ? { ...entry, unexpected: true } : entry) },
  ]) assert.throws(() => evaluate([record]), /unexpected fields/u);
});

test('correction loading verifies evidence digests and rejects self-reference', () => {
    assert.equal(loadReleaseCorrections(process.cwd()).document.schemaVersion, 3);
  const directory = mkdtempSync(resolve(tmpdir(), 'correction-evidence-'));
  try {
    const path = resolve(directory, 'corrections.json');
    const activeBase = structuredClone(base);
    delete activeBase.authorizationEvidence;
    delete activeBase.candidateEvidence;
    delete activeBase.resolutionEvidence;
    const document = {
      schemaVersion: 3,
      corrections: [{
        ...activeBase,
        id: 'X',
        status: 'active-release-hold',
        auditTrail: [{
          action: 'created', actorRole: 'maintainer', recordedAt,
          evidence: { path: 'corrections.json', sha256: '0'.repeat(64), recordedAt },
        }],
      }],
    };
    writeFileSync(path, JSON.stringify({ schemaVersion: 3, corrections: {} }));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /schemaVersion 3/u);
    writeFileSync(path, JSON.stringify({ schemaVersion: 3, corrections: [], unexpected: true }));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /unexpected fields/u);
    writeFileSync(path, JSON.stringify({
      schemaVersion: 3,
      corrections: [{
        ...base,
        status: 'candidate-verified',
        candidateEvidence: undefined,
        targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
      }],
    }));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /candidate verification evidence/u);
    writeFileSync(path, JSON.stringify(document));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /cannot reference/u);
    writeFileSync(resolve(directory, 'evidence.txt'), 'actual');
    document.corrections[0].auditTrail[0].evidence.path = 'evidence.txt';
    writeFileSync(path, JSON.stringify(document));
    assert.throws(() => loadReleaseCorrections(directory, 'corrections.json'), /digest differs/u);
    const evidence = 'verified evidence';
    const sha256 = createHash('sha256').update(evidence).digest('hex');
    writeFileSync(resolve(directory, 'evidence.txt'), evidence);
    document.corrections[0] = {
      ...activeBase,
      id: 'X',
      status: 'active-release-hold',
      authorizationEvidence: { path: 'evidence.txt', sha256, recordedAt },
      auditTrail: [{
        action: 'created', actorRole: 'maintainer', recordedAt,
        evidence: { path: 'evidence.txt', sha256, recordedAt },
      }],
    };
    writeFileSync(path, JSON.stringify(document));
    assert.equal(loadReleaseCorrections(directory, 'corrections.json').document.corrections[0].id, 'X');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('resolved and unrelated corrections do not block while recovery requires protected publication', () => {
  const resolved = correction('resolved-by-governed-release', {
    releaseBoundary: { ...base.releaseBoundary, mayPublishStable: true },
    targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag },
  });
  assert.equal(evaluate([resolved], { independentReview: { passed: true } }).status, 'READY');
  const unrelated = correction('authorized-for-new-candidate', { affectedCommits: ['f'.repeat(40)], stableRelease: { ...base.stableRelease, tag: 'v3.0.0' }, targetRelease: { stableTag: 'v3.1.0', candidateTag: 'v3.1.0-rc.1' } });
  assert.equal(evaluate([unrelated], { independentReview: { passed: true } }).status, 'READY');
  const affectedButResolved = {
    ...resolved,
    id: 'REL-AFFECTED',
    affectedCommits: [identity.sourceCommit],
  };
  assert.deepEqual(evaluate([affectedButResolved], { independentReview: { passed: true } }).correctionIds, ['REL-AFFECTED']);
  const stableReleaseMatch = {
    ...resolved,
    id: 'REL-STABLE',
    stableRelease: { ...base.stableRelease, tag: identity.stableTag },
  };
  assert.deepEqual(evaluate([stableReleaseMatch]).correctionIds, ['REL-STABLE']);
  const verified = correction('candidate-verified', { targetRelease: { stableTag: identity.stableTag, candidateTag: identity.candidateTag } });
  const recovery = evaluate([verified], {
    mode: 'recover', independentReview: { passed: true }, candidateVerification: { passed: true },
  });
  assert.equal(recovery.reasonCode, 'PROTECTED_PUBLICATION_REQUIRED');
  assert.equal(recovery.maximumPermittedState, 'ASSETS_RECONCILED');
});
