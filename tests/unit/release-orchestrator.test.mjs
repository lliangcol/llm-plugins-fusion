import assert from 'node:assert/strict';
import { linkSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';
import { orchestrateRelease } from '../../scripts/release-orchestrator.mjs';

const sourceCommit = 'a'.repeat(40);
const bundleSha256 = 'b'.repeat(64);
const correctionRecordedAt = '2026-07-16T00:00:00Z';
const correctionEvidence = {
  path: 'governance/evidence/test.md',
  sha256: 'f'.repeat(64),
  recordedAt: correctionRecordedAt,
};

function correctionRecord(status, overrides = {}) {
  const actionsByStatus = {
    'active-release-hold': ['created'],
    'authorized-for-new-candidate': ['created', 'authorized'],
    'candidate-verified': ['created', 'authorized', 'candidate-verified'],
    'resolved-by-governed-release': ['created', 'authorized', 'candidate-verified', 'closed'],
  };
  return {
    id: 'REL-TEST',
    issue: 73,
    status,
    affectedCommits: [sourceCommit],
    stableRelease: { tag: 'v4.0.0', commit: 'e'.repeat(40), state: 'INSTALL_PROVEN' },
    decision: { authorizedByIssue: 73, nonRetroactive: true, summary: 'test correction' },
    releaseBoundary: {
      mayPublishStable: status === 'resolved-by-governed-release',
      requiresNewCandidate: true,
      requiresCurrentIndependentReview: true,
      requiresProtectedPublicationEvidence: true,
      requiresInstallProof: true,
    },
    authorizationEvidence: correctionEvidence,
    candidateEvidence: correctionEvidence,
    resolutionEvidence: correctionEvidence,
    targetRelease: { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1' },
    auditTrail: actionsByStatus[status].map((action) => ({
      action, actorRole: 'maintainer', recordedAt: correctionRecordedAt, evidence: correctionEvidence,
    })),
    ...overrides,
  };
}

function releaseFixture(t, corrections = []) {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-orchestrator-unit-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const controlBundle = resolve(directory, 'control.json');
  const promotionIntent = resolve(directory, 'intent.json');
  const eventDir = resolve(directory, 'events');
  const document = { schemaVersion: 3, corrections };
  const correctionSource = { document, sha256: canonicalSha256(document) };
  const intent = {
    stableTag: 'v4.1.0',
    candidateTag: 'v4.1.0-rc.1',
    sourceCommit,
    candidateCoreSha256: 'c'.repeat(64),
    controlBundleSha256: bundleSha256,
    correctionsSha256: correctionSource.sha256,
  };
  writeFileSync(controlBundle, `${JSON.stringify({ bundleSha256 })}\n`);
  writeFileSync(promotionIntent, `${JSON.stringify(intent)}\n`);
  return {
    directory,
    controlBundle,
    promotionIntent,
    eventDir,
    correctionSource,
    intent,
    options: {
      mode: 'drill',
      state: 'DRAFT',
      targetState: 'CANDIDATE_TAGGED',
      stableTag: intent.stableTag,
      candidateTag: intent.candidateTag,
      sourceCommit,
      promotionIntent,
      controlBundle,
      eventDir,
      runId: 'unit',
      dryRun: true,
      candidateVerificationPassed: true,
      protectedPublicationApproved: true,
    },
  };
}

test('release orchestrator uses its default clock and rejects drifted or policy-blocked identities', (t) => {
  const fixture = releaseFixture(t);
  const result = orchestrateRelease(fixture.options, undefined, fixture.correctionSource);
  assert.deepEqual(result.transitions.map((entry) => entry.transition), ['DRAFT->CANDIDATE_TAGGED']);

  assert.throws(() => orchestrateRelease({
    ...fixture.options,
    candidateTag: 'v4.1.0-rc.2',
  }, undefined, fixture.correctionSource), /explicit release identity differs from promotion intent/u);

  writeFileSync(fixture.controlBundle, `${JSON.stringify({ bundleSha256: 'f'.repeat(64) })}\n`);
  assert.throws(
    () => orchestrateRelease(fixture.options, undefined, fixture.correctionSource),
    /promotion intent differs from the release control bundle/u,
  );
  writeFileSync(fixture.controlBundle, `${JSON.stringify({ bundleSha256 })}\n`);

  writeFileSync(fixture.promotionIntent, `${JSON.stringify({
    ...fixture.intent,
    correctionsSha256: 'f'.repeat(64),
  })}\n`);
  assert.throws(
    () => orchestrateRelease(fixture.options, undefined, fixture.correctionSource),
    /stale release correction evidence/u,
  );

  const activeHold = releaseFixture(t, [correctionRecord('active-release-hold', {
    id: 'REL-HOLD', targetRelease: undefined,
  })]);
  assert.throws(
    () => orchestrateRelease(activeHold.options, undefined, activeHold.correctionSource),
    /ACTIVE_RELEASE_HOLD/u,
  );

  const candidateVerified = releaseFixture(t, [correctionRecord('candidate-verified', { id: 'REL-VERIFIED' })]);
  assert.throws(() => orchestrateRelease({
    ...candidateVerified.options,
    targetState: 'PROMOTION_READY',
    candidateVerificationPassed: false,
  }, undefined, candidateVerified.correctionSource), /release policy limits orchestration to CANDIDATE_VERIFIED/u);
});

test('release orchestrator rejects invalid, semantically conflicting, and byte-conflicting retry events', (t) => {
  const fixture = releaseFixture(t);
  const options = { ...fixture.options, mode: 'promote', dryRun: false };
  const now = () => new Date('2026-07-13T00:00:00.000Z');
  orchestrateRelease(options, now, fixture.correctionSource);
  const ledgerPath = resolve(fixture.eventDir, 'release-ledger.json');
  const eventPath = resolve(fixture.eventDir, '01-draft-to-candidate_tagged.json');
  const originalText = readFileSync(eventPath, 'utf8');
  const original = JSON.parse(originalText);
  unlinkSync(ledgerPath);

  writeFileSync(eventPath, `${JSON.stringify({ ...original, createdAt: 'not-a-time' }, null, 2)}\n`);
  assert.throws(
    () => orchestrateRelease(options, now, fixture.correctionSource),
    /existing release event has an invalid timestamp/u,
  );

  writeFileSync(eventPath, `${JSON.stringify({ ...original, outputDigests: { unexpected: 'digest' } }, null, 2)}\n`);
  assert.throws(
    () => orchestrateRelease(options, now, fixture.correctionSource),
    /existing release event conflicts with the requested transition/u,
  );

  writeFileSync(eventPath, `${JSON.stringify(original)}\n`);
  assert.throws(
    () => orchestrateRelease(options, now, fixture.correctionSource),
    /existing release event bytes conflict/u,
  );

  writeFileSync(eventPath, originalText);
  orchestrateRelease(options, now, fixture.correctionSource);
  const resumed = orchestrateRelease(options, now, fixture.correctionSource);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.ledgerHeadState, 'CANDIDATE_TAGGED');
  assert.deepEqual(resumed.transitions, []);
  assert.throws(() => orchestrateRelease({ ...options, mode: 'drill' }, now, fixture.correctionSource), /different orchestration mode/u);
  assert.throws(() => orchestrateRelease({ ...options, targetState: 'CANDIDATE_VERIFIED' }, now, fixture.correctionSource), /conflicting initial transition/u);

  writeFileSync(fixture.promotionIntent, `${JSON.stringify({ ...fixture.intent, candidateTag: 'v4.1.0-rc.2' })}\n`);
  assert.throws(() => orchestrateRelease({ ...options, candidateTag: 'v4.1.0-rc.2' }, now, fixture.correctionSource), /ledger identity differs/u);
});

test('release orchestrator resumes an exactly completed publication as a strict no-op', (t) => {
  const fixture = releaseFixture(t);
  const now = () => new Date('2026-07-13T00:00:00.000Z');
  const verified = {
    ...fixture.options,
    mode: 'promote',
    state: 'DRAFT',
    targetState: 'STABLE_TAG_VERIFIED',
    dryRun: false,
  };
  orchestrateRelease(verified, now, fixture.correctionSource);
  const publish = {
    ...verified,
    state: 'STABLE_TAG_VERIFIED',
    targetState: 'RELEASE_PUBLISHED',
    protectedPublicationApproved: true,
  };
  const completed = orchestrateRelease(publish, now, fixture.correctionSource);
  assert.equal(completed.ledgerHeadState, 'RELEASE_PUBLISHED');
  assert.deepEqual(completed.transitions.map((entry) => entry.transition), [
    'STABLE_TAG_VERIFIED->RELEASE_DRAFT_CREATED',
    'RELEASE_DRAFT_CREATED->ASSETS_RECONCILED',
    'ASSETS_RECONCILED->RELEASE_PUBLISHED',
  ]);
  const resumed = orchestrateRelease(publish, now, fixture.correctionSource);
  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.transitions, []);
  assert.equal(resumed.ledgerHeadState, 'RELEASE_PUBLISHED');

  const driftedDocument = { $schema: 'drifted', schemaVersion: 3, corrections: [] };
  const driftedCorrectionSource = { document: driftedDocument, sha256: canonicalSha256(driftedDocument) };
  writeFileSync(fixture.promotionIntent, `${JSON.stringify({
    ...fixture.intent,
    correctionsSha256: driftedCorrectionSource.sha256,
  })}\n`);
  assert.throws(
    () => orchestrateRelease(publish, now, driftedCorrectionSource),
    /bound to a different promotion intent/u,
  );
});

test('release orchestrator rejects linked identity inputs and resumed ledgers', (t) => {
  const linkedIntent = releaseFixture(t);
  const intentSource = resolve(linkedIntent.directory, 'intent-hardlink-source.json');
  writeFileSync(intentSource, readFileSync(linkedIntent.promotionIntent));
  unlinkSync(linkedIntent.promotionIntent);
  linkSync(intentSource, linkedIntent.promotionIntent);
  assert.throws(
    () => orchestrateRelease(linkedIntent.options, undefined, linkedIntent.correctionSource),
    /release promotion intent.*hard linked/u,
  );

  const linkedLedger = releaseFixture(t);
  const options = { ...linkedLedger.options, mode: 'promote', dryRun: false };
  orchestrateRelease(options, () => new Date('2026-07-13T00:00:00.000Z'), linkedLedger.correctionSource);
  const ledgerPath = resolve(linkedLedger.eventDir, 'release-ledger.json');
  const ledgerSource = resolve(linkedLedger.eventDir, 'release-ledger-hardlink-source.json');
  writeFileSync(ledgerSource, readFileSync(ledgerPath));
  unlinkSync(ledgerPath);
  linkSync(ledgerSource, ledgerPath);
  assert.throws(
    () => orchestrateRelease(options, () => new Date('2026-07-13T00:00:00.000Z'), linkedLedger.correctionSource),
    /release ledger.*hard linked/u,
  );
});
