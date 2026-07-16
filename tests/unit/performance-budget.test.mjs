import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalSha256 } from '../../scripts/lib/canonical-json.mjs';
import {
  derivePerformanceSampleAggregate,
  performanceSampleAggregateSha256,
  requireGovernedProfile,
  validatePerformanceReport,
  verifyPerformanceSampleManifest,
  verifyExternalPerformanceProvenance,
} from '../../scripts/validate-performance-budget.mjs';

const now = () => new Date('2026-07-01T00:00:00Z');
const digests = { registry: 'sha256:registry', policy: 'sha256:policy' };
const profileIdentity = {
  id: 'windows-x64-node24-ci-3-fresh-process-full-uncached',
  platform: 'windows',
  arch: 'x64',
  nodeMajor: 24,
  runnerClass: 'ci',
  concurrency: 3,
  scenario: 'fresh-process-full-uncached',
};
const reportProfile = { ...profileIdentity, comparable: true };
const collection = {
  repository: 'example/project',
  workflowPath: '.github/workflows/ci.yml',
  workflowRef: 'refs/heads/main',
  jobName: 'Required / Tests',
  artifactName: 'validation-timing-trend',
};
const budgetDerivation = {
  method: 'p95-plus-headroom',
  percentileBasisPoints: 9_500,
  headroomBasisPoints: 2_500,
  roundingMs: 1_000,
};
const results = [
  { check: 'runtime.smoke', status: 'passed', actual: { durationMs: 600 } },
  { check: 'docs.validate', status: 'passed', actual: { durationMs: 1_000 } },
];
const report = {
  command: 'validate-all',
  status: 'passed',
  results,
  summary: {
    elapsedWallMs: 900,
    sumTaskMs: 1_600,
    runtimeSmokeMs: 600,
    selectedTaskCount: 2,
    cacheHitCount: 0,
    mode: 'full',
    profile: reportProfile,
    digests,
  },
};

function sample(index, overrides = {}) {
  const runId = 10_000 + index;
  const runAttempt = 1;
  const commit = (index + 1).toString(16).padStart(40, '0');
  const record = {
    sampleId: `github-${runId}-${runAttempt}`,
    profile: structuredClone(profileIdentity),
    sourceCommit: commit,
    workflow: {
      repository: collection.repository,
      path: collection.workflowPath,
      ref: collection.workflowRef,
      sha: commit,
      runId,
      runAttempt,
      jobName: collection.jobName,
    },
    observedAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    evidence: {
      artifactName: collection.artifactName,
      artifactId: 20_000 + index,
      artifactSha256: (index + 101).toString(16).padStart(64, '0'),
      reportPath: 'validation-timings.json',
      reportSha256: (index + 201).toString(16).padStart(64, '0'),
    },
    metrics: { elapsedWallMs: 800 + index, runtimeSmokeMs: 600 + index, failed: 0, skipped: 0 },
  };
  return Object.assign(record, overrides);
}

async function fakeExternalProvenance(policy, manifest) {
  return verifyExternalPerformanceProvenance(policy, profileIdentity.id, manifest, {
    now,
    verifySample: async ({ sample: current }) => ({ sampleId: current.sampleId }),
  });
}

function fixture(sampleCount = 20) {
  const manifest = {
    $schema: '../../schemas/validation-performance-samples.schema.json',
    schemaVersion: 1,
    profile: structuredClone(profileIdentity),
    collection: structuredClone(collection),
    budgetDerivation: structuredClone(budgetDerivation),
    samples: Array.from({ length: sampleCount }, (_, index) => sample(index)),
    aggregate: null,
    aggregateSha256: '0'.repeat(64),
  };
  manifest.aggregate = derivePerformanceSampleAggregate(manifest);
  manifest.aggregateSha256 = performanceSampleAggregateSha256(manifest);
  const policy = {
    schemaVersion: 3,
    enforcement: 'profile-required',
    minimumStableSamples: 20,
    maximumSampleAgeDays: 90,
    externalProvenance: {
      mode: 'github-actions-api-and-artifact',
      apiVersion: '2026-03-10',
      requiredForEligibility: true,
    },
    budgetDerivation: structuredClone(budgetDerivation),
    profiles: [{
      ...structuredClone(profileIdentity),
      collection: structuredClone(collection),
      sampleManifest: {
        path: 'governance/evidence/validation-performance-samples.json',
        canonicalSha256: canonicalSha256(manifest),
        aggregateSha256: manifest.aggregateSha256,
      },
      budgets: sampleCount >= 20 ? structuredClone(manifest.aggregate.derivedBudgets) : null,
      owner: 'maintainers',
      reason: 'fixture',
      regressionRisk: 'fixture',
    }],
    legacyBudgets: {
      deprecated: true,
      validateAllWallMs: 60_000,
      runtimeSmokeWallMs: 30_000,
      note: 'fixture legacy policy',
    },
  };
  return { policy, manifest };
}

function reseal(policy, manifest, { updatePolicy = true } = {}) {
  manifest.aggregate = derivePerformanceSampleAggregate(manifest);
  manifest.aggregateSha256 = performanceSampleAggregateSha256(manifest);
  if (updatePolicy) {
    policy.profiles[0].sampleManifest.aggregateSha256 = manifest.aggregateSha256;
    policy.profiles[0].sampleManifest.canonicalSha256 = canonicalSha256(manifest);
    policy.profiles[0].budgets = manifest.samples.length >= policy.minimumStableSamples
      ? structuredClone(manifest.aggregate.derivedBudgets)
      : null;
  }
}

test('concurrent summed task time does not replace observed elapsed wall time', async () => {
  const { policy, manifest } = fixture();
  const externalProvenance = await fakeExternalProvenance(policy, manifest);
  const options = { currentDigests: digests, sampleManifest: manifest, externalProvenance, now };
  const result = validatePerformanceReport(report, policy, options);
  assert.equal(result.elapsedWallMs, 900);
  assert.equal(result.sumTaskMs, 1_600);
  const tooSlow = { ...report, summary: { ...report.summary, elapsedWallMs: policy.profiles[0].budgets.elapsedWallMs + 1 } };
  assert.throws(() => validatePerformanceReport(tooSlow, policy, options), /elapsed wall time/u);
});

test('unknown local and CPU profile evidence is explicitly non-comparable', () => {
  const { policy, manifest } = fixture();
  const unknown = { ...report, summary: { ...report.summary, profile: { ...reportProfile, runnerClass: 'unknown', comparable: false } } };
  assert.equal(validatePerformanceReport(unknown, policy, { currentDigests: digests, sampleManifest: manifest, now }).status, 'not-comparable');
  assert.throws(() => validatePerformanceReport(unknown, policy, { currentDigests: digests, sampleManifest: manifest, now, requireProfile: profileIdentity.id }), /Blocked/u);
});

test('profile identity, cache mode, sample count, and evidence digests fail closed', () => {
  const stable = fixture();
  const options = { currentDigests: digests, sampleManifest: stable.manifest, now };
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, cacheHitCount: 1 } }, stable.policy, options), /zero cache hits/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, digests: { ...digests, registry: 'stale' } } }, stable.policy, options), /digest is stale/u);
  const wrongIdentity = { ...report, summary: { ...report.summary, profile: { ...reportProfile, nodeMajor: 22 } } };
  assert.throws(() => validatePerformanceReport(wrongIdentity, stable.policy, options), /profile identity/u);

  const small = fixture(3);
  assert.equal(validatePerformanceReport(report, small.policy, { currentDigests: digests, sampleManifest: small.manifest, now }).status, 'not-comparable');
  assert.throws(
    () => validatePerformanceReport(report, small.policy, { currentDigests: digests, sampleManifest: small.manifest, now, requireProfile: profileIdentity.id }),
    /only 3\/20 manifest-bound comparable samples/u,
  );
  assert.throws(() => validatePerformanceReport(report, { ...stable.policy, profiles: [] }, { currentDigests: digests, sampleManifest: stable.manifest, now, requireProfile: profileIdentity.id }), /no governed budget/u);
});

test('governed profile derives count and budget from manifest samples, never sampleCount or repository-only provenance', async () => {
  const stable = fixture();
  assert.throws(
    () => requireGovernedProfile(stable.policy, profileIdentity.id, { sampleManifest: stable.manifest, now }),
    /no externally verified GitHub Actions provenance/u,
  );
  const externalProvenance = await fakeExternalProvenance(stable.policy, stable.manifest);
  const governed = requireGovernedProfile(stable.policy, profileIdentity.id, { sampleManifest: stable.manifest, externalProvenance, now });
  assert.equal(governed.sampleCount, 20);
  assert.deepEqual(governed.budgets, { elapsedWallMs: 2_000, runtimeSmokeMs: 1_000 });

  const spoofed = fixture(0);
  spoofed.policy.profiles[0].sampleCount = 20;
  assert.throws(
    () => requireGovernedProfile(spoofed.policy, profileIdentity.id, { sampleManifest: spoofed.manifest, now }),
    /schema validation failed; unexpected sampleCount/u,
  );
  const undersampled = fixture(19);
  assert.throws(
    () => requireGovernedProfile(undersampled.policy, profileIdentity.id, { sampleManifest: undersampled.manifest, now }),
    /only 19\/20 manifest-bound comparable samples/u,
  );
  assert.throws(() => requireGovernedProfile({ ...stable.policy, profiles: [] }, profileIdentity.id, { sampleManifest: stable.manifest, now }), /no governed budget/u);
  assert.throws(
    () => requireGovernedProfile({ ...stable.policy, profiles: [stable.policy.profiles[0], stable.policy.profiles[0]] }, profileIdentity.id, { sampleManifest: stable.manifest, now }),
    /duplicate profile/u,
  );
});

test('manifest and aggregate digests detect edits before they can unlock a profile', () => {
  const edited = fixture();
  edited.manifest.samples[0].metrics.elapsedWallMs += 1;
  assert.throws(() => verifyPerformanceSampleManifest(edited.policy, edited.policy.profiles[0], edited.manifest, { now }), /aggregate digest does not match/u);

  const reboundAggregateOnly = fixture();
  reboundAggregateOnly.manifest.samples[0].metrics.elapsedWallMs += 1;
  reseal(reboundAggregateOnly.policy, reboundAggregateOnly.manifest, { updatePolicy: false });
  reboundAggregateOnly.policy.profiles[0].sampleManifest.aggregateSha256 = reboundAggregateOnly.manifest.aggregateSha256;
  assert.throws(() => verifyPerformanceSampleManifest(reboundAggregateOnly.policy, reboundAggregateOnly.policy.profiles[0], reboundAggregateOnly.manifest, { now }), /canonical manifest digest/u);

  const selfReportedBudget = fixture();
  selfReportedBudget.policy.profiles[0].budgets.elapsedWallMs += 1_000;
  assert.throws(() => verifyPerformanceSampleManifest(selfReportedBudget.policy, selfReportedBudget.policy.profiles[0], selfReportedBudget.manifest, { now }), /budget does not match/u);
});

test('manifest rejects mismatched profile, workflow, run, observation, and evidence identities', () => {
  const cases = [
    ['profile identity', (manifest) => { manifest.samples[0].profile.nodeMajor = 22; }],
    ['workflow identity', (manifest) => { manifest.samples[0].workflow.path = '.github/workflows/nightly.yml'; }],
    ['workflow run identity', (manifest) => { manifest.samples[0].sampleId = 'github-99999-1'; }],
    ['future', (manifest) => { manifest.samples[0].observedAt = '2026-07-02T00:00:00Z'; }],
    ['older than', (manifest) => { manifest.samples[0].observedAt = '2025-01-01T00:00:00Z'; }],
    ['artifact identity', (manifest) => { manifest.samples[0].evidence.artifactName = 'other-artifact'; }],
    ['full lowercase commit', (manifest) => { manifest.samples[0].workflow.sha = 'bad'; }],
  ];
  for (const [expected, mutate] of cases) {
    const current = fixture();
    mutate(current.manifest);
    reseal(current.policy, current.manifest);
    assert.throws(
      () => verifyPerformanceSampleManifest(current.policy, current.policy.profiles[0], current.manifest, { now }),
      new RegExp(expected, 'u'),
      expected,
    );
  }
});

test('manifest rejects duplicate workflow and evidence identities', () => {
  for (const [expected, mutate] of [
    ['sample id', (samples) => { samples[1].workflow.runId = samples[0].workflow.runId; samples[1].sampleId = samples[0].sampleId; }],
    ['artifact id', (samples) => { samples[1].evidence.artifactId = samples[0].evidence.artifactId; }],
    ['artifact digest', (samples) => { samples[1].evidence.artifactSha256 = samples[0].evidence.artifactSha256; }],
    ['report digest', (samples) => { samples[1].evidence.reportSha256 = samples[0].evidence.reportSha256; }],
  ]) {
    const current = fixture();
    mutate(current.manifest.samples);
    reseal(current.policy, current.manifest);
    assert.throws(() => verifyPerformanceSampleManifest(current.policy, current.policy.profiles[0], current.manifest, { now }), new RegExp(`duplicate ${expected}`, 'u'));
  }
});

test('observed evidence requires a matching passed runtime smoke result and complete result set', () => {
  const { policy, manifest } = fixture();
  const options = { currentDigests: digests, sampleManifest: manifest, now };
  assert.throws(() => validatePerformanceReport({ ...report, results: report.results.slice(1), summary: { ...report.summary, selectedTaskCount: 1, sumTaskMs: 1_000 } }, policy, options), /runtime\.smoke/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [{ ...report.results[0], status: 'failed' }, report.results[1] ] }, policy, options), /blocked or failed/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, selectedTaskCount: 1 } }, policy, options), /selected task count/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, runtimeSmokeMs: 599 } }, policy, options), /runtime smoke summary/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, sumTaskMs: 1_599 } }, policy, options), /summed task duration/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [{ ...report.results[0], actual: { durationMs: -1 } }, report.results[1]] }, policy, options), /invalid duration/u);
});

test('legacy summed-duration reports are retained only as non-comparable input', () => {
  const { policy, manifest } = fixture();
  assert.equal(validatePerformanceReport({ command: 'validate-all', results: [] }, policy, { currentDigests: digests, sampleManifest: manifest, now }).status, 'not-comparable');
  assert.throws(() => validatePerformanceReport({ schemaVersion: 2, command: 'validate-all', results: [] }, policy, { currentDigests: digests, sampleManifest: manifest, now }), /requires an observed summary/u);
});
