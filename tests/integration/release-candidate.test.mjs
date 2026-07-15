import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { buildReleaseArtifacts } from '../../scripts/build-release-artifacts.mjs';
import { buildReleaseControlBundle } from '../../scripts/build-release-control-bundle.mjs';
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
  main as promotionMain,
  parsePromotionArgs,
  verifyPromotion,
} from '../../scripts/verify-release-promotion.mjs';
import { resolveFromModule } from '../../scripts/lib/repo-root.mjs';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';

const root = resolveFromModule(import.meta.url, '../..');
const commit = 'a'.repeat(40);
const reviewHead = 'c'.repeat(40);
const correctionSourceFor = (candidateTag) => {
  const document = { schemaVersion: 3, corrections: [{
    id: 'REL-TEST', status: 'candidate-verified', affectedCommits: [commit],
    stableRelease: { tag: 'v4.0.0', commit: 'b'.repeat(40), state: 'INSTALL_PROVEN' },
    targetRelease: { stableTag: 'v4.1.0', candidateTag },
  }] };
  return { document, sha256: canonicalSha256(document) };
};
const correctionSource = correctionSourceFor('v4.1.0-rc.1');
const releasePolicy = {
  status: 'READY', reasonCode: 'RELEASE_POLICY_READY', correctionIds: ['REL-TEST'], correctionsSha256: correctionSource.sha256, maximumPermittedState: 'INSTALL_PROVEN',
};

async function candidateFixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-candidate-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const artifactDir = join(temp, 'artifacts');
  const evidenceDir = join(temp, 'evidence');
  await mkdir(evidenceDir);
  const control = buildReleaseControlBundle({ outDir: temp });
  const controlBundle = control.bundlePath;
  const controlManifest = control.manifestPath;
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
    writeFile(evidence[1], '{"check":true,"exitCode":0,"thresholds":{"lines":85,"branches":70,"functions":90},"summaryPath":"coverage-summary.txt"}\n'),
    writeFile(evidence[2], '{"failed":0,"skipped":0,"gates":[{"status":"passed"}]}\n'),
    writeFile(evidence[3], '{"validation":{"passed":true,"errors":[]},"inventoryDiff":{"matches":true},"manifestValidation":{"marketplace":true,"plugin":true},"sourceTreeDigest":"same","installedTreeDigest":"same","plugin":{"version":"4.1.0"},"marketplace":{"ref":"v4.1.0-rc.1"}}\n'),
    writeFile(evidence[4], '{"outputStructureValid":true,"processExitCode":0,"processCompletion":"zero-exit","processStderrPresent":false,"processStderrBytes":0,"processStderrSha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","projectChanged":false,"gitStatus":"","authenticationMode":"claude-code-oauth-token","configurationIsolation":"temporary-home","beforeProjectDigest":"same","afterProjectDigest":"same"}\n'),
    writeFile(evidence[5], `{"passed":true,"commit":"${commit}","pullRequestHead":"${reviewHead}","expectedReviewCommit":"${reviewHead}","minimumApprovals":1,"approvalReviewers":["peer"],"excludedReviewers":["author","actor"]}\n`),
  ]);
  const manifest = buildReleaseCandidate({
    root,
    tag: 'v4.1.0-rc.1',
    commit,
    artifactDir,
    bundleRoot: temp,
    evidencePaths: evidence,
    controlBundle: { path: 'release-control-bundle.tar.gz', sha256: sha256File(controlBundle), bytes: (await readFile(controlBundle)).length },
    releasePolicy,
    now: () => new Date('2026-07-12T01:00:00Z'),
  });
  return { temp, artifactDir, evidence, manifest, controlBundle, controlManifest };
}

test('candidate tag parsing binds an RC number to a stable base version', () => {
  assert.deepEqual(parseCandidateTag('v4.1.0-rc.2'), {
    tag: 'v4.1.0-rc.2', stableVersion: '4.1.0', number: 2,
  });
  for (const tag of ['v4.1.0', '4.1.0-rc.1', 'v4.1.0-beta.1', 'v4.1.0-rc.01']) {
    assert.throws(() => parseCandidateTag(tag));
  }
});

test('candidate manifest binds source, evidence, and deterministic artifacts for promotion', async (t) => {
  const fixture = await candidateFixture(t);
  assert.equal(fixture.manifest.artifacts.length, 5);
  assert.equal(fixture.manifest.evidence.length, 6);
  assert.equal(fixture.manifest.schemaVersion, 2);
  assert.equal(fixture.manifest.controlBundle.sha256, sha256File(fixture.controlBundle));
  assert.equal(fixture.manifest.candidate.stableVersion, '4.1.0');
  assert.equal(Object.keys(fixture.manifest.sourceDigests).length, candidateSourcePaths.length);
  const promoted = verifyReleasePromotion({
    root,
    stableTag: 'v4.1.0',
    commit,
    manifest: fixture.manifest,
    artifactDir: fixture.artifactDir,
  });
  assert.equal(promoted.candidateTag, 'v4.1.0-rc.1');
  assert.match(promoted.artifactDigest, /^[a-f0-9]{64}$/);
});

test('candidate rehearsal rejects zero, multiple, and mismatched artifacts', async (t) => {
  const missing = await candidateFixture(t);
  await unlink(join(missing.artifactDir, 'nova-plugin-4.1.0.tar.gz'));
  assert.throws(() => resolveCandidateArtifacts(missing.artifactDir, '4.1.0'), /exactly one archive; found 0/);

  const multiple = await candidateFixture(t);
  await writeFile(join(multiple.artifactDir, 'nova-plugin-9.9.9.tar.gz'), 'duplicate');
  assert.throws(() => resolveCandidateArtifacts(multiple.artifactDir, '4.1.0'), /exactly one archive; found 2/);

  const changed = await candidateFixture(t);
  await writeFile(join(changed.artifactDir, 'nova-plugin-4.1.0.tar.gz'), 'changed');
  assert.throws(() => verifyReleasePromotion({
    root,
    stableTag: 'v4.1.0',
    commit,
    manifest: changed.manifest,
    artifactDir: changed.artifactDir,
  }), /artifact digest or size differs/);
});

test('promotion rejects candidate version, commit, and source drift', async (t) => {
  const fixture = await candidateFixture(t);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', expectedCandidateTag: 'v4.1.0-rc.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /selected candidate release/);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit: 'b'.repeat(40), manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /same commit/);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.0.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /stable version does not match/);
  const drifted = structuredClone(fixture.manifest);
  drifted.sourceDigests['package.json'] = '0'.repeat(64);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: drifted, artifactDir: fixture.artifactDir,
  }), /source digest differs/);
  const extraSource = structuredClone(fixture.manifest);
  extraSource.sourceDigests['README.md'] = sha256File(resolve(root, 'README.md'));
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: extraSource, artifactDir: fixture.artifactDir,
  }), /source digest inventory differs/);
});

test('promotion fails closed for missing, replaced, or skipped required evidence', async (t) => {
  const fixture = await candidateFixture(t);
  const missing = structuredClone(fixture.manifest);
  missing.evidence = missing.evidence.filter((entry) => entry.kind !== 'route-smoke');
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: missing, artifactDir: fixture.artifactDir,
  }), /required promotion evidence is missing: route-smoke/);

  await writeFile(fixture.evidence.find((path) => path.endsWith('inventory.json')), '{"validation":{"passed":false,"errors":["replaced"]}}\n');
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /evidence digest or size differs/);

  const skipped = await candidateFixture(t);
  const timingPath = skipped.evidence.find((path) => path.endsWith('validation-timings.json'));
  await writeFile(timingPath, '{"failed":0,"skipped":1,"gates":[{"status":"skipped"}]}\n');
  const timing = skipped.manifest.evidence.find((entry) => entry.kind === 'validation-timings');
  timing.sha256 = sha256File(timingPath);
  timing.bytes = (await readFile(timingPath)).length;
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: skipped.manifest, artifactDir: skipped.artifactDir,
  }), /failed or skipped gates/);
});

test('promotion accepts only the bounded Claude compatibility skip with exact-tag live install proof', async (t) => {
  const fixture = await candidateFixture(t);
  const timingPath = fixture.evidence.find((path) => path.endsWith('validation-timings.json'));
  const boundedSkip = {
    failed: 0,
    skipped: 1,
    gates: [
      { id: 'docs.validate', status: 'passed' },
      { id: 'claude.manifest.static', status: 'skipped', reasonCode: 'LOCAL_RUNTIME_UNAVAILABLE' },
    ],
  };
  await writeFile(timingPath, JSON.stringify(boundedSkip));
  const timing = fixture.manifest.evidence.find((entry) => entry.kind === 'validation-timings');
  timing.sha256 = sha256File(timingPath);
  timing.bytes = (await readFile(timingPath)).length;
  assert.doesNotThrow(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }));

  for (const mutate of [
    (data) => { data.gates[1].id = 'another.gate'; },
    (data) => { data.gates[1].reasonCode = 'UNKNOWN'; },
    (data) => { data.skipped = 2; },
  ]) {
    const data = structuredClone(boundedSkip);
    mutate(data);
    await writeFile(timingPath, JSON.stringify(data));
    timing.sha256 = sha256File(timingPath);
    timing.bytes = (await readFile(timingPath)).length;
    assert.throws(() => verifyReleasePromotion({
      root, stableTag: 'v4.1.0', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
    }), /failed or skipped gates/);
  }
});

test('candidate and promotion CLI parsers require explicit digest-bound identity', async (t) => {
  const fixture = await candidateFixture(t);
  const outDir = join(fixture.temp, 'candidate-output');
  const inventoryPath = fixture.evidence.find((path) => path.endsWith('inventory.json'));
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  inventory.marketplace.ref = 'v4.1.0-rc.3';
  await writeFile(inventoryPath, `${JSON.stringify(inventory)}\n`);
  const result = generateReleaseCandidate({
    args: [
      '--tag', 'v4.1.0-rc.3',
      '--stable-tag', 'v4.1.0',
      '--commit', commit,
      '--control-bundle-manifest', fixture.controlManifest,
      '--artifact-dir', fixture.artifactDir,
      '--bundle-root', fixture.temp,
      ...fixture.evidence.flatMap((path) => ['--evidence', path]),
      '--out-dir', outDir,
    ],
    env: {},
    now: () => new Date('2026-07-12T02:00:00Z'),
    correctionSource: correctionSourceFor('v4.1.0-rc.3'),
  });
  assert.equal(result.core.candidate.number, 3);
  assert.equal(JSON.parse(await readFile(result.paths.intent, 'utf8')).candidateTag, 'v4.1.0-rc.3');
  const githubOutput = join(fixture.temp, 'github-output.txt');
  const verified = verifyPromotion({
    args: [
      '--stable-tag', 'v4.1.0', '--candidate-tag', 'v4.1.0-rc.3', '--commit', commit,
      '--manifest', result.paths.envelope, '--candidate-core', result.paths.core,
      '--promotion-intent', result.paths.intent, '--control-bundle-manifest', fixture.controlManifest,
      '--artifact-dir', fixture.artifactDir, '--bundle-root', fixture.temp, '--github-output', githubOutput,
    ],
    env: {}, correctionSource: correctionSourceFor('v4.1.0-rc.3'),
  });
  assert.equal(verified.candidateTag, 'v4.1.0-rc.3');
  assert.match(await readFile(githubOutput, 'utf8'), /candidate_tag=v4\.1\.0-rc\.3/u);
  assert.equal(promotionMain(), 1);

  const envelope = JSON.parse(await readFile(result.paths.envelope, 'utf8'));
  const intent = JSON.parse(await readFile(result.paths.intent, 'utf8'));
  const core = JSON.parse(await readFile(result.paths.core, 'utf8'));
  const common = [
    '--stable-tag', 'v4.1.0', '--candidate-tag', 'v4.1.0-rc.3', '--commit', commit,
    '--manifest', result.paths.envelope, '--candidate-core', result.paths.core,
    '--promotion-intent', result.paths.intent, '--control-bundle-manifest', fixture.controlManifest,
    '--artifact-dir', fixture.artifactDir, '--bundle-root', fixture.temp,
  ];
  envelope.schemaVersion = 2;
  await writeFile(result.paths.envelope, `${JSON.stringify(envelope)}\n`);
  assert.throws(() => verifyPromotion({ args: common, env: {}, correctionSource: correctionSourceFor('v4.1.0-rc.3') }), /schema must be 3/u);
  envelope.schemaVersion = 3;
  envelope.candidateCore.sha256 = '0'.repeat(64);
  await writeFile(result.paths.envelope, `${JSON.stringify(envelope)}\n`);
  assert.throws(() => verifyPromotion({ args: common, env: {}, correctionSource: correctionSourceFor('v4.1.0-rc.3') }), /envelope binding/u);
  envelope.candidateCore.sha256 = canonicalSha256(core);
  await writeFile(result.paths.envelope, `${JSON.stringify(envelope)}\n`);
  intent.correctionsSha256 = '0'.repeat(64);
  await writeFile(result.paths.intent, `${JSON.stringify(intent)}\n`);
  envelope.promotionIntent.sha256 = canonicalSha256(intent);
  await writeFile(result.paths.envelope, `${JSON.stringify(envelope)}\n`);
  assert.throws(() => verifyPromotion({ args: common, env: {}, correctionSource: correctionSourceFor('v4.1.0-rc.3') }), /correction evidence differs/u);
  assert.throws(() => parseCandidateArgs(['--tag', 'v4.1.0-rc.4', '--commit', commit], {}), /missing required/);
  assert.throws(() => parsePromotionArgs(['--stable-tag', 'v4.1.0', '--commit', commit], {}), /missing required/);
  assert.throws(() => parsePromotionArgs(['--unknown', 'x'], {}), /unknown argument/u);
});

test('candidate generation rejects a control manifest that does not match the archive bytes', async (t) => {
  const fixture = await candidateFixture(t);
  const control = JSON.parse(await readFile(fixture.controlManifest, 'utf8'));
  control.bundleSha256 = '0'.repeat(64);
  await writeFile(fixture.controlManifest, `${JSON.stringify(control)}\n`);
  assert.throws(() => generateReleaseCandidate({
    args: [
      '--tag', 'v4.1.0-rc.5', '--stable-tag', 'v4.1.0', '--commit', commit,
      '--control-bundle-manifest', fixture.controlManifest,
      '--artifact-dir', fixture.artifactDir, '--bundle-root', fixture.temp,
      ...fixture.evidence.flatMap((path) => ['--evidence', path]),
      '--out-dir', join(fixture.temp, 'rejected-output'),
    ],
    env: {},
    correctionSource: correctionSourceFor('v4.1.0-rc.5'),
  }), /digest differs/u);
});
