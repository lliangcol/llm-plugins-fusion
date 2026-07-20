#!/usr/bin/env node
/** Compare the final installed plugin bytes with the promoted candidate tree. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { treeDigest } from './validate-plugin-install.mjs';
import {
  prepareArtifactOutputPlan,
  resolveArtifactOutputPath,
  writeArtifactOutput,
} from './lib/artifact-output.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function parseStableInstallArgs(args) {
  const options = { candidateRoot: null, installedRoot: null, claudeVersion: null, out: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--candidate-root') options.candidateRoot = resolve(root, value());
    else if (arg === '--installed-root') options.installedRoot = resolve(root, value());
    else if (arg === '--claude-version') options.claudeVersion = value();
    else if (arg === '--out') options.out = resolveArtifactOutputPath(root, value(), 'stable install proof output');
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  for (const key of ['candidateRoot', 'installedRoot', 'claudeVersion', 'out']) {
    if (!options[key]) throw new Error(`missing required --${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  return options;
}

export function buildStableInstallProof({ candidateRoot, installedRoot, claudeVersion, now = () => new Date(), channelText = readFileSync(resolve(root, 'governance/release-channels.json'), 'utf8') }) {
  const channels = JSON.parse(channelText);
  const candidateTreeDigest = treeDigest(candidateRoot);
  const installedTreeDigest = treeDigest(installedRoot, { ignoreClaudeRuntimeMarkers: true });
  if (candidateTreeDigest !== channels.stable.pluginTreeSha256) throw new Error('candidate tree digest does not match the stable release channel');
  if (installedTreeDigest !== candidateTreeDigest) throw new Error('installed tree digest differs from promoted candidate tree digest');
  return {
    schemaVersion: 1,
    stable: {
      version: channels.stable.version,
      tag: channels.stable.tag,
      commit: channels.stable.commit,
      channelFactsSha256: sha256(channelText),
    },
    claudeVersion,
    treeManifestVersion: 2,
    candidateTreeDigest,
    installedTreeDigest,
    ignoredInstalledPaths: ['.in_use/**'],
    matches: true,
    generatedAt: now().toISOString(),
  };
}

/**
 * @param {string[]} args
 * @param {{channelText?: string}} [dependencies]
 */
export function main(args = process.argv.slice(2), dependencies = {}) {
  const { channelText } = dependencies;
  try {
    const options = parseStableInstallArgs(args);
    const outputPlan = prepareArtifactOutputPlan(root, [{
      key: 'proof', path: options.out, label: 'stable install proof output',
    }], { protectedRoots: [options.candidateRoot, options.installedRoot] });
    const proof = buildStableInstallProof({ ...options, ...(channelText ? { channelText } : {}) });
    writeArtifactOutput(outputPlan, 'proof', `${JSON.stringify(proof, null, 2)}\n`);
    console.log(`Wrote ${options.out}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
