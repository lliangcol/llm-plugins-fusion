import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { orchestrateRelease } from '../../scripts/release-orchestrator.mjs';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';

test('release continuation requires and extends the prior verified ledger', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-ledger-'));
  try {
    const control = resolve(directory, 'control.json'); const intent = resolve(directory, 'intent.json'); const eventDir = resolve(directory, 'events');
    const sourceCommit = 'a'.repeat(40); const bundleSha256 = 'b'.repeat(64);
    const recordedAt = '2026-07-16T00:00:00Z';
    const evidence = { path: 'governance/evidence/test.md', sha256: 'e'.repeat(64), recordedAt };
    const document = { schemaVersion: 3, corrections: [{
      id: 'REL-TEST', issue: 73, status: 'candidate-verified', affectedCommits: [sourceCommit],
      stableRelease: { tag: 'v4.0.0', commit: 'd'.repeat(40), state: 'INSTALL_PROVEN' },
      targetRelease: { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1' },
      decision: { authorizedByIssue: 73, nonRetroactive: true, summary: 'test correction' },
      releaseBoundary: {
        mayPublishStable: false, requiresNewCandidate: true, requiresCurrentIndependentReview: true,
        requiresProtectedPublicationEvidence: true, requiresInstallProof: true,
      },
      authorizationEvidence: evidence,
      candidateEvidence: evidence,
      auditTrail: ['created', 'authorized', 'candidate-verified'].map((action) => ({
        action, actorRole: 'maintainer', recordedAt, evidence,
      })),
    }] };
    const correctionSource = { document, sha256: canonicalSha256(document) };
    writeFileSync(control, `${JSON.stringify({ bundleSha256 })}\n`);
    writeFileSync(intent, `${JSON.stringify({ stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit, candidateCoreSha256: 'c'.repeat(64), controlBundleSha256: bundleSha256, correctionsSha256: correctionSource.sha256 })}\n`);
    const base = { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit, promotionIntent: intent, controlBundle: control, eventDir, candidateVerificationPassed: true };
    assert.throws(() => orchestrateRelease({ ...base, mode: 'recover', state: 'CANDIDATE_TAGGED', targetState: 'CANDIDATE_VERIFIED', runId: 'missing', dryRun: false }, undefined, correctionSource), /prior release ledger/u);
    const initial = { ...base, mode: 'promote', state: 'DRAFT', targetState: 'CANDIDATE_TAGGED', runId: 'first', dryRun: false };
    orchestrateRelease(initial, () => new Date('2026-07-13T00:00:00Z'), correctionSource);
    const eventPath = resolve(eventDir, '01-draft-to-candidate_tagged.json');
    const originalEvent = readFileSync(eventPath, 'utf8');
    unlinkSync(resolve(eventDir, 'release-ledger.json'));
    const recoveredInitial = orchestrateRelease({ ...initial, runId: 'retry' }, () => new Date('2026-07-13T00:00:30Z'), correctionSource);
    assert.equal(recoveredInitial.ledgerHeadState, 'CANDIDATE_TAGGED');
    assert.equal(readFileSync(eventPath, 'utf8'), originalEvent);
    unlinkSync(resolve(eventDir, 'release-ledger.json'));
    assert.throws(() => orchestrateRelease({ ...initial, mode: 'drill', runId: 'retry' }, () => new Date('2026-07-13T00:00:30Z'), correctionSource), /event mode conflicts/u);
    orchestrateRelease({ ...initial, runId: 'retry' }, () => new Date('2026-07-13T00:00:30Z'), correctionSource);
    const result = orchestrateRelease({ ...base, mode: 'recover', state: 'CANDIDATE_TAGGED', targetState: 'CANDIDATE_VERIFIED', runId: 'second', dryRun: false }, () => new Date('2026-07-13T00:00:01Z'), correctionSource);
    assert.equal(result.ledgerHeadState, 'CANDIDATE_VERIFIED');
    assert.equal(JSON.parse(readFileSync(resolve(eventDir, 'release-ledger.json'))).events.length, 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
