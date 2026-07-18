import assert from 'node:assert/strict';
import test from 'node:test';
import { validateReleaseSignerInventory } from '../../scripts/lib/release-operations.mjs';
import { evaluateIndependentReview } from '../../scripts/lib/release-review.mjs';
import {
  evaluateReleaseOperationalReadiness,
  main as validateOperationalReadiness,
} from '../../scripts/validate-release-operational-readiness.mjs';

const reviewers = {
  schemaVersion: 1,
  status: 'configured',
  trustedUsers: ['peer'],
  trustedTeams: ['owner/release-engineering'],
  botIdentities: [],
  sensitivePaths: ['schemas/'],
  standardMinimumApprovals: 1,
  sensitiveMinimumApprovals: 2,
};

const baseKey = 'AAAAC3NzaC1lZDI1NTE5AAAAICTCMBdvVU9Rqlt35ntMkNSwkbY1/pLTIzn2QNd9l5xu'; // gitleaks:allow -- synthetic public-key fixture
function signer(principal, variant = 0) {
  const key = Buffer.from(baseKey, 'base64');
  if (variant) key[key.length - 1] ^= variant;
  return `${principal} ssh-ed25519 ${key.toString('base64')}`;
}

const operations = {
  $schema: '../schemas/release-operations.schema.json',
  schemaVersion: 4,
  independentReview: {
    requiredForCandidate: true,
    minimumApprovals: 1,
    reviewerMustDifferFrom: ['pull-request-author', 'candidate-actor'],
    evidenceName: 'independent-review.json',
  },
  signing: {
    allowedSignersFile: '.github/release-signers',
    minimumActiveSigners: 1,
    inventoryReviewedAt: '2026-07-01',
    rotationReviewCadenceDays: 90,
    overlapRequired: true,
    lastRotationEvidence: {
      source: 'https://github.com/owner/repo/actions/runs/10',
      sha256: 'a'.repeat(64),
      recordedAt: '2026-07-02T00:00:00Z',
    },
    revocationProcedure: 'Revoke the affected key and record the reviewed incident.',
    lostKeyRecoveryProcedure: 'Keep publication blocked until an authorized replacement key is reviewed.',
  },
  recovery: {
    workflow: '.github/workflows/release-recovery-drill.yml',
    drillCadenceDays: 90,
    lastSuccessfulDrill: {
      runUrl: 'https://github.com/owner/repo/actions/runs/11/attempts/1',
      workflowSha: 'b'.repeat(40),
      completedAt: '2026-07-03T00:00:00Z',
    },
  },
  protectedPublication: {
    environment: 'release',
    externalApprovalRequired: true,
    evidenceMaxAgeDays: 90,
    currentEvidence: {
      source: 'https://github.com/owner/repo/settings/environments/1',
      sha256: 'c'.repeat(64),
      verifiedAt: '2026-07-04T00:00:00Z',
    },
  },
  candidateObservation: {
    minimumHours: 168,
    timestampSource: 'github-releases-api-published-at',
    requirePublishedPrerelease: true,
  },
  labels: {
    source: '.github/labels.yml',
    workflow: '.github/workflows/pr-governance.yml',
    mode: 'create-update-no-delete',
  },
};

const now = new Date('2026-07-13T00:00:00Z');
const signers = [signer('owner-a'), signer('owner-b', 1)];

function sshWireString(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function rsaSigner(principal, suffix = Buffer.alloc(0)) {
  const modulus = Buffer.alloc(257);
  modulus[1] = 0x80;
  modulus[modulus.length - 1] = 0x01;
  const blob = Buffer.concat([
    sshWireString('ssh-rsa'),
    sshWireString(Buffer.from([0x01, 0x00, 0x01])),
    sshWireString(modulus),
    suffix,
  ]);
  return `${principal} ssh-rsa ${blob.toString('base64')}`;
}

function rsaSignerWithParameters(principal, exponent, modulus) {
  const blob = Buffer.concat([
    sshWireString('ssh-rsa'),
    sshWireString(exponent),
    sshWireString(modulus),
  ]);
  return `${principal} ssh-rsa ${blob.toString('base64')}`;
}

test('operational readiness requires distinct reviewers and resilient release operations', () => {
  assert.equal(evaluateReleaseOperationalReadiness({ reviewers, operations, signers, mode: 'promote', now }).status, 'READY');
  const blocked = evaluateReleaseOperationalReadiness({
    reviewers: { ...reviewers, status: 'awaiting-owner-configuration', trustedUsers: [], trustedTeams: [] },
    operations: {
      ...operations,
      signing: { ...operations.signing, lastRotationEvidence: null },
      recovery: { ...operations.recovery, lastSuccessfulDrill: null },
      protectedPublication: { ...operations.protectedPublication, currentEvidence: null },
    },
    signers: [signers[0]],
    mode: 'promote',
    now,
  });
  assert.equal(blocked.status, 'BLOCKED_EXTERNAL_GATE');
  assert.deepEqual(blocked.reasonCodes, ['PROTECTED_ENVIRONMENT_EVIDENCE_REQUIRED', 'RECOVERY_DRILL_EVIDENCE_REQUIRED', 'SIGNER_REDUNDANCY_REQUIRED', 'SIGNER_ROTATION_EVIDENCE_REQUIRED', 'TRUSTED_REVIEWERS_UNCONFIGURED']);
});

test('operational approval counts use the same independent-review identity semantics', () => {
  const result = evaluateIndependentReview({
    pullRequestAuthor: 'author',
    candidateActor: 'publisher',
    expectedReviewCommit: 'head',
    trustedReviewers: reviewers.trustedUsers,
    botActors: ['automation'],
    minimumApprovals: operations.independentReview.minimumApprovals,
    reviews: [
      { id: 2, reviewer: 'peer', state: 'APPROVED', submittedAt: '2026-07-13T00:01:00Z', commit: 'head' },
      { id: 1, reviewer: 'automation', state: 'APPROVED', submittedAt: '2026-07-13T00:00:00Z', commit: 'head' },
    ],
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.approvalReviewers, ['peer']);
});

test('operational readiness rejects malformed identities, signer material, dates, and evidence', () => {
  assert.throws(
    () => evaluateReleaseOperationalReadiness({ reviewers, operations, signers: [signers[0], signers[0]], mode: 'promote', now }),
    /distinct public keys|unique entries/u,
  );
  assert.throws(
    () => evaluateReleaseOperationalReadiness({ reviewers, operations, signers: [signer('same'), signer('same', 1)], mode: 'promote', now }),
    /distinct signer principals/u,
  );
  assert.throws(
    () => evaluateReleaseOperationalReadiness({ reviewers, operations, signers: ['owner ssh-ed25519 AAAA'], mode: 'candidate', now }),
    /SSH wire/u,
  );
  assert.throws(
    () => evaluateReleaseOperationalReadiness({ reviewers, operations: { ...operations, signing: { ...operations.signing, inventoryReviewedAt: '2099-99-99' } }, signers, mode: 'promote', now }),
    /valid ISO date/u,
  );
  assert.throws(
    () => evaluateReleaseOperationalReadiness({ reviewers, operations: { ...operations, recovery: { ...operations.recovery, lastSuccessfulDrill: { ...operations.recovery.lastSuccessfulDrill, runUrl: 'https://evil.example/actions/runs/11' } } }, signers, mode: 'promote', now }),
    /GitHub Actions run/u,
  );
  assert.throws(
    () => evaluateReleaseOperationalReadiness({ reviewers, operations: { ...operations, protectedPublication: { ...operations.protectedPublication, currentEvidence: {} } }, signers, mode: 'promote', now }),
    /currentEvidence fields must be exactly/u,
  );
});

test('operational readiness expires rotation, drill, and protected-environment evidence independently', () => {
  const stale = structuredClone(operations);
  stale.signing.lastRotationEvidence.recordedAt = '2020-01-01T00:00:00Z';
  stale.recovery.lastSuccessfulDrill.completedAt = '2020-01-01T00:00:00Z';
  stale.protectedPublication.currentEvidence.verifiedAt = '2020-01-01T00:00:00Z';
  const result = evaluateReleaseOperationalReadiness({ reviewers, operations: stale, signers, mode: 'promote', now });
  assert.equal(result.status, 'BLOCKED_EXTERNAL_GATE');
  assert.deepEqual(result.reasonCodes, [
    'PROTECTED_ENVIRONMENT_EVIDENCE_EXPIRED',
    'RECOVERY_DRILL_EVIDENCE_EXPIRED',
    'SIGNER_ROTATION_EVIDENCE_EXPIRED',
  ]);
});

test('release operations reject each immutable governance contract boundary', () => {
  const cases = [
    [(value) => { value.independentReview.reviewerMustDifferFrom = ['candidate-actor']; }, /reviewerMustDifferFrom/u],
    [(value) => { value.protectedPublication.environment = 'staging'; }, /protected publication/u],
    [(value) => { value.candidateObservation.timestampSource = 'local-clock'; }, /candidate observation contract/u],
    [(value) => { value.labels.mode = 'create-update-delete'; }, /label governance contract/u],
    [(value) => { value.signing.lastRotationEvidence.source = 'not a URL'; }, /HTTPS URL/u],
    [(value) => { value.signing.inventoryReviewedAt = '2026-07-14'; }, /must not be in the future/u],
  ];
  for (const [mutate, expected] of cases) {
    const invalid = structuredClone(operations);
    mutate(invalid);
    assert.throws(
      () => evaluateReleaseOperationalReadiness({ reviewers, operations: invalid, signers, mode: 'promote', now }),
      expected,
    );
  }
});

test('release signer inventory validates RSA wire fields and rejects trailing material', () => {
  assert.equal(validateReleaseSignerInventory([rsaSigner('release-owner')]).distinctKeys, 1);
  assert.throws(
    () => validateReleaseSignerInventory([rsaSigner('release-owner', Buffer.from([0x00]))]),
    /invalid RSA SSH key blob/u,
  );
  assert.throws(
    () => validateReleaseSignerInventory([
      signer('release-owner'),
      `${signer('release-peer', 0)}=`,
    ]),
    /invalid or non-canonical base64|distinct public keys/u,
  );
  assert.throws(
    () => validateReleaseSignerInventory([
      rsaSignerWithParameters('release-owner', Buffer.from([0x00]), Buffer.from([0x00])),
    ]),
    /must be positive/u,
  );
  assert.throws(
    () => validateReleaseSignerInventory([
      rsaSignerWithParameters('release-owner', Buffer.from([0x03]), Buffer.from([0x01, 0x01])),
    ]),
    /at least 2048 bits/u,
  );
});

test('operational readiness CLI loads canonical governance and fails closed on usage or mode errors', () => {
  assert.equal(validateOperationalReadiness([]), 1);
  assert.equal(validateOperationalReadiness(['--mode', 'unsupported']), 1);
  assert.ok([0, 2].includes(validateOperationalReadiness(['--mode', 'candidate'])));
});
