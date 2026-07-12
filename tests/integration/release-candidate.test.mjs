import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildReleaseArtifacts } from '../../scripts/build-release-artifacts.mjs';
import {
  buildReleaseCandidate,
  parseCandidateTag,
  resolveCandidateArtifacts,
  verifyReleasePromotion,
} from '../../scripts/lib/release-candidate.mjs';
import {
  generateReleaseCandidate,
  parseCandidateArgs,
} from '../../scripts/generate-release-candidate.mjs';
import {
  parsePromotionArgs,
} from '../../scripts/verify-release-promotion.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const commit = 'a'.repeat(40);

async function candidateFixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-candidate-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const artifactDir = join(temp, 'artifacts');
  const evidence = join(temp, 'evidence.json');
  await writeFile(evidence, '{"status":"passed"}\n');
  buildReleaseArtifacts({ root, outDir: artifactDir, now: () => new Date('2026-07-12T00:00:00Z') });
  const manifest = buildReleaseCandidate({
    root,
    tag: 'v3.1.0-rc.1',
    commit,
    artifactDir,
    evidencePaths: [evidence],
    now: () => new Date('2026-07-12T01:00:00Z'),
  });
  return { temp, artifactDir, evidence, manifest };
}

test('candidate tag parsing binds an RC number to a stable base version', () => {
  assert.deepEqual(parseCandidateTag('v3.1.0-rc.2'), {
    tag: 'v3.1.0-rc.2', stableVersion: '3.1.0', number: 2,
  });
  for (const tag of ['v3.1.0', '3.1.0-rc.1', 'v3.1.0-beta.1', 'v3.1.0-rc.01']) {
    assert.throws(() => parseCandidateTag(tag));
  }
});

test('candidate manifest binds source, evidence, and deterministic artifacts for promotion', async (t) => {
  const fixture = await candidateFixture(t);
  assert.equal(fixture.manifest.artifacts.length, 3);
  assert.equal(fixture.manifest.evidence.length, 1);
  assert.equal(fixture.manifest.candidate.stableVersion, '3.1.0');
  assert.equal(Object.keys(fixture.manifest.sourceDigests).length, 6);
  const promoted = verifyReleasePromotion({
    root,
    stableTag: 'v3.1.0',
    commit,
    manifest: fixture.manifest,
    artifactDir: fixture.artifactDir,
  });
  assert.equal(promoted.candidateTag, 'v3.1.0-rc.1');
  assert.match(promoted.artifactDigest, /^[a-f0-9]{64}$/);
});

test('candidate rehearsal rejects zero, multiple, and mismatched artifacts', async (t) => {
  const missing = await candidateFixture(t);
  await unlink(join(missing.artifactDir, 'nova-plugin-3.1.0.tar.gz'));
  assert.throws(() => resolveCandidateArtifacts(missing.artifactDir, '3.1.0'), /exactly one archive; found 0/);

  const multiple = await candidateFixture(t);
  await writeFile(join(multiple.artifactDir, 'nova-plugin-9.9.9.tar.gz'), 'duplicate');
  assert.throws(() => resolveCandidateArtifacts(multiple.artifactDir, '3.1.0'), /exactly one archive; found 2/);

  const changed = await candidateFixture(t);
  await writeFile(join(changed.artifactDir, 'nova-plugin-3.1.0.tar.gz'), 'changed');
  assert.throws(() => verifyReleasePromotion({
    root,
    stableTag: 'v3.1.0',
    commit,
    manifest: changed.manifest,
    artifactDir: changed.artifactDir,
  }), /artifact digest or size differs/);
});

test('promotion rejects candidate version, commit, and source drift', async (t) => {
  const fixture = await candidateFixture(t);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.1.0', commit: 'b'.repeat(40), manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /same commit/);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.0.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /stable version does not match/);
  const drifted = structuredClone(fixture.manifest);
  drifted.sourceDigests['package.json'] = '0'.repeat(64);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.1.0', commit, manifest: drifted, artifactDir: fixture.artifactDir,
  }), /source digest differs/);
});

test('candidate and promotion CLI parsers preserve explicit evidence paths', async (t) => {
  const fixture = await candidateFixture(t);
  const out = join(fixture.temp, 'candidate.json');
  const result = generateReleaseCandidate({
    args: [
      '--tag', 'v3.1.0-rc.3',
      '--commit', commit,
      '--artifact-dir', fixture.artifactDir,
      '--evidence', fixture.evidence,
      '--out', out,
    ],
    env: {},
    now: () => new Date('2026-07-12T02:00:00Z'),
  });
  assert.equal(result.manifest.candidate.number, 3);
  assert.equal(JSON.parse(await readFile(out, 'utf8')).candidate.tag, 'v3.1.0-rc.3');
  assert.equal(parseCandidateArgs(['--tag', 'v3.1.0-rc.4', '--commit', commit], {}).tag, 'v3.1.0-rc.4');
  assert.equal(parsePromotionArgs(['--stable-tag', 'v3.1.0', '--commit', commit], {}).stableTag, 'v3.1.0');
});
