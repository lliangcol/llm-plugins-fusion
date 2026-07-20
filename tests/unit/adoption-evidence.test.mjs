import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  adoptionRecordBindingSha256,
  assertPortableAdoptionEvidencePath,
  validateAdoptionEvidenceDocument,
  validateAdoptionRecordEvidence,
} from '../../scripts/lib/adoption-evidence.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function repositoryFixture(t, prefix = 'adoption-evidence-') {
  const root = mkdtempSync(resolve(tmpdir(), prefix));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(resolve(root, 'governance/evidence'), { recursive: true });
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Adoption Evidence Test']);
  git(root, ['config', 'user.email', 'adoption-evidence@example.invalid']);
  writeFileSync(resolve(root, 'source.txt'), 'source snapshot\n');
  git(root, ['add', 'source.txt']);
  git(root, ['commit', '--quiet', '-m', 'source snapshot']);
  return { root, sourceCommit: git(root, ['rev-parse', 'HEAD']) };
}

function baseRecord(sourceCommit, number, overrides = {}) {
  return {
    recordId: `ADOPTION-2026-00${number}`,
    consumerClass: `public-safe-consumer-class-${number}`,
    assistant: 'claude-code@2.1.205',
    signals: ['installation', 'activation', 'successful-workflow'],
    sourceCommit,
    sourceDigest: String(number).repeat(64),
    privacyReview: 'passed',
    observedAt: `2026-07-15T0${number}:00:00Z`,
    expiresAt: `2026-07-17T0${number}:00:00Z`,
    ...overrides,
  };
}

function writeEvidence(root, record, suffix, { validation = {}, consent = {} } = {}) {
  const binding = adoptionRecordBindingSha256(record);
  const validationDocument = {
    $schema: '../../../schemas/adoption-validation-evidence.schema.json',
    schemaVersion: 1,
    evidenceType: 'adoption-validation',
    recordId: record.recordId,
    recordBindingSha256: binding,
    assistant: record.assistant,
    sourceCommit: record.sourceCommit,
    sourceDigest: record.sourceDigest,
    observedAt: record.observedAt,
    validationStatus: 'passed',
    sourceVerification: {
      status: 'passed',
      method: 'installed-artifact-sha256',
      artifactSha256: record.sourceDigest,
    },
    signalResults: record.signals.map((signal) => ({ signal, status: 'passed', summary: `Public-safe ${signal} evidence.` })),
    privacyReview: 'passed',
    ...validation,
  };
  const validationContent = `${JSON.stringify(validationDocument, null, 2)}\n`;
  const validationEvidence = `governance/evidence/validation-${suffix}.json`;
  const validationEvidenceSha256 = sha256(validationContent);
  const consentDocument = {
    $schema: '../../../schemas/adoption-consent-evidence.schema.json',
    schemaVersion: 1,
    evidenceType: 'adoption-consent',
    recordId: record.recordId,
    recordBindingSha256: binding,
    validationEvidenceSha256,
    consentGranted: true,
    approvedPurpose: 'public-adoption-evidence',
    publicFieldsApproved: true,
    withdrawalMechanismAcknowledged: true,
    privacyReview: 'passed',
    consentedAt: record.observedAt,
    expiresAt: record.expiresAt,
    ...consent,
  };
  const consentContent = `${JSON.stringify(consentDocument, null, 2)}\n`;
  const consentEvidence = `governance/evidence/consent-${suffix}.json`;
  const consentEvidenceSha256 = sha256(consentContent);
  writeFileSync(resolve(root, validationEvidence), validationContent);
  writeFileSync(resolve(root, consentEvidence), consentContent);
  git(root, ['add', validationEvidence, consentEvidence]);
  return {
    ...record,
    validationEvidence,
    validationEvidenceSha256,
    consentEvidence,
    consentEvidenceSha256,
  };
}

function adoptionDocument(records, overrides = {}) {
  return {
    $schema: '../schemas/adoption-evidence.schema.json',
    schemaVersion: 3,
    status: 'demonstrated',
    records,
    minimumForDemonstrated: 2,
    collectionPolicy: {
      consentRequired: true,
      rawPrivateDataAllowed: false,
      retentionDays: 3,
      withdrawalMechanism: 'Private maintainer request by public-safe record ID.',
      allowedSignals: ['installation', 'activation', 'successful-workflow', 'maintenance-commitment'],
    },
    claimBoundary: 'Test records exercise structural, semantic, binding, and uniqueness enforcement.',
    ...overrides,
  };
}

test('adoption evidence paths are portable and reject URL, Windows, UNC, and traversal forms', () => {
  assert.equal(
    assertPortableAdoptionEvidencePath('governance/evidence/adoption-001.json'),
    'governance/evidence/adoption-001.json',
  );
  for (const path of [
    '/governance/evidence/adoption.json',
    'https://example.com/adoption.json',
    'C:/evidence/adoption.json',
    '\\\\server\\share\\adoption.json',
    'governance\\evidence\\adoption.json',
    'governance/evidence/../adoption.json',
    'governance/./evidence/adoption.json',
    'governance//evidence/adoption.json',
  ]) {
    assert.throws(() => assertPortableAdoptionEvidencePath(path), /POSIX repository-relative path/u);
  }
});

test('adoption record evidence is tracked, schema-valid, commit-reachable, and cross-bound', (t) => {
  const { root, sourceCommit } = repositoryFixture(t);
  const record = writeEvidence(root, baseRecord(sourceCommit, 1), '1');
  const result = validateAdoptionRecordEvidence(root, record);
  assert.equal(result.validationEvidence.sha256, record.validationEvidenceSha256);
  assert.equal(result.consentEvidence.sha256, record.consentEvidenceSha256);
  assert.equal(result.bindingSha256, adoptionRecordBindingSha256(record));

  assert.throws(
    () => validateAdoptionRecordEvidence(root, { ...record, validationEvidenceSha256: '0'.repeat(64) }),
    /digest does not match/u,
  );
  assert.throws(
    () => validateAdoptionRecordEvidence(root, { ...record, sourceCommit: 'f'.repeat(40) }),
    /must exist and be reachable/u,
  );
  assert.throws(
    () => validateAdoptionRecordEvidence(root, { ...record, assistant: 'codex@different' }),
    /recordBindingSha256 does not match/u,
  );
  assert.throws(
    () => validateAdoptionRecordEvidence(root, { ...record, consentEvidence: record.validationEvidence }),
    /must reference distinct files/u,
  );

  const untrackedPath = 'governance/evidence/untracked.json';
  writeFileSync(resolve(root, untrackedPath), '{}\n');
  assert.throws(
    () => validateAdoptionRecordEvidence(root, {
      ...record,
      consentEvidence: untrackedPath,
      consentEvidenceSha256: sha256('{}\n'),
    }),
    /tracked public repository file/u,
  );
});

test('adoption evidence rejects mismatched signal, source, consent, and privacy semantics', (t) => {
  const { root, sourceCommit } = repositoryFixture(t, 'adoption-evidence-semantics-');
  const base = baseRecord(sourceCommit, 1);

  const missingSignal = writeEvidence(root, base, 'missing-signal', {
    validation: {
      signalResults: [{ signal: 'installation', status: 'passed', summary: 'Only installation was observed.' }],
    },
  });
  assert.throws(() => validateAdoptionRecordEvidence(root, missingSignal), /signal results do not exactly match/u);

  const sourceMismatch = writeEvidence(root, base, 'source-mismatch', {
    validation: { sourceDigest: 'a'.repeat(64) },
  });
  assert.throws(() => validateAdoptionRecordEvidence(root, sourceMismatch), /sourceDigest does not match/u);

  const consentMismatch = writeEvidence(root, base, 'consent-mismatch', {
    consent: { validationEvidenceSha256: 'b'.repeat(64) },
  });
  assert.throws(() => validateAdoptionRecordEvidence(root, consentMismatch), /does not bind the validation evidence digest/u);

  const invalidConsent = writeEvidence(root, base, 'invalid-consent', {
    consent: { consentGranted: false },
  });
  assert.throws(() => validateAdoptionRecordEvidence(root, invalidConsent), /consentEvidence schema validation failed/u);
});

test('repository-local adoption records remain maintainer-attested and cannot self-unlock demonstrated status', (t) => {
  const { root, sourceCommit } = repositoryFixture(t, 'adoption-demonstrated-');
  const record1 = writeEvidence(root, baseRecord(sourceCommit, 1), '1');
  const record2 = writeEvidence(root, baseRecord(sourceCommit, 2), '2');
  const now = '2026-07-16T00:00:00Z';

  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([record1, record2]), { now }),
    /maintainer-attested only.*independent external provenance verifier/u,
  );
  assert.deepEqual(validateAdoptionEvidenceDocument(root, adoptionDocument([record1, record2], { status: 'not-demonstrated' }), { now }), {
    validRecordCount: 2,
    status: 'not-demonstrated',
    evidenceClass: 'maintainer-attested',
  });
  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([record1, { ...record2, recordId: record1.recordId }]), { now }),
    /duplicate adoption recordId/u,
  );
  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([
      record1,
      { ...record2, validationEvidence: record1.validationEvidence },
    ]), { now }),
    /duplicate adoption evidence path/u,
  );
  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([
      record1,
      { ...record2, validationEvidenceSha256: record1.consentEvidenceSha256 },
    ]), { now }),
    /duplicate adoption evidence digest/u,
  );
  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([
      { ...record1, observedAt: '2026-07-16T00:00:01Z', expiresAt: '2026-07-17T00:00:01Z' },
      record2,
    ]), { now }),
    /observedAt cannot be in the future/u,
  );
  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([{ ...record1, expiresAt: now }, record2]), { now }),
    /is expired/u,
  );
  assert.throws(
    () => validateAdoptionEvidenceDocument(root, adoptionDocument([record1]), { now }),
    /schema validation failed.*fewer than 2 items/u,
  );
});
