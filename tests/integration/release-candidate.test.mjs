import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildReleaseArtifacts } from '../../scripts/build-release-artifacts.mjs';
import {
  buildReleaseCandidate,
  candidateSourcePaths,
  parseCandidateTag,
  resolveCandidateArtifacts,
  sha256File,
  verifyReleasePromotion,
} from '../../scripts/lib/release-candidate.mjs';
import {
  generateReleaseCandidate,
  parseCandidateArgs,
} from '../../scripts/generate-release-candidate.mjs';
import {
  parsePromotionArgs,
} from '../../scripts/verify-release-promotion.mjs';
import { resolveFromModule } from '../../scripts/lib/repo-root.mjs';

const root = resolveFromModule(import.meta.url, '../..');
const commit = 'a'.repeat(40);

async function candidateFixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-candidate-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const artifactDir = join(temp, 'artifacts');
  const evidenceDir = join(temp, 'evidence');
  await mkdir(evidenceDir);
  const evidence = [
    join(evidenceDir, 'SHA256SUMS.txt'),
    join(evidenceDir, 'coverage-metadata.json'),
    join(evidenceDir, 'validation-timings.json'),
    join(evidenceDir, 'inventory.json'),
    join(evidenceDir, 'route-smoke.json'),
    join(evidenceDir, 'independent-review.json'),
  ];
  buildReleaseArtifacts({ root, outDir: artifactDir, now: () => new Date('2026-07-12T00:00:00Z') });
  await Promise.all([
    writeFile(evidence[0], `${sha256File(resolve(root, 'package.json'))}  package.json\n`),
    writeFile(evidence[1], '{"check":true,"exitCode":0,"thresholds":{"lines":85,"branches":60,"functions":90},"summaryPath":"coverage-summary.txt"}\n'),
    writeFile(evidence[2], '{"failed":0,"skipped":0,"gates":[{"status":"passed"}]}\n'),
    writeFile(evidence[3], '{"validation":{"passed":true,"errors":[]},"inventoryDiff":{"matches":true},"manifestValidation":{"marketplace":true,"plugin":true},"sourceTreeDigest":"same","installedTreeDigest":"same","plugin":{"version":"3.2.0"},"marketplace":{"ref":"v3.2.0-rc.1"}}\n'),
    writeFile(evidence[4], '{"outputStructureValid":true,"projectChanged":false,"gitStatus":"","authenticationMode":"claude-code-oauth-token","configurationIsolation":"temporary-home","beforeProjectDigest":"same","afterProjectDigest":"same"}\n'),
    writeFile(evidence[5], `{"passed":true,"commit":"${commit}","pullRequestHead":"${commit}","expectedReviewCommit":"${commit}","minimumApprovals":1,"approvalReviewers":["peer"],"excludedReviewers":["author","actor"]}\n`),
  ]);
  const manifest = buildReleaseCandidate({
    root,
    tag: 'v3.2.0-rc.1',
    commit,
    artifactDir,
    bundleRoot: temp,
    evidencePaths: evidence,
    now: () => new Date('2026-07-12T01:00:00Z'),
  });
  return { temp, artifactDir, evidence, manifest };
}

test('candidate tag parsing binds an RC number to a stable base version', () => {
  assert.deepEqual(parseCandidateTag('v3.2.0-rc.2'), {
    tag: 'v3.2.0-rc.2', stableVersion: '3.2.0', number: 2,
  });
  for (const tag of ['v3.2.0', '3.2.0-rc.1', 'v3.2.0-beta.1', 'v3.2.0-rc.01']) {
    assert.throws(() => parseCandidateTag(tag));
  }
});

test('candidate manifest binds source, evidence, and deterministic artifacts for promotion', async (t) => {
  const fixture = await candidateFixture(t);
  assert.equal(fixture.manifest.artifacts.length, 3);
  assert.equal(fixture.manifest.evidence.length, 6);
  assert.equal(fixture.manifest.schemaVersion, 2);
  assert.equal(fixture.manifest.candidate.stableVersion, '3.2.0');
  assert.equal(Object.keys(fixture.manifest.sourceDigests).length, candidateSourcePaths.length);
  const promoted = verifyReleasePromotion({
    root,
    stableTag: 'v3.2.0',
    commit,
    manifest: fixture.manifest,
    artifactDir: fixture.artifactDir,
  });
  assert.equal(promoted.candidateTag, 'v3.2.0-rc.1');
  assert.match(promoted.artifactDigest, /^[a-f0-9]{64}$/);
});

test('candidate rehearsal rejects zero, multiple, and mismatched artifacts', async (t) => {
  const missing = await candidateFixture(t);
  await unlink(join(missing.artifactDir, 'nova-plugin-3.2.0.tar.gz'));
  assert.throws(() => resolveCandidateArtifacts(missing.artifactDir, '3.2.0'), /exactly one archive; found 0/);

  const multiple = await candidateFixture(t);
  await writeFile(join(multiple.artifactDir, 'nova-plugin-9.9.9.tar.gz'), 'duplicate');
  assert.throws(() => resolveCandidateArtifacts(multiple.artifactDir, '3.2.0'), /exactly one archive; found 2/);

  const changed = await candidateFixture(t);
  await writeFile(join(changed.artifactDir, 'nova-plugin-3.2.0.tar.gz'), 'changed');
  assert.throws(() => verifyReleasePromotion({
    root,
    stableTag: 'v3.2.0',
    commit,
    manifest: changed.manifest,
    artifactDir: changed.artifactDir,
  }), /artifact digest or size differs/);
});

test('promotion rejects candidate version, commit, and source drift', async (t) => {
  const fixture = await candidateFixture(t);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', expectedCandidateTag: 'v3.2.0-rc.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /selected candidate release/);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', commit: 'b'.repeat(40), manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /same commit/);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.0.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /stable version does not match/);
  const drifted = structuredClone(fixture.manifest);
  drifted.sourceDigests['package.json'] = '0'.repeat(64);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', commit, manifest: drifted, artifactDir: fixture.artifactDir,
  }), /source digest differs/);
  const extraSource = structuredClone(fixture.manifest);
  extraSource.sourceDigests['README.md'] = sha256File(resolve(root, 'README.md'));
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', commit, manifest: extraSource, artifactDir: fixture.artifactDir,
  }), /source digest inventory differs/);
});

test('promotion fails closed for missing, replaced, or skipped required evidence', async (t) => {
  const fixture = await candidateFixture(t);
  const missing = structuredClone(fixture.manifest);
  missing.evidence = missing.evidence.filter((entry) => entry.kind !== 'route-smoke');
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', commit, manifest: missing, artifactDir: fixture.artifactDir,
  }), /required promotion evidence is missing: route-smoke/);

  await writeFile(fixture.evidence.find((path) => path.endsWith('inventory.json')), '{"validation":{"passed":false,"errors":["replaced"]}}\n');
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /evidence digest or size differs/);

  const skipped = await candidateFixture(t);
  const timingPath = skipped.evidence.find((path) => path.endsWith('validation-timings.json'));
  await writeFile(timingPath, '{"failed":0,"skipped":1,"gates":[{"status":"skipped"}]}\n');
  const timing = skipped.manifest.evidence.find((entry) => entry.kind === 'validation-timings');
  timing.sha256 = sha256File(timingPath);
  timing.bytes = (await readFile(timingPath)).length;
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.2.0', commit, manifest: skipped.manifest, artifactDir: skipped.artifactDir,
  }), /failed or skipped gates/);
});

test('candidate and promotion CLI parsers preserve explicit evidence paths', async (t) => {
  const fixture = await candidateFixture(t);
  const out = join(fixture.temp, 'candidate.json');
  const result = generateReleaseCandidate({
    args: [
      '--tag', 'v3.2.0-rc.3',
      '--commit', commit,
      '--artifact-dir', fixture.artifactDir,
      '--bundle-root', fixture.temp,
      ...fixture.evidence.flatMap((path) => ['--evidence', path]),
      '--out', out,
    ],
    env: {},
    now: () => new Date('2026-07-12T02:00:00Z'),
  });
  assert.equal(result.manifest.candidate.number, 3);
  assert.equal(JSON.parse(await readFile(out, 'utf8')).candidate.tag, 'v3.2.0-rc.3');
  assert.equal(parseCandidateArgs(['--tag', 'v3.2.0-rc.4', '--commit', commit], {}).tag, 'v3.2.0-rc.4');
  assert.equal(parsePromotionArgs(['--stable-tag', 'v3.2.0', '--commit', commit], {}).stableTag, 'v3.2.0');
  assert.equal(parsePromotionArgs(['--candidate-tag', 'v3.2.0-rc.4'], {}).expectedCandidateTag, 'v3.2.0-rc.4');
});
