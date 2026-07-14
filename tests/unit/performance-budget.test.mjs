import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePerformanceReport } from '../../scripts/validate-performance-budget.mjs';

const digests = { registry: 'sha256:registry', policy: 'sha256:policy' };
const profile = { id: 'windows-x64-node24-ci-3-fresh-process-full-uncached', platform: 'windows', arch: 'x64', nodeMajor: 24, runnerClass: 'ci', concurrency: 3, scenario: 'fresh-process-full-uncached', comparable: true };
const policy = { minimumStableSamples: 20, profiles: [{ ...profile, sampleCount: 20, budgets: { elapsedWallMs: 1_000, runtimeSmokeMs: 700 }, owner: 'maintainers', reason: 'fixture', regressionRisk: 'fixture' }] };
const report = { command: 'validate-all', summary: { elapsedWallMs: 900, sumTaskMs: 1_600, runtimeSmokeMs: 600, selectedTaskCount: 2, cacheHitCount: 0, mode: 'full', profile, digests } };

test('concurrent summed task time does not replace observed elapsed wall time', () => {
  const result = validatePerformanceReport(report, policy, { currentDigests: digests });
  assert.equal(result.elapsedWallMs, 900);
  assert.equal(result.sumTaskMs, 1_600);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, elapsedWallMs: 1_001 } }, policy, { currentDigests: digests }), /elapsed wall time/u);
});

test('unknown local and CPU profile evidence is explicitly non-comparable', () => {
  const unknown = { ...report, summary: { ...report.summary, profile: { ...profile, runnerClass: 'unknown', comparable: false } } };
  assert.equal(validatePerformanceReport(unknown, policy, { currentDigests: digests }).status, 'not-comparable');
  assert.throws(() => validatePerformanceReport(unknown, policy, { currentDigests: digests, requireProfile: profile.id }), /Blocked/u);
});

test('profile identity, cache mode, sample count, and evidence digests fail closed', () => {
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, cacheHitCount: 1 } }, policy, { currentDigests: digests }), /zero cache hits/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, digests: { ...digests, registry: 'stale' } } }, policy, { currentDigests: digests }), /digest is stale/u);
  const smallPolicy = { ...policy, profiles: [{ ...policy.profiles[0], sampleCount: 3 }] };
  assert.equal(validatePerformanceReport(report, smallPolicy, { currentDigests: digests }).status, 'not-comparable');
  assert.throws(() => validatePerformanceReport(report, { ...policy, profiles: [] }, { currentDigests: digests, requireProfile: profile.id }), /no governed budget/u);
});

test('legacy summed-duration reports are retained only as non-comparable input', () => {
  assert.equal(validatePerformanceReport({ command: 'validate-all', results: [] }, policy, { currentDigests: digests }).status, 'not-comparable');
});
