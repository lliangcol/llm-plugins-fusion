import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  coverageCommand,
  parseCoverageArgs,
  prepareCoverageDirectory,
  runCoverage,
} from '../../scripts/lib/coverage-runner.mjs';

test('coverage runner parses strict CLI options', () => {
  const root = process.cwd();
  assert.equal(parseCoverageArgs(['--check'], root).check, true);
  assert.equal(parseCoverageArgs(['--coverage-dir', '.metrics/out'], root).coverageDir, resolve(root, '.metrics/out'));
  assert.throws(() => parseCoverageArgs(['--coverage-dir', 'out'], root), /below \.metrics/u);
  assert.throws(() => parseCoverageArgs(['--coverage-dir', '--check'], root), /requires a value/);
  assert.throws(() => parseCoverageArgs(['--unknown'], root), /unknown argument/);
});

test('coverage command uses explicit test files', () => {
  assert.deepEqual(coverageCommand(['tests/a.test.mjs']), [
    '--test', '--experimental-test-coverage', '--test-concurrency=4', 'tests/a.test.mjs',
  ]);
});

test('coverage cleanup removes only the owned V8 evidence directory', () => {
  const calls = [];
  const v8Dir = prepareCoverageDirectory('/repo', {
    remove: (...args) => calls.push(['remove', ...args]),
    makeDirectory: (...args) => calls.push(['mkdir', ...args]),
  });
  assert.equal(v8Dir, resolve('/repo', 'v8'));
  assert.deepEqual(calls, [
    ['remove', resolve('/repo', 'v8'), { recursive: true, force: true }],
    ['mkdir', resolve('/repo', 'v8'), { recursive: true }],
  ]);
});

test('coverage help path has no filesystem or process side effects', () => {
  assert.equal(runCoverage({ root: process.cwd(), args: ['--help'] }), 0);
});

test('a failed checked coverage run removes stale promotable metadata', () => {
  const coverageDir = mkdtempSync(join(tmpdir(), 'nova-coverage-failure-'));
  try {
    const metadata = join(coverageDir, 'metadata.json');
    writeFileSync(metadata, '{"gatePassed":true}\n');
    const result = runCoverage({
      root: process.cwd(),
      args: ['--check', '--coverage-dir', coverageDir],
      runner: () => ({ status: 1, signal: null, stdout: '', stderr: 'test failure\n' }),
      now: () => new Date('2026-07-12T00:00:00.000Z'),
    });
    assert.equal(result, 1);
    assert.equal(existsSync(metadata), false);
    const summary = readFileSync(join(coverageDir, 'coverage-summary.txt'), 'utf8');
    assert.match(summary, /^command=node /u);
    assert.equal(summary.includes(process.execPath), false);
  } finally {
    rmSync(coverageDir, { recursive: true, force: true });
  }
});

test('checked coverage metadata is written only after every governed gate passes', () => {
  const coverageDir = mkdtempSync(join(tmpdir(), 'nova-coverage-success-'));
  const times = [
    new Date('2026-07-12T00:00:00.000Z'),
    new Date('2026-07-12T00:00:02.500Z'),
  ];
  try {
    const result = runCoverage({
      root: process.cwd(),
      args: ['--check', '--coverage-dir', coverageDir],
      runner: () => ({
        status: 0,
        signal: null,
        stdout: 'start of coverage report\nall files | 91 | 75 | 94\n',
        stderr: '',
      }),
      now: () => times.shift(),
      discoverTests: () => ['tests/unit/example.test.mjs'],
      readText: () => JSON.stringify({ criticalCoverage: { modules: {} } }),
      listDirectory: () => ['coverage-1.json'],
      inventorySources: () => ['scripts/example.mjs'],
      inventoryLoadedSources: () => ['scripts/example.mjs'],
    });
    assert.equal(result, 0);
    const metadata = JSON.parse(readFileSync(join(coverageDir, 'metadata.json'), 'utf8'));
    assert.equal(metadata.schemaVersion, 2);
    assert.equal(metadata.gatePassed, true);
    assert.deepEqual(metadata.command, ['node', '--test', '--experimental-test-coverage', '--test-concurrency=4', 'tests/unit/example.test.mjs']);
    assert.deepEqual(metadata.actual, { lines: 91, branches: 75, functions: 94 });
    assert.equal(metadata.durationMs, 2500);
    assert.equal(metadata.rawCoverageFileCount, 1);
    assert.equal(metadata.expectedSourceCount, 1);
    assert.equal(metadata.loadedSourceCount, 1);
    assert.equal(JSON.stringify(metadata).includes(process.execPath), false);
  } finally {
    rmSync(coverageDir, { recursive: true, force: true });
  }
});
