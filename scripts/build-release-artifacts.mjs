#!/usr/bin/env node
/** Build a deterministic plugin archive, CycloneDX SBOM, and provenance statement. */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { treeManifest } from './validate-plugin-install.mjs';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'release artifact build' });

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');

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

function tarPath(path) {
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
  if (entry.type === 'symlink') writeString(header, 157, 100, entry.target);
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

export function buildReleaseArtifacts({ root = defaultRoot, outDir = '.metrics/release-artifacts', now = () => new Date(0) } = {}) {
  const pluginRoot = resolve(root, 'nova-plugin');
  const plugin = JSON.parse(readFileSync(resolve(pluginRoot, '.claude-plugin/plugin.json'), 'utf8'));
  const workflows = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.json'), 'utf8'));
  const outputRoot = resolve(root, outDir);
  mkdirSync(outputRoot, { recursive: true });
  const archiveName = `nova-plugin-${plugin.version}.tar.gz`;
  const archive = gzipSync(deterministicTar(pluginRoot), { level: 9, mtime: 0 });
  const archivePath = resolve(outputRoot, archiveName);
  writeFileSync(archivePath, archive);
  const manifest = treeManifest(pluginRoot);
  const manifestSha256 = sha256(JSON.stringify(manifest));
  const archiveSha256 = sha256(archive);
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${archiveSha256.slice(0, 8)}-${archiveSha256.slice(8, 12)}-${archiveSha256.slice(12, 16)}-${archiveSha256.slice(16, 20)}-${archiveSha256.slice(20, 32)}`,
    version: 1,
    metadata: {
      timestamp: now().toISOString(),
      component: {
        type: 'application',
        name: 'nova-plugin',
        version: plugin.version,
        'bom-ref': `pkg:generic/nova-plugin@${plugin.version}`,
        hashes: [{ alg: 'SHA-256', content: archiveSha256 }],
      },
    },
    components: [
      {
        type: 'platform',
        name: 'Node.js',
        version: '>=22',
        'bom-ref': 'runtime:node>=22',
        scope: 'required',
        properties: [{ name: 'nova:purpose', value: 'hook and validation runtime' }],
      },
      {
        type: 'application',
        name: 'Bash',
        version: '>=3.2',
        'bom-ref': 'runtime:bash>=3.2',
        scope: 'required',
        properties: [{ name: 'nova:purpose', value: 'fail-closed launcher and Codex helpers' }],
      },
      {
        type: 'application',
        name: 'Claude Code',
        version: workflows.knownGoodClaudeCli,
        'bom-ref': 'host:claude-code',
        scope: 'required',
        properties: [{ name: 'nova:purpose', value: 'plugin host; exact compatible version is release-evidence-bound' }],
      },
    ],
    dependencies: [
      { ref: `pkg:generic/nova-plugin@${plugin.version}`, dependsOn: ['runtime:node>=22', 'runtime:bash>=3.2', 'host:claude-code'] },
      { ref: 'runtime:node>=22', dependsOn: [] },
      { ref: 'runtime:bash>=3.2', dependsOn: [] },
      { ref: 'host:claude-code', dependsOn: [] },
    ],
  };
  const sbomPath = resolve(outputRoot, `${archiveName}.cdx.json`);
  writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');
  const commit = process.env.GITHUB_SHA ?? gitValue(root, ['rev-parse', 'HEAD']);
  const tag = process.env.GITHUB_REF_NAME ?? gitValue(root, ['describe', '--tags', '--exact-match', 'HEAD']);
  const provenance = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: archiveName, digest: { sha256: archiveSha256 } }],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://github.com/lliangcol/llm-plugins-fusion/build-types/nova-plugin-release/v1',
        externalParameters: { pluginVersion: plugin.version, tag },
        internalParameters: { node: process.version, deterministicTarVersion: 1 },
        resolvedDependencies: [{ uri: 'git+https://github.com/lliangcol/llm-plugins-fusion', digest: { gitCommit: commit } }],
      },
      runDetails: {
        builder: { id: 'https://github.com/lliangcol/llm-plugins-fusion/.github/workflows/release-candidate.yml' },
        metadata: { invocationId: `${commit}:${tag}`, startedOn: now().toISOString(), finishedOn: now().toISOString() },
        byproducts: [{ name: 'tree-manifest-v2', digest: { sha256: manifestSha256 }, entries: manifest.length }],
      },
    },
  };
  const provenancePath = resolve(outputRoot, `${archiveName}.provenance.json`);
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
  return { archivePath, sbomPath, provenancePath, archiveSha256, manifestSha256 };
}

function main() {
  try {
    const result = buildReleaseArtifacts();
    for (const path of [result.archivePath, result.sbomPath, result.provenancePath]) {
      console.log(`Wrote ${relative(defaultRoot, path).replaceAll('\\', '/')}`);
    }
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
