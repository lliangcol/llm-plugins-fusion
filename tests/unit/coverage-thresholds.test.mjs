import assert from 'node:assert/strict';
import test from 'node:test';
import {
  coverageThresholdFailures,
  parseCoverageSummary,
  resolveCoverageThresholds,
} from '../../scripts/lib/coverage-thresholds.mjs';

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
