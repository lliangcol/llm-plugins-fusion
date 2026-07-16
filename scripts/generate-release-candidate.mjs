#!/usr/bin/env node
/** Generate a candidate manifest that binds RC tag, source, evidence, and artifacts. */

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { buildReleaseCandidate } from './lib/release-candidate.mjs';
import { canonicalSha256 } from './lib/canonical-json.mjs';
import { verifyControlBundle } from './build-release-control-bundle.mjs';
import { assertReleaseReady, evaluateReleaseCorrections, loadReleaseCorrections } from './lib/release-corrections.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseCandidateArgs(args, env = process.env) {
  const options = {
    tag: null,
    stableTag: null,
    commit: null,
    workflowSourceCommit: null,
    artifactDir: resolve(root, '.metrics/release-artifacts'),
    outDir: resolve(root, '.metrics/release-candidate'),
    bundleRoot: resolve(root, '.metrics/release-candidate'),
    controlBundleManifest: null,
    evidencePaths: [],
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--tag') options.tag = value();
    else if (arg === '--stable-tag') options.stableTag = value();
    else if (arg === '--commit') options.commit = value();
    else if (arg === '--workflow-source-commit') options.workflowSourceCommit = value();
    else if (arg === '--artifact-dir') options.artifactDir = resolve(root, value());
    else if (arg === '--out-dir') options.outDir = resolve(root, value());
    else if (arg === '--control-bundle-manifest') options.controlBundleManifest = resolve(root, value());
    else if (arg === '--bundle-root') options.bundleRoot = resolve(root, value());
    else if (arg === '--evidence') options.evidencePaths.push(resolve(root, value()));
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  for (const key of ['tag', 'stableTag', 'commit', 'workflowSourceCommit', 'controlBundleManifest']) {
    if (!options[key]) throw new Error(`missing required candidate identity option: ${key}`);
  }
  if (!/^[a-f0-9]{40}$/u.test(options.workflowSourceCommit)) {
    throw new Error('workflow source commit must be a full Git SHA');
  }
  return options;
}

/** @param {{args?: string[], env?: NodeJS.ProcessEnv, now?: () => Date, correctionSource?: {document: {corrections: object[]}, sha256: string}}} [options] */
export function generateReleaseCandidate({ args = process.argv.slice(2), env = process.env, now, correctionSource = loadReleaseCorrections(root) } = {}) {
  const options = parseCandidateArgs(args, env);
  const reviewPath = options.evidencePaths.find((path) => path.endsWith('/independent-review.json') || path.endsWith('\\independent-review.json'));
  const review = reviewPath ? JSON.parse(readFileSync(reviewPath, 'utf8')) : null;
  const independentReview = {
    passed: review?.passed === true
      && review.commit === options.commit
      && /^[a-f0-9]{40}$/u.test(review.pullRequestHead ?? '')
      && review.expectedReviewCommit === review.pullRequestHead
      && Number.isInteger(review.minimumApprovals)
      && review.minimumApprovals >= 1
      && Array.isArray(review.approvalReviewers)
      && review.approvalReviewers.length >= review.minimumApprovals
      && new Set(review.approvalReviewers).size === review.approvalReviewers.length
      && review.approvalReviewers.every((reviewer) => !review.excludedReviewers?.includes(reviewer)),
  };
  const releasePolicy = assertReleaseReady(evaluateReleaseCorrections({
    mode: 'candidate', stableTag: options.stableTag, candidateTag: options.tag, sourceCommit: options.commit,
    corrections: correctionSource.document.corrections, correctionsSha256: correctionSource.sha256, independentReview,
  }));
  const controlManifest = JSON.parse(readFileSync(options.controlBundleManifest, 'utf8'));
  const controlBundlePath = resolve(dirname(options.controlBundleManifest), 'release-control-bundle.tar.gz');
  verifyControlBundle({ bundlePath: controlBundlePath, manifest: controlManifest });
  const core = buildReleaseCandidate({
    root,
    ...options,
    controlBundle: {
      path: 'release-control-bundle.tar.gz',
      sha256: controlManifest.bundleSha256,
      bytes: statSync(controlBundlePath).size,
    },
    releasePolicy,
    now,
  });
  const candidateCoreSha256 = canonicalSha256(core);
  const intent = {
    schemaVersion: 1,
    stableTag: options.stableTag,
    candidateTag: options.tag,
    sourceCommit: options.commit,
    candidateCoreSha256,
    controlBundleSha256: controlManifest.bundleSha256,
    correctionsSha256: releasePolicy.correctionsSha256,
    correctionIds: releasePolicy.correctionIds,
  };
  const envelope = {
    schemaVersion: 3,
    candidateCore: { path: 'candidate-core.json', sha256: candidateCoreSha256 },
    promotionIntent: { path: 'promotion-intent.json', sha256: canonicalSha256(intent) },
  };
  mkdirSync(options.outDir, { recursive: true });
  const paths = {
    core: resolve(options.outDir, 'candidate-core.json'),
    intent: resolve(options.outDir, 'promotion-intent.json'),
    envelope: resolve(options.outDir, 'release-candidate.json'),
  };
  writeFileSync(paths.core, `${JSON.stringify(core, null, 2)}\n`, 'utf8');
  writeFileSync(paths.intent, `${JSON.stringify(intent, null, 2)}\n`, 'utf8');
  writeFileSync(paths.envelope, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  return { paths, manifest: envelope, core, intent };
}

export function main() {
  try {
    const result = generateReleaseCandidate();
    for (const path of Object.values(result.paths)) console.log(`Wrote ${relative(root, path).replaceAll('\\', '/')}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
