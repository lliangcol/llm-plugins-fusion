#!/usr/bin/env node
/** Verify that stable publication promotes an identical release candidate. */

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { verifyReleasePromotion } from './lib/release-candidate.mjs';
import { canonicalSha256 } from './lib/canonical-json.mjs';
import { verifyControlBundle } from './build-release-control-bundle.mjs';
import { assertReleaseReady, evaluateReleaseCorrections, loadReleaseCorrections } from './lib/release-corrections.mjs';
import { createPhysicalReadBoundary, readPhysicalFile } from './lib/physical-read-boundary.mjs';
import {
  appendArtifactFileSafely,
  prepareArtifactOutputPlan,
  resolveArtifactOutputPath,
  writeArtifactOutput,
} from './lib/artifact-output.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parsePromotionArgs(args, env = process.env) {
  const options = {
    stableTag: null,
    expectedCandidateTag: null,
    repository: env.GITHUB_REPOSITORY ?? null,
    commit: null,
    manifestPath: null,
    corePath: null,
    intentPath: null,
    controlBundleManifest: null,
    candidateReleaseMetadata: null,
    observationEvidenceOut: null,
    artifactDir: resolve(root, '.metrics/promotion/artifacts'),
    bundleRoot: resolve(root, '.metrics/promotion'),
    githubOutput: env.GITHUB_OUTPUT ?? null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--stable-tag') options.stableTag = value();
    else if (arg === '--candidate-tag') options.expectedCandidateTag = value();
    else if (arg === '--repository') options.repository = value();
    else if (arg === '--commit') options.commit = value();
    else if (arg === '--manifest') options.manifestPath = resolve(root, value());
    else if (arg === '--candidate-core') options.corePath = resolve(root, value());
    else if (arg === '--promotion-intent') options.intentPath = resolve(root, value());
    else if (arg === '--control-bundle-manifest') options.controlBundleManifest = resolve(root, value());
    else if (arg === '--candidate-release-metadata') options.candidateReleaseMetadata = resolve(root, value());
    else if (arg === '--observation-evidence-out') options.observationEvidenceOut = resolveArtifactOutputPath(root, value(), 'candidate observation output');
    else if (arg === '--artifact-dir') options.artifactDir = resolve(root, value());
    else if (arg === '--bundle-root') options.bundleRoot = resolve(root, value());
    else if (arg === '--github-output') options.githubOutput = value();
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  for (const key of ['stableTag', 'expectedCandidateTag', 'repository', 'commit', 'manifestPath', 'corePath', 'intentPath', 'controlBundleManifest', 'candidateReleaseMetadata', 'observationEvidenceOut']) {
    if (!options[key]) throw new Error(`missing required promotion identity option: ${key}`);
  }
  return options;
}

export function verifyPromotion({
  args = process.argv.slice(2),
  env = process.env,
  correctionSource = null,
  releaseOperations = null,
  now = undefined,
} = {}) {
  const options = parsePromotionArgs(args, env);
  const repoBoundary = createPhysicalReadBoundary(root, 'release promotion repository root');
  const bundleBoundary = createPhysicalReadBoundary(options.bundleRoot, 'release promotion bundle root');
  const metadataBoundary = createPhysicalReadBoundary(dirname(options.bundleRoot), 'release promotion handoff root');
  const resolvedCorrectionSource = correctionSource ?? loadReleaseCorrections(root, undefined, repoBoundary);
  const resolvedReleaseOperations = releaseOperations ?? JSON.parse(
    readPhysicalFile(repoBoundary, resolve(root, 'governance/release-operations.json'), 'release operations').buffer.toString('utf8'),
  );
  const envelope = JSON.parse(readPhysicalFile(bundleBoundary, options.manifestPath, 'release candidate envelope').buffer.toString('utf8'));
  const manifest = JSON.parse(readPhysicalFile(bundleBoundary, options.corePath, 'release candidate core').buffer.toString('utf8'));
  const intent = JSON.parse(readPhysicalFile(bundleBoundary, options.intentPath, 'release promotion intent').buffer.toString('utf8'));
  const control = JSON.parse(readPhysicalFile(bundleBoundary, options.controlBundleManifest, 'release control manifest').buffer.toString('utf8'));
  if (envelope.schemaVersion !== 3) throw new Error('release candidate envelope schema must be 3');
  if (canonicalSha256(manifest) !== envelope.candidateCore?.sha256 || canonicalSha256(intent) !== envelope.promotionIntent?.sha256) {
    throw new Error('release candidate envelope binding differs');
  }
  if (intent.candidateCoreSha256 !== envelope.candidateCore.sha256 || intent.controlBundleSha256 !== control.bundleSha256 || manifest.controlBundle.sha256 !== control.bundleSha256) {
    throw new Error('promotion intent or candidate core control binding differs');
  }
  if (intent.correctionsSha256 !== manifest.releasePolicy?.correctionsSha256
    || intent.correctionsSha256 !== resolvedCorrectionSource.sha256
    || JSON.stringify(intent.correctionIds ?? []) !== JSON.stringify(manifest.releasePolicy?.correctionIds ?? [])) {
    throw new Error('release correction evidence differs or is stale');
  }
  if (manifest.controlBundle.path !== 'release-control-bundle.tar.gz') throw new Error('candidate core control bundle path is invalid');
  const controlBundlePath = resolve(options.bundleRoot, manifest.controlBundle.path);
  const controlBundleFile = readPhysicalFile(bundleBoundary, controlBundlePath, 'release control bundle');
  verifyControlBundle({ bundlePath: controlBundlePath, manifest: control, archive: controlBundleFile.buffer });
  if (controlBundleFile.bytes !== manifest.controlBundle.bytes) throw new Error('release control bundle size differs from candidate core');
  if (intent.stableTag !== options.stableTag || intent.candidateTag !== options.expectedCandidateTag || intent.sourceCommit !== options.commit) {
    throw new Error('explicit promotion identity differs from promotion intent');
  }
  const candidateReleaseMetadata = JSON.parse(
    readPhysicalFile(metadataBoundary, options.candidateReleaseMetadata, 'candidate release metadata').buffer.toString('utf8'),
  );
  const result = verifyReleasePromotion({
    root,
    manifest,
    ...options,
    candidateReleaseMetadata,
    minimumObservationHours: resolvedReleaseOperations.candidateObservation?.minimumHours,
    now,
  });
  const releasePolicy = evaluateReleaseCorrections({
    mode: 'promote', stableTag: options.stableTag, candidateTag: options.expectedCandidateTag, sourceCommit: options.commit,
    corrections: resolvedCorrectionSource.document.corrections, correctionsSha256: resolvedCorrectionSource.sha256,
    independentReview: { passed: true }, candidateVerification: { passed: true }, protectedPublication: { passed: false },
  });
  if (releasePolicy.status === 'BLOCKED_POLICY') assertReleaseReady(releasePolicy);
  const outputPlan = prepareArtifactOutputPlan(root, [{
    key: 'observation', path: options.observationEvidenceOut, label: 'candidate observation output',
  }], {
    protectedPaths: [
      options.manifestPath,
      options.corePath,
      options.intentPath,
      options.controlBundleManifest,
      options.candidateReleaseMetadata,
    ],
    protectedRoots: [options.artifactDir],
  });
  writeArtifactOutput(outputPlan, 'observation', `${JSON.stringify(result.observation, null, 2)}\n`);
  if (options.githubOutput) {
    appendArtifactFileSafely(
      root,
      options.githubOutput,
      `candidate_tag=${result.candidateTag}\nartifact_digest=${result.artifactDigest}\ncandidate_release_id=${result.observation.releaseId}\ncandidate_published_at=${result.observation.publishedAt}\ncandidate_observation_sha256=${canonicalSha256(result.observation)}\n`,
      { label: 'GitHub output command file', allowedRepositoryRoots: [] },
    );
  }
  return result;
}

export function main() {
  try {
    const result = verifyPromotion();
    console.log(`OK ${result.candidateTag} -> ${result.stableTag} (${result.artifactDigest})`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
