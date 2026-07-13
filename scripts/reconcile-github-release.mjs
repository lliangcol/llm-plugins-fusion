#!/usr/bin/env node
/** Reconcile a draft GitHub Release without overwriting conflicting assets. */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reconcileReleaseAssets } from './lib/release-state-machine.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function gh(args, { tolerate = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', shell: false, windowsHide: true });
  if (!tolerate && result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args[0]} failed`);
  return result;
}

function assets(dir) {
  const files = readdirSync(dir).map((name) => resolve(dir, name)).filter((path) => statSync(path).isFile());
  const names = files.map((path) => basename(path));
  if (new Set(names).size !== names.length) throw new Error('release asset basenames must be unique');
  return files.map((path) => ({ name: basename(path), path, sha256: sha256File(path), bytes: statSync(path).size })).sort((a, b) => a.name.localeCompare(b.name));
}

function failureMessage(result, fallback) {
  return result.stderr?.trim() || fallback;
}

function releaseIsMissing(result) {
  return result.status !== 0 && (/^release not found$/iu.test(result.stderr?.trim() ?? '') || /\bHTTP 404\b/iu.test(result.stderr ?? ''));
}

function releaseHasNoAssets(result) {
  return result.status !== 0 && /no assets found/iu.test(result.stderr ?? '');
}

export function reconcileGithubRelease({ tag, assetsDir, notes, prerelease = false }, { ghRun = gh } = {}) {
  const expected = assets(assetsDir);
  const existing = ghRun(['release', 'view', tag, '--json', 'isDraft'], { tolerate: true });
  if (releaseIsMissing(existing)) ghRun(['release', 'create', tag, '--verify-tag', '--draft', `--prerelease=${prerelease}`, '--notes-file', notes, '--title', `nova-plugin ${tag}`]);
  else if (existing.status !== 0) throw new Error(failureMessage(existing, `unable to inspect release ${tag}`));
  else if (JSON.parse(existing.stdout).isDraft !== true) throw new Error(`release ${tag} already exists and is not a draft`);

  const download = mkdtempSync(resolve(tmpdir(), 'nova-release-assets-'));
  try {
    const downloaded = ghRun(['release', 'download', tag, '--dir', download], { tolerate: true });
    if (downloaded.status !== 0 && !releaseHasNoAssets(downloaded)) {
      throw new Error(failureMessage(downloaded, `unable to inspect release assets for ${tag}`));
    }
    const actual = assets(download);
    const plan = reconcileReleaseAssets(expected, actual);
    if (!plan.publishable) throw new Error(`release asset conflict requires quarantine: ${plan.quarantine.map((entry) => entry.actual?.name).join(', ')}`);
    if (plan.upload.length) ghRun(['release', 'upload', tag, ...plan.upload.map((asset) => asset.path)]);
    rmSync(download, { recursive: true, force: true });
    const verify = mkdtempSync(resolve(tmpdir(), 'nova-release-assets-verify-'));
    try {
      ghRun(['release', 'download', tag, '--dir', verify]);
      const verified = reconcileReleaseAssets(expected, assets(verify));
      if (!verified.publishable || verified.upload.length || verified.reuse.length !== expected.length) throw new Error('downloaded release asset inventory differs before publication');
    } finally { rmSync(verify, { recursive: true, force: true }); }
    ghRun(['release', 'edit', tag, '--draft=false', `--prerelease=${prerelease}`]);
    return { uploaded: plan.upload.map((asset) => asset.name), reused: plan.reuse.map((asset) => asset.name), published: true };
  } finally { rmSync(download, { recursive: true, force: true }); }
}

export function main(args = process.argv.slice(2)) {
  try {
    const options = { tag: null, assetsDir: null, notes: null };
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      const value = () => requireOptionValue(args, index, arg);
      if (arg === '--prerelease') { options.prerelease = true; continue; }
      if (arg === '--tag') options.tag = value();
      else if (arg === '--assets-dir') options.assetsDir = resolve(value());
      else if (arg === '--notes') options.notes = resolve(value());
      else throw new Error(`unknown argument: ${arg}`);
      index += 1;
    }
    if (!options.tag || !options.assetsDir || !options.notes) throw new Error('--tag, --assets-dir, and --notes are required');
    console.log(JSON.stringify(reconcileGithubRelease(options), null, 2));
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
