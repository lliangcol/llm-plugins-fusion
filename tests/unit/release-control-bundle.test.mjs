import assert from 'node:assert/strict';
import { copyFile, link, mkdir, mkdtemp, readFile, rm, stat, symlink, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildReleaseControlBundle, verifyControlBundle } from '../../scripts/build-release-control-bundle.mjs';
import { comparePortablePaths } from '../../scripts/lib/portable-path.mjs';
import { parseTarGzEntries } from '../../scripts/lib/safe-tar.mjs';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function copyControlSources(sourceRoot, manifest) {
  for (const entry of manifest.files) {
    const target = resolve(sourceRoot, entry.path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(repo, entry.path), target);
  }
}

test('release control bundle is deterministic and includes transitive control imports', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-control-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = buildReleaseControlBundle({ outDir: join(root, 'a') });
  const second = buildReleaseControlBundle({ outDir: join(root, 'b') });
  assert.deepEqual(await readFile(first.bundlePath), await readFile(second.bundlePath));
  assert.equal(first.manifest.bundleSha256, second.manifest.bundleSha256);
  assert.deepEqual(
    first.manifest.files.map((entry) => entry.path),
    first.manifest.files.map((entry) => entry.path).toSorted(comparePortablePaths),
  );
  const archiveEntries = parseTarGzEntries(await readFile(first.bundlePath));
  const scriptPath = 'scripts/generate-release-candidate.mjs';
  const archivedScript = archiveEntries.find((entry) => entry.path === scriptPath);
  assert.equal(archivedScript.mode & 0o777, (await stat(resolve(repo, scriptPath))).mode & 0o777);
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/release-state-machine.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/semver.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/safe-tar.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/reconcile-github-release.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/verify-stable-install.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/validate-performance-budget.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/github-actions-performance-provenance.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'governance/evidence/validation-performance-samples.json'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'schemas/validation-performance-samples.schema.json'));
  assert.deepEqual(verifyControlBundle({ bundlePath: first.bundlePath, manifest: first.manifest }), {
    bundleSha256: first.manifest.bundleSha256,
    files: first.manifest.files.length,
  });
  const tampered = structuredClone(first.manifest);
  tampered.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => verifyControlBundle({ bundlePath: first.bundlePath, manifest: tampered }), /file inventory differs/u);

  const mirroredRoot = join(root, 'mirrored-source');
  await copyControlSources(mirroredRoot, first.manifest);
  const mirrored = buildReleaseControlBundle({ sourceRoot: mirroredRoot, outDir: join(root, 'mirrored-output') });
  assert.deepEqual(await readFile(mirrored.bundlePath), await readFile(first.bundlePath));
});

test('release control bundle rejects hard-linked and symlinked source files', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-control-linked-source-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const baseline = buildReleaseControlBundle({ outDir: join(temp, 'baseline') });

  const hardLinkedRoot = join(temp, 'hard-linked-source');
  await copyControlSources(hardLinkedRoot, baseline.manifest);
  const hardLinkedPath = join(hardLinkedRoot, 'scripts/generate-release-candidate.mjs');
  const hardLinkSource = join(hardLinkedRoot, 'hardlink-source.mjs');
  await copyFile(hardLinkedPath, hardLinkSource);
  await unlink(hardLinkedPath);
  await link(hardLinkSource, hardLinkedPath);
  assert.throws(
    () => buildReleaseControlBundle({ sourceRoot: hardLinkedRoot, outDir: join(temp, 'hard-linked-output') }),
    /release control source.*hard linked/u,
  );

  if (process.platform !== 'win32') {
    const symlinkedRoot = join(temp, 'symlinked-source');
    await copyControlSources(symlinkedRoot, baseline.manifest);
    const symlinkedPath = join(symlinkedRoot, 'scripts/generate-release-candidate.mjs');
    const symlinkSource = join(symlinkedRoot, 'symlink-source.mjs');
    await copyFile(symlinkedPath, symlinkSource);
    await unlink(symlinkedPath);
    await symlink(symlinkSource, symlinkedPath);
    assert.throws(
      () => buildReleaseControlBundle({ sourceRoot: symlinkedRoot, outDir: join(temp, 'symlinked-output') }),
      /release control source.*symlink or junction/u,
    );
  }
});
