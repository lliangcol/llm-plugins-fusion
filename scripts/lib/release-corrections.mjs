import { isAbsolute, relative, resolve } from 'node:path';
import { canonicalSha256 } from './canonical-json.mjs';
import { createPhysicalReadBoundary, readPhysicalFile } from './physical-read-boundary.mjs';

export const correctionStatuses = Object.freeze([
  'active-release-hold',
  'authorized-for-new-candidate',
  'candidate-verified',
  'resolved-by-governed-release',
]);

export const readinessStatuses = Object.freeze(['READY', 'BLOCKED_POLICY', 'BLOCKED_EXTERNAL_GATE']);

const fullCommitPattern = /^[a-f0-9]{40}$/u;
const stableTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const candidateTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-rc\.(0|[1-9]\d*)$/u;
const correctionIdPattern = /^[A-Z0-9-]+$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u;
const auditActions = new Set(['created', 'authorized', 'candidate-verified', 'closed', 'reopened']);
const auditActorRoles = new Set(['maintainer', 'owner', 'independent-reviewer', 'release-operator']);
const terminalAuditActionsByStatus = Object.freeze({
  'active-release-hold': new Set(['created', 'reopened']),
  'authorized-for-new-candidate': new Set(['authorized']),
  'candidate-verified': new Set(['candidate-verified']),
  'resolved-by-governed-release': new Set(['closed']),
});
const nextAuditAction = Object.freeze({
  created: 'authorized',
  authorized: 'candidate-verified',
  'candidate-verified': 'closed',
  closed: 'reopened',
  reopened: 'authorized',
});

const correctionKeys = new Set([
  'id', 'issue', 'status', 'affectedCommits', 'stableRelease', 'decision', 'releaseBoundary',
  'targetRelease', 'authorizationEvidence', 'candidateEvidence', 'resolutionEvidence', 'auditTrail',
]);

function assertExactKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) throw new Error(`${label} contains unexpected fields: ${unexpected.join(', ')}`);
}

function validDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = dateTimePattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetSign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]) return false;
  if (offsetSign) {
    const offsetHour = Number(offsetHourText);
    const offsetMinute = Number(offsetMinuteText);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return true;
}

export class ReleaseReadinessError extends Error {
  constructor(result) {
    super(`${result.reasonCode}: release readiness is ${result.status}`);
    this.name = 'ReleaseReadinessError';
    this.code = result.reasonCode;
    this.readiness = result;
  }
}

function assertContained(root, path) {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(path);
  const rel = relative(absoluteRoot, absolutePath);
  if (!rel || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) {
    throw new Error('release correction path must be a contained repository file');
  }
  return absolutePath;
}

function assertEvidenceReference(reference, label) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)
    || typeof reference.path !== 'string' || reference.path.length === 0
    || reference.path.includes('\\') || isAbsolute(reference.path)
    || reference.path.split('/').includes('..') || /[\u0000-\u001f\u007f]/u.test(reference.path)
    || !digestPattern.test(reference.sha256 ?? '')
    || !validDateTime(reference.recordedAt)) {
    throw new Error(`${label} must contain a portable repository path, SHA-256 digest, and timestamp`);
  }
  assertExactKeys(reference, new Set(['path', 'sha256', 'recordedAt']), label);
}

export function assertReleaseCorrectionRecords(corrections) {
  if (!Array.isArray(corrections)) throw new Error('release correction evaluation requires correction records');
  const ids = new Set();
  for (const [index, entry] of corrections.entries()) {
    const label = `release correction record ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${label} must be an object`);
    }
    assertExactKeys(entry, correctionKeys, label);
    if (!correctionIdPattern.test(entry.id ?? '') || ids.has(entry.id)) {
      throw new Error(`${label} must have a unique correction id`);
    }
    ids.add(entry.id);
    if (!correctionStatuses.includes(entry.status)) {
      throw new Error(`${label} has an unsupported status`);
    }
    if (!Number.isInteger(entry.issue) || entry.issue < 1) {
      throw new Error(`${label} must bind a positive issue identity`);
    }
    if (!Array.isArray(entry.affectedCommits) || entry.affectedCommits.length === 0
      || entry.affectedCommits.some((commit) => !fullCommitPattern.test(commit))
      || new Set(entry.affectedCommits).size !== entry.affectedCommits.length) {
      throw new Error(`${label} must bind unique full affected commits`);
    }
    if (!entry.stableRelease || typeof entry.stableRelease !== 'object' || Array.isArray(entry.stableRelease)
      || !stableTagPattern.test(entry.stableRelease.tag ?? '')
      || !fullCommitPattern.test(entry.stableRelease.commit ?? '')
      || entry.stableRelease.state !== 'INSTALL_PROVEN') {
      throw new Error(`${label} must bind an INSTALL_PROVEN stable release identity`);
    }
    assertExactKeys(entry.stableRelease, new Set(['tag', 'commit', 'state']), `${label} stable release`);
    if (!entry.decision || typeof entry.decision !== 'object' || Array.isArray(entry.decision)
      || entry.decision.authorizedByIssue !== entry.issue
      || entry.decision.nonRetroactive !== true
      || typeof entry.decision.summary !== 'string' || entry.decision.summary.length === 0) {
      throw new Error(`${label} must bind a non-retroactive issue decision`);
    }
    assertExactKeys(entry.decision, new Set(['authorizedByIssue', 'nonRetroactive', 'summary']), `${label} decision`);
    const stableMayPublish = entry.status === 'resolved-by-governed-release';
    if (!entry.releaseBoundary || typeof entry.releaseBoundary !== 'object' || Array.isArray(entry.releaseBoundary)
      || entry.releaseBoundary.mayPublishStable !== stableMayPublish
      || entry.releaseBoundary.requiresNewCandidate !== true
      || entry.releaseBoundary.requiresCurrentIndependentReview !== true
      || entry.releaseBoundary.requiresProtectedPublicationEvidence !== true
      || entry.releaseBoundary.requiresInstallProof !== true) {
      throw new Error(`${label} has an invalid release boundary for status ${entry.status}`);
    }
    assertExactKeys(entry.releaseBoundary, new Set([
      'mayPublishStable', 'requiresNewCandidate', 'requiresCurrentIndependentReview',
      'requiresProtectedPublicationEvidence', 'requiresInstallProof',
    ]), `${label} release boundary`);
    const targetRequired = entry.status !== 'active-release-hold';
    if (targetRequired || entry.targetRelease !== undefined) {
      if (!entry.targetRelease || typeof entry.targetRelease !== 'object' || Array.isArray(entry.targetRelease)
        || !stableTagPattern.test(entry.targetRelease.stableTag ?? '')
        || !candidateTagPattern.test(entry.targetRelease.candidateTag ?? '')
        || entry.targetRelease.candidateTag.split('-rc.')[0] !== entry.targetRelease.stableTag) {
        throw new Error(`${label} must bind matching stable and candidate target identities`);
      }
      assertExactKeys(entry.targetRelease, new Set(['stableTag', 'candidateTag']), `${label} target release`);
    }
    for (const [name, reference] of [
      ['authorization evidence', entry.authorizationEvidence],
      ['candidate evidence', entry.candidateEvidence],
      ['resolution evidence', entry.resolutionEvidence],
    ]) {
      if (reference !== undefined) assertEvidenceReference(reference, `${label} ${name}`);
    }
    if (entry.status !== 'active-release-hold' && entry.authorizationEvidence === undefined) {
      throw new Error(`${label} requires authorization evidence`);
    }
    if (['candidate-verified', 'resolved-by-governed-release'].includes(entry.status)
      && entry.candidateEvidence === undefined) {
      throw new Error(`${label} requires candidate verification evidence`);
    }
    if (entry.status === 'resolved-by-governed-release' && entry.resolutionEvidence === undefined) {
      throw new Error(`${label} requires resolution evidence`);
    }
    if (!Array.isArray(entry.auditTrail) || entry.auditTrail.length === 0) {
      throw new Error(`${label} audit trail must be a non-empty array`);
    }
    let previousAuditTime = -Infinity;
    let previousAuditAction = null;
    for (const [auditIndex, audit] of (entry.auditTrail ?? []).entries()) {
      if (!audit || typeof audit !== 'object' || Array.isArray(audit)
        || !auditActions.has(audit.action) || !auditActorRoles.has(audit.actorRole)
        || !validDateTime(audit.recordedAt)
        || audit.evidence === undefined) {
        throw new Error(`${label} audit entry ${auditIndex + 1} must contain a governed action, actor, timestamp, and evidence`);
      }
      assertExactKeys(audit, new Set(['action', 'actorRole', 'recordedAt', 'evidence']), `${label} audit entry ${auditIndex + 1}`);
      assertEvidenceReference(audit.evidence, `${label} audit entry ${auditIndex + 1} evidence`);
      const auditTime = Date.parse(audit.recordedAt);
      const evidenceTime = Date.parse(audit.evidence.recordedAt);
      if (auditTime < previousAuditTime) {
        throw new Error(`${label} audit trail timestamps must be non-decreasing`);
      }
      if ((previousAuditAction === null && audit.action !== 'created')
        || (previousAuditAction !== null && nextAuditAction[previousAuditAction] !== audit.action)) {
        throw new Error(`${label} audit trail contains an illegal action sequence at entry ${auditIndex + 1}`);
      }
      if (evidenceTime > auditTime) {
        throw new Error(`${label} audit entry ${auditIndex + 1} evidence cannot postdate the audit record`);
      }
      previousAuditTime = auditTime;
      previousAuditAction = audit.action;
    }
    const terminalAudit = entry.auditTrail.at(-1);
    if (!terminalAuditActionsByStatus[entry.status].has(terminalAudit.action)) {
      throw new Error(`${label} audit trail terminal action does not prove status ${entry.status}`);
    }
    const terminalAuditTime = Date.parse(terminalAudit.recordedAt);
    for (const [name, reference] of [
      ['authorization evidence', entry.authorizationEvidence],
      ['candidate evidence', entry.candidateEvidence],
      ['resolution evidence', entry.resolutionEvidence],
    ]) {
      if (reference && Date.parse(reference.recordedAt) > terminalAuditTime) {
        throw new Error(`${label} ${name} cannot postdate the terminal audit record`);
      }
    }
  }
  return corrections;
}

export function loadReleaseCorrections(
  root,
  path = 'governance/release-corrections.json',
  boundary = createPhysicalReadBoundary(root, 'release correction root'),
) {
  const absolutePath = assertContained(root, resolve(root, path));
  const sourceText = readPhysicalFile(boundary, absolutePath, 'release correction document').buffer.toString('utf8');
  const document = JSON.parse(sourceText);
  if (document?.schemaVersion !== 3 || !Array.isArray(document.corrections)) {
    throw new Error('release correction document must use schemaVersion 3');
  }
  assertExactKeys(document, new Set(['$schema', 'schemaVersion', 'corrections']), 'release correction document');
  assertReleaseCorrectionRecords(document.corrections);
  for (const correction of document.corrections) {
    const references = [];
    for (const reference of [correction.authorizationEvidence, correction.candidateEvidence, correction.resolutionEvidence]) {
      if (reference) references.push(reference);
    }
    for (const entry of correction.auditTrail ?? []) {
      if (entry.evidence) references.push(entry.evidence);
    }
    for (const reference of references) {
      const evidencePath = assertContained(root, resolve(root, reference.path));
      if (evidencePath === absolutePath) throw new Error('release correction evidence cannot reference the correction source itself');
      const digest = readPhysicalFile(boundary, evidencePath, `release correction evidence ${reference.path}`).sha256;
      if (digest !== reference.sha256) throw new Error(`release correction evidence digest differs: ${reference.path}`);
    }
  }
  return { document, sourceText, sha256: canonicalSha256(document), path: relative(resolve(root), absolutePath).replaceAll('\\', '/') };
}

function correctionApplies(correction, { stableTag, sourceCommit }) {
  if (correction.status === 'active-release-hold') return true;
  if (correction.stableRelease?.tag === stableTag) return true;
  if (correction.targetRelease?.stableTag === stableTag) return true;
  return correction.affectedCommits?.includes(sourceCommit) ?? false;
}

function missingOperationalEvidence({ independentReview, protectedPublication }, mode) {
  const missing = [];
  if (!independentReview?.passed) missing.push('INDEPENDENT_REVIEW_REQUIRED');
  if (['promote', 'recover'].includes(mode) && !protectedPublication?.passed) missing.push('PROTECTED_PUBLICATION_REQUIRED');
  return missing;
}

export function evaluateReleaseCorrections({
  mode,
  stableTag,
  candidateTag,
  sourceCommit,
  corrections,
  correctionsSha256,
  independentReview = null,
  protectedPublication = null,
  candidateVerification = null,
}) {
  if (!['candidate', 'promote', 'recover', 'drill'].includes(mode)) throw new Error(`unsupported release correction mode: ${mode}`);
  if (!stableTagPattern.test(stableTag ?? '')) throw new Error('release correction evaluation requires a stable tag');
  if (!candidateTagPattern.test(candidateTag ?? '')) throw new Error('release correction evaluation requires an immutable candidate tag');
  if (candidateTag.split('-rc.')[0] !== stableTag) {
    throw new Error('release correction evaluation requires the candidate tag base to equal the stable tag');
  }
  if (!fullCommitPattern.test(sourceCommit ?? '')) throw new Error('release correction evaluation requires a full source commit');
  assertReleaseCorrectionRecords(corrections);
  if (!digestPattern.test(correctionsSha256 ?? '')) throw new Error('release correction evaluation requires the correction source digest');

  const applicable = [];
  const correctionIds = [];
  const active = [];
  for (const entry of corrections) {
    if (!correctionApplies(entry, { stableTag, sourceCommit })) continue;
    applicable.push(entry);
    correctionIds.push(entry.id);
    if (entry.status !== 'resolved-by-governed-release') active.push(entry);
  }
  correctionIds.sort();
  const missingEvidence = [];
  let status = 'READY';
  let reasonCode = 'RELEASE_POLICY_READY';
  let maximumPermittedState = mode === 'drill' ? 'PROMOTION_READY' : 'INSTALL_PROVEN';

  const unauthorized = [];
  for (const entry of active) {
    if (entry.status === 'active-release-hold') unauthorized.push(entry);
  }
  if (unauthorized.length) {
    status = 'BLOCKED_POLICY';
    reasonCode = 'ACTIVE_RELEASE_HOLD';
    maximumPermittedState = 'DRAFT';
    for (const entry of unauthorized) missingEvidence.push(`CORRECTION_AUTHORIZATION:${entry.id}`);
  } else {
    let identityMismatch = false;
    let authorizedCandidate = false;
    for (const entry of active) {
      if (entry.targetRelease?.stableTag !== stableTag || entry.targetRelease?.candidateTag !== candidateTag) {
        identityMismatch = true;
      }
      if (entry.status === 'authorized-for-new-candidate') authorizedCandidate = true;
    }
    if (identityMismatch) {
      status = 'BLOCKED_POLICY';
      reasonCode = 'CORRECTION_IDENTITY_MISMATCH';
      maximumPermittedState = 'DRAFT';
    } else if ((['promote', 'recover'].includes(mode) || (mode === 'drill' && authorizedCandidate))
      && candidateVerification?.passed !== true) {
      status = 'BLOCKED_POLICY';
      reasonCode = 'CANDIDATE_NOT_VERIFIED';
      maximumPermittedState = 'CANDIDATE_TAGGED';
      missingEvidence.push('CANDIDATE_VERIFICATION_REQUIRED');
    } else {
      const operational = missingOperationalEvidence({ independentReview, protectedPublication }, mode);
      if (operational.length) {
        status = 'BLOCKED_EXTERNAL_GATE';
        reasonCode = operational[0];
        const onlyPublicationMissing = operational.every((code) => code === 'PROTECTED_PUBLICATION_REQUIRED');
        maximumPermittedState = mode === 'candidate'
          ? 'CANDIDATE_TAGGED'
          : onlyPublicationMissing
            ? 'ASSETS_RECONCILED'
            : 'CANDIDATE_VERIFIED';
        missingEvidence.push(...operational);
      }
    }
  }

  return {
    schemaVersion: 1,
    status,
    reasonCode,
    mode,
    stableTag,
    candidateTag,
    sourceCommit,
    correctionIds,
    correctionsSha256,
    missingEvidence: [...new Set(missingEvidence)].sort(),
    maximumPermittedState,
  };
}

export function assertReleaseReady(result) {
  if (result.status !== 'READY') {
    throw new ReleaseReadinessError(result);
  }
  return result;
}
