#!/usr/bin/env node
/** Build a deterministic plugin archive, manifest, build SBOM, runtime BOM, and build record. */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeManifest } from './validate-plugin-install.mjs';
import { assertNodeVersion } from './lib/node-version.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

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
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  const split = path.lastIndexOf('/');
  if (split <= 0) throw new Error(`release archive path is too long: ${path}`);
  const prefix = path.slice(0, split);
  const name = path.slice(split + 1);
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

function gitValue(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

/** @param {{root?: string, outDir?: string, now?: () => Date, env?: NodeJS.ProcessEnv}} [options] */
export function buildReleaseArtifacts({ root = defaultRoot, outDir = '.metrics/release-artifacts', now, env = process.env } = {}) {
  const sourceEpoch = Number(env.SOURCE_DATE_EPOCH);
  const commitTimestamp = gitValue(root, ['show', '-s', '--format=%cI', 'HEAD']);
  const buildTimestamp = Number.isFinite(sourceEpoch)
    ? new Date(sourceEpoch * 1000)
    : new Date(commitTimestamp === 'unknown' ? 0 : commitTimestamp);
  const clock = now ?? (() => buildTimestamp);
  const pluginRoot = resolve(root, 'nova-plugin');
  const plugin = JSON.parse(readFileSync(resolve(pluginRoot, '.claude-plugin/plugin.json'), 'utf8'));
  const { knownGoodClaudeCli } = loadNovaWorkflowModel(root);
  const packageLock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const outputRoot = resolve(root, outDir);
  mkdirSync(outputRoot, { recursive: true });
  const archiveName = `nova-plugin-${plugin.version}.tar.gz`;
  const archive = gzipSync(deterministicTar(pluginRoot), deterministicGzipOptions);
  const archivePath = resolve(outputRoot, archiveName);
  writeFileSync(archivePath, archive);
  const manifest = treeManifest(pluginRoot);
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
      const name = path.slice('node_modules/'.length);
      return {
        type: 'library',
        name,
        version: data.version,
        'bom-ref': `pkg:npm/${name}@${data.version}`,
        purl: `pkg:npm/${name}@${data.version}`,
        scope: 'required',
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
      component: { type: 'application', name: 'llm-plugins-fusion-build', version: plugin.version, 'bom-ref': `build:llm-plugins-fusion@${plugin.version}` },
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
      { type: 'platform', name: 'Node.js', version: '>=22', 'bom-ref': 'runtime:node>=22', properties: [{ name: 'nova:known-good', value: process.version }] },
      { type: 'application', name: 'Bash', version: '>=3.2', 'bom-ref': 'runtime:bash>=3.2' },
      { type: 'application', name: 'Claude Code', version: knownGoodClaudeCli, 'bom-ref': 'host:claude-code' },
      { type: 'application', name: 'Codex', version: env.CODEX_VERSION ?? 'not-release-bound', 'bom-ref': 'external:codex' },
    ],
    dependencies: [{ ref: `pkg:generic/nova-plugin@${plugin.version}`, dependsOn: ['runtime:node>=22', 'runtime:bash>=3.2', 'host:claude-code', 'external:codex'] }],
  };
  const runtimeCapabilitiesPath = resolve(outputRoot, 'runtime-capabilities.cdx.json');
  writeFileSync(runtimeCapabilitiesPath, `${JSON.stringify(runtimeCapabilities, null, 2)}\n`, 'utf8');

  const commit = env.RELEASE_COMMIT ?? gitValue(root, ['rev-parse', 'HEAD']);
  const tag = env.RELEASE_TAG ?? gitValue(root, ['describe', '--tags', '--exact-match', 'HEAD']);
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
    nodeVersion: process.version,
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
