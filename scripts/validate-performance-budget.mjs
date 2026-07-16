#!/usr/bin/env node
/** Validate elapsed-wall performance only against an exact, manifest-backed governed profile. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalSha256 } from './lib/canonical-json.mjs';
import { verifyGithubActionsPerformanceSample } from './lib/github-actions-performance-provenance.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { validationEvidenceDigests } from './lib/validation-performance-profile.mjs';

const root = repoRoot(import.meta.url);
const policy = JSON.parse(readFileSync(resolve(root, 'governance/engineering-evidence.json'), 'utf8')).validationPerformance;
const PROFILE_KEYS = Object.freeze(['id', 'platform', 'arch', 'nodeMajor', 'runnerClass', 'concurrency', 'scenario']);
const COLLECTION_KEYS = Object.freeze(['repository', 'workflowPath', 'workflowRef', 'jobName', 'artifactName']);
const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_COMMIT = /^[a-f0-9]{40}$/u;
const SAMPLE_MANIFEST_PATH = /^governance\/evidence\/[A-Za-z0-9._-]+\.json$/u;
const VERIFIED_PROVENANCE = Symbol('verified-performance-provenance');

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  object(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    const unexpected = actual.filter((key) => !wanted.includes(key));
    const missing = wanted.filter((key) => !actual.includes(key));
    throw new Error(`${label} schema validation failed${unexpected.length ? `; unexpected ${unexpected.join(', ')}` : ''}${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
  }
}

function positiveInteger(value, label, minimum = 1) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`${label} must be an integer >= ${minimum}`);
}

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
}

function digest(value, label) {
  if (!SHA256.test(value ?? '')) throw new Error(`${label} must be a lowercase SHA-256 digest`);
}

export function performanceProfileIdentity(value) {
  return Object.fromEntries(PROFILE_KEYS.map((key) => [key, value?.[key]]));
}

function expectedProfileId(profile) {
  return `${profile.platform}-${profile.arch}-node${profile.nodeMajor}-${profile.runnerClass}-${profile.concurrency}-${profile.scenario}`;
}

function assertProfileIdentity(profile, label) {
  exactKeys(profile, PROFILE_KEYS, label);
  nonEmptyString(profile.id, `${label}.id`);
  if (!['windows', 'linux', 'macos'].includes(profile.platform)) throw new Error(`${label}.platform is unsupported`);
  if (!['x64', 'arm64'].includes(profile.arch)) throw new Error(`${label}.arch is unsupported`);
  positiveInteger(profile.nodeMajor, `${label}.nodeMajor`, 22);
  nonEmptyString(profile.runnerClass, `${label}.runnerClass`);
  positiveInteger(profile.concurrency, `${label}.concurrency`);
  if (!['fresh-process-full-uncached', 'full-cache-warm', 'incremental-cache-warm'].includes(profile.scenario)) throw new Error(`${label}.scenario is unsupported`);
  if (profile.id !== expectedProfileId(profile)) throw new Error(`${label}.id does not match its exact profile identity`);
}

function assertCollection(collection, label) {
  exactKeys(collection, COLLECTION_KEYS, label);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(collection.repository ?? '')) throw new Error(`${label}.repository must be an exact owner/repository identity`);
  if (!/^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/u.test(collection.workflowPath ?? '')) throw new Error(`${label}.workflowPath must identify a repository workflow`);
  if (!/^refs\/heads\/[A-Za-z0-9._/-]+$/u.test(collection.workflowRef ?? '')) throw new Error(`${label}.workflowRef must identify an exact branch ref`);
  nonEmptyString(collection.jobName, `${label}.jobName`);
  nonEmptyString(collection.artifactName, `${label}.artifactName`);
}

function assertPerformancePolicyStructure(performancePolicy) {
  exactKeys(performancePolicy, ['schemaVersion', 'enforcement', 'minimumStableSamples', 'maximumSampleAgeDays', 'externalProvenance', 'budgetDerivation', 'profiles', 'legacyBudgets'], 'performance policy');
  if (performancePolicy.schemaVersion !== 3) throw new Error('performance policy schemaVersion must be 3');
  if (performancePolicy.enforcement !== 'profile-required') throw new Error('performance policy enforcement must be profile-required');
  positiveInteger(performancePolicy.minimumStableSamples, 'performance policy minimumStableSamples', 20);
  positiveInteger(performancePolicy.maximumSampleAgeDays, 'performance policy maximumSampleAgeDays');
  exactKeys(performancePolicy.externalProvenance, ['mode', 'apiVersion', 'requiredForEligibility'], 'performance policy externalProvenance');
  if (performancePolicy.externalProvenance.mode !== 'github-actions-api-and-artifact' || performancePolicy.externalProvenance.apiVersion !== '2026-03-10' || performancePolicy.externalProvenance.requiredForEligibility !== true) throw new Error('performance policy externalProvenance must require GitHub Actions API 2026-03-10 and downloaded artifact verification');
  exactKeys(performancePolicy.budgetDerivation, ['method', 'percentileBasisPoints', 'headroomBasisPoints', 'roundingMs'], 'performance policy budgetDerivation');
  if (performancePolicy.budgetDerivation.method !== 'p95-plus-headroom') throw new Error('performance policy budgetDerivation.method must be p95-plus-headroom');
  if (performancePolicy.budgetDerivation.percentileBasisPoints !== 9_500) throw new Error('performance policy budgetDerivation.percentileBasisPoints must be 9500');
  if (performancePolicy.budgetDerivation.headroomBasisPoints !== 2_500) throw new Error('performance policy budgetDerivation.headroomBasisPoints must be 2500');
  if (performancePolicy.budgetDerivation.roundingMs !== 1_000) throw new Error('performance policy budgetDerivation.roundingMs must be 1000');
  if (!Array.isArray(performancePolicy.profiles)) throw new Error('performance policy profiles must be an array');
  exactKeys(performancePolicy.legacyBudgets, ['deprecated', 'validateAllWallMs', 'runtimeSmokeWallMs', 'note'], 'performance policy legacyBudgets');
  if (performancePolicy.legacyBudgets.deprecated !== true) throw new Error('performance policy legacyBudgets must remain deprecated');
  positiveInteger(performancePolicy.legacyBudgets.validateAllWallMs, 'performance policy legacyBudgets.validateAllWallMs', 1_000);
  positiveInteger(performancePolicy.legacyBudgets.runtimeSmokeWallMs, 'performance policy legacyBudgets.runtimeSmokeWallMs', 1_000);
  nonEmptyString(performancePolicy.legacyBudgets.note, 'performance policy legacyBudgets.note');

  const ids = new Set();
  for (const [index, profile] of performancePolicy.profiles.entries()) {
    const label = `performance policy profiles[${index}]`;
    exactKeys(profile, [...PROFILE_KEYS, 'collection', 'sampleManifest', 'budgets', 'owner', 'reason', 'regressionRisk'], label);
    assertProfileIdentity(performanceProfileIdentity(profile), `${label} identity`);
    if (ids.has(profile.id)) throw new Error(`performance policy contains duplicate profile ${profile.id}`);
    ids.add(profile.id);
    assertCollection(profile.collection, `${label}.collection`);
    exactKeys(profile.sampleManifest, ['path', 'canonicalSha256', 'aggregateSha256'], `${label}.sampleManifest`);
    if (!SAMPLE_MANIFEST_PATH.test(profile.sampleManifest.path ?? '')) throw new Error(`${label}.sampleManifest.path must be a governed evidence JSON path`);
    digest(profile.sampleManifest.canonicalSha256, `${label}.sampleManifest.canonicalSha256`);
    digest(profile.sampleManifest.aggregateSha256, `${label}.sampleManifest.aggregateSha256`);
    if (profile.budgets !== null) {
      exactKeys(profile.budgets, ['elapsedWallMs', 'runtimeSmokeMs'], `${label}.budgets`);
      positiveInteger(profile.budgets.elapsedWallMs, `${label}.budgets.elapsedWallMs`, 1_000);
      positiveInteger(profile.budgets.runtimeSmokeMs, `${label}.budgets.runtimeSmokeMs`, 1_000);
    }
    nonEmptyString(profile.owner, `${label}.owner`);
    nonEmptyString(profile.reason, `${label}.reason`);
    nonEmptyString(profile.regressionRisk, `${label}.regressionRisk`);
  }
}

export function performanceSampleAggregate(manifest) {
  return {
    schemaVersion: manifest?.schemaVersion,
    profile: manifest?.profile,
    collection: manifest?.collection,
    budgetDerivation: manifest?.budgetDerivation,
    samples: manifest?.samples,
    aggregate: manifest?.aggregate,
  };
}

export function performanceSampleAggregateSha256(manifest) {
  return canonicalSha256(performanceSampleAggregate(manifest));
}

function nearestRank(values, percentileBasisPoints) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentileBasisPoints / 10_000) - 1)];
}

function withHeadroom(value, derivation) {
  if (value === null) return null;
  const raw = Math.ceil(value * (10_000 + derivation.headroomBasisPoints) / 10_000);
  return Math.max(derivation.roundingMs, Math.ceil(raw / derivation.roundingMs) * derivation.roundingMs);
}

export function derivePerformanceSampleAggregate(manifest) {
  const samples = Array.isArray(manifest?.samples) ? manifest.samples : [];
  const observed = samples.map((sample) => sample.observedAt).sort();
  const elapsedWallMsP95 = nearestRank(samples.map((sample) => sample.metrics.elapsedWallMs), manifest.budgetDerivation.percentileBasisPoints);
  const runtimeSmokeMsP95 = nearestRank(samples.map((sample) => sample.metrics.runtimeSmokeMs), manifest.budgetDerivation.percentileBasisPoints);
  return {
    sampleCount: samples.length,
    observedAtEarliest: observed[0] ?? null,
    observedAtLatest: observed.at(-1) ?? null,
    elapsedWallMsP95,
    runtimeSmokeMsP95,
    derivedBudgets: samples.length === 0 ? null : {
      elapsedWallMs: withHeadroom(elapsedWallMsP95, manifest.budgetDerivation),
      runtimeSmokeMs: withHeadroom(runtimeSmokeMsP95, manifest.budgetDerivation),
    },
  };
}

function sameValue(left, right) {
  return canonicalSha256(left) === canonicalSha256(right);
}

function assertSample(sample, index, profile, collection, now, maximumSampleAgeDays) {
  const label = `performance sample[${index}]`;
  exactKeys(sample, ['sampleId', 'profile', 'sourceCommit', 'workflow', 'observedAt', 'evidence', 'metrics'], label);
  assertProfileIdentity(sample.profile, `${label}.profile`);
  if (!sameValue(sample.profile, performanceProfileIdentity(profile))) throw new Error(`${label} profile identity does not match the governed profile`);
  if (!SOURCE_COMMIT.test(sample.sourceCommit ?? '')) throw new Error(`${label}.sourceCommit must be a full lowercase commit`);

  exactKeys(sample.workflow, ['repository', 'path', 'ref', 'sha', 'runId', 'runAttempt', 'jobName'], `${label}.workflow`);
  if (sample.workflow.repository !== collection.repository
    || sample.workflow.path !== collection.workflowPath
    || sample.workflow.ref !== collection.workflowRef
    || sample.workflow.jobName !== collection.jobName) {
    throw new Error(`${label} workflow identity does not match the governed collection workflow`);
  }
  if (!SOURCE_COMMIT.test(sample.workflow.sha ?? '')) throw new Error(`${label}.workflow.sha must be a full lowercase commit`);
  if (sample.workflow.sha !== sample.sourceCommit) throw new Error(`${label} source commit does not match workflow source identity`);
  positiveInteger(sample.workflow.runId, `${label}.workflow.runId`);
  positiveInteger(sample.workflow.runAttempt, `${label}.workflow.runAttempt`);
  if (sample.sampleId !== `github-${sample.workflow.runId}-${sample.workflow.runAttempt}`) throw new Error(`${label}.sampleId does not match its workflow run identity`);

  if (typeof sample.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(sample.observedAt)) throw new Error(`${label}.observedAt must be a canonical UTC observation time`);
  const observedAt = new Date(sample.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new Error(`${label}.observedAt is invalid`);
  if (observedAt.getTime() > now.getTime()) throw new Error(`${label}.observedAt is in the future`);
  if (now.getTime() - observedAt.getTime() > maximumSampleAgeDays * 86_400_000) throw new Error(`${label}.observedAt is older than ${maximumSampleAgeDays} days`);

  exactKeys(sample.evidence, ['artifactName', 'artifactId', 'artifactSha256', 'reportPath', 'reportSha256'], `${label}.evidence`);
  if (sample.evidence.artifactName !== collection.artifactName) throw new Error(`${label} artifact identity does not match the governed collection artifact`);
  positiveInteger(sample.evidence.artifactId, `${label}.evidence.artifactId`);
  digest(sample.evidence.artifactSha256, `${label}.evidence.artifactSha256`);
  if (!/^[A-Za-z0-9._/-]+\.json$/u.test(sample.evidence.reportPath ?? '') || sample.evidence.reportPath.startsWith('/') || sample.evidence.reportPath.split('/').includes('..')) throw new Error(`${label}.evidence.reportPath must be a safe relative JSON path`);
  digest(sample.evidence.reportSha256, `${label}.evidence.reportSha256`);

  exactKeys(sample.metrics, ['elapsedWallMs', 'runtimeSmokeMs', 'failed', 'skipped'], `${label}.metrics`);
  nonNegativeInteger(sample.metrics.elapsedWallMs, `${label}.metrics.elapsedWallMs`);
  nonNegativeInteger(sample.metrics.runtimeSmokeMs, `${label}.metrics.runtimeSmokeMs`);
  if (sample.metrics.failed !== 0 || sample.metrics.skipped !== 0) throw new Error(`${label} must represent a complete passed validation run`);
}

export function verifyPerformanceSampleManifest(performancePolicy, profile, manifest, { now = () => new Date() } = {}) {
  assertPerformancePolicyStructure(performancePolicy);
  exactKeys(manifest, ['$schema', 'schemaVersion', 'profile', 'collection', 'budgetDerivation', 'samples', 'aggregate', 'aggregateSha256'], 'performance sample manifest');
  if (manifest.$schema !== '../../schemas/validation-performance-samples.schema.json') throw new Error('performance sample manifest $schema path is invalid');
  if (manifest.schemaVersion !== 1) throw new Error('performance sample manifest schemaVersion must be 1');
  assertProfileIdentity(manifest.profile, 'performance sample manifest profile');
  if (!sameValue(manifest.profile, performanceProfileIdentity(profile))) throw new Error('performance sample manifest profile identity does not match the governed profile');
  assertCollection(manifest.collection, 'performance sample manifest collection');
  if (!sameValue(manifest.collection, profile.collection)) throw new Error('performance sample manifest collection identity does not match the governed profile');
  if (!sameValue(manifest.budgetDerivation, performancePolicy.budgetDerivation)) throw new Error('performance sample manifest budget derivation does not match the governed policy');
  if (!Array.isArray(manifest.samples)) throw new Error('performance sample manifest samples must be an array');
  digest(manifest.aggregateSha256, 'performance sample manifest aggregateSha256');

  const currentTime = typeof now === 'function' ? now() : now;
  if (!(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) throw new Error('performance sample manifest current time is invalid');
  const sampleIds = new Set();
  const runIdentities = new Set();
  const artifactIds = new Set();
  const artifactDigests = new Set();
  const reportDigests = new Set();
  for (const [index, sample] of manifest.samples.entries()) {
    assertSample(sample, index, profile, profile.collection, currentTime, performancePolicy.maximumSampleAgeDays);
    const runIdentity = `${sample.workflow.repository}:${sample.workflow.runId}:${sample.workflow.runAttempt}`;
    const duplicateChecks = [
      [sampleIds, sample.sampleId, 'sample id'],
      [runIdentities, runIdentity, 'workflow run identity'],
      [artifactIds, sample.evidence.artifactId, 'artifact id'],
      [artifactDigests, sample.evidence.artifactSha256, 'artifact digest'],
      [reportDigests, sample.evidence.reportSha256, 'report digest'],
    ];
    for (const [seen, value, identity] of duplicateChecks) {
      if (seen.has(value)) throw new Error(`performance sample manifest contains duplicate ${identity} ${value}`);
      seen.add(value);
    }
  }
  const derivedAggregate = derivePerformanceSampleAggregate(manifest);
  if (!sameValue(manifest.aggregate, derivedAggregate)) throw new Error('performance sample manifest aggregate does not match the recomputed sample count, observations, percentiles, and budgets');
  const aggregateSha256 = performanceSampleAggregateSha256(manifest);
  if (manifest.aggregateSha256 !== aggregateSha256) throw new Error('performance sample manifest aggregate digest does not match its profile, collection, derivation, samples, and aggregate');
  if (profile.sampleManifest.aggregateSha256 !== aggregateSha256) throw new Error('governed performance profile aggregate digest does not match the sample manifest');
  const manifestSha256 = canonicalSha256(manifest);
  if (profile.sampleManifest.canonicalSha256 !== manifestSha256) throw new Error('governed performance profile canonical manifest digest does not match the sample manifest');
  if (manifest.samples.length < performancePolicy.minimumStableSamples && profile.budgets !== null) throw new Error('under-sampled governed performance profile must not publish a self-reported budget');
  if (manifest.samples.length >= performancePolicy.minimumStableSamples && !sameValue(profile.budgets, derivedAggregate.derivedBudgets)) throw new Error('governed performance budget does not match the recomputed immutable sample aggregate');
  return {
    profileId: profile.id,
    sampleCount: manifest.samples.length,
    minimumStableSamples: performancePolicy.minimumStableSamples,
    manifestSha256,
    aggregateSha256,
    manifestPath: profile.sampleManifest.path,
    aggregate: derivedAggregate,
  };
}

export function inspectGovernedProfile(performancePolicy, profileId, sampleManifest, options = {}) {
  if (!profileId) throw new Error('Blocked: a required performance profile id must be provided');
  assertPerformancePolicyStructure(performancePolicy);
  const matches = performancePolicy.profiles.filter((candidate) => candidate.id === profileId);
  if (matches.length === 0) throw new Error(`Blocked: required performance profile ${profileId} has no governed budget`);
  if (matches.length > 1) throw new Error(`performance policy contains duplicate profile ${profileId}`);
  if (!sampleManifest) throw new Error(`Blocked: required performance profile ${profileId} has no bound sample manifest`);
  const profile = matches[0];
  return { profile, evidence: verifyPerformanceSampleManifest(performancePolicy, profile, sampleManifest, options) };
}

export async function verifyExternalPerformanceProvenance(performancePolicy, profileId, sampleManifest, options = {}) {
  const {
    now,
    token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN,
    fetchImpl = globalThis.fetch,
    apiBase,
    verifySample = verifyGithubActionsPerformanceSample,
  } = /** @type {any} */ (options);
  const inspected = inspectGovernedProfile(performancePolicy, profileId, sampleManifest, { now });
  const verifiedSamples = [];
  for (const sample of sampleManifest.samples) {
    verifiedSamples.push(await verifySample({
      sample,
      profile: inspected.profile,
      collection: inspected.profile.collection,
      token,
      fetchImpl,
      apiBase,
      apiVersion: performancePolicy.externalProvenance.apiVersion,
    }));
  }
  return Object.freeze({
    [VERIFIED_PROVENANCE]: true,
    profileId,
    manifestSha256: inspected.evidence.manifestSha256,
    aggregateSha256: inspected.evidence.aggregateSha256,
    sampleCount: inspected.evidence.sampleCount,
    verifiedSamples: Object.freeze(verifiedSamples),
  });
}

function hasMatchingExternalProvenance(provenance, evidence) {
  return provenance?.[VERIFIED_PROVENANCE] === true
    && provenance.profileId === evidence.profileId
    && provenance.manifestSha256 === evidence.manifestSha256
    && provenance.aggregateSha256 === evidence.aggregateSha256
    && provenance.sampleCount === evidence.sampleCount
    && provenance.verifiedSamples?.length === evidence.sampleCount;
}

export function requireGovernedProfile(performancePolicy, profileId, options = {}) {
  const { sampleManifest, now, externalProvenance } = /** @type {any} */ (options);
  const inspected = inspectGovernedProfile(performancePolicy, profileId, sampleManifest, { now });
  if (inspected.evidence.sampleCount < performancePolicy.minimumStableSamples) {
    throw new Error(`Blocked: required performance profile ${profileId} has only ${inspected.evidence.sampleCount}/${performancePolicy.minimumStableSamples} manifest-bound comparable samples`);
  }
  if (!hasMatchingExternalProvenance(externalProvenance, inspected.evidence)) throw new Error(`Blocked: required performance profile ${profileId} has no externally verified GitHub Actions provenance for all manifest samples`);
  return { ...inspected.profile, sampleCount: inspected.evidence.sampleCount, sampleEvidence: inspected.evidence };
}

export function validatePerformanceReport(report, performancePolicy = policy, options = {}) {
  const {
    requireProfile = null,
    currentDigests = validationEvidenceDigests(root),
    sampleManifest = null,
    now,
    externalProvenance = null,
  } = /** @type {any} */ (options);
  if (report?.command !== 'validate-all') throw new Error('performance evidence must be a validate-all diagnostics report');
  if (!report.summary) {
    if (report.schemaVersion === 2) throw new Error('diagnostics schema v2 performance evidence requires an observed summary');
    return { comparable: false, status: 'not-comparable', reason: 'legacy report has summed task durations but no observed elapsed wall time' };
  }
  const { summary } = report;
  for (const key of ['elapsedWallMs', 'sumTaskMs', 'runtimeSmokeMs']) if (!Number.isFinite(summary[key]) || summary[key] < 0) throw new Error(`performance evidence has invalid ${key}`);
  if (!Array.isArray(report.results) || report.results.length === 0) throw new Error('performance evidence has no validation results');
  if (summary.selectedTaskCount !== report.results.length) throw new Error('performance evidence selected task count does not match validation results');
  if (report.results.some((result) => ['blocked', 'failed'].includes(result.status))) throw new Error('performance evidence contains a blocked or failed validation result');
  for (const result of report.results) if (!Number.isFinite(result.actual?.durationMs) || result.actual.durationMs < 0) throw new Error(`performance evidence has an invalid duration for ${result.check ?? 'unknown check'}`);
  const observedSumTaskMs = report.results.reduce((sum, result) => sum + result.actual.durationMs, 0);
  if (observedSumTaskMs !== summary.sumTaskMs) throw new Error('performance evidence summed task duration does not match validation results');
  const runtimeResults = report.results.filter((result) => result.check === 'runtime.smoke');
  if (runtimeResults.length !== 1 || runtimeResults[0].status !== 'passed') throw new Error('performance evidence requires exactly one passed runtime.smoke result');
  if (runtimeResults[0].actual?.durationMs !== summary.runtimeSmokeMs) throw new Error('performance evidence runtime smoke summary does not match validation results');
  if (summary.mode !== 'full' || summary.cacheHitCount !== 0) throw new Error('fresh-process performance evidence requires full mode with zero cache hits');
  if (!summary.profile?.comparable) {
    if (requireProfile) throw new Error(`Blocked: required performance profile ${requireProfile} is unavailable or non-comparable`);
    return { comparable: false, status: 'not-comparable', reason: 'runner class is unknown or CPU profiling is active' };
  }
  if (summary.digests?.registry !== currentDigests.registry || summary.digests?.policy !== currentDigests.policy) throw new Error('performance evidence registry/policy digest is stale');
  if (requireProfile && summary.profile.id !== requireProfile) throw new Error(`Blocked: report profile ${summary.profile.id} does not match required ${requireProfile}`);
  const governed = performancePolicy.profiles?.find((candidate) => candidate.id === summary.profile.id);
  if (!governed) {
    if (requireProfile) throw new Error(`Blocked: required performance profile ${requireProfile} has no governed budget`);
    return { comparable: false, status: 'not-comparable', reason: `no governed budget for ${summary.profile.id}` };
  }
  if (!sameValue(performanceProfileIdentity(summary.profile), performanceProfileIdentity(governed))) throw new Error('performance report profile identity does not match the governed profile');
  const inspected = inspectGovernedProfile(performancePolicy, governed.id, sampleManifest, { now });
  if (inspected.evidence.sampleCount < performancePolicy.minimumStableSamples) {
    const reason = `only ${inspected.evidence.sampleCount}/${performancePolicy.minimumStableSamples} manifest-bound comparable samples`;
    if (requireProfile) throw new Error(`Blocked: required performance profile ${governed.id} has ${reason}`);
    return { comparable: false, status: 'not-comparable', reason };
  }
  if (!hasMatchingExternalProvenance(externalProvenance, inspected.evidence)) {
    const reason = 'external GitHub Actions provenance has not been verified for every manifest sample';
    if (requireProfile) throw new Error(`Blocked: required performance profile ${governed.id} ${reason}`);
    return { comparable: false, status: 'not-comparable', reason };
  }
  if (summary.elapsedWallMs > governed.budgets.elapsedWallMs) throw new Error(`observed elapsed wall time ${summary.elapsedWallMs}ms exceeds ${governed.budgets.elapsedWallMs}ms`);
  if (summary.runtimeSmokeMs > governed.budgets.runtimeSmokeMs) throw new Error(`runtime smoke ${summary.runtimeSmokeMs}ms exceeds ${governed.budgets.runtimeSmokeMs}ms`);
  return { comparable: true, status: 'passed', profileId: governed.id, elapsedWallMs: summary.elapsedWallMs, sumTaskMs: summary.sumTaskMs, runtimeSmokeMs: summary.runtimeSmokeMs };
}

function parseArgs(args) {
  let reportPath = null;
  let requireProfile = null;
  let checkProfile = null;
  let sampleManifestPath = null;
  let verifyGithub = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--require-profile') {
      if (!args[index + 1]) throw new Error('--require-profile requires a profile id');
      requireProfile = args[++index];
    } else if (args[index] === '--check-profile') {
      if (!args[index + 1]) throw new Error('--check-profile requires a profile id');
      checkProfile = args[++index];
    } else if (args[index] === '--sample-manifest') {
      if (!args[index + 1]) throw new Error('--sample-manifest requires a repository-relative path');
      sampleManifestPath = args[++index];
    } else if (args[index] === '--verify-github') {
      verifyGithub = true;
    } else if (!reportPath) reportPath = args[index];
    else throw new Error(`unknown argument: ${args[index]}`);
  }
  if (checkProfile && (reportPath || requireProfile)) throw new Error('--check-profile cannot be combined with a report or --require-profile');
  if (sampleManifestPath && !checkProfile && !requireProfile) throw new Error('--sample-manifest requires --check-profile or --require-profile');
  if (verifyGithub && !checkProfile && !requireProfile) throw new Error('--verify-github requires --check-profile or --require-profile');
  return { reportPath, requireProfile, checkProfile, sampleManifestPath, verifyGithub };
}

function manifestForProfile(performancePolicy, profileId, requestedPath = null) {
  assertPerformancePolicyStructure(performancePolicy);
  const profile = performancePolicy.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return null;
  if (requestedPath && requestedPath !== profile.sampleManifest.path) throw new Error(`sample manifest override ${requestedPath} does not match governed path ${profile.sampleManifest.path}`);
  return JSON.parse(readFileSync(resolve(root, profile.sampleManifest.path), 'utf8'));
}

async function externalProvenanceFor(performancePolicy, profileId, sampleManifest, verifyGithub) {
  const inspected = inspectGovernedProfile(performancePolicy, profileId, sampleManifest);
  if (inspected.evidence.sampleCount < performancePolicy.minimumStableSamples) return null;
  if (!verifyGithub) throw new Error(`Blocked: required performance profile ${profileId} must use --verify-github to verify non-repository provenance`);
  return verifyExternalPerformanceProvenance(performancePolicy, profileId, sampleManifest);
}

export async function main(args = process.argv.slice(2)) {
  try {
    const { reportPath, requireProfile, checkProfile, sampleManifestPath, verifyGithub } = parseArgs(args);
    if (checkProfile) {
      const sampleManifest = manifestForProfile(policy, checkProfile, sampleManifestPath);
      const externalProvenance = await externalProvenanceFor(policy, checkProfile, sampleManifest, verifyGithub);
      const profile = requireGovernedProfile(policy, checkProfile, { sampleManifest, externalProvenance });
      console.log(`OK governed performance profile (${profile.id}; externally verified samples=${profile.sampleCount}; manifest=${profile.sampleEvidence.manifestSha256})`);
      return 0;
    }
    if (!reportPath) {
      if (requireProfile) throw new Error('Blocked: --require-profile requires an observed diagnostics report');
      assertPerformancePolicyStructure(policy);
      console.log(`OK performance policy structure (profiles=${policy.profiles.length}; legacy summed-task budget is deprecated and not enforced)`);
      for (const profile of policy.profiles) {
        const evidence = verifyPerformanceSampleManifest(policy, profile, manifestForProfile(policy, profile.id));
        if (evidence.sampleCount < policy.minimumStableSamples) console.log(`EVIDENCE_PENDING ${profile.id} has ${evidence.sampleCount}/${policy.minimumStableSamples} manifest-bound comparable samples; candidate --check-profile remains blocked`);
        else console.log(`EVIDENCE_PENDING ${profile.id} has ${evidence.sampleCount} manifest records, but candidate --check-profile --verify-github must still verify every external run and artifact`);
      }
      if (policy.enforcement === 'profile-required' && policy.profiles.length === 0) console.log('EVIDENCE_PENDING no governed performance profile is available; candidate --check-profile remains blocked');
      return 0;
    }
    const sampleManifest = requireProfile ? manifestForProfile(policy, requireProfile, sampleManifestPath) : null;
    const externalProvenance = requireProfile ? await externalProvenanceFor(policy, requireProfile, sampleManifest, verifyGithub) : null;
    const result = validatePerformanceReport(JSON.parse(readFileSync(resolve(root, reportPath), 'utf8')), policy, { requireProfile, sampleManifest, externalProvenance });
    if (!result.comparable) console.log(`NOT COMPARABLE ${result.reason}`);
    else console.log(`OK observed performance (${result.profileId}; elapsed=${result.elapsedWallMs}ms sum=${result.sumTaskMs}ms)`);
    return 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
