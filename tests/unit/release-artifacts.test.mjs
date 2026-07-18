import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  buildReleaseArtifacts,
  capturePluginTreeSnapshot,
  deterministicTar,
  deterministicTarFromSnapshot,
  main,
  npmPackageNameFromLockPath,
  npmPackagePurl,
  tarPath,
  verifyArchiveSnapshot,
} from '../../scripts/build-release-artifacts.mjs';
import { parseTarGzEntries } from '../../scripts/lib/safe-tar.mjs';
import {
  releaseArtifactNames,
  releaseChecksumPaths,
  releaseChecksumSourcePaths,
} from '../../scripts/lib/release-checksum-contract.mjs';
import { resolveFromModule } from '../../scripts/lib/repo-root.mjs';
import {
  generateReleaseChecksums,
  main as checksumMain,
  parseArgs as parseChecksumArgs,
} from '../../scripts/generate-release-checksums.mjs';

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
  assert.deepEqual(sbom.metadata.component.hashes, [{ alg: 'SHA-256', content: left.archiveSha256 }]);
  assert.ok(sbom.components.some((component) => component.name === 'ajv'));
  const nodeTypes = sbom.components.find((component) => component.name === '@types/node');
  assert.equal(nodeTypes.purl, `pkg:npm/%40types/node@${nodeTypes.version}`);
  assert.equal(nodeTypes.scope, 'required');
  assert.equal(sbom.components.find((component) => component.name === '@typescript/typescript-aix-ppc64').scope, 'optional');
  assert.equal(sbom.components.find((component) => component.name === 'ajv').scope, 'required');
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
  assert.deepEqual(releaseArtifactNames('4.1.0'), [
    'nova-plugin-4.1.0.tar.gz',
    'artifact-manifest.json',
    'build-sbom.cdx.json',
    'runtime-capabilities.cdx.json',
    'nova-build-record.json',
  ]);
  assert.equal(releaseChecksumPaths('4.1.0').length, 10);
  for (const version of [undefined, '4.1.0-rc.1', '4.01.0']) {
    assert.throws(() => releaseArtifactNames(version), /stable SemVer/u);
  }
  assert.equal(npmPackageNameFromLockPath('node_modules/ajv'), 'ajv');
  assert.equal(npmPackageNameFromLockPath('node_modules/parent/node_modules/@scope/child'), '@scope/child');
  assert.throws(() => npmPackageNameFromLockPath('packages/not-a-lock-entry'), /not under node_modules/u);
  assert.equal(npmPackagePurl('ajv', '8.17.1'), 'pkg:npm/ajv@8.17.1');
  assert.equal(npmPackagePurl('@types/node', '22.20.1'), 'pkg:npm/%40types/node@22.20.1');
  assert.throws(() => npmPackagePurl('@invalid', '1.0.0'), /invalid scoped npm package/u);
  assert.deepEqual(tarPath('short/file.txt'), { name: 'short/file.txt', prefix: '' });
  for (const path of ['back\\slash', './dot', 'dir/../escape', 'dir//empty']) {
    assert.throws(() => tarPath(path), /portable|traversal|dot|empty/u, path);
  }
  const prefix = 'nested/'.repeat(15).slice(0, -1);
  const longPath = `${prefix}/file.txt`;
  assert.ok(Buffer.byteLength(longPath) > 100);
  assert.deepEqual(tarPath(longPath), { name: 'file.txt', prefix });
  const longDirectoryPath = `${prefix}/directory/`;
  const encodedDirectory = tarPath(longDirectoryPath);
  assert.notEqual(encodedDirectory.name, '');
  assert.equal(`${encodedDirectory.prefix}/${encodedDirectory.name}`, longDirectoryPath);
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

test('release checksum generation emits the exact ten-target contract and rejects partial artifacts', async (t) => {
  const releaseRoot = await mkdtemp(join(tmpdir(), 'nova-release-checksums-'));
  t.after(() => rm(releaseRoot, { recursive: true, force: true }));
  assert.equal(
    parseChecksumArgs([], releaseRoot),
    join(releaseRoot, '.metrics/release-checksums/SHA256SUMS.txt'),
  );
  assert.throws(() => parseChecksumArgs(['--unknown'], releaseRoot), /unknown argument/u);
  assert.throws(() => parseChecksumArgs(['--out'], releaseRoot), /requires a value/u);
  for (const path of releaseChecksumSourcePaths) {
    const target = join(releaseRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, path === 'nova-plugin/.claude-plugin/plugin.json'
      ? '{"name":"nova-plugin","version":"4.1.0"}\n'
      : `${path}\n`);
  }
  const artifactDir = join(releaseRoot, '.metrics/release-artifacts');
  await mkdir(artifactDir, { recursive: true });
  for (const name of releaseArtifactNames('4.1.0')) await writeFile(join(artifactDir, name), `${name}\n`);

  const result = generateReleaseChecksums({ root: releaseRoot, args: ['--out', '.metrics/checksums.txt'] });
  assert.equal(result.lines.length, 10);
  assert.deepEqual(
    result.lines.map((line) => /^([a-f0-9]{64})  (.+)$/u.exec(line)?.[2]),
    releaseChecksumPaths('4.1.0'),
  );
  assert.equal(await readFile(result.outPath, 'utf8'), `${result.lines.join('\n')}\n`);

  await unlink(join(artifactDir, 'nova-build-record.json'));
  assert.throws(
    () => generateReleaseChecksums({ root: releaseRoot }),
    /release artifacts missing for 4\.1\.0: nova-build-record\.json/u,
  );
  await rm(artifactDir, { recursive: true });
  assert.throws(
    () => generateReleaseChecksums({ root: releaseRoot }),
    /release artifacts missing for 4\.1\.0: nova-plugin-4\.1\.0\.tar\.gz/u,
  );
});

test('release checksum CLI reports help and fails closed on invalid arguments', (t) => {
  const logs = [];
  const errors = [];
  t.mock.method(console, 'log', (line) => logs.push(line));
  t.mock.method(console, 'error', (line) => errors.push(line));
  assert.equal(checksumMain(['--help']), 0);
  assert.equal(checksumMain(['--unknown']), 1);
  assert.match(logs.join('\n'), /Usage: node scripts\/generate-release-checksums\.mjs/u);
  assert.match(errors.join('\n'), /ERROR unknown argument: --unknown/u);
});

test('release archive and plugin manifest consume the same protected byte snapshot', async (t) => {
  const pluginRoot = await mkdtemp(join(tmpdir(), 'nova-release-snapshot-'));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  await mkdir(join(pluginRoot, 'nested'));
  const file = join(pluginRoot, 'nested', 'contract.txt');
  await writeFile(file, 'captured');
  const snapshot = capturePluginTreeSnapshot(pluginRoot);
  await writeFile(file, 'changed-after-snapshot');
  const archive = gzipSync(deterministicTarFromSnapshot(snapshot), { level: 9, mtime: 0 });
  assert.deepEqual(verifyArchiveSnapshot(archive, snapshot), snapshot.manifest);
  const archived = parseTarGzEntries(archive).find((entry) => entry.path === 'nested/contract.txt');
  assert.equal(archived.content.toString('utf8'), 'captured');
  assert.equal(snapshot.manifest.find((entry) => entry.path === 'nested/contract.txt').bytes, 8);
});

test('release plugin snapshots reject symlinks and hard-linked files', async (t) => {
  const hardLinked = await mkdtemp(join(tmpdir(), 'nova-release-hardlink-'));
  t.after(() => rm(hardLinked, { recursive: true, force: true }));
  await writeFile(join(hardLinked, 'source.txt'), 'same inode');
  await link(join(hardLinked, 'source.txt'), join(hardLinked, 'linked.txt'));
  assert.throws(() => capturePluginTreeSnapshot(hardLinked), /hard linked/u);

  if (process.platform !== 'win32') {
    const symlinked = await mkdtemp(join(tmpdir(), 'nova-release-symlink-'));
    t.after(() => rm(symlinked, { recursive: true, force: true }));
    await writeFile(join(symlinked, 'source.txt'), 'source');
    await symlink('source.txt', join(symlinked, 'linked.txt'));
    assert.throws(() => capturePluginTreeSnapshot(symlinked), /symlink or junction/u);
  }
});
