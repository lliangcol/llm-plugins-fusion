import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePerformanceReport } from '../../scripts/validate-performance-budget.mjs';

const policy = {
  platform: 'windows-x64-node24',
  budgets: { validateAllWallMs: 1_000, runtimeSmokeWallMs: 700 },
};

const report = {
  command: 'validate-all',
  platform: policy.platform,
  results: [
    { check: 'runtime.smoke', status: 'passed', actual: { durationMs: 600 } },
    { check: 'docs.validate', status: 'passed', actual: { durationMs: 300 } },
  ],
};

test('performance evidence is accepted only for the governed comparable platform', () => {
  assert.deepEqual(validatePerformanceReport(report, policy), { totalMs: 900, runtimeSmokeMs: 600 });
  assert.throws(() => validatePerformanceReport({ ...report, platform: 'linux-x64-node24' }, policy), /not comparable/u);
});

test('performance evidence fails closed on missing checks, invalid durations, and exceeded budgets', () => {
  assert.throws(() => validatePerformanceReport({ ...report, command: 'doctor' }, policy), /validate-all diagnostics/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [] }, policy), /no validation results/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [{ check: 'runtime.smoke', status: 'skipped', actual: { durationMs: 0 } }] }, policy), /passed runtime\.smoke/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [report.results[0], report.results[0]] }, policy), /exactly one passed runtime\.smoke/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: [{ check: 'runtime.smoke', status: 'passed', actual: { durationMs: -1 } }] }, policy), /invalid duration/u);
  assert.throws(() => validatePerformanceReport({ ...report, results: report.results.map((entry) => ({ ...entry, actual: { durationMs: 800 } })) }, policy), /task wall time/u);
});
