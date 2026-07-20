#!/usr/bin/env node
/** Build a deterministic plugin archive, manifest, build SBOM, runtime BOM, and build record. */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeManifest } from './validate-plugin-install.mjs';
import { assertNodeVersion } from './lib/node-version.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';
import {
  assertPortableRelativePath,
  comparePortablePaths,
  portablePathCollisionKey,
  portableRelativeFromRoot,
} from './lib/portable-path.mjs';
import {
  createPhysicalReadBoundary,
  readPhysicalDirectory,
  readPhysicalFile,
} from './lib/physical-read-boundary.mjs';
import { parseTarGzEntries } from './lib/safe-tar.mjs';
import { gitCommitTimestamp, gitExactTag, gitHead } from './lib/git-source-snapshot.mjs';

assertNodeVersion({ label: 'release artifact build' });

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const deterministicGzipOptions = /** @type {import('node:zlib').ZlibOptions} */ ({ level: 9, mtime: 0 });

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeString(buffer, offset, length, value) {
  buffer.write(String(value), offset, Math.min(length, Buffer.byteLength(String(value))), 'utf8');
}

function writeOctal(buffer, offset, length, value) {
  const text = Math.trunc(value).toString(8).padStart(length - 1, '0');
  writeString(buffer, offset, length, `${text}\0`);
}

export function tarPath(path) {
  const directorySuffix = path.endsWith('/') ? '/' : '';
  const portablePath = directorySuffix ? path.slice(0, -1) : path;
  assertPortableRelativePath(portablePath, 'release archive path');
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  const split = portablePath.lastIndexOf('/');
  if (split <= 0) throw new Error(`release archive path is too long: ${path}`);
  const prefix = portablePath.slice(0, split);
  const name = `${portablePath.slice(split + 1)}${directorySuffix}`;
  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) {
    throw new Error(`release archive path is too long: ${path}`);
  }
  return { name, prefix };
}

function tarHeader(entry, size) {
  const header = Buffer.alloc(512);
  const archivePath = entry.type === 'directory' ? `${entry.path}/` : entry.path;
  const { name, prefix } = tarPath(archivePath);
  writeString(header, 0, 100, name);
  writeOctal(header, 100, 8, Number.parseInt(entry.mode.slice(-3), 8));
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  writeString(header, 156, 1, entry.type === 'directory' ? '5' : (entry.type === 'symlink' ? '2' : '0'));
  if (entry.type === 'symlink') {
    if (Buffer.byteLength(entry.target, 'utf8') > 100) throw new Error(`release archive symlink target is too long: ${entry.path}`);
    writeString(header, 157, 100, entry.target);
  }
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  writeString(header, 345, 155, prefix);
  const checksum = header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0');
  writeString(header, 148, 8, `${checksum}\0 `);
  return header;
}

export function deterministicTar(pluginRoot) {
  const chunks = [];
  for (const entry of treeManifest(pluginRoot)) {
    const content = entry.type === 'file' ? readFileSync(resolve(pluginRoot, entry.path)) : Buffer.alloc(0);
    chunks.push(tarHeader(entry, content.length));
    if (content.length > 0) {
      chunks.push(content);
      const remainder = content.length % 512;
      if (remainder) chunks.push(Buffer.alloc(512 - remainder));
    }
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function snapshotManifestEntry(entry) {
  if (entry.type === 'directory') return { path: entry.path, type: entry.type, mode: entry.mode };
  return {
    path: entry.path,
    type: entry.type,
    mode: entry.mode,
    bytes: entry.content.length,
    sha256: sha256(entry.content),
  };
}

function snapshotDirectoryMode(path, label) {
  const before = lstatSync(path);
  if (before.isSymbolicLink() || !before.isDirectory()) {
    throw new Error(`${label} must be a physical directory, not a symlink or junction`);
  }
  return {
    identity: `${before.dev}:${before.ino}`,
    mode: `040${(before.mode & 0o777).toString(8).padStart(3, '0')}`,
  };
}

function capturePluginTreeOnce(pluginRoot, boundary, current = pluginRoot) {
  const entries = [];
  const currentLabel = current === pluginRoot
    ? '.'
    : portableRelativeFromRoot(pluginRoot, current, 'release plugin directory');
  const names = readPhysicalDirectory(boundary, current, `release plugin directory ${currentLabel}`);
  for (const name of names) {
    const path = resolve(current, name);
    const relativePath = portableRelativeFromRoot(pluginRoot, path, 'release plugin snapshot path');
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`release plugin snapshot ${relativePath} must not be a symlink or junction`);
    if (stat.isDirectory()) {
      const before = snapshotDirectoryMode(path, `release plugin snapshot ${relativePath}`);
      readPhysicalDirectory(boundary, path, `release plugin snapshot ${relativePath}`);
      const after = snapshotDirectoryMode(path, `release plugin snapshot ${relativePath}`);
      if (before.identity !== after.identity || before.mode !== after.mode) {
        throw new Error(`release plugin snapshot ${relativePath} changed identity or mode while it was read`);
      }
      entries.push({ path: relativePath, type: 'directory', mode: after.mode, content: Buffer.alloc(0) });
      entries.push(...capturePluginTreeOnce(pluginRoot, boundary, path));
    } else if (stat.isFile()) {
      const file = readPhysicalFile(boundary, path, `release plugin snapshot ${relativePath}`);
      entries.push({
        path: relativePath,
        type: 'file',
        mode: `100${file.mode.toString(8).padStart(3, '0')}`,
        content: file.buffer,
      });
    } else {
      throw new Error(`release plugin snapshot contains an unsupported entry: ${relativePath}`);
    }
  }
  return entries;
}

function validateSnapshotPaths(entries) {
  const collisionKeys = new Map();
  for (const entry of entries) {
    assertPortableRelativePath(entry.path, 'release plugin snapshot path');
    const key = portablePathCollisionKey(entry.path);
    const existing = collisionKeys.get(key);
    if (existing && existing !== entry.path) {
      throw new Error(`release plugin snapshot contains a normalized case collision: ${existing} and ${entry.path}`);
    }
    collisionKeys.set(key, entry.path);
  }
}

/** Capture a stable, physical, link-free plugin tree once for all release outputs. */
export function capturePluginTreeSnapshot(pluginRoot) {
  const boundary = createPhysicalReadBoundary(pluginRoot, 'release plugin root');
  const first = capturePluginTreeOnce(pluginRoot, boundary).sort((left, right) => comparePortablePaths(left.path, right.path));
  const second = capturePluginTreeOnce(pluginRoot, boundary).sort((left, right) => comparePortablePaths(left.path, right.path));
  validateSnapshotPaths(second);
  const firstManifest = first.map(snapshotManifestEntry);
  const manifest = second.map(snapshotManifestEntry);
  if (JSON.stringify(firstManifest) !== JSON.stringify(manifest)) {
    throw new Error('release plugin tree changed while its protected snapshot was captured');
  }
  return { entries: second, manifest };
}

/** Render an archive exclusively from already-captured bytes. */
export function deterministicTarFromSnapshot(snapshot) {
  const chunks = [];
  for (const entry of snapshot.entries) {
    chunks.push(tarHeader(entry, entry.content.length));
    if (entry.content.length > 0) {
      chunks.push(entry.content);
      const remainder = entry.content.length % 512;
      if (remainder) chunks.push(Buffer.alloc(512 - remainder));
    }
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

/** Reparse the final gzip archive and prove that it contains the captured snapshot exactly. */
export function verifyArchiveSnapshot(archive, snapshot) {
  const archiveManifest = parseTarGzEntries(archive).map((entry) => {
    const mode = `${entry.type === 'directory' ? '040' : '100'}${(entry.mode & 0o777).toString(8).padStart(3, '0')}`;
    return entry.type === 'directory'
      ? { path: entry.path, type: entry.type, mode }
      : { path: entry.path, type: entry.type, mode, bytes: entry.content.length, sha256: sha256(entry.content) };
  });
  if (JSON.stringify(archiveManifest) !== JSON.stringify(snapshot.manifest)) {
    throw new Error('release archive contents differ from the protected plugin snapshot');
  }
  return archiveManifest;
}

export function npmPackagePurl(name, version) {
  if (name.startsWith('@')) {
    const separator = name.indexOf('/');
    if (separator <= 1 || separator === name.length - 1) throw new Error(`invalid scoped npm package name: ${name}`);
    return `pkg:npm/${encodeURIComponent(name.slice(0, separator))}/${encodeURIComponent(name.slice(separator + 1))}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

export function npmPackageNameFromLockPath(path) {
  const marker = 'node_modules/';
  const index = path.lastIndexOf(marker);
  if (index < 0) throw new Error(`npm lock package path is not under node_modules: ${path}`);
  const name = path.slice(index + marker.length);
  if (!name || (!name.startsWith('@') && name.includes('/')) || (name.startsWith('@') && name.split('/').length !== 2)) {
    throw new Error(`npm lock package path has an invalid package name: ${path}`);
  }
  return name;
}

/** @param {{root?: string, outDir?: string, now?: () => Date, env?: NodeJS.ProcessEnv, runtimeNodeVersion?: string}} [options] */
export function buildReleaseArtifacts({ root = defaultRoot, outDir = '.metrics/release-artifacts', now, env = process.env, runtimeNodeVersion = process.version } = {}) {
  const sourceEpoch = Number(env.SOURCE_DATE_EPOCH);
  const commitTimestamp = gitCommitTimestamp(root);
  const buildTimestamp = Number.isFinite(sourceEpoch)
    ? new Date(sourceEpoch * 1000)
    : new Date(commitTimestamp === 'unknown' ? 0 : commitTimestamp);
  const clock = now ?? (() => buildTimestamp);
  const pluginRoot = resolve(root, 'nova-plugin');
  const pluginSnapshot = capturePluginTreeSnapshot(pluginRoot);
  const pluginMetadata = pluginSnapshot.entries.find((entry) => entry.path === '.claude-plugin/plugin.json' && entry.type === 'file');
  if (!pluginMetadata) throw new Error('release plugin snapshot is missing .claude-plugin/plugin.json');
  const plugin = JSON.parse(pluginMetadata.content.toString('utf8'));
  const { knownGoodClaudeCli } = loadNovaWorkflowModel(root);
  const packageLock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const outputRoot = resolve(root, outDir);
  mkdirSync(outputRoot, { recursive: true });
  const archiveName = `nova-plugin-${plugin.version}.tar.gz`;
  const archive = gzipSync(deterministicTarFromSnapshot(pluginSnapshot), deterministicGzipOptions);
  verifyArchiveSnapshot(archive, pluginSnapshot);
  const archivePath = resolve(outputRoot, archiveName);
  writeFileSync(archivePath, archive);
  const manifest = pluginSnapshot.manifest;
  const manifestSha256 = sha256(JSON.stringify(manifest));
  const archiveSha256 = sha256(archive);
  const artifactManifest = {
    schemaVersion: 1,
    archive: { name: archiveName, sha256: archiveSha256, bytes: archive.length },
    pluginTree: { manifestVersion: 2, sha256: manifestSha256, entries: manifest },
  };
  const artifactManifestPath = resolve(outputRoot, 'artifact-manifest.json');
  writeFileSync(artifactManifestPath, `${JSON.stringify(artifactManifest, null, 2)}\n`, 'utf8');

  const buildComponents = Object.entries(packageLock.packages ?? {})
    .filter(([path, data]) => path.startsWith('node_modules/') && data.version)
    .map(([path, data]) => {
      const name = npmPackageNameFromLockPath(path);
      const purl = npmPackagePurl(name, data.version);
      return {
        type: 'library',
        name,
        version: data.version,
        'bom-ref': purl,
        purl,
        scope: data.optional ? 'optional' : 'required',
        ...(data.license ? { licenses: [{ license: { id: data.license } }] } : {}),
      };
    });
  const buildSbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.7',
    serialNumber: `urn:uuid:${archiveSha256.slice(0, 8)}-${archiveSha256.slice(8, 12)}-${archiveSha256.slice(12, 16)}-${archiveSha256.slice(16, 20)}-${archiveSha256.slice(20, 32)}`,
    version: 1,
    metadata: {
      timestamp: clock().toISOString(),
      component: {
        type: 'application',
        name: 'llm-plugins-fusion-build',
        version: plugin.version,
        'bom-ref': `build:llm-plugins-fusion@${plugin.version}`,
        hashes: [{ alg: 'SHA-256', content: archiveSha256 }],
      },
    },
    components: buildComponents,
    dependencies: [
      { ref: `build:llm-plugins-fusion@${plugin.version}`, dependsOn: buildComponents.map((component) => component['bom-ref']) },
      ...buildComponents.map((component) => ({ ref: component['bom-ref'], dependsOn: [] })),
    ],
    compositions: [{ aggregate: 'complete', assemblies: [`build:llm-plugins-fusion@${plugin.version}`] }],
    formulation: [{ components: buildComponents }],
  };
  const buildSbomPath = resolve(outputRoot, 'build-sbom.cdx.json');
  writeFileSync(buildSbomPath, `${JSON.stringify(buildSbom, null, 2)}\n`, 'utf8');

  const runtimeCapabilities = {
    bomFormat: 'CycloneDX', specVersion: '1.7', version: 1,
    metadata: { timestamp: clock().toISOString(), component: { type: 'application', name: 'nova-plugin', version: plugin.version, 'bom-ref': `pkg:generic/nova-plugin@${plugin.version}`, hashes: [{ alg: 'SHA-256', content: archiveSha256 }] } },
    components: [
      { type: 'platform', name: 'Node.js', version: '>=22', 'bom-ref': 'runtime:node>=22', properties: [{ name: 'nova:known-good', value: runtimeNodeVersion }] },
      { type: 'application', name: 'Bash', version: '>=3.2', 'bom-ref': 'runtime:bash>=3.2' },
      { type: 'application', name: 'Claude Code', version: knownGoodClaudeCli, 'bom-ref': 'host:claude-code' },
      { type: 'application', name: 'Codex', version: env.CODEX_VERSION ?? 'not-release-bound', 'bom-ref': 'external:codex' },
    ],
    dependencies: [{ ref: `pkg:generic/nova-plugin@${plugin.version}`, dependsOn: ['runtime:node>=22', 'runtime:bash>=3.2', 'host:claude-code', 'external:codex'] }],
  };
  const runtimeCapabilitiesPath = resolve(outputRoot, 'runtime-capabilities.cdx.json');
  writeFileSync(runtimeCapabilitiesPath, `${JSON.stringify(runtimeCapabilities, null, 2)}\n`, 'utf8');

  const commit = env.RELEASE_COMMIT ?? gitHead(root);
  const tag = env.RELEASE_TAG ?? gitExactTag(root) ?? 'unknown';
  const startedOn = clock().toISOString();
  const buildRecord = {
    schemaVersion: 1,
    subject: { name: archiveName, sha256: archiveSha256 },
    sourceCommit: commit,
    candidateTag: tag,
    promotionIntentSha256: env.PROMOTION_INTENT_SHA256 ?? null,
    workflow: { path: '.github/workflows/release-candidate.yml', sha256: sha256(readFileSync(resolve(root, '.github/workflows/release-candidate.yml'))) },
    controlBundleSha256: env.RELEASE_CONTROL_BUNDLE_SHA256 ?? null,
    githubRunId: env.GITHUB_RUN_ID ?? null,
    startedOn,
    finishedOn: clock().toISOString(),
    runnerImage: env.ImageOS ?? env.RUNNER_OS ?? 'local',
    nodeVersion: runtimeNodeVersion,
    actionShas: env.NOVA_ACTION_SHAS ? JSON.parse(env.NOVA_ACTION_SHAS) : {},
    npmTarballIntegrity: env.CLAUDE_NPM_INTEGRITY ?? null,
    artifactManifestSha256: sha256(readFileSync(artifactManifestPath)),
  };
  const buildRecordPath = resolve(outputRoot, 'nova-build-record.json');
  writeFileSync(buildRecordPath, `${JSON.stringify(buildRecord, null, 2)}\n`, 'utf8');
  return { archivePath, artifactManifestPath, buildSbomPath, runtimeCapabilitiesPath, buildRecordPath, archiveSha256, manifestSha256 };
}

export function main({ build = buildReleaseArtifacts, log = console.log, errorLog = console.error } = {}) {
  try {
    const result = build();
    for (const path of [result.archivePath, result.artifactManifestPath, result.buildSbomPath, result.runtimeCapabilitiesPath, result.buildRecordPath]) {
      log(`Wrote ${relative(defaultRoot, path).replaceAll('\\', '/')}`);
    }
    return 0;
  } catch (error) {
    errorLog(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
