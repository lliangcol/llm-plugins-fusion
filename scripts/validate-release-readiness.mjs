#!/usr/bin/env node
/** Evaluate release corrections separately from ordinary repository integrity. */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { evaluateReleaseCorrections, loadReleaseCorrections } from './lib/release-corrections.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';

const root = repoRoot(import.meta.url);

export function parseReadinessArgs(args) {
  const options = { mode: 'candidate', stableTag: null, candidateTag: null, sourceCommit: null, requireReady: false, independentReviewEvidence: null, protectedPublicationApproved: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--require-ready') { options.requireReady = true; continue; }
    if (arg === '--protected-publication-approved') { options.protectedPublicationApproved = true; continue; }
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--mode') options.mode = value();
    else if (arg === '--stable-tag') options.stableTag = value();
    else if (arg === '--candidate-tag') options.candidateTag = value();
    else if (arg === '--source-commit') options.sourceCommit = value();
    else if (arg === '--independent-review-evidence') options.independentReviewEvidence = value();
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  const version = JSON.parse(readFileSync(`${root}/nova-plugin/.claude-plugin/plugin.json`, 'utf8')).version;
  options.stableTag ??= `v${version}`;
  options.candidateTag ??= `v${version}-rc.0`;
  if (!options.sourceCommit) {
    const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
    if (git.status !== 0) throw new Error('unable to resolve current Git commit for readiness');
    options.sourceCommit = git.stdout.trim();
  }
  return options;
}

export function validateReleaseReadiness(args = process.argv.slice(2)) {
  const options = parseReadinessArgs(args);
  const source = loadReleaseCorrections(root);
  const review = options.independentReviewEvidence ? JSON.parse(readFileSync(options.independentReviewEvidence, 'utf8')) : null;
  const result = evaluateReleaseCorrections({
    ...options,
    corrections: source.document.corrections,
    correctionsSha256: source.sha256,
    independentReview: { passed: review?.passed === true && review.commit === options.sourceCommit && review.pullRequestHead === options.sourceCommit },
    protectedPublication: { passed: options.protectedPublicationApproved },
  });
  return { options, result };
}

export function main(args = process.argv.slice(2)) {
  try {
    const { options, result } = validateReleaseReadiness(args);
    console.log(JSON.stringify(result, null, 2));
    return options.requireReady && result.status !== 'READY' ? 2 : 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
