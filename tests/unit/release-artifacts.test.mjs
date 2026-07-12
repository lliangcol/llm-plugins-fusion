import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  buildReleaseArtifacts,
  deterministicTar,
  main,
  tarPath,
} from '../../scripts/build-release-artifacts.mjs';
import { resolveFromModule } from '../../scripts/lib/repo-root.mjs';

test('release archive, manifest, build SBOM, runtime BOM, and build record are deterministic', async (t) => {
  const first = await mkdtemp(join(tmpdir(), 'nova-release-artifacts-'));
  const second = await mkdtemp(join(tmpdir(), 'nova-release-artifacts-'));
  t.after(() => Promise.all([rm(first, { recursive: true, force: true }), rm(second, { recursive: true, force: true })]));
  const now = () => new Date('2026-07-12T00:00:00Z');
  const left = buildReleaseArtifacts({ outDir: first, now });
  const right = buildReleaseArtifacts({ outDir: second, now });
  assert.equal(left.archiveSha256, right.archiveSha256);
  const pluginRoot = resolveFromModule(import.meta.url, '../../nova-plugin');
  assert.deepEqual(deterministicTar(pluginRoot), deterministicTar(pluginRoot));
  const sbom = JSON.parse(await readFile(left.buildSbomPath, 'utf8'));
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.specVersion, '1.7');
  assert.ok(sbom.components.some((component) => component.name === 'ajv'));
  const runtime = JSON.parse(await readFile(left.runtimeCapabilitiesPath, 'utf8'));
  assert.equal(runtime.metadata.component.hashes[0].content, left.archiveSha256);
  assert.equal(runtime.components.length, 4);
  const manifest = JSON.parse(await readFile(left.artifactManifestPath, 'utf8'));
  assert.equal(manifest.archive.sha256, left.archiveSha256);
  const buildRecord = JSON.parse(await readFile(left.buildRecordPath, 'utf8'));
  assert.equal(buildRecord.subject.sha256, left.archiveSha256);
  assert.match(buildRecord.workflow.sha256, /^[a-f0-9]{64}$/u);

  const recoveryDir = await mkdtemp(join(tmpdir(), 'nova-release-artifacts-'));
  t.after(() => rm(recoveryDir, { recursive: true, force: true }));
  const recovery = buildReleaseArtifacts({
    outDir: recoveryDir,
    now,
    env: {
      GITHUB_REF_NAME: 'main',
      GITHUB_SHA: 'b'.repeat(40),
      RELEASE_TAG: 'v3.2.0-rc.3',
      RELEASE_COMMIT: 'a'.repeat(40),
    },
  });
  const recoveryRecord = JSON.parse(await readFile(recovery.buildRecordPath, 'utf8'));
  assert.equal(recoveryRecord.candidateTag, 'v3.2.0-rc.3');
  assert.equal(recoveryRecord.sourceCommit, 'a'.repeat(40));
});

test('release artifact helpers cover long archive paths and CLI outcomes', () => {
  assert.deepEqual(tarPath('short/file.txt'), { name: 'short/file.txt', prefix: '' });
  const prefix = 'nested/'.repeat(15).slice(0, -1);
  const longPath = `${prefix}/file.txt`;
  assert.ok(Buffer.byteLength(longPath) > 100);
  assert.deepEqual(tarPath(longPath), { name: 'file.txt', prefix });
  assert.throws(() => tarPath('x'.repeat(101)), /path is too long/);
  assert.throws(() => tarPath(`${'p'.repeat(156)}/file.txt`), /path is too long/);

  const output = [];
  const result = {
    archivePath: '/tmp/archive.tar.gz',
    artifactManifestPath: '/tmp/artifact-manifest.json',
    buildSbomPath: '/tmp/build-sbom.cdx.json',
    runtimeCapabilitiesPath: '/tmp/runtime-capabilities.cdx.json',
    buildRecordPath: '/tmp/nova-build-record.json',
  };
  assert.equal(main({ build: () => result, log: (line) => output.push(line) }), 0);
  assert.equal(output.length, 5);
  const errors = [];
  assert.equal(main({ build: () => { throw new Error('boom'); }, errorLog: (line) => errors.push(line) }), 1);
  assert.deepEqual(errors, ['ERROR boom']);
});
