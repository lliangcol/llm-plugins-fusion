#!/usr/bin/env node
/** Generate a candidate manifest that binds RC tag, source, evidence, and artifacts. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { buildReleaseCandidate } from './lib/release-candidate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseCandidateArgs(args, env = process.env) {
  const options = {
    tag: env.GITHUB_REF_NAME ?? env.RELEASE_CANDIDATE_TAG,
    commit: env.GITHUB_SHA ?? env.RELEASE_COMMIT,
    artifactDir: resolve(root, '.metrics/release-artifacts'),
    out: resolve(root, '.metrics/release-candidate/release-candidate.json'),
    bundleRoot: resolve(root, '.metrics/release-candidate'),
    evidencePaths: [],
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--tag') options.tag = value();
    else if (arg === '--commit') options.commit = value();
    else if (arg === '--artifact-dir') options.artifactDir = resolve(root, value());
    else if (arg === '--out') options.out = resolve(root, value());
    else if (arg === '--bundle-root') options.bundleRoot = resolve(root, value());
    else if (arg === '--evidence') options.evidencePaths.push(resolve(root, value()));
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  return options;
}

export function generateReleaseCandidate({ args = process.argv.slice(2), env = process.env, now } = {}) {
  const options = parseCandidateArgs(args, env);
  const manifest = buildReleaseCandidate({ root, ...options, now });
  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { path: options.out, manifest };
}

export function main() {
  try {
    const result = generateReleaseCandidate();
    console.log(`Wrote ${relative(root, result.path).replaceAll('\\', '/')}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
