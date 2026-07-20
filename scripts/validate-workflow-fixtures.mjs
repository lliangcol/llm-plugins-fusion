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
import { assertDemoFixtureContract, demoFixtureModel } from './lib/demo-fixture-contract.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

assertNodeVersion({ label: 'workflow fixture validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixtureRoot = 'fixtures/workflow/invoice-sync';
const demoRoot = 'fixtures/demo';
const demoModel = demoFixtureModel(loadNovaWorkflowModelV6(root));
let failed = 0;

function read(relPath) {
  return readFileSync(resolve(root, relPath), 'utf8');
}

function readJson(relPath) {
  try {
    return JSON.parse(read(relPath));
  } catch (error) {
    throw new Error(`malformed JSON fixture ${relPath}: ${error.message}`);
  }
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
    `${demoRoot}/route-dependency-update.json`,
    `${demoRoot}/review-signal.json`,
    `${demoRoot}/verification-evidence.json`,
    'docs/tutorials/workflow-evaluation.md',
    'docs/templates/evidence/workflow-evaluation.md',
  ]) {
    assert.equal(existsSync(resolve(root, relPath)), true, `missing ${relPath}`);
  }
});

test('headless demo fixtures are deterministic and public-safe', () => {
  const fixtures = [
    readJson(`${demoRoot}/route-basic.json`),
    readJson(`${demoRoot}/route-dependency-update.json`),
    readJson(`${demoRoot}/review-signal.json`),
    readJson(`${demoRoot}/verification-evidence.json`),
  ];

  for (const fixture of fixtures) {
    assert.equal(assertDemoFixtureContract(fixture, demoModel), true);
    const boundaryText = fixture.boundaries.join(' ');
    assert.match(boundaryText, /fictional public-safe fixture/i);
    assert.match(boundaryText, /does not (?:call|execute)/i);
    assert.match(boundaryText, /private consumer names/i);
    assert.doesNotMatch(JSON.stringify(fixture), /D:\\|https:\/\/[^"\s]*internal|customer|prod|token=/i);
  }
});

test('dependency-update route fixture requires review before implementation', () => {
  const relPath = `${demoRoot}/route-dependency-update.json`;
  assert.equal(existsSync(resolve(root, relPath)), true, `missing dependency-update route fixture: ${relPath}`);

  const fixture = readJson(relPath);
  assert.equal(fixture.id, 'route-dependency-update', `${relPath} has unexpected id`);
  assert.equal(fixture.mode, 'route', `${relPath} must use route mode`);
  assert.equal(fixture.expected?.nextCommand, '/nova-plugin:review', `${relPath} must route to review before implementation`);
  assert.equal(fixture.expected?.stage, 'review', `${relPath} must identify the canonical review stage`);
  assert.deepEqual(fixture.expected?.packs, ['dependency', 'security'], `${relPath} must preserve dependency and security review order`);
  assert.ok(Array.isArray(fixture.expected?.requiredInputs), `${relPath} missing requiredInputs`);

  const orderedSignals = fixture.expected.outputSignals.join(' ');
  assert.match(orderedSignals, /dependency and security impact before implementation/i, `${relPath} missing review-before-implementation signal`);
  assert.match(orderedSignals, /skipped or not-run evidence/i, `${relPath} missing explicit evidence-status signal`);
  assert.match(fixture.expected.failureSignals.join(' '), /starts implementation before dependency and security review/i, `${relPath} missing unsafe-order failure signal`);
});

test('headless demo docs and scripts stay linked', () => {
  for (const relPath of [
    'scripts/demo-route.mjs',
    'scripts/demo-review.mjs',
  ]) {
    assert.equal(existsSync(resolve(root, relPath)), true, `missing ${relPath}`);
  }
  assertContainsAll('docs/getting-started/first-workflow.md', [
    'No-Credential Headless Demo',
    'npm run demo:route',
    'npm run demo:review',
    'They do not execute slash commands',
    'route-dependency-update.json',
    'dependency and security review before implementation',
  ]);
  assertContainsAll('docs/tutorials/README.md', [
    'Headless Demo Fixtures',
    'fixtures/demo',
    'not an LLM execution',
  ]);
  assertContainsAll('docs/guides/workflows/source-controlled-checks.md', [
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

  assertContainsAll('docs/tutorials/README.md', [
    'public-safe examples',
    'fictional or generic scenarios',
    ...commonPrivateSignals,
  ]);
  assertContainsAll('docs/tutorials/workflow-evaluation.md', [
    'public-safe scenarios',
    'intentionally fictional',
    ...commonPrivateSignals,
  ]);
  assertContainsAll('docs/templates/evidence/workflow-evaluation.md', [
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
  assertContainsAll('docs/tutorials/java-backend.md', [
    'fictional backend feature',
    'does not describe a real consumer',
    'Do not publish private Maven profiles',
  ]);
  assertContainsAll('docs/tutorials/frontend.md', [
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
  const doc = read('docs/tutorials/workflow-evaluation.md');
  for (const command of [
    '/nova-plugin:explore',
    '/nova-plugin:produce-plan',
    '/nova-plugin:review',
    '/nova-plugin:implement-plan',
    '/nova-plugin:finalize-work',
  ]) {
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
