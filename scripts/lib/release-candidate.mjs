import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import {
  createPhysicalReadBoundary,
  readPhysicalDirectory,
  readPhysicalFile,
} from './physical-read-boundary.mjs';
import { requireSemVer } from './semver.mjs';
import { assertPortableRelativePath, portableRelativeFromRoot } from './portable-path.mjs';
import { parseTarGzEntries } from './safe-tar.mjs';
import { releaseArtifactNames, releaseChecksumPaths } from './release-checksum-contract.mjs';
import { DEFAULT_COVERAGE_THRESHOLDS } from './coverage-thresholds.mjs';
import { coverageCommand } from './coverage-runner.mjs';
import { relativeTestFiles } from './test-discovery.mjs';
import { validationTaskDefinitions } from './validation-task-registry.mjs';
import { validateReleaseReviewerPolicy } from './release-review.mjs';
import {
  routeAllowedTools,
  routeDisallowedTools,
  routeMaxTurns,
  routeOutputContract,
  routeSmokeExpectedSelection,
  routeSystemPromptSha256,
} from '../validate-plugin-route-live.mjs';

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
  'nova-plugin/runtime/route-output-contract.json',
  'nova-plugin/runtime/workflow-permissions.json',
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
  'scripts/validate-plugin-route-live.mjs',
  'scripts/lib/validation-task-registry.mjs',
  'scripts/lib/canonical-json.mjs',
  'scripts/lib/github-actions-performance-provenance.mjs',
  'scripts/lib/validation-performance-profile.mjs',
  'scripts/lib/coverage-runner.mjs',
  'scripts/lib/coverage-thresholds.mjs',
  'scripts/lib/test-discovery.mjs',
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
  return portableRelativeFromRoot(root, path, 'candidate bundle path');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function protectedCandidateWorkflowSha256(root, workflowSourceCommit) {
  const result = spawnSync(
    'git',
    ['show', `${workflowSourceCommit}:.github/workflows/release-candidate.yml`],
    { cwd: root, encoding: 'buffer', shell: false, maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr?.toString('utf8').trim() ?? '';
    throw new Error(`unable to read the protected candidate workflow at ${workflowSourceCommit}: ${detail || `git exited ${result.status}`}`);
  }
  return sha256(result.stdout);
}

function archiveTreeManifest(archive) {
  return parseTarGzEntries(archive).map((entry) => {
    const mode = `${entry.type === 'directory' ? '040' : '100'}${(entry.mode & 0o777).toString(8).padStart(3, '0')}`;
    return entry.type === 'directory'
      ? { path: entry.path, type: entry.type, mode }
      : { path: entry.path, type: entry.type, mode, bytes: entry.content.length, sha256: sha256(entry.content) };
  });
}

function publicEvidencePathLeak(value) {
  if (typeof value !== 'string') return false;
  if (value.includes('\\') || /^file:/iu.test(value)) return true;
  if (/(?:^|[\s="'([{=])[A-Za-z]:\//u.test(value)) return true;
  const absoluteTokens = value.matchAll(/(?:^|[\s="'([{=])(\/[^\s"'()\[\]{}<>]*)/gu);
  for (const match of absoluteTokens) {
    const token = match[1].replace(/[,.!?;]+$/u, '');
    if (!/^\/[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+$/u.test(token)) return true;
  }
  return false;
}

export function assertPublicEvidencePortable(value, label = 'public evidence', location = '$') {
  if (publicEvidencePathLeak(value)) {
    throw new Error(`${label} contains a machine-local or non-portable path at ${location}`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPublicEvidencePortable(entry, label, `${location}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [index, [key, entry]] of Object.entries(value).entries()) {
      assertPublicEvidencePortable(key, label, `${location}{key:${index}}`);
      assertPublicEvidencePortable(entry, label, `${location}{value:${index}}`);
    }
  }
  return value;
}

function parseArtifactJson(files, name, label) {
  try {
    const value = JSON.parse(files.get(name).buffer.toString('utf8'));
    assertPublicEvidencePortable(value, label);
    return value;
  } catch (error) {
    throw new Error(`${label} is not valid public JSON evidence: ${error.message}`, { cause: error });
  }
}

function validCycloneDxDocument(value, componentName, stableVersion) {
  return value?.bomFormat === 'CycloneDX'
    && value.specVersion === '1.7'
    && value.version === 1
    && value.metadata?.component?.name === componentName
    && value.metadata.component.version === stableVersion
    && validTimestamp(value.metadata?.timestamp);
}

function validBuildSbom(value, stableVersion, archiveSha256) {
  const rootRef = `build:llm-plugins-fusion@${stableVersion}`;
  const components = Array.isArray(value?.components) ? value.components : [];
  const refs = components.map((component) => component?.['bom-ref']);
  const dependencies = Array.isArray(value?.dependencies) ? value.dependencies : [];
  const dependencyByRef = new Map(dependencies.map((entry) => [entry?.ref, entry]));
  return validCycloneDxDocument(value, 'llm-plugins-fusion-build', stableVersion)
    && value.metadata.component.type === 'application'
    && value.metadata.component['bom-ref'] === rootRef
    && value.metadata.component.hashes?.length === 1
    && value.metadata.component.hashes[0]?.alg === 'SHA-256'
    && value.metadata.component.hashes[0]?.content === archiveSha256
    && components.length > 0
    && refs.every((ref) => typeof ref === 'string' && ref.length > 0)
    && new Set(refs).size === refs.length
    && components.every((component) => component?.type === 'library'
      && typeof component.name === 'string'
      && component.name.length > 0
      && typeof component.version === 'string'
      && component.version.length > 0
      && component.purl === component['bom-ref']
      && ['required', 'optional'].includes(component.scope))
    && dependencies.length === components.length + 1
    && dependencyByRef.size === dependencies.length
    && sameArray(dependencyByRef.get(rootRef)?.dependsOn, refs)
    && refs.every((ref) => sameArray(dependencyByRef.get(ref)?.dependsOn, []))
    && sameArray(value.compositions, [{ aggregate: 'complete', assemblies: [rootRef] }])
    && sameArray(value.formulation, [{ components }]);
}

function validRuntimeBom(value, stableVersion, archiveSha256) {
  const rootRef = `pkg:generic/nova-plugin@${stableVersion}`;
  const components = Array.isArray(value?.components) ? value.components : [];
  const names = components.map((component) => component?.name);
  const refs = components.map((component) => component?.['bom-ref']);
  if (components.length !== 4
    || new Set(names).size !== names.length
    || new Set(refs).size !== refs.length
    || !sameArray([...names].sort(), ['Bash', 'Claude Code', 'Codex', 'Node.js'])) return false;
  const byName = new Map(components.map((component) => [component.name, component]));
  const node = byName.get('Node.js');
  const bash = byName.get('Bash');
  const claude = byName.get('Claude Code');
  const codex = byName.get('Codex');
  return validCycloneDxDocument(value, 'nova-plugin', stableVersion)
    && value.metadata.component.type === 'application'
    && value.metadata.component['bom-ref'] === rootRef
    && value.metadata.component.hashes?.length === 1
    && value.metadata.component.hashes[0]?.alg === 'SHA-256'
    && value.metadata.component.hashes[0]?.content === archiveSha256
    && node?.type === 'platform'
    && node.version === '>=22'
    && node['bom-ref'] === 'runtime:node>=22'
    && sameArray(node.properties, [{ name: 'nova:known-good', value: node.properties?.[0]?.value }])
    && /^v22\./u.test(node.properties[0].value ?? '')
    && bash?.type === 'application'
    && bash.version === '>=3.2'
    && bash['bom-ref'] === 'runtime:bash>=3.2'
    && claude?.type === 'application'
    && typeof claude.version === 'string'
    && claude.version.length > 0
    && claude['bom-ref'] === 'host:claude-code'
    && codex?.type === 'application'
    && typeof codex.version === 'string'
    && codex.version.length > 0
    && codex['bom-ref'] === 'external:codex'
    && sameArray(value.dependencies, [{
      ref: rootRef,
      dependsOn: ['runtime:node>=22', 'runtime:bash>=3.2', 'host:claude-code', 'external:codex'],
    }]);
}

function validateCandidateArtifactSemantics(files, stableVersion, validation = null) {
  const archiveName = `nova-plugin-${stableVersion}.tar.gz`;
  const archiveFile = files.get(archiveName);
  const artifactManifestFile = files.get('artifact-manifest.json');
  const artifactManifest = parseArtifactJson(files, 'artifact-manifest.json', 'candidate artifact manifest');
  const archiveManifest = archiveTreeManifest(archiveFile.buffer);
  if (artifactManifest?.schemaVersion !== 1
    || artifactManifest.archive?.name !== archiveName
    || artifactManifest.archive?.sha256 !== archiveFile.sha256
    || artifactManifest.archive?.bytes !== archiveFile.bytes
    || artifactManifest.pluginTree?.manifestVersion !== 2
    || artifactManifest.pluginTree?.sha256 !== sha256(JSON.stringify(archiveManifest))
    || !sameArray(artifactManifest.pluginTree?.entries, archiveManifest)) {
    throw new Error('candidate artifact manifest does not describe the exact release archive and plugin tree');
  }
  const pluginManifestEntry = parseTarGzEntries(archiveFile.buffer).find((entry) => (
    entry.type === 'file' && entry.path === '.claude-plugin/plugin.json'
  ));
  if (!pluginManifestEntry) throw new Error('candidate release archive is missing its plugin manifest');
  let plugin;
  try {
    plugin = JSON.parse(pluginManifestEntry.content.toString('utf8'));
  } catch (error) {
    throw new Error(`candidate release archive plugin manifest is invalid JSON: ${error.message}`, { cause: error });
  }
  if (plugin.name !== 'nova-plugin' || plugin.version !== stableVersion) {
    throw new Error('candidate release archive plugin identity does not match the candidate version');
  }

  const buildSbom = parseArtifactJson(files, 'build-sbom.cdx.json', 'candidate build SBOM');
  if (!validBuildSbom(buildSbom, stableVersion, archiveFile.sha256)) {
    throw new Error('candidate build SBOM is not a complete archive-bound CycloneDX document');
  }

  const runtime = parseArtifactJson(files, 'runtime-capabilities.cdx.json', 'candidate runtime capabilities BOM');
  if (!validRuntimeBom(runtime, stableVersion, archiveFile.sha256)) {
    throw new Error('candidate runtime capabilities BOM is not bound to the archive and exact governed runtimes');
  }
  const runtimeComponents = new Map(runtime.components.map((component) => [component.name, component]));
  const runtimeNode = runtimeComponents.get('Node.js');
  const runtimeClaude = runtimeComponents.get('Claude Code');

  const buildRecord = parseArtifactJson(files, 'nova-build-record.json', 'candidate build record');
  const startedOn = new Date(buildRecord?.startedOn ?? '');
  const finishedOn = new Date(buildRecord?.finishedOn ?? '');
  if (buildRecord?.schemaVersion !== 1
    || buildRecord.subject?.name !== archiveName
    || buildRecord.subject?.sha256 !== archiveFile.sha256
    || buildRecord.artifactManifestSha256 !== artifactManifestFile.sha256
    || buildRecord.workflow?.path !== '.github/workflows/release-candidate.yml'
    || !sha256Pattern.test(buildRecord.workflow?.sha256 ?? '')
    || !/^v22\./u.test(buildRecord.nodeVersion ?? '')
    || buildRecord.nodeVersion !== runtimeNode.properties.find((entry) => entry?.name === 'nova:known-good')?.value
    || !/^\d+$/u.test(buildRecord.githubRunId ?? '')
    || !validTimestamp(buildRecord.startedOn)
    || !validTimestamp(buildRecord.finishedOn)
    || finishedOn.getTime() < startedOn.getTime()
    || typeof buildRecord.runnerImage !== 'string'
    || buildRecord.runnerImage.length === 0) {
    throw new Error('candidate build record does not bind the archive, artifact manifest, workflow, Node 22, and GitHub run');
  }
  if (validation) {
    if (buildRecord.sourceCommit !== validation.candidate.commit
      || buildRecord.candidateTag !== validation.candidate.tag
      || buildRecord.workflow.sha256 !== validation.sourceFiles.get('.github/workflows/release-candidate.yml').sha256
      || runtimeClaude.version !== validation.contract.knownGoodClaudeCli
      || validation.exactTagInstall?.sourceTreeDigest !== artifactManifest.pluginTree.sha256) {
      throw new Error('candidate artifacts are not cross-bound to the candidate, source workflow, runtime, and exact-tag install');
    }
  }
}

function resolveCandidateArtifactsWithinBoundary(artifactDir, stableVersion, bundleRoot, bundleBoundary, validation = null) {
  const names = readPhysicalDirectory(bundleBoundary, artifactDir, 'candidate artifact directory');
  const archive = exactlyOne(names, (name) => /^nova-plugin-.*\.tar\.gz$/.test(name), 'archive');
  const artifactManifest = exactlyOne(names, (name) => name === 'artifact-manifest.json', 'artifact manifest');
  const buildSbom = exactlyOne(names, (name) => name === 'build-sbom.cdx.json', 'build SBOM');
  const runtimeCapabilities = exactlyOne(names, (name) => name === 'runtime-capabilities.cdx.json', 'runtime capabilities BOM');
  const buildRecord = exactlyOne(names, (name) => name === 'nova-build-record.json', 'build record');
  const expected = releaseArtifactNames(stableVersion);
  const actual = [archive, artifactManifest, buildSbom, runtimeCapabilities, buildRecord];
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`candidate artifacts do not match stable version ${stableVersion}: ${actual.join(', ')}`);
  }
  if (JSON.stringify(names) !== JSON.stringify([...expected].sort())) {
    throw new Error(`candidate artifact directory contains unexpected entries: ${names.join(', ')}`);
  }
  const files = new Map();
  const records = actual.map((name, index) => {
    const path = resolve(artifactDir, name);
    const file = readPhysicalFile(bundleBoundary, path, `candidate artifact ${name}`);
    files.set(name, file);
    return {
      name,
      path: portableRelative(bundleRoot, path),
      sha256: file.sha256,
      bytes: file.bytes,
      kind: ['archive', 'artifact-manifest', 'build-sbom', 'runtime-capabilities', 'build-record'][index],
    };
  });
  if (JSON.stringify(readPhysicalDirectory(bundleBoundary, artifactDir, 'candidate artifact directory')) !== JSON.stringify(names)) {
    throw new Error('candidate artifact directory changed while it was read');
  }
  if (validation?.expectedArtifacts && !sameArray(records, validation.expectedArtifacts)) {
    throw new Error('candidate artifact digest or size differs during promotion');
  }
  validateCandidateArtifactSemantics(files, stableVersion, validation);
  return records;
}

export function resolveCandidateArtifacts(artifactDir, stableVersion, bundleRoot = artifactDir) {
  const bundleBoundary = createPhysicalReadBoundary(bundleRoot, 'candidate bundle root');
  return resolveCandidateArtifactsWithinBoundary(artifactDir, stableVersion, bundleRoot, bundleBoundary);
}

const evidenceKinds = Object.freeze({
  'SHA256SUMS.txt': 'checksums',
  'coverage-metadata.json': 'coverage-metadata',
  'validation-timings.json': 'validation-timings',
  'inventory.json': 'install-inventory',
  'route-smoke.json': 'route-smoke',
  'quality-summary.json': 'quality-summary',
  'independent-review.json': 'independent-review',
  'workflow-provenance.json': 'workflow-provenance',
});

const hookSyntaxGateIds = Object.freeze([
  'hooks.syntax.prewritecheck',
  'hooks.syntax.prebashcheck',
  'hooks.syntax.trustednodehook',
  'hooks.syntax.postauditlog',
]);

export const requiredReleaseValidationGateIds = Object.freeze(validationTaskDefinitions.flatMap((definition) => (
  definition.id === 'hooks.syntax' ? hookSyntaxGateIds : [definition.id]
)));

const validationGateIdByLabel = new Map(validationTaskDefinitions.map((definition) => [definition.label, definition.id]));
const sha256Pattern = /^[a-f0-9]{64}$/u;

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validTimestamp(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function identityKey(value) {
  return typeof value === 'string' && value === value.trim() && value.length > 0
    ? value.toLowerCase()
    : null;
}

function uniqueIdentities(values) {
  if (!Array.isArray(values)) return null;
  const keys = values.map(identityKey);
  if (keys.some((value) => value === null) || new Set(keys).size !== keys.length) return null;
  return keys;
}

export function independentReviewProvesCandidate(data, candidate, reviewerPolicy) {
  const approvals = uniqueIdentities(data?.approvalReviewers);
  const trusted = uniqueIdentities(data?.trustedReviewers);
  const excluded = uniqueIdentities(data?.excludedReviewers);
  const author = identityKey(data?.pullRequestAuthor);
  const actor = identityKey(data?.candidateActor);
  const trustedSet = new Set(trusted ?? []);
  const excludedSet = new Set(excluded ?? []);
  const governedBots = new Set(reviewerPolicy?.botIdentities ?? []);
  const governedMinimumApprovals = data?.sensitive === true
    ? reviewerPolicy?.sensitiveMinimumApprovals
    : reviewerPolicy?.standardMinimumApprovals;
  return data?.schemaVersion === 1
    && data.passed === true
    && data.commit === candidate.commit
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(data.repository ?? '')
    && Number.isInteger(data.pullRequest)
    && data.pullRequest > 0
    && /^[a-f0-9]{40}$/u.test(data.pullRequestHead ?? '')
    && data.expectedReviewCommit === data.pullRequestHead
    && typeof data.sensitive === 'boolean'
    && reviewerPolicy?.status === 'configured'
    && data.reviewerPolicyStatus === reviewerPolicy.status
    && Number.isInteger(data.minimumApprovals)
    && data.minimumApprovals >= 1
    && data.minimumApprovals === governedMinimumApprovals
    && approvals !== null
    && trusted !== null
    && excluded !== null
    && author !== null
    && actor !== null
    && approvals.length >= data.minimumApprovals
    && excludedSet.has(author)
    && excludedSet.has(actor)
    && reviewerPolicy.trustedUsers.every((reviewer) => trustedSet.has(reviewer))
    && (reviewerPolicy.trustedTeams.length > 0
      || (trustedSet.size === reviewerPolicy.trustedUsers.length
        && reviewerPolicy.trustedUsers.every((reviewer) => trustedSet.has(reviewer))))
    && approvals.every((reviewer) => trustedSet.has(reviewer)
      && !excludedSet.has(reviewer)
      && !governedBots.has(reviewer)
      && !reviewer.endsWith('[bot]'))
    && validTimestamp(data.checkedAt);
}

function releaseEvidenceContract(sourceFiles, root) {
  const permissionSpec = JSON.parse(sourceFiles.get('nova-plugin/runtime/workflow-permissions.json').buffer.toString('utf8'));
  const product = JSON.parse(sourceFiles.get('workflow-specs/nova.product.json').buffer.toString('utf8'));
  const engineeringEvidence = JSON.parse(sourceFiles.get('governance/engineering-evidence.json').buffer.toString('utf8'));
  const reviewerPolicy = validateReleaseReviewerPolicy(
    JSON.parse(sourceFiles.get('governance/release-reviewers.json').buffer.toString('utf8')),
  );
  const expectedSkills = [...permissionSpec.expectedInventory.commandIds, ...permissionSpec.expectedInventory.skillNames].sort();
  const coverageTestFiles = relativeTestFiles(root, 'all');
  return {
    expectedSkills,
    expectedSkillCount: permissionSpec.expectedInventory.combinedSkillCount,
    primaryEntrypoints: permissionSpec.primaryEntrypoints.map((id) => `/${permissionSpec.pluginNamespace}:${id}`),
    knownGoodClaudeCli: product.runtimeCompatibility?.['claude-code'],
    reviewerPolicy,
    criticalModuleCount: Object.keys(engineeringEvidence.criticalCoverage?.modules ?? {}).length,
    coverageCommand: ['node', ...coverageCommand(coverageTestFiles)],
    coverageTestFiles,
    routeInventory: {
      commands: new Set(permissionSpec.expectedInventory.commandIds),
      skills: new Set(permissionSpec.expectedInventory.skillNames),
      agents: new Set(product.agents),
      packs: new Set(product.packs),
      workflows: new Map(permissionSpec.workflows.map((workflow) => [workflow.id, workflow])),
    },
  };
}

function evidenceRecords(paths, bundleRoot, bundleBoundary) {
  return [...new Set(paths)].sort().map((path) => {
    const name = basename(path);
    const kind = evidenceKinds[name];
    if (!kind) throw new Error(`candidate evidence has unsupported name: ${name}`);
    const file = readPhysicalFile(bundleBoundary, path, `candidate evidence ${name}`);
    return {
      kind,
      path: portableRelative(bundleRoot, path),
      sha256: file.sha256,
      bytes: file.bytes,
      requiredForPromotion: true,
    };
  });
}

function installInventoryProvesExactTagValidation(data, candidate, contract) {
  const skills = Array.isArray(data.inventory?.skills) ? [...data.inventory.skills] : null;
  const sortedSkills = skills ? [...skills].sort() : null;
  const expectedSkills = contract.expectedSkills;
  const sourceDigest = data.sourceTreeDigest;
  const expectedInventorySha256 = sha256Json(expectedSkills);
  return data.schemaVersion === 2
    && validTimestamp(data.generatedAt)
    && data.validation?.passed === true
    && sameArray(data.validation?.errors, [])
    && data.inventoryDiff?.matches === true
    && data.inventoryDiff?.actualCount === contract.expectedSkillCount
    && data.inventoryDiff?.expectedCount === contract.expectedSkillCount
    && sameArray(data.inventoryDiff?.missing, [])
    && sameArray(data.inventoryDiff?.unexpected, [])
    && data.inventoryDiff?.actualSha256 === expectedInventorySha256
    && data.inventoryDiff?.expectedSha256 === expectedInventorySha256
    && data.manifestValidation?.marketplace === true
    && data.manifestValidation?.plugin === true
    && sha256Pattern.test(sourceDigest ?? '')
    && sourceDigest === data.installedTreeDigest
    && data.plugin?.version === candidate.stableVersion
    && typeof data.plugin?.id === 'string'
    && data.plugin.id.length > 0
    && sameArray(Object.keys(data.plugin).sort(), ['id', 'version'])
    && data.marketplace?.ref === candidate.tag
    && typeof data.marketplace?.source === 'string'
    && data.marketplace.source.endsWith(`@${candidate.tag}`)
    && data.marketplace.installSourceType === 'local-manifest-remote-exact-ref'
    && data.inventory?.count === contract.expectedSkillCount
    && skills?.length === contract.expectedSkillCount
    && new Set(skills).size === skills.length
    && sameArray(sortedSkills, expectedSkills)
    && sameArray(data.primaryEntrypoints, contract.primaryEntrypoints)
    && sameArray(data.installedTreeIgnoredPaths, ['.in_use/**'])
    && data.treeManifestVersion === 2
    && data.knownGoodClaudeCli === contract.knownGoodClaudeCli
    && typeof data.claudeVersion === 'string'
    && data.claudeVersion.startsWith(contract.knownGoodClaudeCli);
}

function coverageMetadataProvesGovernedRun(data, contract) {
  const metrics = ['lines', 'branches', 'functions'];
  const command = data?.command;
  const testFiles = contract.coverageTestFiles;
  const startedAt = new Date(data?.startedAt ?? '');
  const completedAt = new Date(data?.completedAt ?? '');
  const timestampsValid = validTimestamp(data?.startedAt)
    && validTimestamp(data?.completedAt)
    && completedAt.getTime() >= startedAt.getTime();
  const commandValid = Array.isArray(command)
    && sameArray(command, contract.coverageCommand)
    && testFiles.length > 0
    && testFiles.length === data.testFileCount
    && new Set(testFiles).size === testFiles.length
    && testFiles.every((path) => {
      try {
        return assertPortableRelativePath(path, 'coverage test path').startsWith('tests/')
          && path.endsWith('.test.mjs');
      } catch {
        return false;
      }
    });
  return data?.schemaVersion === 2
    && data.check === true
    && data.gatePassed === true
    && data.exitCode === 0
    && data.signal === null
    && commandValid
    && /^v22\./u.test(data.nodeVersion ?? '')
    && metrics.every((metric) => data.thresholds?.[metric] === DEFAULT_COVERAGE_THRESHOLDS[metric])
    && metrics.every((metric) => Number.isFinite(data.actual?.[metric])
      && data.actual[metric] >= data.thresholds[metric]
      && data.actual[metric] <= 100)
    && timestampsValid
    && Number.isInteger(data.durationMs)
    && data.durationMs >= 0
    && data.durationMs === completedAt.getTime() - startedAt.getTime()
    && data.coverageDir === '.metrics/coverage'
    && data.v8Dir === '.metrics/coverage/v8'
    && data.summaryPath === '.metrics/coverage/coverage-summary.txt'
    && sha256Pattern.test(data.summarySha256 ?? '')
    && Number.isInteger(data.rawCoverageFileCount)
    && data.rawCoverageFileCount > 0
    && data.criticalModuleCount === contract.criticalModuleCount
    && data.criticalModulesPassed === contract.criticalModuleCount
    && Number.isInteger(data.expectedSourceCount)
    && data.expectedSourceCount > 0
    && data.loadedSourceCount === data.expectedSourceCount
    && data.missingSourceCount === 0;
}

function workflowProvenanceProvesCandidate(data, candidate, repository, root) {
  const runUrl = (() => {
    try { return new URL(data?.githubRunUrl ?? ''); } catch { return null; }
  })();
  const protectedWorkflowSha256 = (() => {
    try { return protectedCandidateWorkflowSha256(root, candidate.workflowSourceCommit); } catch { return null; }
  })();
  return data?.schemaVersion === 1
    && data.operation === 'release-candidate'
    && data.repository === repository
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository ?? '')
    && /^\d+$/u.test(data.githubRunId ?? '')
    && Number.isInteger(data.githubRunAttempt)
    && data.githubRunAttempt >= 1
    && runUrl?.origin === 'https://github.com'
    && runUrl.pathname === `/${repository}/actions/runs/${data.githubRunId}`
    && runUrl.search === ''
    && runUrl.hash === ''
    && data.eventName === 'repository_dispatch'
    && data.callerWorkflowRef === `${repository}/.github/workflows/release-candidate.yml@refs/heads/main`
    && data.callerWorkflowSha === candidate.workflowSourceCommit
    && data.workflow?.path === '.github/workflows/release-candidate.yml'
    && data.workflow?.sha256 === protectedWorkflowSha256
    && data.workflowSourceCommit === candidate.workflowSourceCommit
    && data.candidateTag === candidate.tag
    && data.candidateCommit === candidate.commit
    && /^v22\./u.test(data.nodeVersion ?? '')
    && validTimestamp(data.generatedAt);
}

function canonicalValidationGateId(gate) {
  if (typeof gate.id === 'string' && gate.id) return gate.id;
  return validationGateIdByLabel.get(gate.label) ?? null;
}

function validationTimingsArePromotable(data, exactTagInstall, candidate, contract) {
  if (
    data.schemaVersion !== 2
    || !validTimestamp(data.generatedAt)
    || typeof data.runId !== 'string'
    || !data.runId
    || data.failed !== 0
    || !Array.isArray(data.gates)
    || data.gates.length !== requiredReleaseValidationGateIds.length
    || data.summary?.mode !== 'full'
    || data.summary?.selectedTaskCount !== data.gates.length
    || data.summary?.cacheHitCount !== 0
    || !/^sha256:[a-f0-9]{64}$/u.test(data.summary?.digests?.registry ?? '')
    || !/^sha256:[a-f0-9]{64}$/u.test(data.summary?.digests?.policy ?? '')
  ) return false;
  const gateIds = data.gates.map(canonicalValidationGateId);
  if (gateIds.some((id) => id === null)
    || new Set(gateIds).size !== gateIds.length
    || !sameArray([...gateIds].sort(), [...requiredReleaseValidationGateIds].sort())) return false;
  if (data.gates.some((gate) => (
    typeof gate.label !== 'string'
    || gate.label.length === 0
    || !Number.isInteger(gate.durationMs)
    || gate.durationMs < 0
    || gate.cached !== false
  ))) return false;
  const skipped = data.gates.filter((gate) => gate.status === 'skipped');
  if (data.skipped !== skipped.length) return false;
  if (data.gates.some((gate) => !['passed', 'skipped'].includes(gate.status))) return false;
  if (skipped.length === 0) return true;
  return skipped.length === 1
    && canonicalValidationGateId(skipped[0]) === 'claude.manifest.static'
    && skipped[0].reasonCode === 'LOCAL_RUNTIME_UNAVAILABLE'
    && installInventoryProvesExactTagValidation(exactTagInstall ?? {}, candidate, contract);
}

function validProjectInventory(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const paths = new Set();
  for (const entry of entries) {
    if (typeof entry?.path !== 'string' || paths.has(entry.path) || !['file', 'directory', 'symlink'].includes(entry.type)) return false;
    try {
      assertPortableRelativePath(entry.path, 'route project inventory path');
    } catch {
      return false;
    }
    paths.add(entry.path);
    if (entry.type === 'file' && (!Number.isInteger(entry.bytes) || entry.bytes < 0 || !sha256Pattern.test(entry.sha256 ?? ''))) return false;
    if (entry.type === 'symlink' && typeof entry.target !== 'string') return false;
  }
  return true;
}

function validRouteInventoryField(values, allowed) {
  return Array.isArray(values)
    && values.length > 0
    && new Set(values).size === values.length
    && values.every((value) => typeof value === 'string' && allowed.has(value));
}

function routeSmokeProvesExactTagValidation(data, install, candidate, contract) {
  const projectFileInventory = data.projectFileInventory;
  const projectPaths = new Map((projectFileInventory ?? []).map((entry) => [entry?.path, entry?.type]));
  const binding = data.evidenceBinding;
  const routeInventory = contract.routeInventory;
  const command = Array.isArray(data.commands) && data.commands.length === 1 ? data.commands[0] : null;
  const expectedSkill = command ? `nova-${routeInventory.workflows.get(command)?.canonicalSurfaceId ?? ''}` : null;
  return data.schemaVersion === 1
    && validTimestamp(data.generatedAt)
    && data.outputStructureValid === true
    && [0, 1].includes(data.processExitCode)
    && (data.processExitCode !== 0 || data.processCompletion === 'zero-exit')
    && (data.processExitCode !== 1 || data.processCompletion === 'claude-json-success-completed')
    && typeof data.processStderrPresent === 'boolean'
    && Number.isInteger(data.processStderrBytes)
    && data.processStderrBytes >= 0
    && data.processStderrPresent === (data.processStderrBytes > 0)
    && sha256Pattern.test(data.processStderrSha256 ?? '')
    && data.projectChanged === false
    && data.gitStatus === ''
    && data.authenticationMode === 'claude-code-oauth-token'
    && data.configurationIsolation === 'temporary-home'
    && data.permissionMode === 'dontAsk'
    && sameArray(data.allowedTools, routeAllowedTools)
    && sameArray(data.disallowedTools, routeDisallowedTools)
    && data.outputContract === routeOutputContract.id
    && data.systemPromptSha256 === routeSystemPromptSha256
    && data.maxTurns === routeMaxTurns
    && data.invocation === '/nova-plugin:route'
    && sha256Pattern.test(data.resultSha256 ?? '')
    && sha256Pattern.test(data.beforeDigest ?? '')
    && data.beforeDigest === data.afterDigest
    && sha256Pattern.test(data.beforeProjectDigest ?? '')
    && data.beforeProjectDigest === data.afterProjectDigest
    && validProjectInventory(projectFileInventory)
    && projectPaths.get('.git') === 'directory'
    && projectPaths.get('.git/HEAD') === 'file'
    && sha256Json(projectFileInventory) === data.beforeProjectDigest
    && validRouteInventoryField(data.commands, routeInventory.commands)
    && validRouteInventoryField(data.skills, routeInventory.skills)
    && validRouteInventoryField(data.agents, routeInventory.agents)
    && validRouteInventoryField(data.packs, routeInventory.packs)
    && sameArray(data.commands, routeSmokeExpectedSelection.commands)
    && sameArray(data.skills, routeSmokeExpectedSelection.skills)
    && sameArray(data.agents, routeSmokeExpectedSelection.agents)
    && sameArray(data.packs, routeSmokeExpectedSelection.packs)
    && sameArray(data.variantParameters, routeSmokeExpectedSelection.variantParameters)
    && data.skills.length === 1
    && data.skills[0] === expectedSkill
    && binding?.ref === candidate.tag
    && binding?.commit === candidate.commit
    && binding?.evidenceSource === install.marketplace.source
    && binding?.artifactTreeDigest === install.sourceTreeDigest
    && binding?.installedTreeDigest === install.installedTreeDigest
    && binding?.assistantVersion === install.claudeVersion
    && JSON.stringify(install.routeSmoke) === JSON.stringify(data);
}

const requiredPromotionEvidenceKinds = Object.freeze([
  'checksums',
  'coverage-metadata',
  'validation-timings',
  'install-inventory',
  'route-smoke',
  'independent-review',
  'workflow-provenance',
]);

function assertRequiredPromotionEvidence(records) {
  const actualKinds = records.map((entry) => entry.kind).sort();
  for (const kind of requiredPromotionEvidenceKinds) {
    if (!actualKinds.includes(kind)) throw new Error(`candidate required promotion evidence is missing: ${kind}`);
  }
  if (new Set(actualKinds).size !== actualKinds.length) throw new Error('candidate evidence kinds must be unique');
  const unexpectedKinds = actualKinds.filter((kind) => !requiredPromotionEvidenceKinds.includes(kind));
  if (unexpectedKinds.length > 0) {
    throw new Error(`candidate evidence contains unsupported promotion evidence: ${unexpectedKinds.join(', ')}`);
  }
}

function readPromotionEvidence(bundleRoot, bundleBoundary, record) {
  if (record.requiredForPromotion !== true) throw new Error(`${record.kind}: promotion evidence must be required`);
  assertPortableRelativePath(record.path, `${record.kind}: evidence path`);
  const path = resolve(bundleRoot, record.path);
  portableRelative(bundleRoot, path);
  const file = readPhysicalFile(bundleBoundary, path, `${record.kind}: promotion evidence`);
  if (file.sha256 !== record.sha256 || file.bytes !== record.bytes) {
    throw new Error(`${record.kind}: evidence digest or size differs during promotion`);
  }
  return file;
}

function parsePublicEvidenceData(records, evidenceFiles) {
  const data = new Map();
  for (const record of records) {
    if (!record.path.endsWith('.json')) continue;
    let value;
    try {
      value = JSON.parse(evidenceFiles.get(record).buffer.toString('utf8'));
    } catch (error) {
      throw new Error(`${record.kind}: evidence is not valid JSON: ${error.message}`, { cause: error });
    }
    assertPublicEvidencePortable(value, `${record.kind}: public evidence`);
    data.set(record.kind, value);
  }
  return data;
}

function verifyEvidenceRecord(root, bundleRoot, record, candidate, exactTagInstall, file, repoBoundary, bundleBoundary, contract, evidenceData) {
  if (record.path.endsWith('.json')) {
    const data = evidenceData.get(record.kind);
    if (record.kind === 'coverage-metadata' && !coverageMetadataProvesGovernedRun(data, contract)) {
      throw new Error('coverage evidence does not prove a passing checked run');
    }
    if (record.kind === 'validation-timings' && !validationTimingsArePromotable(data, exactTagInstall, candidate, contract)) {
      throw new Error('validation timing evidence does not prove the complete uncached release gate set');
    }
    if (record.kind === 'install-inventory' && !installInventoryProvesExactTagValidation(data, candidate, contract)) {
      throw new Error('install inventory evidence does not prove an identical validated install');
    }
    if (record.kind === 'route-smoke' && !routeSmokeProvesExactTagValidation(data, exactTagInstall ?? {}, candidate, contract)) {
      throw new Error('route smoke evidence does not prove valid zero-write execution');
    }
    if (record.kind === 'independent-review' && !independentReviewProvesCandidate(data, candidate, contract.reviewerPolicy)) {
      throw new Error('independent review evidence does not prove a distinct approved reviewer');
    }
    if (record.kind === 'workflow-provenance' && !workflowProvenanceProvesCandidate(
      data,
      candidate,
      evidenceData.get('independent-review')?.repository,
      root,
    )) {
      throw new Error('workflow provenance does not prove the protected candidate workflow identity');
    }
  }
  if (record.kind === 'checksums') {
    const text = file.buffer.toString('utf8');
    if (!text.endsWith('\n') || text.includes('\r')) throw new Error('checksum evidence must use canonical LF-terminated lines');
    const lines = text.slice(0, -1).split('\n');
    const expectedPaths = releaseChecksumPaths(candidate.stableVersion);
    if (lines.length !== expectedPaths.length) {
      throw new Error(`checksum evidence must contain exactly ${expectedPaths.length} governed targets`);
    }
    for (const [index, line] of lines.entries()) {
      const match = /^([a-f0-9]{64})  (.+)$/u.exec(line);
      if (!match) throw new Error('checksum evidence contains a malformed line');
      const [, expected, recordedPath] = match;
      if (recordedPath !== expectedPaths[index]) {
        throw new Error(`checksum evidence target ${index + 1} is ${recordedPath}, expected ${expectedPaths[index]}`);
      }
      assertPortableRelativePath(recordedPath, 'checksum evidence path');
      const target = recordedPath.startsWith('.metrics/release-artifacts/')
        ? resolve(bundleRoot, 'artifacts', basename(recordedPath))
        : resolve(root, recordedPath);
      const targetBoundary = recordedPath.startsWith('.metrics/release-artifacts/') ? bundleBoundary : repoBoundary;
      const targetFile = readPhysicalFile(targetBoundary, target, `checksum target ${recordedPath}`);
      if (targetFile.sha256 !== expected) throw new Error(`checksum evidence differs for ${recordedPath}`);
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
  const repoBoundary = createPhysicalReadBoundary(root, 'candidate source root');
  const bundleBoundary = createPhysicalReadBoundary(bundleRoot, 'candidate bundle root');
  const sourceFiles = new Map(candidateSourcePaths.map((path) => [
    path,
    readPhysicalFile(repoBoundary, resolve(root, path), `candidate source ${path}`),
  ]));
  const plugin = JSON.parse(sourceFiles.get('nova-plugin/.claude-plugin/plugin.json').buffer.toString('utf8'));
  if (plugin.version !== candidate.stableVersion) {
    throw new Error(`candidate base version ${candidate.stableVersion} does not match plugin version ${plugin.version}`);
  }
  const sourceDigests = Object.fromEntries(candidateSourcePaths.map((path) => [path, sourceFiles.get(path).sha256]));
  const contract = releaseEvidenceContract(sourceFiles, root);
  const evidence = evidenceRecords(evidencePaths, bundleRoot, bundleBoundary);
  assertRequiredPromotionEvidence(evidence);
  const evidenceFiles = new Map(evidence.map((record) => [
    record,
    readPromotionEvidence(bundleRoot, bundleBoundary, record),
  ]));
  const evidenceData = parsePublicEvidenceData(evidence, evidenceFiles);
  const exactTagInstall = evidenceData.get('install-inventory');
  const candidateIdentity = { ...candidate, commit, workflowSourceCommit };
  for (const record of evidence) {
    verifyEvidenceRecord(
      root,
      bundleRoot,
      record,
      candidateIdentity,
      exactTagInstall,
      evidenceFiles.get(record),
      repoBoundary,
      bundleBoundary,
      contract,
      evidenceData,
    );
  }
  const artifacts = resolveCandidateArtifactsWithinBoundary(
    artifactDir,
    candidate.stableVersion,
    bundleRoot,
    bundleBoundary,
    { candidate: candidateIdentity, exactTagInstall, contract, sourceFiles },
  );
  const manifest = {
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
    artifacts,
    evidence,
  };
  assertPublicEvidencePortable(manifest, 'release candidate manifest');
  return manifest;
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
  assertPublicEvidencePortable(manifest, 'release candidate manifest');
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
  const repoBoundary = createPhysicalReadBoundary(root, 'candidate source root');
  const bundleBoundary = createPhysicalReadBoundary(bundleRoot, 'candidate bundle root');
  const sourceFiles = new Map(candidateSourcePaths.map((path) => [
    path,
    readPhysicalFile(repoBoundary, resolve(root, path), `candidate source ${path}`),
  ]));
  const plugin = JSON.parse(sourceFiles.get('nova-plugin/.claude-plugin/plugin.json').buffer.toString('utf8'));
  if (plugin.version !== stable.version) throw new Error('stable tag does not match plugin version');
  if (JSON.stringify(Object.keys(manifest.sourceDigests ?? {}).sort()) !== JSON.stringify([...candidateSourcePaths].sort())) {
    throw new Error('candidate source digest inventory differs from the required source set');
  }
  for (const [path, expected] of Object.entries(manifest.sourceDigests ?? {})) {
    assertPortableRelativePath(path, 'candidate source digest path');
    if (sourceFiles.get(path)?.sha256 !== expected) throw new Error(`candidate source digest differs for ${path}`);
  }
  assertRequiredPromotionEvidence(manifest.evidence ?? []);
  const contract = releaseEvidenceContract(sourceFiles, root);
  const evidenceFiles = new Map(manifest.evidence.map((record) => [
    record,
    readPromotionEvidence(bundleRoot, bundleBoundary, record),
  ]));
  const evidenceData = parsePublicEvidenceData(manifest.evidence, evidenceFiles);
  const installRecord = manifest.evidence.find((entry) => entry.kind === 'install-inventory');
  const exactTagInstall = installRecord ? evidenceData.get('install-inventory') : null;
  for (const record of manifest.evidence) {
    verifyEvidenceRecord(
      root,
      bundleRoot,
      record,
      manifest.candidate,
      exactTagInstall,
      evidenceFiles.get(record),
      repoBoundary,
      bundleBoundary,
      contract,
      evidenceData,
    );
  }
  const actualArtifacts = resolveCandidateArtifactsWithinBoundary(
    artifactDir,
    stable.version,
    bundleRoot,
    bundleBoundary,
    {
      candidate: manifest.candidate,
      exactTagInstall,
      contract,
      sourceFiles,
      expectedArtifacts: manifest.artifacts,
    },
  );
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
