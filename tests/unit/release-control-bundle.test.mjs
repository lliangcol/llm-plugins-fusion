import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildReleaseControlBundle, verifyControlBundle } from '../../scripts/build-release-control-bundle.mjs';

test('release control bundle is deterministic and includes transitive control imports', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-control-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const first = buildReleaseControlBundle({ outDir: join(root, 'a') });
  const second = buildReleaseControlBundle({ outDir: join(root, 'b') });
  assert.deepEqual(await readFile(first.bundlePath), await readFile(second.bundlePath));
  assert.equal(first.manifest.bundleSha256, second.manifest.bundleSha256);
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/release-state-machine.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/semver.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/lib/safe-tar.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/reconcile-github-release.mjs'));
  assert.ok(first.manifest.files.some((entry) => entry.path === 'scripts/verify-stable-install.mjs'));
  assert.deepEqual(verifyControlBundle({ bundlePath: first.bundlePath, manifest: first.manifest }), {
    bundleSha256: first.manifest.bundleSha256,
    files: first.manifest.files.length,
  });
  const tampered = structuredClone(first.manifest);
  tampered.files[0].sha256 = '0'.repeat(64);
  assert.throws(() => verifyControlBundle({ bundlePath: first.bundlePath, manifest: tampered }), /file inventory differs/u);
});
