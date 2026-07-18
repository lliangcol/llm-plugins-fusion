import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveContainedFile } from '../../framework/io/safe-json-file.mjs';
import { canonicalSha256 } from './canonical-json.mjs';
import { gitIsAncestor, gitResolveCommit, gitTrackedFiles } from './git-source-snapshot.mjs';
import { compileStandardSchema, formatAjvErrors } from './schema-engine.mjs';

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/u;
const moduleDir = dirname(fileURLToPath(import.meta.url));
const adoptionEvidenceSchema = JSON.parse(readFileSync(resolve(moduleDir, '../../schemas/adoption-evidence.schema.json'), 'utf8'));
const adoptionValidationEvidenceSchema = JSON.parse(readFileSync(resolve(moduleDir, '../../schemas/adoption-validation-evidence.schema.json'), 'utf8'));
const adoptionConsentEvidenceSchema = JSON.parse(readFileSync(resolve(moduleDir, '../../schemas/adoption-consent-evidence.schema.json'), 'utf8'));
const validateAdoptionEvidenceSchema = compileStandardSchema(adoptionEvidenceSchema);
const validateAdoptionValidationEvidenceSchema = compileStandardSchema(adoptionValidationEvidenceSchema);
const validateAdoptionConsentEvidenceSchema = compileStandardSchema(adoptionConsentEvidenceSchema);

export function assertPortableAdoptionEvidencePath(value, label = 'adoption evidence path') {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a non-empty POSIX repository-relative path`);
  if (value.includes('\\') || value.startsWith('/') || value.includes('\0')) {
    throw new Error(`${label} must be a POSIX repository-relative path`);
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || !SAFE_SEGMENT_PATTERN.test(segment))) {
    throw new Error(`${label} must be a normalized POSIX repository-relative path without traversal, URL, drive, or UNC syntax`);
  }
  return value;
}

function assertTracked(root, path, label) {
  if (!gitTrackedFiles(root, { pathPrefix: path }).includes(path)) {
    throw new Error(`${label} must reference a tracked public repository file: ${path}`);
  }
}

function verifyEvidenceFile(root, path, expectedSha256, label, validateSchema) {
  assertPortableAdoptionEvidencePath(path, label);
  if (!SHA256_PATTERN.test(expectedSha256 ?? '')) throw new Error(`${label} digest must be 64 lowercase hexadecimal characters`);
  let absolute;
  try {
    absolute = resolveContainedFile(root, path);
  } catch (error) {
    throw new Error(`${label} must reference an existing regular repository file: ${path}: ${error.message}`);
  }
  assertTracked(root, path, label);
  const bytes = readFileSync(absolute);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== expectedSha256) throw new Error(`${label} digest does not match ${path}`);
  let document;
  try {
    document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error(`${label} must be valid UTF-8 JSON: ${path}: ${error.message}`);
  }
  if (!validateSchema(document)) {
    throw new Error(`${label} schema validation failed: ${formatAjvErrors(validateSchema.errors).join('; ')}`);
  }
  return { path, sha256: actualSha256, document };
}

function recordBinding(record) {
  return {
    recordId: record.recordId,
    consumerClass: record.consumerClass,
    assistant: record.assistant,
    signals: record.signals,
    sourceCommit: record.sourceCommit,
    sourceDigest: record.sourceDigest,
    observedAt: record.observedAt,
    expiresAt: record.expiresAt,
  };
}

export function adoptionRecordBindingSha256(record) {
  return canonicalSha256(recordBinding(record));
}

function assertReachableSourceCommit(root, sourceCommit) {
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit ?? '')) throw new Error('adoption sourceCommit must be 40 lowercase hexadecimal characters');
  try {
    if (gitResolveCommit(root, sourceCommit) !== sourceCommit
      || !gitIsAncestor(root, sourceCommit, 'HEAD')) throw new Error('commit is not an ancestor');
  } catch {
    throw new Error(`adoption sourceCommit must exist and be reachable from repository HEAD: ${sourceCommit}`);
  }
}

function assertBoundField(document, record, field, label) {
  if (document[field] !== record[field]) throw new Error(`${label} ${field} does not match adoption record ${record.recordId}`);
}

function assertRecordBinding(evidence, record, bindingSha256, label) {
  if (evidence.document.recordBindingSha256 !== bindingSha256) {
    throw new Error(`${label} recordBindingSha256 does not match adoption record ${record.recordId}`);
  }
  assertBoundField(evidence.document, record, 'recordId', label);
}

export function validateAdoptionRecordEvidence(root, record) {
  if (!root || typeof root !== 'string') throw new Error('adoption evidence repository root is required');
  if (!record || typeof record !== 'object') throw new Error('adoption evidence record is required');
  if (record.validationEvidence === record.consentEvidence) {
    throw new Error('validationEvidence and consentEvidence must reference distinct files');
  }
  assertReachableSourceCommit(root, record.sourceCommit);
  const validationEvidence = verifyEvidenceFile(
      root,
      record.validationEvidence,
      record.validationEvidenceSha256,
      'validationEvidence',
      validateAdoptionValidationEvidenceSchema,
    );
  const consentEvidence = verifyEvidenceFile(
      root,
      record.consentEvidence,
      record.consentEvidenceSha256,
      'consentEvidence',
      validateAdoptionConsentEvidenceSchema,
  );
  const bindingSha256 = adoptionRecordBindingSha256(record);
  assertRecordBinding(validationEvidence, record, bindingSha256, 'validationEvidence');
  assertRecordBinding(consentEvidence, record, bindingSha256, 'consentEvidence');
  for (const field of ['assistant', 'sourceCommit', 'sourceDigest', 'observedAt']) {
    assertBoundField(validationEvidence.document, record, field, 'validationEvidence');
  }
  if (validationEvidence.document.sourceVerification.artifactSha256 !== record.sourceDigest) {
    throw new Error(`validationEvidence artifactSha256 does not match adoption record ${record.recordId}`);
  }
  const resultSignals = validationEvidence.document.signalResults.map((result) => result.signal);
  if (new Set(resultSignals).size !== resultSignals.length) {
    throw new Error(`validationEvidence contains duplicate signal results for ${record.recordId}`);
  }
  if (resultSignals.length !== record.signals.length
    || [...resultSignals].sort().join('\0') !== [...record.signals].sort().join('\0')) {
    throw new Error(`validationEvidence signal results do not exactly match adoption record ${record.recordId}`);
  }
  if (consentEvidence.document.validationEvidenceSha256 !== record.validationEvidenceSha256) {
    throw new Error(`consentEvidence does not bind the validation evidence digest for ${record.recordId}`);
  }
  if (consentEvidence.document.expiresAt !== record.expiresAt) {
    throw new Error(`consentEvidence expiresAt does not match adoption record ${record.recordId}`);
  }
  const consentedAtMs = parseEvidenceTime(consentEvidence.document.consentedAt, `${record.recordId} consentedAt`);
  const observedAtMs = parseEvidenceTime(record.observedAt, `${record.recordId} observedAt`);
  if (consentedAtMs > observedAtMs) throw new Error(`${record.recordId} consent must precede or equal observation`);
  return { validationEvidence, consentEvidence, bindingSha256 };
}

function parseEvidenceTime(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid date-time`);
  return parsed;
}

export function validateAdoptionEvidenceDocument(root, adoption, { now = undefined } = {}) {
  if (!adoption || typeof adoption !== 'object' || !Array.isArray(adoption.records)) {
    throw new Error('adoption evidence document requires a records array');
  }
  if (adoption.schemaVersion !== 3) throw new Error('adoption evidence document requires schemaVersion 3');
  if (!['not-demonstrated', 'demonstrated'].includes(adoption.status)) {
    throw new Error('adoption evidence status is invalid');
  }
  if (!Number.isInteger(adoption.minimumForDemonstrated) || adoption.minimumForDemonstrated < 2) {
    throw new Error('adoption minimumForDemonstrated must be an integer of at least 2');
  }
  if (!Number.isInteger(adoption.collectionPolicy?.retentionDays) || adoption.collectionPolicy.retentionDays < 1) {
    throw new Error('adoption evidence retentionDays must be a positive integer');
  }
  if (!validateAdoptionEvidenceSchema(adoption)) {
    throw new Error(`adoption evidence document schema validation failed: ${formatAjvErrors(validateAdoptionEvidenceSchema.errors).join('; ')}`);
  }
  const nowMs = now === undefined ? Date.now() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error('adoption evidence validation requires a valid current time');
  const maximumLifetimeMs = adoption.collectionPolicy.retentionDays * 24 * 60 * 60 * 1000;
  const recordIds = new Set();
  const evidencePairs = new Set();
  const evidencePaths = new Set();
  const evidenceDigests = new Set();
  let validRecordCount = 0;

  for (const [index, record] of adoption.records.entries()) {
    if (typeof record.recordId !== 'string' || !record.recordId) throw new Error(`adoption record ${index} requires recordId`);
    if (recordIds.has(record.recordId)) throw new Error(`duplicate adoption recordId: ${record.recordId}`);
    recordIds.add(record.recordId);

    const pair = [record.validationEvidence, record.consentEvidence].sort().join('\0');
    if (evidencePairs.has(pair)) throw new Error(`duplicate adoption evidence pair for record ${record.recordId}`);
    evidencePairs.add(pair);

    for (const [kind, path, digest] of [
      ['validationEvidence', record.validationEvidence, record.validationEvidenceSha256],
      ['consentEvidence', record.consentEvidence, record.consentEvidenceSha256],
    ]) {
      if (evidencePaths.has(path)) throw new Error(`duplicate adoption evidence path for record ${record.recordId}: ${path}`);
      evidencePaths.add(path);
      if (evidenceDigests.has(digest)) throw new Error(`duplicate adoption evidence digest for record ${record.recordId}: ${kind}`);
      evidenceDigests.add(digest);
    }

    const observedAtMs = parseEvidenceTime(record.observedAt, `${record.recordId} observedAt`);
    const expiresAtMs = parseEvidenceTime(record.expiresAt, `${record.recordId} expiresAt`);
    if (observedAtMs > nowMs) throw new Error(`${record.recordId} observedAt cannot be in the future`);
    if (expiresAtMs <= observedAtMs) throw new Error(`${record.recordId} expiresAt must be later than observedAt`);
    if (expiresAtMs <= nowMs) throw new Error(`${record.recordId} is expired`);
    if (expiresAtMs - observedAtMs > maximumLifetimeMs) {
      throw new Error(`${record.recordId} evidence lifetime exceeds retentionDays`);
    }

    validateAdoptionRecordEvidence(root, record);
    validRecordCount += 1;
  }

  if (adoption.status === 'demonstrated' && validRecordCount < adoption.minimumForDemonstrated) {
    throw new Error(`adoption cannot be demonstrated with only ${validRecordCount} valid records`);
  }
  if (adoption.status === 'demonstrated') {
    throw new Error('repository-local adoption records are maintainer-attested only; demonstrated adoption requires an independent external provenance verifier that is not yet configured');
  }
  return {
    validRecordCount,
    status: adoption.status,
    evidenceClass: validRecordCount === 0 ? 'none' : 'maintainer-attested',
  };
}
