import { createHash } from 'node:crypto';

const DAY_MS = 86_400_000;
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT_SHA = /^[a-f0-9]{40}$/u;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const SIGNER = /^(\S+)\s+(ssh-(?:ed25519|rsa))\s+([A-Za-z0-9+/]+={0,2})$/u;

function assertExactObject(value, label, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} fields must be exactly: ${expected.join(', ')}`);
  }
  return value;
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be an integer of at least 1`);
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) throw new Error(`${label} must be a non-empty trimmed string`);
}

function validDateOnly(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be an ISO date`);
  const match = DATE_ONLY.exec(value);
  if (!match) throw new Error(`${label} must be an ISO date`);
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)) {
    throw new Error(`${label} must be a valid ISO date`);
  }
  return timestamp;
}

function validTimestamp(value, label) {
  if (typeof value !== 'string' || !RFC3339.test(value)) throw new Error(`${label} must be an RFC 3339 timestamp`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} must be a valid RFC 3339 timestamp`);
  return timestamp;
}

function assertHttpsUrl(value, label, { actionsRun = false } = {}) {
  assertNonEmptyString(value, label);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} must be an HTTPS URL`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error(`${label} must be an HTTPS URL without credentials or a fragment`);
  if (actionsRun && (url.hostname.toLowerCase() !== 'github.com'
    || !/\/actions\/runs\/[1-9][0-9]*(?:\/attempts\/[1-9][0-9]*)?\/?$/u.test(url.pathname))) {
    throw new Error(`${label} must identify an immutable GitHub Actions run or attempt`);
  }
}

function assertNotFuture(timestamp, label, now) {
  if (timestamp !== null && timestamp > now.getTime()) throw new Error(`release operations ${label} must not be in the future`);
}

function readSshString(buffer, offset, label) {
  if (offset + 4 > buffer.length) throw new Error(`${label} contains a truncated SSH wire string`);
  const length = buffer.readUInt32BE(offset);
  const start = offset + 4;
  const end = start + length;
  if (length === 0 || end > buffer.length) throw new Error(`${label} contains an invalid SSH wire string`);
  return { value: buffer.subarray(start, end), offset: end };
}

function readPositiveSshMpint(field, label) {
  const value = field.value;
  if (value[0] >= 0x80) throw new Error(`${label} must be a positive SSH mpint`);
  if (value.length > 1 && value[0] === 0 && value[1] < 0x80) {
    throw new Error(`${label} is not canonically encoded`);
  }
  const unsigned = value[0] === 0 ? value.subarray(1) : value;
  if (unsigned.length === 0 || unsigned.every((byte) => byte === 0)) {
    throw new Error(`${label} must be positive`);
  }
  return BigInt(`0x${unsigned.toString('hex')}`);
}

function validateSshPublicKey(type, encoded, label) {
  const blob = Buffer.from(encoded, 'base64');
  const canonical = blob.toString('base64');
  if (blob.length === 0 || canonical !== encoded) throw new Error(`${label} contains invalid or non-canonical base64 key material`);
  const typeField = readSshString(blob, 0, label);
  if (typeField.value.toString('ascii') !== type) throw new Error(`${label} declared key type differs from its SSH wire blob`);
  if (type === 'ssh-ed25519') {
    const key = readSshString(blob, typeField.offset, label);
    if (key.value.length !== 32 || key.offset !== blob.length) throw new Error(`${label} contains an invalid Ed25519 SSH key blob`);
    return `${type}:${createHash('sha256').update(blob).digest('hex')}`;
  }
  const exponent = readSshString(blob, typeField.offset, label);
  const modulus = readSshString(blob, exponent.offset, label);
  if (modulus.offset !== blob.length) throw new Error(`${label} contains an invalid RSA SSH key blob`);
  const exponentValue = readPositiveSshMpint(exponent, `${label} RSA public exponent`);
  const modulusValue = readPositiveSshMpint(modulus, `${label} RSA modulus`);
  if (exponentValue < 3n || exponentValue % 2n === 0n) {
    throw new Error(`${label} RSA public exponent must be an odd integer of at least 3`);
  }
  if (modulusValue < (1n << 2047n) || modulusValue % 2n === 0n) {
    throw new Error(`${label} RSA modulus must be an odd integer of at least 2048 bits`);
  }
  return `${type}:${createHash('sha256').update(blob).digest('hex')}`;
}

function assertEvidenceReference(value, label, timestampKey, { workflow = false, actionsRun = false } = {}) {
  if (value === null) return null;
  const keys = workflow
    ? ['runUrl', 'workflowSha', timestampKey]
    : ['source', 'sha256', timestampKey];
  assertExactObject(value, label, keys);
  if (workflow) {
    assertHttpsUrl(value.runUrl, `${label}.runUrl`, { actionsRun });
    if (typeof value.workflowSha !== 'string' || !COMMIT_SHA.test(value.workflowSha)) throw new Error(`${label}.workflowSha must be a lowercase 40-character SHA`);
  } else {
    assertHttpsUrl(value.source, `${label}.source`);
    if (typeof value.sha256 !== 'string' || !SHA256.test(value.sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest`);
  }
  return validTimestamp(value[timestampKey], `${label}.${timestampKey}`);
}

export function validateReleaseOperationsPolicy(operations, { now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('release operations now must be a valid date');
  assertExactObject(operations, 'release operations', [
    '$schema', 'schemaVersion', 'independentReview', 'signing', 'recovery',
    'protectedPublication', 'candidateObservation', 'labels',
  ]);
  assertNonEmptyString(operations.$schema, 'release operations $schema');
  if (operations.schemaVersion !== 4) throw new Error('release operations schemaVersion must be 4');

  const review = assertExactObject(operations.independentReview, 'release operations independentReview', [
    'requiredForCandidate', 'minimumApprovals', 'reviewerMustDifferFrom', 'evidenceName',
  ]);
  if (review.requiredForCandidate !== true) throw new Error('release operations independent review must be required for candidates');
  assertPositiveInteger(review.minimumApprovals, 'release operations minimumApprovals');
  if (JSON.stringify(review.reviewerMustDifferFrom) !== JSON.stringify(['pull-request-author', 'candidate-actor'])) {
    throw new Error('release operations reviewerMustDifferFrom must exclude pull-request-author and candidate-actor');
  }
  if (review.evidenceName !== 'independent-review.json') throw new Error('release operations evidenceName must be independent-review.json');

  const signing = assertExactObject(operations.signing, 'release operations signing', [
    'allowedSignersFile', 'minimumActiveSigners', 'inventoryReviewedAt',
    'rotationReviewCadenceDays', 'overlapRequired', 'lastRotationEvidence',
    'revocationProcedure', 'lostKeyRecoveryProcedure',
  ]);
  if (signing.allowedSignersFile !== '.github/release-signers') throw new Error('release operations allowedSignersFile must be .github/release-signers');
  assertPositiveInteger(signing.minimumActiveSigners, 'release operations minimumActiveSigners');
  assertPositiveInteger(signing.rotationReviewCadenceDays, 'release operations rotationReviewCadenceDays');
  if (signing.overlapRequired !== true) throw new Error('release operations signer overlap must remain required');
  assertNonEmptyString(signing.revocationProcedure, 'release operations revocationProcedure');
  assertNonEmptyString(signing.lostKeyRecoveryProcedure, 'release operations lostKeyRecoveryProcedure');
  const inventoryReviewedAt = validDateOnly(signing.inventoryReviewedAt, 'release operations inventoryReviewedAt');
  const rotationRecordedAt = assertEvidenceReference(signing.lastRotationEvidence, 'release operations lastRotationEvidence', 'recordedAt');

  const recovery = assertExactObject(operations.recovery, 'release operations recovery', [
    'workflow', 'drillCadenceDays', 'lastSuccessfulDrill',
  ]);
  if (recovery.workflow !== '.github/workflows/release-recovery-drill.yml') throw new Error('release operations recovery workflow is invalid');
  assertPositiveInteger(recovery.drillCadenceDays, 'release operations drillCadenceDays');
  const drillCompletedAt = assertEvidenceReference(recovery.lastSuccessfulDrill, 'release operations lastSuccessfulDrill', 'completedAt', { workflow: true, actionsRun: true });

  const publication = assertExactObject(operations.protectedPublication, 'release operations protectedPublication', [
    'environment', 'externalApprovalRequired', 'evidenceMaxAgeDays', 'currentEvidence',
  ]);
  if (publication.environment !== 'release' || publication.externalApprovalRequired !== true) {
    throw new Error('release operations protected publication must require external approval in the release environment');
  }
  assertPositiveInteger(publication.evidenceMaxAgeDays, 'release operations protected publication evidenceMaxAgeDays');
  const publicationVerifiedAt = assertEvidenceReference(publication.currentEvidence, 'release operations currentEvidence', 'verifiedAt');

  const observation = assertExactObject(operations.candidateObservation, 'release operations candidateObservation', [
    'minimumHours', 'timestampSource', 'requirePublishedPrerelease',
  ]);
  assertPositiveInteger(observation.minimumHours, 'release operations candidate minimumHours');
  if (observation.timestampSource !== 'github-releases-api-published-at' || observation.requirePublishedPrerelease !== true) {
    throw new Error('release operations candidate observation contract is invalid');
  }

  const labels = assertExactObject(operations.labels, 'release operations labels', ['source', 'workflow', 'mode']);
  if (labels.source !== '.github/labels.yml'
    || labels.workflow !== '.github/workflows/pr-governance.yml'
    || labels.mode !== 'create-update-no-delete') {
    throw new Error('release operations label governance contract is invalid');
  }

  assertNotFuture(inventoryReviewedAt, 'inventoryReviewedAt', now);
  assertNotFuture(rotationRecordedAt, 'lastRotationEvidence.recordedAt', now);
  assertNotFuture(drillCompletedAt, 'lastSuccessfulDrill.completedAt', now);
  assertNotFuture(publicationVerifiedAt, 'currentEvidence.verifiedAt', now);
  return { inventoryReviewedAt, rotationRecordedAt, drillCompletedAt, publicationVerifiedAt };
}

export function validateReleaseSignerInventory(signers) {
  if (!Array.isArray(signers) || signers.length === 0) throw new Error('release signer inventory must be a non-empty array');
  if (new Set(signers).size !== signers.length) throw new Error('release signer inventory must contain unique entries');
  const lines = [];
  const keys = new Set();
  const principals = new Set();
  for (const [index, signer] of signers.entries()) {
    if (typeof signer !== 'string' || signer.trim() !== signer) throw new Error(`release signer entry ${index} must be a trimmed string`);
    const match = SIGNER.exec(signer);
    if (!match) throw new Error(`release signer entry ${index} must be a canonical SSH allowed-signers record`);
    const key = validateSshPublicKey(match[2], match[3], `release signer entry ${index}`);
    const principal = match[1].toLowerCase();
    if (principals.has(principal)) throw new Error('release signer inventory must contain distinct signer principals');
    principals.add(principal);
    if (keys.has(key)) throw new Error('release signer inventory must contain distinct public keys');
    keys.add(key);
    lines.push(signer);
  }
  return { entries: lines, distinctKeys: keys.size, distinctPrincipals: principals.size };
}

export function evidenceAgeDays(timestamp, now) {
  if (timestamp === null) return null;
  return (now.getTime() - timestamp) / DAY_MS;
}
