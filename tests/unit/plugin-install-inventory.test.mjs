import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  assertMarketplaceRef,
  assertCandidateMarketplaceSource,
  buildInstallEvidence,
  diffInventory,
  parseArgs,
  parsePluginDetails,
  normalizeMarketplaceSource,
  treeDigest,
  treeManifest,
} from '../../scripts/validate-plugin-install.mjs';

test('install evidence records both successful live manifest validations', () => {
  const evidence = buildInstallEvidence({
    generatedAt: '2026-07-12T00:00:00.000Z',
    claudeVersion: '2.1.205 (Claude Code)',
    knownGoodClaudeCli: '2.1.205',
    manifestValidation: { marketplace: true, plugin: true },
    marketplace: { name: 'llm-plugins-fusion', source: 'owner/repo@v2.4.1', ref: 'v2.4.1' },
    plugin: { id: 'nova-plugin@llm-plugins-fusion', version: '2.4.1', installPath: '/tmp/plugin' },
    inventory: { count: 42, skills: [] },
    inventoryDiff: { matches: true },
    primaryEntrypoints: ['/nova-plugin:route'],
    sourceTreeDigest: 'a'.repeat(64),
    installedTreeDigest: 'a'.repeat(64),
    routeSmoke: null,
    validationErrors: [],
  });
  assert.deepEqual(evidence.manifestValidation, { marketplace: true, plugin: true });
  assert.equal(evidence.validation.passed, true);
  assert.deepEqual(evidence.installedTreeIgnoredPaths, ['.in_use/**']);

  const incomplete = buildInstallEvidence({
    ...evidence,
    manifestValidation: { marketplace: true, plugin: false },
  });
  assert.equal(incomplete.validation.passed, false);
  assert.deepEqual(incomplete.validation.errors, ['plugin manifest validation did not pass']);
});

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
    expectedCommit: null,
    evidenceSource: null,
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

test('candidate marketplace assertions bind plugin source to the exact tag and commit', () => {
  const marketplace = { plugins: [{ name: 'nova-plugin', source: { ref: 'v4.0.0-rc.4', sha: 'a'.repeat(40) } }] };
  assert.doesNotThrow(() => assertCandidateMarketplaceSource(marketplace, 'v4.0.0-rc.4', 'a'.repeat(40)));
  assert.throws(() => assertCandidateMarketplaceSource(marketplace, 'v4.0.0-rc.5', 'a'.repeat(40)), /plugin ref/u);
  assert.throws(() => assertCandidateMarketplaceSource(marketplace, 'v4.0.0-rc.4', 'b'.repeat(40)), /plugin commit/u);
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

test('known-good Claude inventory snapshot records commands plus canonical skills', async () => {
  const snapshot = JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(
    new URL('../../fixtures/runtime/claude-2.1.205-inventory.json', import.meta.url),
    'utf8',
  )));
  assert.equal(snapshot.skillsCount, 27);
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
  await mkdir(join(right, '.in_use'));
  await writeFile(join(right, '.in_use', '12345'), '');
  assert.notEqual(treeDigest(left), treeDigest(right));
  assert.equal(treeDigest(left), treeDigest(right, { ignoreClaudeRuntimeMarkers: true }));
  await writeFile(join(right, 'nested', 'file.txt'), 'changed');
  assert.notEqual(treeDigest(left), treeDigest(right));
  assert.notEqual(treeDigest(left), treeDigest(right, { ignoreClaudeRuntimeMarkers: true }));
});

test('tree manifest covers directories, modes, and symlink targets', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-tree-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'empty'));
  await writeFile(join(root, 'tool'), '#!/bin/sh\n');
  await chmod(join(root, 'tool'), 0o755);
  await symlink('tool', join(root, 'current'));
  const manifest = treeManifest(root);
  assert.deepEqual(manifest.map((entry) => [entry.path, entry.type]), [
    ['current', 'symlink'],
    ['empty', 'directory'],
    ['tool', 'file'],
  ]);
  assert.equal(manifest.find((entry) => entry.path === 'tool').mode, '100755');
  assert.equal(manifest.find((entry) => entry.path === 'current').target, 'tool');
});
