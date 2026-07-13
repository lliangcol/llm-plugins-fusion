#!/usr/bin/env node
/** Build a content-addressed release control bundle and complete source manifest. */

import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deterministicTar } from './build-release-artifacts.mjs';
import { parseTarEntries } from './lib/safe-tar.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [
  'scripts/build-candidate-bundle.mjs',
  'scripts/build-release-artifacts.mjs',
  'scripts/extract-release-bundle.mjs',
  'scripts/generate-release-candidate.mjs',
  'scripts/reconcile-github-release.mjs',
  'scripts/verify-release-promotion.mjs',
  'scripts/verify-stable-install.mjs',
  'scripts/release-orchestrator.mjs',
];
const explicit = [
  'schemas/release-candidate.schema.json',
  'schemas/promotion-intent.schema.json',
  'schemas/release-event.schema.json',
  'schemas/release-ledger.schema.json',
  'schemas/control-bundle.schema.json',
  'workflow-specs/framework.json',
  'workflow-specs/nova.product.json',
  'workflow-specs/workflows.json',
  'workflow-specs/behaviors.json',
  'tests/integration/release-candidate.test.mjs',
  'tests/unit/release-artifacts.test.mjs',
  'tests/unit/release-state-machine.test.mjs',
  'tests/unit/release-ledger.test.mjs',
  'tests/integration/release-recovery.test.mjs',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function verifyControlBundle({ bundlePath, manifest }) {
  const archive = readFileSync(bundlePath);
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.files)) throw new Error('release control bundle manifest is invalid');
  if (sha256(archive) !== manifest.bundleSha256) throw new Error('release control bundle digest differs from its manifest');
  const actualFiles = parseTarEntries(gunzipSync(archive))
    .filter((entry) => entry.type === 'file')
    .map((entry) => ({ path: entry.path, sha256: sha256(entry.content), bytes: entry.content.length }))
    .sort((left, right) => left.path.localeCompare(right.path));
  if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.files)) {
    throw new Error('release control bundle file inventory differs from its manifest');
  }
  return { bundleSha256: manifest.bundleSha256, files: actualFiles.length };
}

function importClosure(entries) {
  const pending = [...entries];
  const seen = new Set();
  while (pending.length) {
    const rel = pending.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (extname(rel) !== '.mjs') continue;
    const source = readFileSync(resolve(root, rel), 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/gu)) {
      const imported = resolve(dirname(resolve(root, rel)), match[1]);
      const importedRel = relative(root, imported).replaceAll('\\', '/');
      if (importedRel.startsWith('..')) throw new Error(`control import escapes repository: ${rel}`);
      pending.push(importedRel);
    }
  }
  return [...seen].sort();
}

export function buildReleaseControlBundle({ outDir = resolve(root, '.metrics/release-control') } = {}) {
  const paths = [...new Set([...importClosure(roots), ...explicit])].sort();
  const staging = mkdtempSync(resolve(tmpdir(), 'nova-release-control-'));
  try {
    const files = paths.map((path) => {
      const source = resolve(root, path);
      const target = resolve(staging, path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
      const content = readFileSync(source);
      return { path, sha256: sha256(content), bytes: content.length };
    });
    const archive = gzipSync(deterministicTar(staging), { level: 9, mtime: 0 });
    mkdirSync(outDir, { recursive: true });
    const bundlePath = resolve(outDir, 'release-control-bundle.tar.gz');
    writeFileSync(bundlePath, archive);
    const manifest = { schemaVersion: 1, files, bundleSha256: sha256(archive) };
    const manifestPath = resolve(outDir, 'release-control-bundle.manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    if (statSync(bundlePath).size === 0) throw new Error('release control bundle is empty');
    verifyControlBundle({ bundlePath, manifest });
    return { bundlePath, manifestPath, manifest };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export function main() {
  try {
    const result = buildReleaseControlBundle();
    console.log(`Wrote ${relative(root, result.bundlePath)}`);
    console.log(`Wrote ${relative(root, result.manifestPath)}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
