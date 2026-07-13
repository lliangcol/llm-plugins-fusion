import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import { canonicalSha256 } from './canonical-json.mjs';

export const correctionStatuses = Object.freeze([
  'active-release-hold',
  'authorized-for-new-candidate',
  'candidate-verified',
  'resolved-by-governed-release',
]);

export const readinessStatuses = Object.freeze(['READY', 'BLOCKED_POLICY', 'BLOCKED_EXTERNAL_GATE']);

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

export function loadReleaseCorrections(root, path = 'governance/release-corrections.json') {
  const absolutePath = assertContained(root, resolve(root, path));
  const sourceText = readFileSync(absolutePath, 'utf8');
  const document = JSON.parse(sourceText);
  if (document?.schemaVersion !== 2 || !Array.isArray(document.corrections)) {
    throw new Error('release correction document must use schemaVersion 2');
  }
  for (const correction of document.corrections) {
    const references = [correction.authorizationEvidence, correction.candidateEvidence, correction.resolutionEvidence, ...(correction.auditTrail ?? []).map((entry) => entry.evidence)].filter(Boolean);
    for (const reference of references) {
      const evidencePath = assertContained(root, resolve(root, reference.path));
      if (evidencePath === absolutePath) throw new Error('release correction evidence cannot reference the correction source itself');
      const digest = createHash('sha256').update(readFileSync(evidencePath)).digest('hex');
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
  installProof = null,
}) {
  if (!['candidate', 'promote', 'recover', 'drill'].includes(mode)) throw new Error(`unsupported release correction mode: ${mode}`);
  if (!/^v\d+\.\d+\.\d+$/u.test(stableTag ?? '')) throw new Error('release correction evaluation requires a stable tag');
  if (!/^v\d+\.\d+\.\d+-rc\.\d+$/u.test(candidateTag ?? '')) throw new Error('release correction evaluation requires an immutable candidate tag');
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit ?? '')) throw new Error('release correction evaluation requires a full source commit');
  if (!Array.isArray(corrections)) throw new Error('release correction evaluation requires correction records');
  if (!/^[a-f0-9]{64}$/u.test(correctionsSha256 ?? '')) throw new Error('release correction evaluation requires the correction source digest');

  const applicable = corrections.filter((entry) => correctionApplies(entry, { stableTag, sourceCommit }));
  const correctionIds = applicable.map((entry) => entry.id).sort();
  const active = applicable.filter((entry) => entry.status !== 'resolved-by-governed-release');
  const missingEvidence = [];
  let status = 'READY';
  let reasonCode = 'RELEASE_POLICY_READY';
  let maximumPermittedState = mode === 'drill' ? 'PROMOTION_READY' : 'INSTALL_PROVEN';

  const unauthorized = active.filter((entry) => entry.status === 'active-release-hold');
  if (unauthorized.length) {
    status = 'BLOCKED_POLICY';
    reasonCode = 'ACTIVE_RELEASE_HOLD';
    maximumPermittedState = 'DRAFT';
    missingEvidence.push(...unauthorized.map((entry) => `CORRECTION_AUTHORIZATION:${entry.id}`));
  } else if (active.length) {
    const identityMismatch = active.some((entry) => entry.targetRelease?.stableTag !== stableTag
      || entry.targetRelease?.candidateTag !== candidateTag
      || entry.targetRelease?.sourceCommit !== sourceCommit);
    if (identityMismatch) {
      status = 'BLOCKED_POLICY';
      reasonCode = 'CORRECTION_IDENTITY_MISMATCH';
      maximumPermittedState = 'DRAFT';
    } else if (mode !== 'candidate' && active.some((entry) => entry.status === 'authorized-for-new-candidate')) {
      status = 'BLOCKED_POLICY';
      reasonCode = 'CANDIDATE_NOT_VERIFIED';
      maximumPermittedState = 'CANDIDATE_TAGGED';
      missingEvidence.push('CANDIDATE_VERIFICATION_REQUIRED');
    } else {
      const operational = missingOperationalEvidence({ independentReview, protectedPublication }, mode);
      if (operational.length) {
        status = 'BLOCKED_EXTERNAL_GATE';
        reasonCode = operational[0];
        maximumPermittedState = mode === 'candidate' ? 'CANDIDATE_TAGGED'
          : (operational.every((code) => code === 'PROTECTED_PUBLICATION_REQUIRED') ? 'ASSETS_RECONCILED' : 'CANDIDATE_VERIFIED');
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
