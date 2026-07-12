#!/usr/bin/env node
/** Verify that stable publication promotes an identical release candidate. */

import { appendFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { verifyReleasePromotion } from './lib/release-candidate.mjs';
import { canonicalSha256 } from './lib/canonical-json.mjs';
import { verifyControlBundle } from './build-release-control-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parsePromotionArgs(args, env = process.env) {
  const options = {
    stableTag: null,
    expectedCandidateTag: null,
    commit: null,
    manifestPath: null,
    corePath: null,
    intentPath: null,
    controlBundleManifest: null,
    artifactDir: resolve(root, '.metrics/promotion/artifacts'),
    bundleRoot: resolve(root, '.metrics/promotion'),
    githubOutput: env.GITHUB_OUTPUT ?? null,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--stable-tag') options.stableTag = value();
    else if (arg === '--candidate-tag') options.expectedCandidateTag = value();
    else if (arg === '--commit') options.commit = value();
    else if (arg === '--manifest') options.manifestPath = resolve(root, value());
    else if (arg === '--candidate-core') options.corePath = resolve(root, value());
    else if (arg === '--promotion-intent') options.intentPath = resolve(root, value());
    else if (arg === '--control-bundle-manifest') options.controlBundleManifest = resolve(root, value());
    else if (arg === '--artifact-dir') options.artifactDir = resolve(root, value());
    else if (arg === '--bundle-root') options.bundleRoot = resolve(root, value());
    else if (arg === '--github-output') options.githubOutput = resolve(root, value());
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  for (const key of ['stableTag', 'expectedCandidateTag', 'commit', 'manifestPath', 'corePath', 'intentPath', 'controlBundleManifest']) {
    if (!options[key]) throw new Error(`missing required promotion identity option: ${key}`);
  }
  return options;
}

export function verifyPromotion({ args = process.argv.slice(2), env = process.env } = {}) {
  const options = parsePromotionArgs(args, env);
  const envelope = JSON.parse(readFileSync(options.manifestPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(options.corePath, 'utf8'));
  const intent = JSON.parse(readFileSync(options.intentPath, 'utf8'));
  const control = JSON.parse(readFileSync(options.controlBundleManifest, 'utf8'));
  if (envelope.schemaVersion !== 3) throw new Error('release candidate envelope schema must be 3');
  if (canonicalSha256(manifest) !== envelope.candidateCore?.sha256 || canonicalSha256(intent) !== envelope.promotionIntent?.sha256) {
    throw new Error('release candidate envelope binding differs');
  }
  if (intent.candidateCoreSha256 !== envelope.candidateCore.sha256 || intent.controlBundleSha256 !== control.bundleSha256 || manifest.controlBundle.sha256 !== control.bundleSha256) {
    throw new Error('promotion intent or candidate core control binding differs');
  }
  if (manifest.controlBundle.path !== 'release-control-bundle.tar.gz') throw new Error('candidate core control bundle path is invalid');
  const controlBundlePath = resolve(options.bundleRoot, manifest.controlBundle.path);
  verifyControlBundle({ bundlePath: controlBundlePath, manifest: control });
  if (statSync(controlBundlePath).size !== manifest.controlBundle.bytes) throw new Error('release control bundle size differs from candidate core');
  if (intent.stableTag !== options.stableTag || intent.candidateTag !== options.expectedCandidateTag || intent.sourceCommit !== options.commit) {
    throw new Error('explicit promotion identity differs from promotion intent');
  }
  const result = verifyReleasePromotion({ root, manifest, ...options });
  if (options.githubOutput) {
    appendFileSync(options.githubOutput, `candidate_tag=${result.candidateTag}\nartifact_digest=${result.artifactDigest}\n`, 'utf8');
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
