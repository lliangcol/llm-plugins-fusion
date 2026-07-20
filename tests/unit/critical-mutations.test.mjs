import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  checkOrWriteReport,
  evaluateMutationProbe,
  finalizeMutationReport,
  runMutations,
} from '../../scripts/run-critical-mutations.mjs';

test('critical mutation probes kill governed operators without infrastructure errors', async () => {
  const report = await runMutations();
  assert.equal(report.results.length, 10);
  assert.equal(report.score, 1);
  assert.equal(report.results.every((entry) => entry.killed && typeof entry.reason === 'string'), true);
  assert.doesNotMatch(
    JSON.stringify(report.results),
    /Cannot find module|ERR_MODULE_NOT_FOUND|nova-mutation-|\/(?:private|tmp|Users)\/|[A-Za-z]:[\\/]/u,
  );
});

test('critical mutation probes require a healthy unmodified baseline before scoring a mutant', async () => {
  const probe = {
    id: 'broken-baseline',
    async test(module) { return module.broken ? 'governed behavior is already broken' : null; },
  };
  await assert.rejects(
    evaluateMutationProbe(probe, { broken: true }, { broken: true }),
    /baseline probe failed before mutation: governed behavior is already broken/u,
  );
  assert.deepEqual(
    await evaluateMutationProbe(probe, { broken: false }, { broken: true }),
    { killed: true, reason: 'governed behavior is already broken' },
  );
});

test('critical mutation baseline uses check-or-write drift semantics', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'nova-critical-mutation-'));
  const path = join(root, 'critical-mutation.json');
  const report = {
    schemaVersion: 1,
    executionMode: 'targeted-source-mutation',
    results: [{ id: 'fixture', source: 'fixture.mjs', killed: true, reason: 'expected' }],
    score: 1,
    targetScore: 1,
  };
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.throws(() => checkOrWriteReport(report, { path }), /critical-mutation\.json is stale/u);
  checkOrWriteReport(report, { path, write: true });
  assert.equal(readFileSync(path, 'utf8'), `${JSON.stringify(report, null, 2)}\n`);
  assert.doesNotThrow(() => checkOrWriteReport(report, { path }));

  writeFileSync(path, '{}\n');
  assert.throws(() => checkOrWriteReport(report, { path }), /critical-mutation\.json is stale/u);

  const failed = {
    ...report,
    results: Array.from({ length: 9 }, (_, index) => ({
      id: `fixture-${index}`,
      source: 'fixture.mjs',
      killed: index !== 8,
      reason: index === 8 ? null : 'expected',
    })),
    score: 8 / 9,
  };
  assert.throws(() => finalizeMutationReport(failed, { path, write: true }), /must kill every governed probe \(8\/9\)/u);
  assert.equal(readFileSync(path, 'utf8'), '{}\n');

  assert.throws(
    () => finalizeMutationReport({ ...report, targetScore: 0.8 }, { path, write: true }),
    /targetScore and score must both equal 1/u,
  );
  assert.equal(readFileSync(path, 'utf8'), '{}\n');
});
