#!/usr/bin/env node
/**
 * Validate public-safe workflow evaluation fixtures.
 *
 * This checks fixture contracts and expected signals. It does not execute
 * Claude Code slash commands or claim golden-output equivalence.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'workflow fixture validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixtureRoot = 'fixtures/workflow/invoice-sync';
let failed = 0;

function read(relPath) {
  return readFileSync(resolve(root, relPath), 'utf8');
}

function test(label, fn) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`ERROR ${label}`);
    console.error(`  ${error.message}`);
  }
}

test('fixture files exist', () => {
  for (const relPath of [
    `${fixtureRoot}/README.md`,
    `${fixtureRoot}/.gitignore`,
    `${fixtureRoot}/inputs/product-note.md`,
    `${fixtureRoot}/inputs/planning-brief.md`,
    `${fixtureRoot}/inputs/review-diff.patch`,
    `${fixtureRoot}/plans/approved-implementation-plan.md`,
    'docs/examples/workflow-evaluation.md',
    'docs/examples/workflow-evaluation-record-template.md',
  ]) {
    assert.equal(existsSync(resolve(root, relPath)), true, `missing ${relPath}`);
  }
});

test('fixture output stays ignored and disposable', () => {
  const gitignore = read(`${fixtureRoot}/.gitignore`);
  const readme = read(`${fixtureRoot}/README.md`);
  assert.match(gitignore, /^out\/$/m);
  assert.match(readme, /disposable/i);
  assert.match(readme, /fixtures\/workflow\/invoice-sync\/out\/plan\.md/);
});

test('review scenario preserves the ordering bug signal', () => {
  const patch = read(`${fixtureRoot}/inputs/review-diff.patch`);
  const markSynced = patch.indexOf('+    await store.markSynced(invoice.id);');
  const sendInvoice = patch.indexOf('await accountingClient.sendInvoice(invoice);');
  assert.ok(markSynced >= 0, 'patch must add premature markSynced call');
  assert.ok(sendInvoice >= 0, 'patch must include accounting send call');
  assert.ok(markSynced < sendInvoice, 'premature markSynced must appear before sendInvoice');
  assert.match(patch, /logs external failures/);
});

test('approved implementation plan keeps bounded scope', () => {
  const plan = read(`${fixtureRoot}/plans/approved-implementation-plan.md`);
  for (const required of [
    'PLAN_APPROVED=true',
    'No schema migration',
    'No new dependency',
    'external send happens before `markSynced`',
    'failure does not mark synced',
    'skipped validation is reported',
  ]) {
    assert.match(plan, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('workflow evaluation covers all five primary commands and rubric signals', () => {
  const doc = read('docs/examples/workflow-evaluation.md');
  for (const command of ['/explore', '/produce-plan', '/review', '/implement-plan', '/finalize-work']) {
    assert.match(doc, new RegExp(command.replace('/', '\\/')));
  }
  for (const signal of [
    'Boundary control',
    'Evidence quality',
    'User value',
    'Safety',
    'Report skipped validation honestly',
  ]) {
    assert.match(doc, new RegExp(signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(doc, /not exact wording/i);
});

console.log(`Summary: failed=${failed}`);
if (failed > 0) process.exit(1);
