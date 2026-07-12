import assert from 'node:assert/strict';
import test from 'node:test';
import {
  criticalCoverageFailures,
  coverageThresholdFailures,
  parseCoverageFileRows,
  parseCoverageSummary,
  resolveCoverageThresholds,
} from '../../scripts/lib/coverage-thresholds.mjs';

test('coverage parser and critical floors preserve per-module evidence', () => {
  const rows = parseCoverageFileRows('ℹ   safe-workspace-path.mjs | 93.01 | 78.43 | 100.00 | 26-27\n');
  assert.deepEqual(rows.get('safe-workspace-path.mjs'), { lines: 93.01, branches: 78.43, functions: 100 });
  assert.deepEqual(criticalCoverageFailures(rows, { 'safe-workspace-path.mjs': { lines: 90, branches: 75, functions: 100 } }), []);
  assert.deepEqual(criticalCoverageFailures(rows, { 'safe-workspace-path.mjs': { lines: 95, branches: 80, functions: 100 }, 'missing.mjs': { lines: 1, branches: 1, functions: 1 } }), [
    'safe-workspace-path.mjs lines coverage 93.01% is below required 95%',
    'safe-workspace-path.mjs branches coverage 78.43% is below required 80%',
    'missing.mjs coverage row is missing',
  ]);
});

test('coverage summary parsing supports Node test report prefixes', () => {
  const output = [
    'ℹ file | line % | branch % | funcs % | uncovered lines',
    'ℹ all files | 89.12 | 64.42 | 94.02 |',
  ].join('\n');
  assert.deepEqual(parseCoverageSummary(output), {
    lines: 89.12,
    branches: 64.42,
    functions: 94.02,
  });
});

test('coverage thresholds use defaults and accept explicit overrides', () => {
  assert.deepEqual(resolveCoverageThresholds({}), {
    lines: 85,
    branches: 60,
    functions: 90,
  });
  assert.deepEqual(resolveCoverageThresholds({
    NOVA_COVERAGE_LINES: '80.5',
    NOVA_COVERAGE_BRANCHES: '55',
    NOVA_COVERAGE_FUNCTIONS: '88',
  }), {
    lines: 80.5,
    branches: 55,
    functions: 88,
  });
  assert.throws(
    () => resolveCoverageThresholds({ NOVA_COVERAGE_LINES: '101' }),
    /between 0 and 100/,
  );
});

test('coverage threshold failures identify only metrics below baseline', () => {
  assert.deepEqual(coverageThresholdFailures(
    { lines: 84.9, branches: 60, functions: 89 },
    { lines: 85, branches: 60, functions: 90 },
  ), [
    'lines coverage 84.9% is below required 85%',
    'functions coverage 89% is below required 90%',
  ]);
});
