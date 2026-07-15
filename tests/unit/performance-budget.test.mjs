import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePerformanceReport } from '../../scripts/validate-performance-budget.mjs';

const digests = { registry: 'sha256:registry', policy: 'sha256:policy' };
const profile = { id: 'windows-x64-node24-ci-3-fresh-process-full-uncached', platform: 'windows', arch: 'x64', nodeMajor: 24, runnerClass: 'ci', concurrency: 3, scenario: 'fresh-process-full-uncached', comparable: true };
const policy = { minimumStableSamples: 20, profiles: [{ ...profile, sampleCount: 20, budgets: { elapsedWallMs: 1_000, runtimeSmokeMs: 700 }, owner: 'maintainers', reason: 'fixture', regressionRisk: 'fixture' }] };
const results = [
  { check: 'runtime.smoke', status: 'passed', actual: { durationMs: 600 } },
  { check: 'docs.validate', status: 'passed', actual: { durationMs: 1_000 } },
];
const report = { command: 'validate-all', status: 'passed', results, summary: { elapsedWallMs: 900, sumTaskMs: 1_600, runtimeSmokeMs: 600, selectedTaskCount: 2, cacheHitCount: 0, mode: 'full', profile, digests } };

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

test('observed evidence requires a matching passed runtime smoke result and complete result set', () => {
  assert.throws(() => validatePerformanceReport({ ...report, results: report.results.slice(1), summary: { ...report.summary, selectedTaskCount: 1, sumTaskMs: 1_000 } }, policy, { currentDigests: digests }), /runtime\.smoke/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [{ ...report.results[0], status: 'failed' }, report.results[1] ] }, policy, { currentDigests: digests }), /blocked or failed/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, selectedTaskCount: 1 } }, policy, { currentDigests: digests }), /selected task count/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, runtimeSmokeMs: 599 } }, policy, { currentDigests: digests }), /runtime smoke summary/u);
  assert.throws(() => validatePerformanceReport({ ...report, summary: { ...report.summary, sumTaskMs: 1_599 } }, policy, { currentDigests: digests }), /summed task duration/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [{ ...report.results[0], actual: { durationMs: -1 } }, report.results[1]] }, policy, { currentDigests: digests }), /invalid duration/u);
});

test('legacy summed-duration reports are retained only as non-comparable input', () => {
  assert.equal(validatePerformanceReport({ command: 'validate-all', results: [] }, policy, { currentDigests: digests }).status, 'not-comparable');
  assert.throws(() => validatePerformanceReport({ schemaVersion: 2, command: 'validate-all', results: [] }, policy, { currentDigests: digests }), /requires an observed summary/u);
});
