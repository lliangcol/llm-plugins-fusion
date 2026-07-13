import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReleaseOperationalReadiness } from '../../scripts/validate-release-operational-readiness.mjs';

const reviewers = { status: 'configured', trustedUsers: ['peer'], trustedTeams: [] };
const operations = {
  signing: { inventoryReviewedAt: '2026-07-01', rotationReviewCadenceDays: 90, lastRotationEvidence: { path: 'evidence' } },
  recovery: { lastSuccessfulDrill: { path: 'evidence' } },
  protectedPublication: { currentEvidence: { path: 'evidence' } },
};

test('operational readiness requires distinct reviewers and resilient release operations', () => {
  assert.equal(evaluateReleaseOperationalReadiness({ reviewers, operations, signers: ['a', 'b'], mode: 'promote', now: new Date('2026-07-13') }).status, 'READY');
  const blocked = evaluateReleaseOperationalReadiness({ reviewers: { ...reviewers, status: 'awaiting-owner-configuration', trustedUsers: [] }, operations: { ...operations, signing: { ...operations.signing, lastRotationEvidence: null }, recovery: { lastSuccessfulDrill: null }, protectedPublication: { currentEvidence: null } }, signers: ['a'], mode: 'promote', now: new Date('2026-07-13') });
  assert.equal(blocked.status, 'BLOCKED_EXTERNAL_GATE');
  assert.deepEqual(blocked.reasonCodes, ['PROTECTED_ENVIRONMENT_EVIDENCE_REQUIRED', 'RECOVERY_DRILL_EVIDENCE_REQUIRED', 'SIGNER_REDUNDANCY_REQUIRED', 'SIGNER_ROTATION_EVIDENCE_REQUIRED', 'TRUSTED_REVIEWERS_UNCONFIGURED']);
});
