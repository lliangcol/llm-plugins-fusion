import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { requireSemVer } from './semver.mjs';

export const candidateSourcePaths = Object.freeze([
  'package.json',
  'package-lock.json',
  'nova-plugin/.claude-plugin/plugin.json',
  'workflow-specs/framework.json',
  'workflow-specs/nova.product.json',
  'workflow-specs/workflows.json',
  'workflow-specs/behaviors.json',
  'workflow-specs/adapters/claude.json',
  'workflow-specs/adapters/codex.json',
  'workflow-specs/adapters/generic.json',
  'governance/release-operations.json',
  'governance/release-corrections.json',
  'governance/release-reviewers.json',
  'governance/engineering-evidence.json',
  'governance/evidence/validation-performance-samples.json',
  '.github/release-signers',
  'schemas/release-corrections.schema.json',
  'schemas/release-reviewers.schema.json',
  'schemas/engineering-evidence.schema.json',
  'schemas/validation-performance.schema.json',
  'schemas/validation-performance-samples.schema.json',
  'scripts/verify-independent-release-review.mjs',
  'scripts/lib/release-review.mjs',
  'scripts/build-release-control-bundle.mjs',
  'scripts/release-orchestrator.mjs',
  'scripts/lib/release-state-machine.mjs',
  'scripts/lib/release-corrections.mjs',
  'scripts/validate-performance-budget.mjs',
  'scripts/lib/canonical-json.mjs',
  'scripts/lib/github-actions-performance-provenance.mjs',
  'scripts/lib/validation-performance-profile.mjs',
  'governance/release-channels.json',
  '.github/workflows/ci.yml',
  '.github/workflows/release-candidate.yml',
  '.github/workflows/promote-release.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-recovery-drill.yml',
]);

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function parseCandidateTag(tag) {
  const match = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))-rc\.((?:0|[1-9]\d*))$/.exec(tag ?? '');
  if (!match) throw new Error('candidate tag must match v<stable-semver>-rc.<number>');
  requireSemVer(match[1], 'candidate stable version');
  return { tag, stableVersion: match[1], number: Number(match[2]) };
}

export function verifyCandidateObservation({
  candidateReleaseMetadata,
  candidateTag,
  sourceCommit,
  repository,
  candidateCreatedAt,
  minimumObservationHours,
  now = () => new Date(),
}) {
  if (!Number.isInteger(minimumObservationHours) || minimumObservationHours < 1) {
    throw new Error('candidate observation policy requires a positive whole-hour minimum');
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository ?? '')) {
    throw new Error('candidate observation requires an exact GitHub repository');
  }
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit ?? '')) throw new Error('candidate observation requires a full source commit');
  if (!Number.isInteger(candidateReleaseMetadata?.id) || candidateReleaseMetadata.id < 1) {
    throw new Error('candidate observation requires a GitHub Release id');
  }
  if (candidateReleaseMetadata.tag_name !== candidateTag) {
    throw new Error('candidate observation release tag does not match the selected candidate');
  }
  if (candidateReleaseMetadata.draft !== false || candidateReleaseMetadata.prerelease !== true) {
    throw new Error('candidate observation requires a published prerelease');
  }
  if (typeof candidateReleaseMetadata.url !== 'string' || !candidateReleaseMetadata.url.endsWith(`/repos/${repository}/releases/${candidateReleaseMetadata.id}`)) {
    throw new Error('candidate observation GitHub Release API identity is invalid');
  }
  const publishedAt = new Date(candidateReleaseMetadata.published_at ?? '');
  const createdAt = new Date(candidateCreatedAt ?? '');
  const observedAt = now();
  if (Number.isNaN(publishedAt.getTime())) throw new Error('candidate observation published_at is invalid');
  if (Number.isNaN(createdAt.getTime())) throw new Error('candidate manifest createdAt is invalid');
  if (!(observedAt instanceof Date) || Number.isNaN(observedAt.getTime())) throw new Error('candidate observation current time is invalid');
  if (publishedAt.getTime() < createdAt.getTime()) throw new Error('candidate release predates its candidate manifest');
  const elapsedMs = observedAt.getTime() - publishedAt.getTime();
  if (elapsedMs < 0) throw new Error('candidate release published_at is in the future');
  const minimumObservationMs = minimumObservationHours * 60 * 60 * 1000;
  if (elapsedMs < minimumObservationMs) {
    throw new Error(`candidate observation is incomplete: ${Math.floor(elapsedMs / 1000)}s/${minimumObservationHours * 60 * 60}s`);
  }
  return {
    schemaVersion: 1,
    status: 'passed',
    source: 'github-releases-api-published-at',
    releaseId: candidateReleaseMetadata.id,
    repository,
    candidateTag,
    sourceCommit,
    publishedAt: publishedAt.toISOString(),
    observedAt: observedAt.toISOString(),
    observedDurationSeconds: Math.floor(elapsedMs / 1000),
    minimumObservationHours,
  };
}

function exactlyOne(names, predicate, label) {
  const matches = names.filter(predicate);
  if (matches.length !== 1) throw new Error(`candidate requires exactly one ${label}; found ${matches.length}`);
  return matches[0];
}

function portableRelative(root, path) {
  const value = relative(resolve(root), resolve(path));
  if (!value || value.startsWith('..') || isAbsolute(value)) throw new Error(`candidate bundle path escapes bundle root: ${path}`);
  return value.replaceAll('\\', '/');
}

export function resolveCandidateArtifacts(artifactDir, stableVersion, bundleRoot = artifactDir) {
  const names = readdirSync(artifactDir).sort();
  const archive = exactlyOne(names, (name) => /^nova-plugin-.*\.tar\.gz$/.test(name), 'archive');
  const artifactManifest = exactlyOne(names, (name) => name === 'artifact-manifest.json', 'artifact manifest');
  const buildSbom = exactlyOne(names, (name) => name === 'build-sbom.cdx.json', 'build SBOM');
  const runtimeCapabilities = exactlyOne(names, (name) => name === 'runtime-capabilities.cdx.json', 'runtime capabilities BOM');
  const buildRecord = exactlyOne(names, (name) => name === 'nova-build-record.json', 'build record');
  const expectedArchive = `nova-plugin-${stableVersion}.tar.gz`;
  const expected = [expectedArchive, 'artifact-manifest.json', 'build-sbom.cdx.json', 'runtime-capabilities.cdx.json', 'nova-build-record.json'];
  const actual = [archive, artifactManifest, buildSbom, runtimeCapabilities, buildRecord];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`candidate artifacts do not match stable version ${stableVersion}: ${actual.join(', ')}`);
  }
  return actual.map((name, index) => {
    const path = resolve(artifactDir, name);
    return {
      name,
      path: portableRelative(bundleRoot, path),
      sha256: sha256File(path),
      bytes: statSync(path).size,
      kind: ['archive', 'artifact-manifest', 'build-sbom', 'runtime-capabilities', 'build-record'][index],
    };
  });
}

const evidenceKinds = Object.freeze({
  'SHA256SUMS.txt': 'checksums',
  'coverage-metadata.json': 'coverage-metadata',
  'validation-timings.json': 'validation-timings',
  'inventory.json': 'install-inventory',
  'route-smoke.json': 'route-smoke',
  'quality-summary.json': 'quality-summary',
  'independent-review.json': 'independent-review',
});

function evidenceRecords(paths, bundleRoot) {
  return [...new Set(paths)].sort().map((path) => {
    const name = basename(path);
    const kind = evidenceKinds[name];
    if (!kind) throw new Error(`candidate evidence has unsupported name: ${name}`);
    return {
      kind,
      path: portableRelative(bundleRoot, path),
      sha256: sha256File(path),
      bytes: statSync(path).size,
      requiredForPromotion: true,
    };
  });
}

function installInventoryProvesExactTagValidation(data, candidate) {
  return data.validation?.passed === true
    && !data.validation?.errors?.length
    && data.inventoryDiff?.matches === true
    && data.manifestValidation?.marketplace === true
    && data.manifestValidation?.plugin === true
    && data.sourceTreeDigest === data.installedTreeDigest
    && data.plugin?.version === candidate.stableVersion
    && data.marketplace?.ref === candidate.tag;
}

function validationTimingsArePromotable(data, exactTagInstall, candidate) {
  if (data.failed !== 0 || !Array.isArray(data.gates) || data.gates.length === 0) return false;
  const skipped = data.gates.filter((gate) => gate.status === 'skipped');
  if (data.skipped !== skipped.length) return false;
  if (data.gates.some((gate) => !['passed', 'skipped'].includes(gate.status))) return false;
  if (skipped.length === 0) return true;
  return skipped.length === 1
    && skipped[0].id === 'claude.manifest.static'
    && skipped[0].reasonCode === 'LOCAL_RUNTIME_UNAVAILABLE'
    && installInventoryProvesExactTagValidation(exactTagInstall ?? {}, candidate);
}

function verifyEvidenceRecord(root, bundleRoot, record, candidate, exactTagInstall) {
  if (record.requiredForPromotion !== true) throw new Error(`${record.kind}: promotion evidence must be required`);
  const path = resolve(bundleRoot, record.path);
  portableRelative(bundleRoot, path);
  if (sha256File(path) !== record.sha256 || statSync(path).size !== record.bytes) {
    throw new Error(`${record.kind}: evidence digest or size differs during promotion`);
  }
  if (record.path.endsWith('.json')) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (record.kind === 'coverage-metadata' && (data.check !== true || data.exitCode !== 0 || !data.thresholds || !data.summaryPath)) {
      throw new Error('coverage evidence does not prove a passing checked run');
    }
    if (record.kind === 'validation-timings' && !validationTimingsArePromotable(data, exactTagInstall, candidate)) {
      throw new Error('validation timing evidence contains failed or skipped gates');
    }
    if (record.kind === 'install-inventory' && !installInventoryProvesExactTagValidation(data, candidate)) {
      throw new Error('install inventory evidence does not prove an identical validated install');
    }
    if (record.kind === 'route-smoke' && (
      data.outputStructureValid !== true
      || ![0, 1].includes(data.processExitCode)
      || (data.processExitCode === 0 && data.processCompletion !== 'zero-exit')
      || (data.processExitCode === 1 && data.processCompletion !== 'claude-json-success-completed')
      || typeof data.processStderrPresent !== 'boolean'
      || !Number.isInteger(data.processStderrBytes)
      || data.processStderrBytes < 0
      || data.processStderrPresent !== (data.processStderrBytes > 0)
      || !/^[a-f0-9]{64}$/u.test(data.processStderrSha256 ?? '')
      || data.projectChanged !== false
      || data.gitStatus !== ''
      || data.authenticationMode !== 'claude-code-oauth-token'
      || data.configurationIsolation !== 'temporary-home'
      || data.beforeProjectDigest !== data.afterProjectDigest
    )) {
      throw new Error('route smoke evidence does not prove valid zero-write execution');
    }
    if (record.kind === 'independent-review' && (
      data.passed !== true
      || data.commit !== candidate.commit
      || !/^[a-f0-9]{40}$/u.test(data.pullRequestHead ?? '')
      || data.expectedReviewCommit !== data.pullRequestHead
      || !Number.isInteger(data.minimumApprovals)
      || data.minimumApprovals < 1
      || !Array.isArray(data.approvalReviewers)
      || data.approvalReviewers.length < data.minimumApprovals
      || data.approvalReviewers.some((reviewer) => data.excludedReviewers?.includes(reviewer))
    )) {
      throw new Error('independent review evidence does not prove a distinct approved reviewer');
    }
  }
  if (record.kind === 'checksums') {
    const lines = readFileSync(path, 'utf8').trim().split(/\r?\n/u);
    for (const line of lines) {
      const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
      if (!match) throw new Error('checksum evidence contains a malformed line');
      const [, expected, recordedPath] = match;
      const target = recordedPath.startsWith('.metrics/release-artifacts/')
        ? resolve(bundleRoot, 'artifacts', basename(recordedPath))
        : resolve(root, recordedPath);
      if (sha256File(target) !== expected) throw new Error(`checksum evidence differs for ${recordedPath}`);
    }
  }
}

export function buildReleaseCandidate({
  root,
  tag,
  commit,
  workflowSourceCommit,
  artifactDir,
  bundleRoot = artifactDir,
  evidencePaths = [],
  controlBundle,
  releasePolicy,
  now = () => new Date(),
}) {
  const candidate = parseCandidateTag(tag);
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('candidate commit must be a full Git SHA');
  if (!/^[a-f0-9]{40}$/.test(workflowSourceCommit ?? '')) throw new Error('workflow source commit must be a full Git SHA');
  if (!controlBundle || !/^[a-f0-9]{64}$/u.test(controlBundle.sha256 ?? '') || !Number.isInteger(controlBundle.bytes)) {
    throw new Error('candidate requires a content-addressed release control bundle');
  }
  if (releasePolicy?.status !== 'READY' || !/^[a-f0-9]{64}$/u.test(releasePolicy.correctionsSha256 ?? '')) {
    throw new Error('candidate requires a READY digest-bound release correction evaluation');
  }
  const plugin = JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8'));
  if (plugin.version !== candidate.stableVersion) {
    throw new Error(`candidate base version ${candidate.stableVersion} does not match plugin version ${plugin.version}`);
  }
  const sourceDigests = Object.fromEntries(candidateSourcePaths.map((path) => [path, sha256File(resolve(root, path))]));
  return {
    schemaVersion: 3,
    candidate: {
      tag: candidate.tag,
      number: candidate.number,
      stableVersion: candidate.stableVersion,
      commit,
      workflowSourceCommit,
      createdAt: now().toISOString(),
    },
    sourceDigests,
    controlBundle,
    releasePolicy: {
      status: releasePolicy.status,
      reasonCode: releasePolicy.reasonCode,
      correctionIds: releasePolicy.correctionIds,
      correctionsSha256: releasePolicy.correctionsSha256,
      maximumPermittedState: releasePolicy.maximumPermittedState,
    },
    artifacts: resolveCandidateArtifacts(artifactDir, candidate.stableVersion, bundleRoot),
    evidence: evidenceRecords(evidencePaths, bundleRoot),
  };
}

export function verifyReleasePromotion({
  root,
  stableTag,
  expectedCandidateTag = null,
  commit,
  manifest,
  artifactDir,
  bundleRoot = resolve(artifactDir, '..'),
  candidateReleaseMetadata,
  repository,
  minimumObservationHours,
  now = () => new Date(),
}) {
  if (manifest?.schemaVersion !== 3) throw new Error('candidate manifest schema must be 3');
  if (!/^[a-f0-9]{40}$/u.test(manifest?.candidate?.workflowSourceCommit ?? '')) {
    throw new Error('candidate manifest workflow source commit must be a full Git SHA');
  }
  if (!/^[a-f0-9]{64}$/u.test(manifest?.controlBundle?.sha256 ?? '') || !Number.isInteger(manifest?.controlBundle?.bytes)) {
    throw new Error('candidate manifest does not bind a release control bundle');
  }
  if (!/^v/.test(stableTag ?? '')) throw new Error('stable tag must start with v');
  const stable = requireSemVer(stableTag.slice(1), 'stable tag version');
  if (stable.isPrerelease || stable.build) throw new Error('stable promotion tag must not contain prerelease or build metadata');
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('stable promotion commit must be a full Git SHA');
  const candidate = parseCandidateTag(manifest?.candidate?.tag);
  if (expectedCandidateTag && candidate.tag !== expectedCandidateTag) throw new Error('candidate manifest tag does not match the selected candidate release');
  if (candidate.stableVersion !== stable.version || manifest.candidate.stableVersion !== stable.version) {
    throw new Error('candidate stable version does not match stable tag');
  }
  if (manifest.candidate.commit !== commit) throw new Error('candidate and stable tags do not point to the same commit');
  const observation = verifyCandidateObservation({
    candidateReleaseMetadata,
    candidateTag: candidate.tag,
    sourceCommit: commit,
    repository,
    candidateCreatedAt: manifest.candidate.createdAt,
    minimumObservationHours,
    now,
  });
  const plugin = JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8'));
  if (plugin.version !== stable.version) throw new Error('stable tag does not match plugin version');
  for (const [path, expected] of Object.entries(manifest.sourceDigests ?? {})) {
    if (sha256File(resolve(root, path)) !== expected) throw new Error(`candidate source digest differs for ${path}`);
  }
  if (JSON.stringify(Object.keys(manifest.sourceDigests ?? {}).sort()) !== JSON.stringify([...candidateSourcePaths].sort())) {
    throw new Error('candidate source digest inventory differs from the required source set');
  }
  const actualArtifacts = resolveCandidateArtifacts(artifactDir, stable.version, bundleRoot);
  if (JSON.stringify(actualArtifacts) !== JSON.stringify(manifest.artifacts)) {
    throw new Error('candidate artifact digest or size differs during promotion');
  }
  const requiredKinds = ['checksums', 'coverage-metadata', 'validation-timings', 'install-inventory', 'route-smoke', 'independent-review'];
  const actualKinds = (manifest.evidence ?? []).map((entry) => entry.kind).sort();
  for (const kind of requiredKinds) {
    if (!actualKinds.includes(kind)) throw new Error(`candidate required promotion evidence is missing: ${kind}`);
  }
  if (new Set(actualKinds).size !== actualKinds.length) throw new Error('candidate evidence kinds must be unique');
  const installRecord = manifest.evidence.find((entry) => entry.kind === 'install-inventory');
  let exactTagInstall = null;
  if (installRecord) {
    const installPath = resolve(bundleRoot, installRecord.path);
    portableRelative(bundleRoot, installPath);
    if (sha256File(installPath) === installRecord.sha256 && statSync(installPath).size === installRecord.bytes) {
      exactTagInstall = JSON.parse(readFileSync(installPath, 'utf8'));
    }
  }
  for (const record of manifest.evidence) verifyEvidenceRecord(root, bundleRoot, record, manifest.candidate, exactTagInstall);
  return {
    candidateTag: manifest.candidate.tag,
    stableTag,
    stableVersion: stable.version,
    commit,
    workflowSourceCommit: manifest.candidate.workflowSourceCommit,
    artifactDigest: actualArtifacts.find((artifact) => artifact.kind === 'archive').sha256,
    observation,
  };
}
