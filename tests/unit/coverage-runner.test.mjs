import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  coverageCommand,
  parseCoverageArgs,
  runCoverage,
} from '../../scripts/lib/coverage-runner.mjs';

test('coverage runner parses strict CLI options', () => {
  const root = '/tmp/repo';
  assert.equal(parseCoverageArgs(['--check'], root).check, true);
  assert.equal(parseCoverageArgs(['--coverage-dir', 'out'], root).coverageDir, resolve(root, 'out'));
  assert.throws(() => parseCoverageArgs(['--coverage-dir', '--check'], root), /requires a value/);
  assert.throws(() => parseCoverageArgs(['--unknown'], root), /unknown argument/);
});

test('coverage command uses explicit test files', () => {
  assert.deepEqual(coverageCommand(['tests/a.test.mjs']), [
    '--test', '--experimental-test-coverage', 'tests/a.test.mjs',
  ]);
});

test('coverage help path has no filesystem or process side effects', () => {
  assert.equal(runCoverage({ root: process.cwd(), args: ['--help'] }), 0);
});
