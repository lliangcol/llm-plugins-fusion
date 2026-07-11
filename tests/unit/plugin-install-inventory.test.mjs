import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  assertMarketplaceRef,
  diffInventory,
  parseArgs,
  parsePluginDetails,
  normalizeMarketplaceSource,
  treeDigest,
} from '../../scripts/validate-plugin-install.mjs';

test('plugin install options accept exact source/ref and evidence output', () => {
  assert.deepEqual(parseArgs([
    '--accept-user-scope-mutation',
    '--isolated-home',
    '--marketplace-source',
    'owner/repo@v2.4.1',
    '--expected-ref',
    'v2.4.1',
    '--inventory-out',
    '.metrics/inventory.json',
  ]), {
    dryRun: false,
    acceptedUserScopeMutation: true,
    isolatedHome: true,
    marketplaceSource: 'owner/repo@v2.4.1',
    expectedRef: 'v2.4.1',
    inventoryOut: '.metrics/inventory.json',
    routeSmokeOut: null,
    help: false,
  });
});

test('inventory diff preserves missing and unexpected Skills for drift artifacts', () => {
  const diff = diffInventory(['route', 'nova-route', 'unexpected'], ['route', 'nova-route', 'review']);
  assert.equal(diff.matches, false);
  assert.deepEqual(diff.missing, ['review']);
  assert.deepEqual(diff.unexpected, ['unexpected']);
  assert.match(diff.actualSha256, /^[a-f0-9]{64}$/);
  assert.match(diff.expectedSha256, /^[a-f0-9]{64}$/);
});

test('marketplace ref assertions distinguish local sources from exact remote refs', () => {
  assert.doesNotThrow(() => assertMarketplaceRef({}, 'local', true));
  assert.doesNotThrow(() => assertMarketplaceRef({ ref: 'v2.4.1' }, 'v2.4.1', false));
  assert.throws(() => assertMarketplaceRef({}, 'v2.4.1', false), /expected "v2.4.1"/);
  assert.throws(() => assertMarketplaceRef({}, 'local', false), /filesystem marketplace source/);
});

test('local marketplace sources are normalized for the Claude CLI', () => {
  assert.equal(normalizeMarketplaceSource('.', process.cwd()), process.cwd());
  assert.equal(
    normalizeMarketplaceSource('owner/repo@v2.4.1', process.cwd()),
    'owner/repo@v2.4.1',
  );
});

test('plugin details parser normalizes exact Skills inventory', () => {
  const parsed = parsePluginDetails(`nova-plugin 2.4.1

Component inventory
  Skills (4)  route, nova-route, explore, nova-explore
  Agents (0)
`);
  assert.deepEqual(parsed, {
    count: 4,
    skills: ['explore', 'nova-explore', 'nova-route', 'route'],
  });
  assert.throws(() => parsePluginDetails('Skills (2) route'), /reported 2 Skills but listed 1/);
});

test('known-good Claude inventory snapshot records the dual surface', async () => {
  const snapshot = JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(
    new URL('../../fixtures/runtime/claude-2.1.205-inventory.json', import.meta.url),
    'utf8',
  )));
  assert.equal(snapshot.skillsCount, 42);
  assert.equal(snapshot.skills.includes('route'), true);
  assert.equal(snapshot.skills.includes('nova-route'), true);
  assert.equal(snapshot.primaryEntrypoints.includes('/nova-plugin:nova-route'), false);
});

test('tree digest is deterministic and content-sensitive', async (t) => {
  const left = await mkdtemp(join(tmpdir(), 'nova-tree-left-'));
  const right = await mkdtemp(join(tmpdir(), 'nova-tree-right-'));
  t.after(() => Promise.all([
    rm(left, { recursive: true, force: true }),
    rm(right, { recursive: true, force: true }),
  ]));
  await mkdir(join(left, 'nested'));
  await mkdir(join(right, 'nested'));
  await writeFile(join(left, 'nested', 'file.txt'), 'same');
  await writeFile(join(right, 'nested', 'file.txt'), 'same');
  assert.equal(treeDigest(left), treeDigest(right));
  await writeFile(join(right, 'nested', 'file.txt'), 'changed');
  assert.notEqual(treeDigest(left), treeDigest(right));
});
