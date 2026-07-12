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
  'scripts/verify-independent-release-review.mjs',
  'scripts/lib/release-review.mjs',
  '.github/workflows/release-candidate.yml',
  '.github/workflows/promote-release.yml',
  '.github/workflows/release.yml',
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
  const sbom = exactlyOne(names, (name) => /^nova-plugin-.*\.tar\.gz\.cdx\.json$/.test(name), 'SBOM');
  const provenance = exactlyOne(names, (name) => /^nova-plugin-.*\.tar\.gz\.provenance\.json$/.test(name), 'provenance');
  const expectedArchive = `nova-plugin-${stableVersion}.tar.gz`;
  const expected = [expectedArchive, `${expectedArchive}.cdx.json`, `${expectedArchive}.provenance.json`];
  const actual = [archive, sbom, provenance];
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
      kind: ['archive', 'sbom', 'provenance'][index],
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

function verifyEvidenceRecord(root, bundleRoot, record, candidate) {
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
    if (record.kind === 'validation-timings' && (data.failed !== 0 || data.skipped !== 0 || !Array.isArray(data.gates) || data.gates.length === 0 || data.gates.some((gate) => gate.status !== 'passed'))) {
      throw new Error('validation timing evidence contains failed or skipped gates');
    }
    if (record.kind === 'install-inventory' && (
      data.validation?.passed !== true
      || data.validation?.errors?.length
      || data.inventoryDiff?.matches !== true
      || data.manifestValidation?.marketplace !== true
      || data.manifestValidation?.plugin !== true
      || data.sourceTreeDigest !== data.installedTreeDigest
      || data.plugin?.version !== candidate.stableVersion
      || data.marketplace?.ref !== candidate.tag
    )) {
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
  artifactDir,
  bundleRoot = artifactDir,
  evidencePaths = [],
  now = () => new Date(),
}) {
  const candidate = parseCandidateTag(tag);
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('candidate commit must be a full Git SHA');
  const plugin = JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8'));
  if (plugin.version !== candidate.stableVersion) {
    throw new Error(`candidate base version ${candidate.stableVersion} does not match plugin version ${plugin.version}`);
  }
  const sourceDigests = Object.fromEntries(candidateSourcePaths.map((path) => [path, sha256File(resolve(root, path))]));
  return {
    schemaVersion: 2,
    candidate: {
      tag: candidate.tag,
      number: candidate.number,
      stableVersion: candidate.stableVersion,
      commit,
      createdAt: now().toISOString(),
    },
    sourceDigests,
    artifacts: resolveCandidateArtifacts(artifactDir, candidate.stableVersion, bundleRoot),
    evidence: evidenceRecords(evidencePaths, bundleRoot),
  };
}

export function verifyReleasePromotion({ root, stableTag, expectedCandidateTag = null, commit, manifest, artifactDir, bundleRoot = resolve(artifactDir, '..') }) {
  if (manifest?.schemaVersion !== 2) throw new Error('candidate manifest schema must be 2');
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
  for (const record of manifest.evidence) verifyEvidenceRecord(root, bundleRoot, record, manifest.candidate);
  return {
    candidateTag: manifest.candidate.tag,
    stableTag,
    stableVersion: stable.version,
    commit,
    artifactDigest: actualArtifacts.find((artifact) => artifact.kind === 'archive').sha256,
  };
}
