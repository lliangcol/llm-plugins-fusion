import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { requireSemVer } from './semver.mjs';

export const candidateSourcePaths = Object.freeze([
  'package.json',
  'nova-plugin/.claude-plugin/plugin.json',
  'workflow-specs/workflows.json',
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

export function resolveCandidateArtifacts(artifactDir, stableVersion) {
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
      sha256: sha256File(path),
      bytes: statSync(path).size,
      kind: ['archive', 'sbom', 'provenance'][index],
    };
  });
}

function evidenceRecords(paths) {
  return [...new Set(paths)].sort().map((path) => ({
    name: basename(path),
    sha256: sha256File(path),
    bytes: statSync(path).size,
  }));
}

export function buildReleaseCandidate({
  root,
  tag,
  commit,
  artifactDir,
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
    schemaVersion: 1,
    candidate: {
      tag: candidate.tag,
      number: candidate.number,
      stableVersion: candidate.stableVersion,
      commit,
      createdAt: now().toISOString(),
    },
    sourceDigests,
    artifacts: resolveCandidateArtifacts(artifactDir, candidate.stableVersion),
    evidence: evidenceRecords(evidencePaths),
  };
}

export function verifyReleasePromotion({ root, stableTag, commit, manifest, artifactDir }) {
  if (!/^v/.test(stableTag ?? '')) throw new Error('stable tag must start with v');
  const stable = requireSemVer(stableTag.slice(1), 'stable tag version');
  if (stable.isPrerelease || stable.build) throw new Error('stable promotion tag must not contain prerelease or build metadata');
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('stable promotion commit must be a full Git SHA');
  const candidate = parseCandidateTag(manifest?.candidate?.tag);
  if (candidate.stableVersion !== stable.version || manifest.candidate.stableVersion !== stable.version) {
    throw new Error('candidate stable version does not match stable tag');
  }
  if (manifest.candidate.commit !== commit) throw new Error('candidate and stable tags do not point to the same commit');
  const plugin = JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8'));
  if (plugin.version !== stable.version) throw new Error('stable tag does not match plugin version');
  for (const [path, expected] of Object.entries(manifest.sourceDigests ?? {})) {
    if (sha256File(resolve(root, path)) !== expected) throw new Error(`candidate source digest differs for ${path}`);
  }
  const actualArtifacts = resolveCandidateArtifacts(artifactDir, stable.version);
  if (JSON.stringify(actualArtifacts) !== JSON.stringify(manifest.artifacts)) {
    throw new Error('candidate artifact digest or size differs during promotion');
  }
  return {
    candidateTag: manifest.candidate.tag,
    stableTag,
    stableVersion: stable.version,
    commit,
    artifactDigest: actualArtifacts.find((artifact) => artifact.kind === 'archive').sha256,
  };
}
