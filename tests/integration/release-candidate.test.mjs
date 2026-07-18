import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, link, mkdir, mkdtemp, readFile, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { buildReleaseArtifacts, deterministicTarFromSnapshot } from '../../scripts/build-release-artifacts.mjs';
import { buildReleaseControlBundle } from '../../scripts/build-release-control-bundle.mjs';
import {
  buildReleaseCandidate,
  candidateSourcePaths,
  parseCandidateTag,
  requiredReleaseValidationGateIds,
  resolveCandidateArtifacts,
  sha256File,
  verifyCandidateObservation,
  verifyReleasePromotion as verifyReleasePromotionBase,
} from '../../scripts/lib/release-candidate.mjs';
import {
  generateReleaseCandidate,
  parseCandidateArgs,
} from '../../scripts/generate-release-candidate.mjs';
import {
  main as promotionMain,
  parsePromotionArgs,
  verifyPromotion as verifyPromotionBase,
} from '../../scripts/verify-release-promotion.mjs';
import { resolveFromModule } from '../../scripts/lib/repo-root.mjs';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';
import {
  releaseChecksumPaths,
  releaseChecksumSourcePaths,
} from '../../scripts/lib/release-checksum-contract.mjs';
import { relativeTestFiles } from '../../scripts/lib/test-discovery.mjs';
import { coverageCommand } from '../../scripts/lib/coverage-runner.mjs';
import { parseTarGzEntries } from '../../scripts/lib/safe-tar.mjs';
import {
  routeAllowedTools,
  routeDisallowedTools,
  routeMaxTurns,
  routeOutputContract,
  routeSystemPromptSha256,
} from '../../scripts/validate-plugin-route-live.mjs';

const root = resolveFromModule(import.meta.url, '../..');
const commit = 'a'.repeat(40);
const workflowSourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const protectedWorkflowSha256 = createHash('sha256').update(execFileSync(
  'git',
  ['show', `${workflowSourceCommit}:.github/workflows/release-candidate.yml`],
  { cwd: root },
)).digest('hex');
const reviewHead = 'c'.repeat(40);
const correctionSourceFor = (candidateTag) => {
  const recordedAt = '2026-07-16T00:00:00Z';
  const evidence = { path: 'governance/evidence/test.md', sha256: 'd'.repeat(64), recordedAt };
  const document = { schemaVersion: 3, corrections: [{
    id: 'REL-TEST', issue: 73, status: 'candidate-verified', affectedCommits: [commit],
    stableRelease: { tag: 'v4.0.0', commit: 'b'.repeat(40), state: 'INSTALL_PROVEN' },
    targetRelease: { stableTag: 'v4.1.0', candidateTag },
    decision: { authorizedByIssue: 73, nonRetroactive: true, summary: 'test correction' },
    releaseBoundary: {
      mayPublishStable: false, requiresNewCandidate: true, requiresCurrentIndependentReview: true,
      requiresProtectedPublicationEvidence: true, requiresInstallProof: true,
    },
    authorizationEvidence: evidence,
    candidateEvidence: evidence,
    auditTrail: ['created', 'authorized', 'candidate-verified'].map((action) => ({
      action, actorRole: 'maintainer', recordedAt, evidence,
    })),
  }] };
  return { document, sha256: canonicalSha256(document) };
};
const correctionSource = correctionSourceFor('v4.1.0-rc.1');
const releasePolicy = {
  status: 'READY', reasonCode: 'RELEASE_POLICY_READY', correctionIds: ['REL-TEST'], correctionsSha256: correctionSource.sha256, maximumPermittedState: 'INSTALL_PROVEN',
};
const candidateReleaseMetadata = (tag = 'v4.1.0-rc.1', publishedAt = '2026-07-12T02:00:00Z') => ({
  id: 41001,
  tag_name: tag,
  draft: false,
  prerelease: true,
  published_at: publishedAt,
  url: 'https://api.github.com/repos/example/repository/releases/41001',
});
const promotionNow = () => new Date('2026-07-19T02:00:00Z');
const permissionSpec = JSON.parse(await readFile(resolve(root, 'nova-plugin/runtime/workflow-permissions.json'), 'utf8'));
const product = JSON.parse(await readFile(resolve(root, 'workflow-specs/nova.product.json'), 'utf8'));
const engineeringEvidence = JSON.parse(await readFile(resolve(root, 'governance/engineering-evidence.json'), 'utf8'));
const expectedSkills = [...permissionSpec.expectedInventory.commandIds, ...permissionSpec.expectedInventory.skillNames].sort();
const evidenceDigest = 'e'.repeat(64);
const projectFileInventory = [
  { path: '.git', type: 'directory' },
  { path: '.git/HEAD', type: 'file', bytes: 21, sha256: evidenceDigest },
  { path: 'README.md', type: 'file', bytes: 1, sha256: evidenceDigest },
];
const projectDigest = createHash('sha256').update(JSON.stringify(projectFileInventory)).digest('hex');
const sha256Json = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function completeValidationTimings({ skippedClaude = false } = {}) {
  const gates = requiredReleaseValidationGateIds.map((id) => ({
    id,
    label: id,
    status: skippedClaude && id === 'claude.manifest.static' ? 'skipped' : 'passed',
    durationMs: 1,
    cached: false,
    ...(skippedClaude && id === 'claude.manifest.static' ? { reasonCode: 'LOCAL_RUNTIME_UNAVAILABLE' } : {}),
  }));
  return {
    schemaVersion: 2,
    runId: 'candidate-test',
    generatedAt: '2026-07-12T00:30:00.000Z',
    failed: 0,
    skipped: skippedClaude ? 1 : 0,
    summary: {
      mode: 'full',
      selectedTaskCount: gates.length,
      cacheHitCount: 0,
      digests: { registry: `sha256:${'a'.repeat(64)}`, policy: `sha256:${'b'.repeat(64)}` },
    },
    gates,
  };
}

function liveEvidence(candidateTag = 'v4.1.0-rc.1', treeDigest = evidenceDigest) {
  const route = {
    schemaVersion: 1,
    generatedAt: '2026-07-12T00:45:00.000Z',
    invocation: '/nova-plugin:route',
    authenticationMode: 'claude-code-oauth-token',
    configurationIsolation: 'temporary-home',
    permissionMode: 'dontAsk',
    allowedTools: [...routeAllowedTools],
    disallowedTools: [...routeDisallowedTools],
    outputContract: routeOutputContract.id,
    systemPromptSha256: routeSystemPromptSha256,
    maxTurns: routeMaxTurns,
    processExitCode: 0,
    processCompletion: 'zero-exit',
    processStderrPresent: false,
    processStderrBytes: 0,
    processStderrSha256: createHash('sha256').update('').digest('hex'),
    outputStructureValid: true,
    commands: ['review'],
    skills: ['nova-review'],
    agents: ['reviewer'],
    packs: ['docs'],
    variantParameters: {},
    projectChanged: false,
    beforeDigest: evidenceDigest,
    afterDigest: evidenceDigest,
    beforeProjectDigest: projectDigest,
    afterProjectDigest: projectDigest,
    projectFileInventory,
    gitStatus: '',
    resultSha256: 'f'.repeat(64),
    evidenceBinding: {
      ref: candidateTag,
      commit,
      evidenceSource: `example/repository@${candidateTag}`,
      artifactTreeDigest: treeDigest,
      installedTreeDigest: treeDigest,
      assistantVersion: `${product.runtimeCompatibility['claude-code']} (Claude Code)`,
    },
  };
  const inventorySha256 = sha256Json(expectedSkills);
  const install = {
    schemaVersion: 2,
    generatedAt: '2026-07-12T00:46:00.000Z',
    claudeVersion: `${product.runtimeCompatibility['claude-code']} (Claude Code)`,
    knownGoodClaudeCli: product.runtimeCompatibility['claude-code'],
    manifestValidation: { marketplace: true, plugin: true },
    marketplace: {
      name: 'llm-plugins-fusion',
      source: `example/repository@${candidateTag}`,
      ref: candidateTag,
      installSourceType: 'local-manifest-remote-exact-ref',
    },
    plugin: { id: 'nova-plugin@llm-plugins-fusion', version: '4.1.0' },
    inventory: { count: expectedSkills.length, skills: expectedSkills },
    inventoryDiff: {
      matches: true,
      actualCount: expectedSkills.length,
      expectedCount: expectedSkills.length,
      missing: [],
      unexpected: [],
      actualSha256: inventorySha256,
      expectedSha256: inventorySha256,
    },
    primaryEntrypoints: permissionSpec.primaryEntrypoints.map((id) => `/${permissionSpec.pluginNamespace}:${id}`),
    sourceTreeDigest: treeDigest,
    installedTreeDigest: treeDigest,
    installedTreeIgnoredPaths: ['.in_use/**'],
    treeManifestVersion: 2,
    routeSmoke: route,
    validation: { passed: true, errors: [] },
  };
  return { install, route };
}

function coverageEvidence() {
  const testFiles = relativeTestFiles(root, 'all');
  return {
    schemaVersion: 2,
    command: ['node', ...coverageCommand(testFiles)],
    check: true,
    gatePassed: true,
    thresholds: { lines: 85, branches: 70, functions: 90 },
    actual: { lines: 91, branches: 75, functions: 94 },
    exitCode: 0,
    signal: null,
    startedAt: '2026-07-12T00:00:00.000Z',
    completedAt: '2026-07-12T00:01:00.000Z',
    durationMs: 60_000,
    coverageDir: '.metrics/coverage',
    v8Dir: '.metrics/coverage/v8',
    summaryPath: '.metrics/coverage/coverage-summary.txt',
    summarySha256: '9'.repeat(64),
    nodeVersion: 'v22.20.0',
    testFileCount: testFiles.length,
    rawCoverageFileCount: 4,
    criticalModuleCount: Object.keys(engineeringEvidence.criticalCoverage.modules).length,
    criticalModulesPassed: Object.keys(engineeringEvidence.criticalCoverage.modules).length,
    expectedSourceCount: 169,
    loadedSourceCount: 169,
    missingSourceCount: 0,
  };
}

function workflowProvenance(candidateTag = 'v4.1.0-rc.1') {
  return {
    schemaVersion: 1,
    operation: 'release-candidate',
    repository: 'example/repository',
    githubRunId: '41001',
    githubRunAttempt: 1,
    githubRunUrl: 'https://github.com/example/repository/actions/runs/41001',
    eventName: 'repository_dispatch',
    callerWorkflowRef: 'example/repository/.github/workflows/release-candidate.yml@refs/heads/main',
    callerWorkflowSha: workflowSourceCommit,
    workflow: {
      path: '.github/workflows/release-candidate.yml',
      sha256: protectedWorkflowSha256,
    },
    workflowSourceCommit,
    candidateTag,
    candidateCommit: commit,
    nodeVersion: 'v22.20.0',
    generatedAt: '2026-07-12T00:15:00.000Z',
  };
}

function checksumEvidence(sourceRoot, artifactDir, version = '4.1.0') {
  return `${releaseChecksumPaths(version).map((path) => {
    const target = path.startsWith('.metrics/release-artifacts/')
      ? resolve(artifactDir, path.split('/').at(-1))
      : resolve(sourceRoot, path);
    return `${sha256File(target)}  ${path}`;
  }).join('\n')}\n`;
}

async function replaceArchivedPluginManifest(fixture, content) {
  const archivePath = join(fixture.artifactDir, 'nova-plugin-4.1.0.tar.gz');
  const entries = parseTarGzEntries(await readFile(archivePath)).map((entry) => ({
    path: entry.path,
    type: entry.type,
    mode: `${entry.type === 'directory' ? '040' : '100'}${(entry.mode & 0o777).toString(8).padStart(3, '0')}`,
    content: entry.path === '.claude-plugin/plugin.json' ? Buffer.from(content) : entry.content,
  }));
  const archive = gzipSync(deterministicTarFromSnapshot({ entries }), { level: 9, mtime: 0 });
  const tree = entries.map((entry) => entry.type === 'directory'
    ? { path: entry.path, type: entry.type, mode: entry.mode }
    : {
        path: entry.path,
        type: entry.type,
        mode: entry.mode,
        bytes: entry.content.length,
        sha256: createHash('sha256').update(entry.content).digest('hex'),
      });
  const manifestPath = join(fixture.artifactDir, 'artifact-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.archive.sha256 = createHash('sha256').update(archive).digest('hex');
  manifest.archive.bytes = archive.length;
  manifest.pluginTree.sha256 = sha256Json(tree);
  manifest.pluginTree.entries = tree;
  await writeFile(archivePath, archive);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    fixture.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, fixture.artifactDir),
  );
}
const verifyReleasePromotion = (options) => verifyReleasePromotionBase({
  candidateReleaseMetadata: candidateReleaseMetadata(options.manifest?.candidate?.tag),
  repository: 'example/repository',
  minimumObservationHours: 168,
  now: promotionNow,
  ...options,
});
const verifyPromotion = (options) => verifyPromotionBase({ now: promotionNow, ...options });

async function candidateFixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-candidate-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const artifactDir = join(temp, 'artifacts');
  const evidenceDir = join(temp, 'evidence');
  await mkdir(evidenceDir);
  const control = buildReleaseControlBundle({ outDir: temp });
  const controlBundle = control.bundlePath;
  const controlManifest = control.manifestPath;
  const candidateReleaseMetadataPath = join(temp, 'candidate-release-metadata.json');
  const observationEvidencePath = join(temp, 'candidate-observation.json');
  const evidence = [
    join(evidenceDir, 'SHA256SUMS.txt'),
    join(evidenceDir, 'coverage-metadata.json'),
    join(evidenceDir, 'validation-timings.json'),
    join(evidenceDir, 'inventory.json'),
    join(evidenceDir, 'route-smoke.json'),
    join(evidenceDir, 'independent-review.json'),
    join(evidenceDir, 'workflow-provenance.json'),
  ];
  buildReleaseArtifacts({
    root,
    outDir: artifactDir,
    now: () => new Date('2026-07-12T00:00:00Z'),
    env: {
      RELEASE_TAG: 'v4.1.0-rc.1',
      RELEASE_COMMIT: commit,
      GITHUB_RUN_ID: '41001',
      RUNNER_OS: 'Linux',
    },
    runtimeNodeVersion: 'v22.20.0',
  });
  const artifactManifest = JSON.parse(await readFile(join(artifactDir, 'artifact-manifest.json'), 'utf8'));
  const live = liveEvidence('v4.1.0-rc.1', artifactManifest.pluginTree.sha256);
  await Promise.all([
    writeFile(evidence[0], checksumEvidence(root, artifactDir)),
    writeFile(evidence[1], `${JSON.stringify(coverageEvidence())}\n`),
    writeFile(evidence[2], `${JSON.stringify(completeValidationTimings())}\n`),
    writeFile(evidence[3], `${JSON.stringify(live.install)}\n`),
    writeFile(evidence[4], `${JSON.stringify(live.route)}\n`),
    writeFile(evidence[5], `${JSON.stringify({
      schemaVersion: 1,
      repository: 'example/repository',
      commit,
      pullRequest: 41,
      pullRequestHead: reviewHead,
      sensitive: false,
      reviewerPolicyStatus: 'configured',
      passed: true,
      minimumApprovals: 1,
      pullRequestAuthor: 'author',
      candidateActor: 'actor',
      expectedReviewCommit: reviewHead,
      approvalReviewers: ['lliang'],
      trustedReviewers: ['lliang'],
      excludedReviewers: ['actor', 'author'],
      checkedAt: '2026-07-12T00:20:00.000Z',
    })}\n`),
    writeFile(evidence[6], `${JSON.stringify(workflowProvenance())}\n`),
    writeFile(candidateReleaseMetadataPath, `${JSON.stringify(candidateReleaseMetadata())}\n`),
  ]);
  const manifest = buildReleaseCandidate({
    root,
    tag: 'v4.1.0-rc.1',
    commit,
    workflowSourceCommit,
    artifactDir,
    bundleRoot: temp,
    evidencePaths: evidence,
    controlBundle: { path: 'release-control-bundle.tar.gz', sha256: sha256File(controlBundle), bytes: (await readFile(controlBundle)).length },
    releasePolicy,
    now: () => new Date('2026-07-12T01:00:00Z'),
  });
  return { temp, artifactDir, evidence, manifest, controlBundle, controlManifest, candidateReleaseMetadataPath, observationEvidencePath };
}

async function copyCandidateSourceTree(base) {
  const candidateRoot = join(base, 'candidate-source-root');
  for (const path of new Set([...candidateSourcePaths, ...releaseChecksumSourcePaths, 'README.md'])) {
    const target = resolve(candidateRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(root, path), target);
  }
  await cp(resolve(root, 'tests'), resolve(candidateRoot, 'tests'), { recursive: true });
  await writeFile(resolve(candidateRoot, '.git'), `gitdir: ${resolve(root, '.git')}\n`);
  return candidateRoot;
}

function rebuildFixtureManifest(fixture, candidateRoot = root, overrides = {}) {
  return buildReleaseCandidate({
    root: candidateRoot,
    tag: 'v4.1.0-rc.1',
    commit,
    workflowSourceCommit,
    artifactDir: fixture.artifactDir,
    bundleRoot: fixture.temp,
    evidencePaths: fixture.evidence,
    controlBundle: fixture.manifest.controlBundle,
    releasePolicy,
    now: () => new Date('2026-07-12T01:00:00Z'),
    ...overrides,
  });
}

async function replaceWithHardLink(path, source) {
  await copyFile(path, source);
  await unlink(path);
  await link(source, path);
}

async function replaceWithSymlink(path, source) {
  await copyFile(path, source);
  await unlink(path);
  await symlink(source, path);
}

async function restoreLinkedReplacement(path, source) {
  await unlink(path);
  await copyFile(source, path);
  await unlink(source);
}

test('candidate tag parsing binds an RC number to a stable base version', () => {
  assert.deepEqual(parseCandidateTag('v4.1.0-rc.2'), {
    tag: 'v4.1.0-rc.2', stableVersion: '4.1.0', number: 2,
  });
  for (const tag of ['v4.1.0', '4.1.0-rc.1', 'v4.1.0-beta.1', 'v4.1.0-rc.01']) {
    assert.throws(() => parseCandidateTag(tag));
  }
});

test('candidate observation uses the GitHub Release published_at boundary and fails closed', () => {
  const common = {
    candidateReleaseMetadata: candidateReleaseMetadata(),
    candidateTag: 'v4.1.0-rc.1',
    sourceCommit: commit,
    repository: 'example/repository',
    candidateCreatedAt: '2026-07-12T01:00:00Z',
    minimumObservationHours: 168,
  };
  assert.throws(() => verifyCandidateObservation({
    ...common,
    now: () => new Date('2026-07-19T01:59:00Z'),
  }), /observation is incomplete/u);
  const accepted = verifyCandidateObservation({
    ...common,
    now: () => new Date('2026-07-19T02:00:00Z'),
  });
  assert.equal(accepted.observedDurationSeconds, 168 * 60 * 60);
  assert.equal(accepted.releaseId, 41001);
  for (const [override, error] of [
    [{ minimumObservationHours: 0 }, /positive whole-hour minimum/u],
    [{ minimumObservationHours: 1.5 }, /positive whole-hour minimum/u],
    [{ repository: 'not-a-repository' }, /exact GitHub repository/u],
    [{ sourceCommit: 'abc' }, /full source commit/u],
    [{ candidateCreatedAt: 'not-a-date' }, /manifest createdAt is invalid/u],
    [{ now: () => '2026-07-19T02:00:00Z' }, /current time is invalid/u],
  ]) {
    assert.throws(() => verifyCandidateObservation({ ...common, ...override }), error);
  }
  for (const metadata of [
    { ...candidateReleaseMetadata(), published_at: 'not-a-date' },
    { ...candidateReleaseMetadata(), published_at: '2026-07-20T00:00:00Z' },
    { ...candidateReleaseMetadata(), published_at: '2026-07-12T00:59:00Z' },
    { ...candidateReleaseMetadata(), tag_name: 'v4.1.0-rc.2' },
    { ...candidateReleaseMetadata(), id: 0 },
    { ...candidateReleaseMetadata(), draft: true },
    { ...candidateReleaseMetadata(), url: 'https://api.github.com/repos/other/repository/releases/41001' },
  ]) {
    assert.throws(() => verifyCandidateObservation({
      ...common,
      candidateReleaseMetadata: metadata,
      now: promotionNow,
    }));
  }
});

test('candidate manifest binds source, evidence, and deterministic artifacts for promotion', async (t) => {
  const fixture = await candidateFixture(t);
  assert.equal(fixture.manifest.artifacts.length, 5);
  assert.equal(fixture.manifest.evidence.length, 7);
  assert.equal(fixture.manifest.schemaVersion, 3);
  assert.equal(fixture.manifest.controlBundle.sha256, sha256File(fixture.controlBundle));
  assert.equal(fixture.manifest.candidate.stableVersion, '4.1.0');
  assert.equal(fixture.manifest.candidate.workflowSourceCommit, workflowSourceCommit);
  assert.equal(Object.keys(fixture.manifest.sourceDigests).length, candidateSourcePaths.length);
  const promoted = verifyReleasePromotion({
    root,
    stableTag: 'v4.1.0',
    commit,
    manifest: fixture.manifest,
    artifactDir: fixture.artifactDir,
  });
  assert.equal(promoted.candidateTag, 'v4.1.0-rc.1');
  assert.equal(promoted.workflowSourceCommit, workflowSourceCommit);
  assert.match(promoted.artifactDigest, /^[a-f0-9]{64}$/);
});

test('candidate rehearsal rejects zero, multiple, and mismatched artifacts', async (t) => {
  const missing = await candidateFixture(t);
  await unlink(join(missing.artifactDir, 'nova-plugin-4.1.0.tar.gz'));
  assert.throws(() => resolveCandidateArtifacts(missing.artifactDir, '4.1.0'), /exactly one archive; found 0/);

  const multiple = await candidateFixture(t);
  await writeFile(join(multiple.artifactDir, 'nova-plugin-9.9.9.tar.gz'), 'duplicate');
  assert.throws(() => resolveCandidateArtifacts(multiple.artifactDir, '4.1.0'), /exactly one archive; found 2/);

  const renamed = await candidateFixture(t);
  await rename(
    join(renamed.artifactDir, 'nova-plugin-4.1.0.tar.gz'),
    join(renamed.artifactDir, 'nova-plugin-9.9.9.tar.gz'),
  );
  assert.throws(
    () => resolveCandidateArtifacts(renamed.artifactDir, '4.1.0'),
    /artifacts do not match stable version 4\.1\.0/u,
  );

  const changed = await candidateFixture(t);
  await writeFile(join(changed.artifactDir, 'nova-plugin-4.1.0.tar.gz'), 'changed');
  assert.throws(() => verifyReleasePromotion({
    root,
    stableTag: 'v4.1.0',
    commit,
    manifest: changed.manifest,
    artifactDir: changed.artifactDir,
  }), /checksum evidence differs|artifact digest or size differs/);

  const expectedRecordDrift = await candidateFixture(t);
  const driftedManifest = structuredClone(expectedRecordDrift.manifest);
  driftedManifest.artifacts[0].bytes += 1;
  assert.throws(() => verifyReleasePromotion({
    root,
    stableTag: 'v4.1.0',
    commit,
    manifest: driftedManifest,
    artifactDir: expectedRecordDrift.artifactDir,
  }), /artifact digest or size differs during promotion/u);
});

test('candidate artifact handoff rejects unexpected entries and linked directories or files', async (t) => {
  const extra = await candidateFixture(t);
  await writeFile(join(extra.artifactDir, 'untracked.txt'), 'not declared');
  assert.throws(
    () => resolveCandidateArtifacts(extra.artifactDir, '4.1.0', extra.temp),
    /artifact directory contains unexpected entries/u,
  );

  const hardLinked = await candidateFixture(t);
  const archivePath = join(hardLinked.artifactDir, 'nova-plugin-4.1.0.tar.gz');
  await replaceWithHardLink(archivePath, join(hardLinked.temp, 'archive-hardlink-source.tar.gz'));
  assert.throws(
    () => resolveCandidateArtifacts(hardLinked.artifactDir, '4.1.0', hardLinked.temp),
    /hard linked/u,
  );

  if (process.platform !== 'win32') {
    const linkedLeaf = await candidateFixture(t);
    const linkedArchive = join(linkedLeaf.artifactDir, 'nova-plugin-4.1.0.tar.gz');
    await replaceWithSymlink(linkedArchive, join(linkedLeaf.temp, 'archive-symlink-source.tar.gz'));
    assert.throws(
      () => resolveCandidateArtifacts(linkedLeaf.artifactDir, '4.1.0', linkedLeaf.temp),
      /symlink or junction/u,
    );

    const linkedParent = await candidateFixture(t);
    const physicalArtifacts = join(linkedParent.temp, 'physical-artifacts');
    await rename(linkedParent.artifactDir, physicalArtifacts);
    await symlink(physicalArtifacts, linkedParent.artifactDir, 'dir');
    assert.throws(
      () => resolveCandidateArtifacts(linkedParent.artifactDir, '4.1.0', linkedParent.temp),
      /symlink or junction/u,
    );
  }
});

test('promotion rejects candidate version, commit, and source drift', async (t) => {
  const fixture = await candidateFixture(t);
  assert.throws(() => rebuildFixtureManifest(fixture, root, {
    controlBundle: { sha256: 'invalid', bytes: 1 },
  }), /content-addressed release control bundle/u);
  assert.throws(() => rebuildFixtureManifest(fixture, root, {
    releasePolicy: { ...releasePolicy, status: 'BLOCKED' },
  }), /READY digest-bound release correction evaluation/u);
  assert.throws(() => rebuildFixtureManifest(fixture, root, {
    tag: 'v9.9.9-rc.1',
  }), /candidate base version 9\.9\.9 does not match plugin version/u);
  assert.throws(() => buildReleaseCandidate({
    root,
    tag: 'v4.1.0-rc.1',
    commit,
    workflowSourceCommit: 'abc',
    artifactDir: fixture.artifactDir,
    bundleRoot: fixture.temp,
    evidencePaths: fixture.evidence,
    controlBundle: fixture.manifest.controlBundle,
    releasePolicy,
  }), /workflow source commit/u);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', expectedCandidateTag: 'v4.1.0-rc.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /selected candidate release/);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit: 'b'.repeat(40), manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /same commit/);
  for (const workflowSource of [undefined, 'abc', 'D'.repeat(40)]) {
    const invalid = structuredClone(fixture.manifest);
    invalid.candidate.workflowSourceCommit = workflowSource;
    assert.throws(() => verifyReleasePromotion({
      root, stableTag: 'v4.1.0', commit, manifest: invalid, artifactDir: fixture.artifactDir,
    }), /workflow source commit/u);
  }
  const oldSchema = structuredClone(fixture.manifest);
  oldSchema.schemaVersion = 2;
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: oldSchema, artifactDir: fixture.artifactDir,
  }), /schema must be 3/u);
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v3.0.2', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }), /stable version does not match/);
  const unboundControl = structuredClone(fixture.manifest);
  unboundControl.controlBundle.sha256 = 'invalid';
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: unboundControl, artifactDir: fixture.artifactDir,
  }), /does not bind a release control bundle/u);
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

test('candidate source reads reject hard-linked files and linked parent directories', async (t) => {
  const hardLinked = await candidateFixture(t);
  const hardLinkedRoot = await copyCandidateSourceTree(hardLinked.temp);
  const packagePath = join(hardLinkedRoot, 'package.json');
  await replaceWithHardLink(packagePath, join(hardLinkedRoot, 'package-hardlink-source.json'));
  assert.throws(() => rebuildFixtureManifest(hardLinked, hardLinkedRoot), /hard linked/u);

  if (process.platform !== 'win32') {
    const linkedParent = await candidateFixture(t);
    const linkedRoot = await copyCandidateSourceTree(linkedParent.temp);
    const githubDirectory = join(linkedRoot, '.github');
    const physicalGithubDirectory = join(linkedRoot, '.github-physical');
    await rename(githubDirectory, physicalGithubDirectory);
    await symlink(physicalGithubDirectory, githubDirectory, 'dir');
    assert.throws(() => rebuildFixtureManifest(linkedParent, linkedRoot), /parent.*symlink or junction/u);
  }
});

test('candidate evidence, install records, and checksum-only targets reject linked files', async (t) => {
  if (process.platform !== 'win32') {
    const linkedEvidence = await candidateFixture(t);
    const routeSmoke = linkedEvidence.evidence.find((path) => path.endsWith('route-smoke.json'));
    await replaceWithSymlink(routeSmoke, join(linkedEvidence.temp, 'route-smoke-symlink-source.json'));
    assert.throws(() => rebuildFixtureManifest(linkedEvidence), /symlink or junction/u);
  }

  const hardLinkedInstall = await candidateFixture(t);
  const installPath = hardLinkedInstall.evidence.find((path) => path.endsWith('inventory.json'));
  await replaceWithHardLink(installPath, join(hardLinkedInstall.temp, 'install-hardlink-source.json'));
  assert.throws(() => verifyReleasePromotion({
    root,
    stableTag: 'v4.1.0',
    commit,
    manifest: hardLinkedInstall.manifest,
    artifactDir: hardLinkedInstall.artifactDir,
  }), /hard linked/u);

  const checksumOnly = await candidateFixture(t);
  const checksumRoot = await copyCandidateSourceTree(checksumOnly.temp);
  const checksumPath = checksumOnly.evidence.find((path) => path.endsWith('SHA256SUMS.txt'));
  const marketplacePath = join(checksumRoot, '.claude-plugin/marketplace.json');
  await writeFile(checksumPath, checksumEvidence(checksumRoot, checksumOnly.artifactDir));
  const checksumManifest = rebuildFixtureManifest(checksumOnly, checksumRoot);
  await replaceWithHardLink(marketplacePath, join(checksumRoot, 'marketplace-hardlink-source.json'));
  assert.throws(() => verifyReleasePromotion({
    root: checksumRoot,
    stableTag: 'v4.1.0',
    commit,
    manifest: checksumManifest,
    artifactDir: checksumOnly.artifactDir,
  }), /checksum target \.claude-plugin\/marketplace\.json.*hard linked/u);
});

test('promotion fails closed for missing, replaced, or skipped required evidence', async (t) => {
  const fixture = await candidateFixture(t);
  const missing = structuredClone(fixture.manifest);
  missing.evidence = missing.evidence.filter((entry) => entry.kind !== 'route-smoke');
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: missing, artifactDir: fixture.artifactDir,
  }), /required promotion evidence is missing: route-smoke/);

  const extra = structuredClone(fixture.manifest);
  extra.evidence.push({ ...extra.evidence[0], kind: 'quality-summary' });
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: extra, artifactDir: fixture.artifactDir,
  }), /unsupported promotion evidence: quality-summary/);

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
  }), /complete uncached release gate set/);
});

test('candidate creation rejects placeholder digests, partial gates, incomplete route proof, and duplicate reviewers', async (t) => {
  const fixture = await candidateFixture(t);
  const cases = [
    {
      name: 'install-inventory',
      mutate(data) { data.sourceTreeDigest = 'same'; data.installedTreeDigest = 'same'; },
      error: /install inventory evidence/u,
    },
    {
      name: 'install-inventory',
      mutate(data) { data.marketplace.installSourceType = 'local-exact-tag-archive'; },
      error: /install inventory evidence/u,
    },
    {
      name: 'validation-timings',
      mutate(data) {
        data.gates = [data.gates[0]];
        data.summary.selectedTaskCount = 1;
      },
      error: /complete uncached release gate set/u,
    },
    {
      name: 'route-smoke',
      mutate(data) { delete data.projectFileInventory; },
      error: /route smoke evidence/u,
    },
    {
      name: 'route-smoke',
      mutate(data) {
        data.projectFileInventory[0].path = '../escape';
        data.beforeProjectDigest = sha256Json(data.projectFileInventory);
        data.afterProjectDigest = data.beforeProjectDigest;
      },
      error: /route smoke evidence/u,
    },
    {
      name: 'independent-review',
      mutate(data) { data.minimumApprovals = 2; data.approvalReviewers = ['peer', 'Peer']; },
      error: /distinct approved reviewer/u,
    },
    {
      name: 'coverage-metadata',
      mutate(data) { data.thresholds.lines = 0; },
      error: /passing checked run/u,
    },
    {
      name: 'workflow-provenance',
      mutate(data) { data.githubRunUrl = 'https://evil.example/example/repository/actions/runs/41001'; },
      error: /protected candidate workflow identity/u,
    },
    {
      name: 'workflow-provenance',
      mutate(data) { data.workflow.sha256 = '0'.repeat(64); },
      error: /protected candidate workflow identity/u,
    },
  ];
  for (const scenario of cases) {
    const path = fixture.evidence.find((entry) => entry.endsWith(`${scenario.name === 'install-inventory' ? 'inventory' : scenario.name}.json`));
    const original = await readFile(path, 'utf8');
    const data = JSON.parse(original);
    scenario.mutate(data);
    await writeFile(path, `${JSON.stringify(data)}\n`);
    assert.throws(() => rebuildFixtureManifest(fixture), scenario.error, scenario.name);
    await writeFile(path, original);
  }

  const inventoryPath = fixture.evidence.find((entry) => entry.endsWith('inventory.json'));
  const inventoryOriginal = await readFile(inventoryPath, 'utf8');
  await writeFile(inventoryPath, '{not-json\n');
  assert.throws(() => rebuildFixtureManifest(fixture), /install-inventory: evidence is not valid JSON/u);
  await writeFile(inventoryPath, inventoryOriginal);

  const provenancePath = fixture.evidence.find((entry) => entry.endsWith('workflow-provenance.json'));
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  const unavailableWorkflowCommit = 'f'.repeat(40);
  provenance.callerWorkflowSha = unavailableWorkflowCommit;
  provenance.workflowSourceCommit = unavailableWorkflowCommit;
  await writeFile(provenancePath, `${JSON.stringify(provenance)}\n`);
  assert.throws(
    () => rebuildFixtureManifest(fixture, root, { workflowSourceCommit: unavailableWorkflowCommit }),
    /protected candidate workflow identity/u,
  );
});

test('candidate checksums require the exact unique ordered ten-target contract', async (t) => {
  const fixture = await candidateFixture(t);
  const path = fixture.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt'));
  const canonical = (await readFile(path, 'utf8')).trimEnd().split('\n');
  assert.equal(canonical.length, 10);

  await writeFile(path, `${canonical[0]}\n`);
  assert.throws(() => rebuildFixtureManifest(fixture), /exactly 10 governed targets/u);

  await writeFile(path, `${[canonical[1], canonical[0], ...canonical.slice(2)].join('\n')}\n`);
  assert.throws(() => rebuildFixtureManifest(fixture), /checksum evidence target 1/u);

  await writeFile(path, `${[canonical[0], canonical[0], ...canonical.slice(2)].join('\n')}\n`);
  assert.throws(() => rebuildFixtureManifest(fixture), /checksum evidence target 2/u);
});

test('candidate artifact JSON must remain semantically bound to the archive and build identity', async (t) => {
  const mismatchedManifest = await candidateFixture(t);
  const manifestPath = join(mismatchedManifest.artifactDir, 'artifact-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.archive.bytes += 1;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    mismatchedManifest.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, mismatchedManifest.artifactDir),
  );
  assert.throws(
    () => rebuildFixtureManifest(mismatchedManifest),
    /artifact manifest does not describe the exact release archive/u,
  );

  const invalidPluginJson = await candidateFixture(t);
  await replaceArchivedPluginManifest(invalidPluginJson, '{not-json\n');
  assert.throws(
    () => rebuildFixtureManifest(invalidPluginJson),
    /archive plugin manifest is invalid JSON/u,
  );

  const wrongPluginIdentity = await candidateFixture(t);
  await replaceArchivedPluginManifest(wrongPluginIdentity, '{"name":"other-plugin","version":"4.1.0"}\n');
  assert.throws(
    () => rebuildFixtureManifest(wrongPluginIdentity),
    /archive plugin identity does not match the candidate version/u,
  );

  const invalidBuildRecord = await candidateFixture(t);
  const invalidBuildRecordPath = join(invalidBuildRecord.artifactDir, 'nova-build-record.json');
  const invalidRecord = JSON.parse(await readFile(invalidBuildRecordPath, 'utf8'));
  invalidRecord.githubRunId = null;
  await writeFile(invalidBuildRecordPath, `${JSON.stringify(invalidRecord)}\n`);
  await writeFile(
    invalidBuildRecord.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, invalidBuildRecord.artifactDir),
  );
  assert.throws(
    () => rebuildFixtureManifest(invalidBuildRecord),
    /build record does not bind the archive/u,
  );

  const crossBoundRecord = await candidateFixture(t);
  const crossBoundRecordPath = join(crossBoundRecord.artifactDir, 'nova-build-record.json');
  const crossBound = JSON.parse(await readFile(crossBoundRecordPath, 'utf8'));
  crossBound.candidateTag = 'v4.1.0-rc.2';
  await writeFile(crossBoundRecordPath, `${JSON.stringify(crossBound)}\n`);
  await writeFile(
    crossBoundRecord.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, crossBoundRecord.artifactDir),
  );
  assert.throws(
    () => rebuildFixtureManifest(crossBoundRecord),
    /artifacts are not cross-bound to the candidate/u,
  );

  const fixture = await candidateFixture(t);
  const originalSbom = JSON.parse(await readFile(join(fixture.artifactDir, 'build-sbom.cdx.json'), 'utf8'));
  const plausibleButIncomplete = {
    bomFormat: 'CycloneDX',
    specVersion: '1.7',
    version: 1,
    metadata: originalSbom.metadata,
    components: [{
      type: 'library', name: 'forged', version: '1.0.0',
      'bom-ref': 'pkg:npm/forged@1.0.0', purl: 'pkg:npm/forged@1.0.0', scope: 'required',
    }],
    dependencies: [],
    compositions: [],
    formulation: [],
  };
  await writeFile(join(fixture.artifactDir, 'build-sbom.cdx.json'), `${JSON.stringify(plausibleButIncomplete)}\n`);
  await writeFile(
    fixture.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, fixture.artifactDir),
  );
  assert.throws(() => rebuildFixtureManifest(fixture), /build SBOM.*complete archive-bound/u);

  const duplicateRuntime = await candidateFixture(t);
  const runtimePath = join(duplicateRuntime.artifactDir, 'runtime-capabilities.cdx.json');
  const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
  runtime.components.push(structuredClone(runtime.components[0]));
  await writeFile(runtimePath, `${JSON.stringify(runtime)}\n`);
  await writeFile(
    duplicateRuntime.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, duplicateRuntime.artifactDir),
  );
  assert.throws(() => rebuildFixtureManifest(duplicateRuntime), /runtime capabilities BOM.*exact governed runtimes/u);

  const forged = await candidateFixture(t);
  for (const name of releaseChecksumPaths('4.1.0').slice(5).map((entry) => entry.split('/').at(-1))) {
    await writeFile(join(forged.artifactDir, name), 'forged ordinary text\n');
  }
  await writeFile(
    forged.evidence.find((entry) => entry.endsWith('SHA256SUMS.txt')),
    checksumEvidence(root, forged.artifactDir),
  );
  assert.throws(() => rebuildFixtureManifest(forged), /header|archive|JSON/u);
});

test('candidate public evidence recursively rejects POSIX, drive, UNC, and backslash paths', async (t) => {
  const fixture = await candidateFixture(t);
  const inventoryPath = fixture.evidence.find((entry) => entry.endsWith('inventory.json'));
  const original = await readFile(inventoryPath, 'utf8');
  for (const leak of [
    '/tmp/plugin',
    'C:\\Users\\builder\\plugin',
    '\\\\server\\share\\plugin',
    'relative\\plugin',
    'error at /Users/builder/plugin/file.json',
    'node=/usr/local/bin/node',
    'node=C:/tools/node.exe',
    'file:///private/tmp/plugin',
  ]) {
    const data = JSON.parse(original);
    data.plugin.installPath = leak;
    await writeFile(inventoryPath, `${JSON.stringify(data)}\n`);
    assert.throws(() => rebuildFixtureManifest(fixture), /machine-local or non-portable path/u, leak);
  }
  await writeFile(inventoryPath, original);

  const keyed = JSON.parse(original);
  keyed.plugin['/Users/builder/private-install'] = true;
  await writeFile(inventoryPath, `${JSON.stringify(keyed)}\n`);
  assert.throws(() => rebuildFixtureManifest(fixture), /machine-local or non-portable path/u);
  await writeFile(inventoryPath, original);

  const coveragePath = fixture.evidence.find((entry) => entry.endsWith('coverage-metadata.json'));
  const coverage = JSON.parse(await readFile(coveragePath, 'utf8'));
  coverage.command[0] = process.execPath;
  await writeFile(coveragePath, `${JSON.stringify(coverage)}\n`);
  assert.throws(() => rebuildFixtureManifest(fixture), /machine-local or non-portable path/u);

  const manifest = structuredClone(fixture.manifest);
  manifest.controlBundle.path = '/tmp/release-control-bundle.tar.gz';
  assert.throws(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest, artifactDir: fixture.artifactDir,
  }), /machine-local or non-portable path/u);
});

test('promotion independently revalidates exact evidence semantics after digest rebinding', async (t) => {
  const fixture = await candidateFixture(t);
  const cases = [
    {
      kind: 'install-inventory', file: 'inventory.json', error: /identical validated install/u,
      mutate(data) { data.sourceTreeDigest = 'same'; data.installedTreeDigest = 'same'; },
    },
    {
      kind: 'install-inventory', file: 'inventory.json', error: /identical validated install/u,
      mutate(data) { data.marketplace.installSourceType = 'local-exact-tag-archive'; },
    },
    {
      kind: 'route-smoke', file: 'route-smoke.json', error: /valid zero-write execution/u,
      mutate(data) { data.resultSha256 = 'placeholder'; },
    },
    {
      kind: 'route-smoke', file: 'route-smoke.json', error: /valid zero-write execution/u,
      mutate(data) { data.variantParameters = { DEPTH: 'deep' }; },
    },
    {
      kind: 'independent-review', file: 'independent-review.json', error: /distinct approved reviewer/u,
      mutate(data) { data.minimumApprovals = 2; data.approvalReviewers = ['peer', 'Peer']; },
    },
  ];
  for (const scenario of cases) {
    const path = fixture.evidence.find((entry) => entry.endsWith(scenario.file));
    const original = await readFile(path, 'utf8');
    const data = JSON.parse(original);
    scenario.mutate(data);
    await writeFile(path, `${JSON.stringify(data)}\n`);
    const manifest = structuredClone(fixture.manifest);
    const record = manifest.evidence.find((entry) => entry.kind === scenario.kind);
    record.sha256 = sha256File(path);
    record.bytes = (await readFile(path)).length;
    assert.throws(() => verifyReleasePromotion({
      root, stableTag: 'v4.1.0', commit, manifest, artifactDir: fixture.artifactDir,
    }), scenario.error, scenario.kind);
    await writeFile(path, original);
  }
});

test('candidate independent review evidence is bound to the source-controlled approval threshold', async (t) => {
  const fixture = await candidateFixture(t);
  const candidateRoot = await copyCandidateSourceTree(fixture.temp);
  const policyPath = join(candidateRoot, 'governance/release-reviewers.json');
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  policy.sensitiveMinimumApprovals = 2;
  await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);

  const reviewPath = fixture.evidence.find((entry) => entry.endsWith('independent-review.json'));
  const review = JSON.parse(await readFile(reviewPath, 'utf8'));
  review.sensitive = true;
  await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);

  assert.throws(
    () => rebuildFixtureManifest(fixture, candidateRoot),
    /independent review evidence does not prove a distinct approved reviewer/u,
  );
});

test('promotion rejects non-portable release manifest paths before resolving them', async (t) => {
  const fixture = await candidateFixture(t);
  for (const path of [
    'evidence\\route-smoke.json',
    'evidence/./route-smoke.json',
    'evidence/../evidence/route-smoke.json',
    'evidence//route-smoke.json',
  ]) {
    const invalid = structuredClone(fixture.manifest);
    invalid.evidence.find((entry) => entry.kind === 'route-smoke').path = path;
    assert.throws(() => verifyReleasePromotion({
      root, stableTag: 'v4.1.0', commit, manifest: invalid, artifactDir: fixture.artifactDir,
    }), /portable|traversal|dot|empty/u, path);
  }
});

test('promotion accepts only the bounded Claude compatibility skip with exact-tag live install proof', async (t) => {
  const fixture = await candidateFixture(t);
  const timingPath = fixture.evidence.find((path) => path.endsWith('validation-timings.json'));
  const boundedSkip = completeValidationTimings({ skippedClaude: true });
  await writeFile(timingPath, JSON.stringify(boundedSkip));
  const timing = fixture.manifest.evidence.find((entry) => entry.kind === 'validation-timings');
  timing.sha256 = sha256File(timingPath);
  timing.bytes = (await readFile(timingPath)).length;
  assert.doesNotThrow(() => verifyReleasePromotion({
    root, stableTag: 'v4.1.0', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
  }));

  for (const mutate of [
    (data) => { data.gates.find((gate) => gate.id === 'claude.manifest.static').id = 'another.gate'; },
    (data) => { data.gates.find((gate) => gate.id === 'claude.manifest.static').reasonCode = 'UNKNOWN'; },
    (data) => { data.skipped = 2; },
  ]) {
    const data = structuredClone(boundedSkip);
    mutate(data);
    await writeFile(timingPath, JSON.stringify(data));
    timing.sha256 = sha256File(timingPath);
    timing.bytes = (await readFile(timingPath)).length;
    assert.throws(() => verifyReleasePromotion({
      root, stableTag: 'v4.1.0', commit, manifest: fixture.manifest, artifactDir: fixture.artifactDir,
    }), /complete uncached release gate set/);
  }
});

test('candidate CLI ingestion rejects linked review, manifest, control, and metadata inputs', async (t) => {
  const candidateArgs = (fixture, outDir) => [
    '--tag', 'v4.1.0-rc.1',
    '--stable-tag', 'v4.1.0',
    '--commit', commit,
    '--workflow-source-commit', workflowSourceCommit,
    '--control-bundle-manifest', fixture.controlManifest,
    '--artifact-dir', fixture.artifactDir,
    '--bundle-root', fixture.temp,
    ...fixture.evidence.flatMap((path) => ['--evidence', path]),
    '--out-dir', outDir,
  ];

  const reviewFixture = await candidateFixture(t);
  const reviewPath = reviewFixture.evidence.find((path) => path.endsWith('independent-review.json'));
  await replaceWithHardLink(reviewPath, join(reviewFixture.temp, 'review-hardlink-source.json'));
  assert.throws(() => generateReleaseCandidate({
    args: candidateArgs(reviewFixture, join(reviewFixture.temp, 'candidate-output')),
    env: {},
    correctionSource,
  }), /independent review evidence.*hard linked/u);

  if (process.platform !== 'win32') {
    const controlFixture = await candidateFixture(t);
    await replaceWithSymlink(controlFixture.controlManifest, join(controlFixture.temp, 'control-manifest-symlink-source.json'));
    assert.throws(() => generateReleaseCandidate({
      args: candidateArgs(controlFixture, join(controlFixture.temp, 'candidate-output')),
      env: {},
      correctionSource,
    }), /release control manifest.*symlink or junction/u);
  }

  const promotionFixture = await candidateFixture(t);
  const generated = generateReleaseCandidate({
    args: candidateArgs(promotionFixture, join(promotionFixture.temp, 'candidate-output')),
    env: {},
    correctionSource,
  });
  const promotionArgs = [
    '--stable-tag', 'v4.1.0',
    '--candidate-tag', 'v4.1.0-rc.1',
    '--commit', commit,
    '--repository', 'example/repository',
    '--manifest', generated.paths.envelope,
    '--candidate-core', generated.paths.core,
    '--promotion-intent', generated.paths.intent,
    '--control-bundle-manifest', promotionFixture.controlManifest,
    '--candidate-release-metadata', promotionFixture.candidateReleaseMetadataPath,
    '--observation-evidence-out', promotionFixture.observationEvidencePath,
    '--artifact-dir', promotionFixture.artifactDir,
    '--bundle-root', promotionFixture.temp,
  ];

  const envelopeSource = join(promotionFixture.temp, 'envelope-hardlink-source.json');
  await replaceWithHardLink(generated.paths.envelope, envelopeSource);
  assert.throws(
    () => verifyPromotion({ args: promotionArgs, env: {}, correctionSource }),
    /release candidate envelope.*hard linked/u,
  );
  await restoreLinkedReplacement(generated.paths.envelope, envelopeSource);

  if (process.platform !== 'win32') {
    const coreSource = join(promotionFixture.temp, 'core-symlink-source.json');
    await replaceWithSymlink(generated.paths.core, coreSource);
    assert.throws(
      () => verifyPromotion({ args: promotionArgs, env: {}, correctionSource }),
      /release candidate core.*symlink or junction/u,
    );
    await restoreLinkedReplacement(generated.paths.core, coreSource);
  }

  const controlBundleSource = join(promotionFixture.temp, 'control-bundle-hardlink-source.tar.gz');
  await replaceWithHardLink(promotionFixture.controlBundle, controlBundleSource);
  assert.throws(
    () => verifyPromotion({ args: promotionArgs, env: {}, correctionSource }),
    /release control bundle.*hard linked/u,
  );
  await restoreLinkedReplacement(promotionFixture.controlBundle, controlBundleSource);

  const metadataSource = join(promotionFixture.temp, 'metadata-hardlink-source.json');
  await replaceWithHardLink(promotionFixture.candidateReleaseMetadataPath, metadataSource);
  assert.throws(
    () => verifyPromotion({ args: promotionArgs, env: {}, correctionSource }),
    /candidate release metadata.*hard linked/u,
  );
});

test('candidate and promotion CLI parsers require explicit digest-bound identity', async (t) => {
  const fixture = await candidateFixture(t);
  const outDir = join(fixture.temp, 'candidate-output');
  const inventoryPath = fixture.evidence.find((path) => path.endsWith('inventory.json'));
  const routePath = fixture.evidence.find((path) => path.endsWith('route-smoke.json'));
  const existingInstall = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const live = liveEvidence('v4.1.0-rc.3', existingInstall.sourceTreeDigest);
  const provenancePath = fixture.evidence.find((path) => path.endsWith('workflow-provenance.json'));
  buildReleaseArtifacts({
    root,
    outDir: fixture.artifactDir,
    now: () => new Date('2026-07-12T00:00:00Z'),
    env: { RELEASE_TAG: 'v4.1.0-rc.3', RELEASE_COMMIT: commit, GITHUB_RUN_ID: '41001', RUNNER_OS: 'Linux' },
    runtimeNodeVersion: 'v22.20.0',
  });
  await writeFile(fixture.evidence.find((path) => path.endsWith('SHA256SUMS.txt')), checksumEvidence(root, fixture.artifactDir));
  await writeFile(inventoryPath, `${JSON.stringify(live.install)}\n`);
  await writeFile(routePath, `${JSON.stringify(live.route)}\n`);
  await writeFile(provenancePath, `${JSON.stringify(workflowProvenance('v4.1.0-rc.3'))}\n`);
  await writeFile(fixture.candidateReleaseMetadataPath, `${JSON.stringify(candidateReleaseMetadata('v4.1.0-rc.3'))}\n`);
  const result = generateReleaseCandidate({
    args: [
      '--tag', 'v4.1.0-rc.3',
      '--stable-tag', 'v4.1.0',
      '--commit', commit,
      '--workflow-source-commit', workflowSourceCommit,
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
  assert.equal(result.core.candidate.workflowSourceCommit, workflowSourceCommit);
  assert.equal(JSON.parse(await readFile(result.paths.intent, 'utf8')).candidateTag, 'v4.1.0-rc.3');
  const githubOutput = join(fixture.temp, 'github-output.txt');
  await writeFile(githubOutput, '');
  const verified = verifyPromotion({
    args: [
      '--stable-tag', 'v4.1.0', '--candidate-tag', 'v4.1.0-rc.3', '--commit', commit,
      '--repository', 'example/repository',
      '--manifest', result.paths.envelope, '--candidate-core', result.paths.core,
      '--promotion-intent', result.paths.intent, '--control-bundle-manifest', fixture.controlManifest,
      '--candidate-release-metadata', fixture.candidateReleaseMetadataPath,
      '--observation-evidence-out', fixture.observationEvidencePath,
      '--artifact-dir', fixture.artifactDir, '--bundle-root', fixture.temp, '--github-output', githubOutput,
    ],
    env: {}, correctionSource: correctionSourceFor('v4.1.0-rc.3'),
  });
  assert.equal(verified.candidateTag, 'v4.1.0-rc.3');
  assert.match(await readFile(githubOutput, 'utf8'), /candidate_tag=v4\.1\.0-rc\.3/u);
  assert.equal(JSON.parse(await readFile(fixture.observationEvidencePath, 'utf8')).status, 'passed');
  assert.equal(promotionMain(), 1);

  const envelope = JSON.parse(await readFile(result.paths.envelope, 'utf8'));
  const intent = JSON.parse(await readFile(result.paths.intent, 'utf8'));
  const core = JSON.parse(await readFile(result.paths.core, 'utf8'));
  const common = [
    '--stable-tag', 'v4.1.0', '--candidate-tag', 'v4.1.0-rc.3', '--commit', commit,
    '--repository', 'example/repository',
    '--manifest', result.paths.envelope, '--candidate-core', result.paths.core,
    '--promotion-intent', result.paths.intent, '--control-bundle-manifest', fixture.controlManifest,
    '--candidate-release-metadata', fixture.candidateReleaseMetadataPath,
    '--observation-evidence-out', fixture.observationEvidencePath,
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
  assert.throws(() => parseCandidateArgs(['--tag', 'v4.1.0-rc.4', '--stable-tag', 'v4.1.0', '--commit', commit, '--control-bundle-manifest', fixture.controlManifest], {}), /workflowSourceCommit/u);
  assert.throws(() => parseCandidateArgs(['--tag', 'v4.1.0-rc.4', '--stable-tag', 'v4.1.0', '--commit', commit, '--workflow-source-commit', 'abc', '--control-bundle-manifest', fixture.controlManifest], {}), /workflow source commit/u);
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
      '--workflow-source-commit', workflowSourceCommit,
      '--control-bundle-manifest', fixture.controlManifest,
      '--artifact-dir', fixture.artifactDir, '--bundle-root', fixture.temp,
      ...fixture.evidence.flatMap((path) => ['--evidence', path]),
      '--out-dir', join(fixture.temp, 'rejected-output'),
    ],
    env: {},
    correctionSource: correctionSourceFor('v4.1.0-rc.5'),
  }), /digest differs/u);
});
