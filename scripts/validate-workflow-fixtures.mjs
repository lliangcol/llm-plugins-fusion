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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'workflow fixture validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixtureRoot = 'fixtures/workflow/invoice-sync';
const demoRoot = 'fixtures/demo';
let failed = 0;

function read(relPath) {
  return readFileSync(resolve(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function assertContainsAll(relPath, fragments) {
  const src = read(relPath);
  for (const fragment of fragments) {
    const pattern = fragment
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/ /g, '\\s+');
    assert.match(
      src,
      new RegExp(pattern, 'i'),
      `${relPath} missing ${fragment}`,
    );
  }
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
    `${fixtureRoot}/package.json`,
    `${fixtureRoot}/src/invoice-sync.js`,
    `${fixtureRoot}/test/invoice-sync.test.js`,
    `${demoRoot}/route-basic.json`,
    `${demoRoot}/review-signal.json`,
    `${demoRoot}/verification-evidence.json`,
    'docs/examples/workflow-evaluation.md',
    'docs/examples/workflow-evaluation-record-template.md',
  ]) {
    assert.equal(existsSync(resolve(root, relPath)), true, `missing ${relPath}`);
  }
});

test('headless demo fixtures are deterministic and public-safe', () => {
  const fixtures = [
    readJson(`${demoRoot}/route-basic.json`),
    readJson(`${demoRoot}/review-signal.json`),
    readJson(`${demoRoot}/verification-evidence.json`),
  ];

  for (const fixture of fixtures) {
    assert.match(fixture.id, /^[a-z0-9-]+$/);
    assert.ok(['route', 'review', 'verification'].includes(fixture.mode), `${fixture.id} has unexpected mode`);
    assert.equal(typeof fixture.request, 'string', `${fixture.id} missing request`);
    assert.ok(fixture.expected && typeof fixture.expected === 'object', `${fixture.id} missing expected object`);
    assert.ok(Array.isArray(fixture.expected.outputSignals), `${fixture.id} missing outputSignals`);
    assert.ok(Array.isArray(fixture.expected.failureSignals), `${fixture.id} missing failureSignals`);
    assert.ok(fixture.expected.outputSignals.length > 0, `${fixture.id} outputSignals empty`);
    assert.ok(fixture.expected.failureSignals.length > 0, `${fixture.id} failureSignals empty`);
    const boundaryText = fixture.boundaries.join(' ');
    assert.match(boundaryText, /fictional public-safe fixture/i);
    assert.match(boundaryText, /does not (?:call|execute)/i);
    assert.match(boundaryText, /private consumer names/i);
    assert.doesNotMatch(JSON.stringify(fixture), /D:\\|https:\/\/[^"\s]*internal|customer|prod|token=/i);
  }
});

test('headless demo docs and scripts stay linked', () => {
  for (const relPath of [
    'scripts/demo-route.mjs',
    'scripts/demo-review.mjs',
  ]) {
    assert.equal(existsSync(resolve(root, relPath)), true, `missing ${relPath}`);
  }
  assertContainsAll('docs/getting-started.md', [
    'No-Credential Headless Demo',
    'npm run demo:route',
    'npm run demo:review',
    'They do not execute slash commands',
  ]);
  assertContainsAll('docs/examples/README.md', [
    'Headless Demo Fixtures',
    'fixtures/demo',
    'not an LLM execution',
  ]);
  assertContainsAll('docs/workflows/source-controlled-checks.md', [
    'fixtures/demo',
    'scripts/demo-route.mjs',
    'scripts/demo-review.mjs',
    'They do not call Claude Code',
  ]);
});

test('workflow examples preserve public-safe redaction boundaries', () => {
  const commonPrivateSignals = [
    'private project names',
    'endpoints',
    'credentials',
    'runtime flags',
  ];

  assertContainsAll('docs/examples/README.md', [
    'public-safe examples',
    'fictional or generic scenarios',
    ...commonPrivateSignals,
  ]);
  assertContainsAll('docs/examples/workflow-evaluation.md', [
    'public-safe scenarios',
    'intentionally fictional',
    ...commonPrivateSignals,
  ]);
  assertContainsAll('docs/examples/workflow-evaluation-record-template.md', [
    'disposable consumer fixture',
    'throwaway branch',
    'Do not paste private project names',
    'private repository URLs',
  ]);
  assertContainsAll(`${fixtureRoot}/README.md`, [
    'public-safe disposable fixture',
    'This fixture is fictional',
    ...commonPrivateSignals,
    'Do not copy private consumer facts',
  ]);
  assertContainsAll('docs/examples/java-backend/redacted-feature.md', [
    'fictional backend feature',
    'does not describe a real consumer',
    'Do not publish private Maven profiles',
  ]);
  assertContainsAll('docs/examples/frontend/basic-feature.md', [
    'fictional frontend feature',
    'does not describe a real consumer',
    'Do not publish private package scripts',
  ]);
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

test('implementation fixture is runnable and preserves the defect to fix', () => {
  const packageJson = readJson(`${fixtureRoot}/package.json`);
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.type, 'module');
  assert.equal(packageJson.scripts?.test, 'node --test test/invoice-sync.test.js');
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);

  const source = read(`${fixtureRoot}/src/invoice-sync.js`);
  const markSynced = source.indexOf('await store.markSynced(invoice.id);');
  const sendInvoice = source.indexOf('await accountingClient.sendInvoice(invoice);');
  assert.ok(markSynced >= 0 && sendInvoice >= 0);
  assert.ok(markSynced < sendInvoice, 'baseline source must retain the ordering defect');

  const tests = read(`${fixtureRoot}/test/invoice-sync.test.js`);
  assert.match(tests, /marks invoice synced after successful send/);
  assert.match(tests, /logs external failures/);
  assert.doesNotMatch(tests, /external failure does not mark synced/);

  const baseline = spawnSync(process.execPath, ['--test', 'test/invoice-sync.test.js'], {
    cwd: resolve(root, fixtureRoot),
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
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
