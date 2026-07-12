#!/usr/bin/env node
/** Verify that stable publication promotes an identical release candidate. */

import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { verifyReleasePromotion } from './lib/release-candidate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parsePromotionArgs(args, env = process.env) {
  const options = {
    stableTag: env.GITHUB_REF_NAME ?? env.RELEASE_TAG,
    expectedCandidateTag: env.RELEASE_CANDIDATE_TAG ?? null,
    commit: env.GITHUB_SHA ?? env.RELEASE_COMMIT,
    manifestPath: resolve(root, '.metrics/promotion/release-candidate.json'),
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
    else if (arg === '--artifact-dir') options.artifactDir = resolve(root, value());
    else if (arg === '--bundle-root') options.bundleRoot = resolve(root, value());
    else if (arg === '--github-output') options.githubOutput = resolve(root, value());
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  return options;
}

export function verifyPromotion({ args = process.argv.slice(2), env = process.env } = {}) {
  const options = parsePromotionArgs(args, env);
  const manifest = JSON.parse(readFileSync(options.manifestPath, 'utf8'));
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
