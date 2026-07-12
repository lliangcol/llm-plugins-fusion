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

test('release archive and CycloneDX evidence are deterministic', async (t) => {
  const first = await mkdtemp(join(tmpdir(), 'nova-release-artifacts-'));
  const second = await mkdtemp(join(tmpdir(), 'nova-release-artifacts-'));
  t.after(() => Promise.all([rm(first, { recursive: true, force: true }), rm(second, { recursive: true, force: true })]));
  const now = () => new Date('2026-07-12T00:00:00Z');
  const left = buildReleaseArtifacts({ outDir: first, now });
  const right = buildReleaseArtifacts({ outDir: second, now });
  assert.equal(left.archiveSha256, right.archiveSha256);
  assert.deepEqual(deterministicTar(new URL('../../nova-plugin', import.meta.url).pathname), deterministicTar(new URL('../../nova-plugin', import.meta.url).pathname));
  const sbom = JSON.parse(await readFile(left.sbomPath, 'utf8'));
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.metadata.component.hashes[0].content, left.archiveSha256);
  assert.equal(sbom.components.length, 3);
  assert.equal(sbom.dependencies[0].dependsOn.length, 3);
  const provenance = JSON.parse(await readFile(left.provenancePath, 'utf8'));
  assert.equal(provenance._type, 'https://in-toto.io/Statement/v1');
  assert.equal(provenance.predicateType, 'https://slsa.dev/provenance/v1');
  assert.equal(provenance.subject[0].digest.sha256, left.archiveSha256);
  assert.equal(provenance.predicate.runDetails.byproducts[0].name, 'tree-manifest-v2');
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
    sbomPath: '/tmp/archive.cdx.json',
    provenancePath: '/tmp/archive.provenance.json',
  };
  assert.equal(main({ build: () => result, log: (line) => output.push(line) }), 0);
  assert.equal(output.length, 3);
  const errors = [];
  assert.equal(main({ build: () => { throw new Error('boom'); }, errorLog: (line) => errors.push(line) }), 1);
  assert.deepEqual(errors, ['ERROR boom']);
});
