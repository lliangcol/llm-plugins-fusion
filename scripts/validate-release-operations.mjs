#!/usr/bin/env node
/** Validate release-review, signer, recovery, label, and adoption governance sources. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';
import { validateAdoptionEvidenceDocument } from './lib/adoption-evidence.mjs';
import { parseLabelCatalog } from './lib/label-catalog.mjs';
import { validateReleaseOperationsPolicy, validateReleaseSignerInventory } from './lib/release-operations.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const operations = readJson('governance/release-operations.json');
const adoption = readJson('governance/adoption-evidence.json');

validateReleaseOperationsPolicy(operations);

assert.equal(operations.schemaVersion, 4);
assert.equal(operations.independentReview.requiredForCandidate, true);
assert.ok(operations.independentReview.minimumApprovals >= 1);
assert.deepEqual(operations.independentReview.reviewerMustDifferFrom, ['pull-request-author', 'candidate-actor']);
assert.equal(operations.signing.overlapRequired, true);
assert.ok(operations.signing.rotationReviewCadenceDays > 0);
assert.equal(existsSync(resolve(root, operations.signing.allowedSignersFile)), true);
assert.equal(existsSync(resolve(root, operations.recovery.workflow)), true);
assert.equal(existsSync(resolve(root, operations.labels.workflow)), true);
assert.equal(operations.candidateObservation.minimumHours, 168);
assert.equal(operations.candidateObservation.timestampSource, 'github-releases-api-published-at');
assert.equal(operations.candidateObservation.requirePublishedPrerelease, true);
const signers = readFileSync(resolve(root, operations.signing.allowedSignersFile), 'utf8').split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
validateReleaseSignerInventory(signers);
assert.ok(signers.length >= operations.signing.minimumActiveSigners);
assert.equal(new Set(signers).size, signers.length, 'release signer entries must be unique');
for (const signer of signers) assert.match(signer, /^\S+\s+ssh-(?:ed25519|rsa)\s+\S+/u);
parseLabelCatalog(readFileSync(resolve(root, operations.labels.source), 'utf8'));

assert.equal(adoption.schemaVersion, 3);
assert.ok(['not-demonstrated', 'demonstrated'].includes(adoption.status));
assert.ok(Array.isArray(adoption.records));
assert.equal(adoption.collectionPolicy.consentRequired, true);
assert.equal(adoption.collectionPolicy.rawPrivateDataAllowed, false);
assert.deepEqual([...adoption.collectionPolicy.allowedSignals].sort(), ['activation', 'installation', 'maintenance-commitment', 'successful-workflow']);
for (const record of adoption.records) {
  assert.equal(record.privacyReview, 'passed');
  assert.ok(
    record.sourceCommit
      && record.sourceDigest
      && record.consentEvidence
      && record.consentEvidenceSha256
      && record.validationEvidence
      && record.validationEvidenceSha256,
    'adoption record requires source, consent, validation, and per-file digest evidence',
  );
}
const adoptionValidation = validateAdoptionEvidenceDocument(root, adoption);
assert.equal(adoptionValidation.validRecordCount, adoption.records.length);
if (adoption.status !== 'demonstrated') {
  for (const forbidden of ['packages/workflow-kernel', 'scripts/plugin-author.mjs', 'plugins', 'portal']) {
    assert.equal(existsSync(resolve(root, forbidden)), false, `KERNEL-001 blocks public productization while adoption is ${adoption.status}: ${forbidden}`);
  }
}

console.log(`OK release operations governance (independent approvals=${operations.independentReview.minimumApprovals}, signers=${signers.length}, labels=${parseLabelCatalog(readFileSync(resolve(root, operations.labels.source), 'utf8')).length}, adoption=${adoption.status})`);
