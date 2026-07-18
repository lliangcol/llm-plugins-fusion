#!/usr/bin/env node
/** Fail-closed operational release readiness, separate from structural validation. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import {
  evidenceAgeDays,
  validateReleaseOperationsPolicy,
  validateReleaseSignerInventory,
} from './lib/release-operations.mjs';
import { validateReleaseReviewerPolicy } from './lib/release-review.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function evaluateReleaseOperationalReadiness({ reviewers, operations, signers, mode = 'candidate', now = new Date() }) {
  if (!['candidate', 'promote', 'recover', 'drill'].includes(mode)) throw new Error(`unsupported operational readiness mode: ${mode}`);
  validateReleaseReviewerPolicy(reviewers);
  const operationEvidence = validateReleaseOperationsPolicy(operations, { now });
  const signerInventory = validateReleaseSignerInventory(signers);
  if (reviewers.standardMinimumApprovals < operations.independentReview.minimumApprovals) {
    throw new Error('release reviewer policy does not satisfy the operational minimum approval count');
  }
  const missing = [];
  if (reviewers.status !== 'configured' || reviewers.trustedUsers.length + reviewers.trustedTeams.length === 0) missing.push('TRUSTED_REVIEWERS_UNCONFIGURED');
  const requiredSigners = mode !== 'candidate' && operations.signing.overlapRequired
    ? Math.max(2, operations.signing.minimumActiveSigners)
    : operations.signing.minimumActiveSigners;
  const inventoryAge = evidenceAgeDays(operationEvidence.inventoryReviewedAt, now);
  const rotationAge = evidenceAgeDays(operationEvidence.rotationRecordedAt, now);
  const drillAge = evidenceAgeDays(operationEvidence.drillCompletedAt, now);
  const publicationAge = evidenceAgeDays(operationEvidence.publicationVerifiedAt, now);
  if (Math.min(signerInventory.distinctKeys, signerInventory.distinctPrincipals) < requiredSigners) missing.push('SIGNER_REDUNDANCY_REQUIRED');
  if (mode !== 'candidate' && !operations.signing.lastRotationEvidence) missing.push('SIGNER_ROTATION_EVIDENCE_REQUIRED');
  if (mode !== 'candidate' && rotationAge !== null && rotationAge > operations.signing.rotationReviewCadenceDays) {
    missing.push('SIGNER_ROTATION_EVIDENCE_EXPIRED');
  }
  if (mode === 'promote' && !operations.recovery.lastSuccessfulDrill) missing.push('RECOVERY_DRILL_EVIDENCE_REQUIRED');
  if (mode === 'promote' && drillAge !== null && drillAge > operations.recovery.drillCadenceDays) {
    missing.push('RECOVERY_DRILL_EVIDENCE_EXPIRED');
  }
  if (mode === 'promote' && !operations.protectedPublication.currentEvidence) missing.push('PROTECTED_ENVIRONMENT_EVIDENCE_REQUIRED');
  if (mode === 'promote' && publicationAge !== null && publicationAge > operations.protectedPublication.evidenceMaxAgeDays) {
    missing.push('PROTECTED_ENVIRONMENT_EVIDENCE_EXPIRED');
  }
  if (inventoryAge !== null && inventoryAge > operations.signing.rotationReviewCadenceDays) missing.push('SIGNER_INVENTORY_EXPIRED');
  return { schemaVersion: 1, status: missing.length ? 'BLOCKED_EXTERNAL_GATE' : 'READY', reasonCodes: missing.sort(), mode };
}

export function main(args = process.argv.slice(2)) {
  const modeIndex = args.indexOf('--mode');
  if (args.length !== 2 || modeIndex !== 0 || !args[1]) { console.error('Usage: node scripts/validate-release-operational-readiness.mjs --mode <candidate|promote|recover|drill>'); return 1; }
  try {
    const reviewers = readJson('governance/release-reviewers.json');
    const operations = readJson('governance/release-operations.json');
    const signers = readFileSync(resolve(root, operations.signing.allowedSignersFile), 'utf8').split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
    const result = evaluateReleaseOperationalReadiness({ reviewers, operations, signers, mode: args[1] });
    console.log(JSON.stringify(result, null, 2));
    return result.status === 'READY' ? 0 : 2;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
