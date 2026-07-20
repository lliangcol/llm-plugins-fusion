import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { realpathSync, rmSync } from 'node:fs';
import { chmod, link, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { assertPortableRelativePath } from '../../scripts/lib/portable-path.mjs';
import {
  assertMarketplaceRef,
  assertCandidateMarketplaceSource,
  assertIsolatedInstallPath,
  assertPublicEvidenceSource,
  assertTrustedClaudeInvocation,
  buildInstallEvidence,
  configureIsolatedHome,
  diffInventory,
  loadInstalledSourceContract,
  main as installMain,
  parseArgs,
  parsePluginDetails,
  resolveInstallEvidenceSource,
  resolveInstallSourceType,
  resolveSourceTreeIdentity,
  normalizeMarketplaceSource,
  readSelectedMarketplace,
  resolveTrustedClaudeInvocation,
  sanitizeIsolatedExecutablePath,
  selectMarketplacePlugin,
  treeDigest,
  treeManifest,
} from '../../scripts/validate-plugin-install.mjs';

const trustedExecutablePath = dirname(realpathSync.native(process.execPath));

test('install evidence records both successful live manifest validations', () => {
  const evidence = buildInstallEvidence({
    generatedAt: '2026-07-12T00:00:00.000Z',
    claudeVersion: '2.1.205 (Claude Code)',
    knownGoodClaudeCli: '2.1.205',
    manifestValidation: { marketplace: true, plugin: true },
    marketplace: { name: 'llm-plugins-fusion', source: 'owner/repo@v2.4.1', ref: 'v2.4.1', installSourceType: 'local-manifest-remote-exact-ref' },
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
  assert.deepEqual(evidence.plugin, { id: 'nova-plugin@llm-plugins-fusion', version: '2.4.1' });
  assert.equal('installPath' in evidence.plugin, false);

  const incomplete = buildInstallEvidence({
    ...evidence,
    manifestValidation: { marketplace: true, plugin: false },
  });
  assert.equal(incomplete.validation.passed, false);
  assert.deepEqual(incomplete.validation.errors, ['plugin manifest validation did not pass']);
});

test('install evidence accepts public provenance and rejects local path sources', () => {
  assert.equal(assertPublicEvidenceSource('local-isolated-install'), 'local-isolated-install');
  assert.equal(assertPublicEvidenceSource('owner/repo@refs/tags/v4.0.0'), 'owner/repo@refs/tags/v4.0.0');
  for (const source of [
    '/private/tmp/repo', 'C:\\Users\\user\\repo', '\\\\server\\share\\repo', '~/repo', '~user/repo',
    'file:///tmp/repo', '.', '..', './repo', '../repo', '.\\repo', '..\\repo', 'local/repo',
  ]) {
    assert.throws(() => assertPublicEvidenceSource(source), /evidence source/u, source);
  }

  const evidenceSource = resolveInstallEvidenceSource({
    evidenceSource: null,
    marketplaceSource: '/Users/example/private-checkout',
    localMarketplaceSource: true,
  });
  assert.equal(evidenceSource, 'local-isolated-install');
  const evidence = buildInstallEvidence({
    generatedAt: '2026-07-17T00:00:00.000Z',
    claudeVersion: '2.1.205',
    knownGoodClaudeCli: '2.1.205',
    manifestValidation: { marketplace: true, plugin: true },
    marketplace: { name: 'llm-plugins-fusion', source: evidenceSource, ref: null, installSourceType: 'local-manifest-local-plugin-bytes' },
    plugin: { id: 'nova-plugin@llm-plugins-fusion', version: '4.0.0' },
    inventory: { count: 0, skills: [] },
    inventoryDiff: { matches: true },
    primaryEntrypoints: [],
    sourceTreeDigest: 'a'.repeat(64),
    installedTreeDigest: 'a'.repeat(64),
    routeSmoke: null,
  });
  assert.doesNotMatch(JSON.stringify(evidence), /Users|private-checkout/u);
  assert.throws(() => buildInstallEvidence({
    ...evidence,
    marketplace: { ...evidence.marketplace, source: '/Users/example/private-checkout' },
  }), /evidence source/u);
});

test('isolated install overrides an inherited Claude config directory', () => {
  const isolated = configureIsolatedHome({
    PATH: trustedExecutablePath,
    CLAUDE_CONFIG_DIR: '/outside/real-user-config',
    CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test-token',
    HTTPS_PROXY: 'http://proxy.invalid:8080',
    KEEP: 'must-not-propagate',
  });
  try {
    assert.equal(isolated.env.CLAUDE_CONFIG_DIR, resolve(isolated.dir, '.claude'));
    assert.equal(isolated.env.HOME, isolated.dir);
    assert.equal(isolated.env.USERPROFILE, isolated.dir);
    assert.equal(isolated.env.TMPDIR, resolve(isolated.dir, 'tmp'));
    assert.equal(isolated.env.CLAUDE_CODE_OAUTH_TOKEN, 'oauth-test-token');
    assert.equal(isolated.env.HTTPS_PROXY, 'http://proxy.invalid:8080');
    assert.equal(isolated.env.KEEP, undefined);
  } finally {
    rmSync(isolated.dir, { recursive: true, force: true });
  }
});

test('isolated install fails closed on inherited launch, provider, model, endpoint, and credential overrides', () => {
  const base = { PATH: trustedExecutablePath };
  for (const [name, value] of [
    ['NODE_OPTIONS', '--require=/tmp/inject.cjs'],
    ['NODE_PATH', '/tmp/modules'],
    ['BASH_ENV', '/tmp/startup.sh'],
    ['ENV', '/tmp/startup.sh'],
    ['CDPATH', '/tmp'],
    ['ANTHROPIC_API_KEY', 'competing-key'],
    ['ANTHROPIC_AUTH_TOKEN', 'competing-token'],
    ['ANTHROPIC_MODEL', 'uncontrolled-model'],
    ['ANTHROPIC_BASE_URL', 'https://uncontrolled.invalid'],
    ['CLAUDE_CODE_USE_BEDROCK', '1'],
    ['CLAUDE_CODE_MODEL', 'uncontrolled-model'],
    ['AWS_ACCESS_KEY_ID', 'competing-access-key'],
    ['GOOGLE_APPLICATION_CREDENTIALS', '/tmp/competing.json'],
  ]) {
    assert.throws(
      () => configureIsolatedHome({ ...base, [name]: value }),
      new RegExp(`forbids inherited overrides: ${name}`, 'u'),
      name,
    );
  }
});

test('isolated install rejects ambiguous or repository-controlled executable search paths', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'nova-install-path-trust-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = join(fixture, 'workspace');
  const workspaceBin = join(workspace, 'bin');
  const externalBin = join(fixture, 'external-bin');
  const linkedWorkspaceBin = join(fixture, 'linked-workspace-bin');
  await mkdir(workspaceBin, { recursive: true });
  await mkdir(externalBin);
  await symlink(workspaceBin, linkedWorkspaceBin, 'dir');

  assert.equal(
    sanitizeIsolatedExecutablePath(`${externalBin}${delimiter}${join(fixture, 'missing-bin')}`, { workspaceRoot: workspace }),
    realpathSync.native(externalBin),
  );
  for (const pathValue of [
    `.${delimiter}${externalBin}`,
    `${externalBin}${delimiter}`,
    workspaceBin,
    linkedWorkspaceBin,
  ]) {
    assert.throws(
      () => configureIsolatedHome({ PATH: pathValue }, { workspaceRoot: workspace }),
      /PATH.*(?:absolute|empty|repository)/u,
      pathValue,
    );
  }
});

test('isolated install pins one physical Claude invocation before exposing credentials', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'nova-install-claude-identity-'));
  const workspace = join(fixture, 'workspace');
  const externalBin = join(fixture, 'trusted-bin');
  const workspaceBin = join(workspace, 'bin');
  await mkdir(externalBin, { recursive: true });
  await mkdir(workspaceBin, { recursive: true });
  const trustedClaude = join(externalBin, 'claude');
  const shadowClaude = join(workspaceBin, 'claude');
  await writeFile(trustedClaude, '#!/usr/bin/env node\nconsole.log("trusted-cli");\n');
  await writeFile(shadowClaude, '#!/bin/sh\necho workspace-shadow\n');
  await chmod(trustedClaude, 0o755);
  await chmod(shadowClaude, 0o755);
  const isolated = configureIsolatedHome({
    PATH: externalBin,
    CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test-token',
  }, { workspaceRoot: workspace });
  t.after(() => Promise.all([
    rm(fixture, { recursive: true, force: true }),
    rm(isolated.dir, { recursive: true, force: true }),
  ]));

  const invocation = resolveTrustedClaudeInvocation({ env: isolated.env, workspaceRoot: workspace });
  assert.equal(invocation.command, realpathSync.native(process.execPath));
  assert.deepEqual(invocation.argsPrefix, [realpathSync.native(trustedClaude)]);
  assert.equal(invocation.resolutionKind, 'posix-node-script');
  const observed = spawnSync(invocation.command, [...invocation.argsPrefix, '--version'], {
    cwd: workspace,
    env: { ...isolated.env, PATH: workspaceBin },
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(observed.status, 0);
  assert.equal(observed.stdout.trim(), 'trusted-cli');
  assertTrustedClaudeInvocation(invocation);

  await rm(trustedClaude);
  await writeFile(trustedClaude, '#!/usr/bin/env node\nconsole.log("replacement");\n');
  await chmod(trustedClaude, 0o755);
  assert.throws(() => assertTrustedClaudeInvocation(invocation), /changed after its trusted invocation/u);

  const unsupportedClaude = join(externalBin, 'unsupported-claude');
  await writeFile(unsupportedClaude, '#!/bin/sh\necho unsupported\n');
  await chmod(unsupportedClaude, 0o755);
  await rename(unsupportedClaude, trustedClaude);
  assert.throws(
    () => resolveTrustedClaudeInvocation({ env: isolated.env, workspaceRoot: workspace }),
    /unsupported shebang interpreter/u,
  );
});

test('local marketplace reads reject linked parent chains and hard-linked manifests', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'nova-install-marketplace-boundary-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const source = join(fixture, 'source');
  const outside = join(fixture, 'outside');
  await mkdir(source);
  await mkdir(outside);
  const manifest = join(outside, 'marketplace.json');
  await writeFile(manifest, JSON.stringify({ name: 'fixture', plugins: [] }));
  await symlink(outside, join(source, '.claude-plugin'), 'dir');
  assert.throws(
    () => readSelectedMarketplace(source, true),
    /parent.*physical directory|symlink/u,
  );

  const linkedManifest = join(fixture, 'linked-marketplace.json');
  await link(manifest, linkedManifest);
  assert.throws(
    () => readSelectedMarketplace(linkedManifest, true),
    /must not be hard linked/u,
  );
});

test('installed plugin roots must remain physically inside the isolated home', { skip: process.platform === 'win32' }, async (t) => {
  const isolated = configureIsolatedHome({ PATH: trustedExecutablePath });
  const outside = await mkdtemp(join(tmpdir(), 'nova-install-outside-'));
  t.after(() => {
    rmSync(isolated.dir, { recursive: true, force: true });
    return rm(outside, { recursive: true, force: true });
  });
  const installed = join(isolated.dir, '.claude', 'plugins', 'nova-plugin');
  await mkdir(installed, { recursive: true });
  const snapshot = assertIsolatedInstallPath(isolated.dir, installed);
  assert.equal(snapshot.installed.lexicalPath, resolve(installed));
  assert.throws(() => assertIsolatedInstallPath(isolated.dir, outside), /strictly physically contained/u);

  const linked = join(isolated.dir, '.claude', 'plugins', 'linked-plugin');
  await symlink(installed, linked);
  assert.throws(() => assertIsolatedInstallPath(isolated.dir, linked), /non-symlink directory/u);

  const displaced = `${installed}-old`;
  await rename(installed, displaced);
  await mkdir(installed);
  assert.throws(
    () => assertIsolatedInstallPath(isolated.dir, installed, snapshot),
    /changed during tree digest/u,
  );
});

test('plugin install options accept a local marketplace path with exact selected-source ref', () => {
  assert.deepEqual(parseArgs([
    '--accept-user-scope-mutation',
    '--isolated-home',
    '--marketplace-source',
    '.',
    '--expected-ref',
    'v2.4.1',
    '--inventory-out',
    '.metrics/inventory.json',
  ]), {
    dryRun: false,
    acceptedUserScopeMutation: true,
    isolatedHome: true,
    marketplaceSource: '.',
    expectedRef: 'v2.4.1',
    expectedCommit: null,
    evidenceSource: null,
    inventoryOut: '.metrics/inventory.json',
    routeSmokeOut: null,
    json: false,
    outputJson: null,
    help: false,
  });
});

test('plugin install rejects unsafe evidence outputs before validation or mutation', async () => {
  for (const [flag, path] of [
    ['--output-json', 'package.json'],
    ['--inventory-out', 'scripts/validate-plugin-install.mjs'],
    ['--route-smoke-out', '.git/config'],
  ]) {
    const args = flag === '--output-json'
      ? ['--dry-run', flag, path]
      : ['--accept-user-scope-mutation', '--isolated-home', flag, path];
    assert.equal(await installMain(args), 1, `${flag} ${path}`);
  }
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
  const marketplace = { plugins: [{ name: 'nova-plugin', version: '4.0.0', source: { ref: 'v4.0.0-rc.4', sha: 'a'.repeat(40) } }] };
  assert.doesNotThrow(() => assertCandidateMarketplaceSource(marketplace, 'v4.0.0-rc.4', 'a'.repeat(40)));
  assert.throws(() => assertCandidateMarketplaceSource(marketplace, 'v4.0.0-rc.5', 'a'.repeat(40)), /plugin ref/u);
  assert.throws(() => assertCandidateMarketplaceSource(marketplace, 'v4.0.0-rc.4', 'b'.repeat(40)), /plugin commit/u);
  assert.throws(() => assertCandidateMarketplaceSource({
    plugins: [{ ...marketplace.plugins[0], version: '4.1.0' }],
  }, 'v4.0.0-rc.4', 'a'.repeat(40)), /version.*approved tag/u);
});

test('install provenance distinguishes local manifests from the selected plugin byte source', () => {
  const remoteExact = {
    name: 'nova-plugin',
    version: '4.0.0',
    source: {
      source: 'git-subdir',
      url: 'https://github.com/owner/repository.git',
      path: 'nova-plugin',
      ref: 'v4.0.0',
      sha: 'a'.repeat(40),
    },
  };
  assert.equal(resolveInstallSourceType(remoteExact, { localMarketplaceSource: true }), 'local-manifest-remote-exact-ref');
  assert.equal(resolveInstallSourceType({ ...remoteExact, source: 'nova-plugin' }, { localMarketplaceSource: true }), 'local-manifest-local-plugin-bytes');
  assert.throws(
    () => resolveInstallSourceType({ ...remoteExact, source: { ...remoteExact.source, sha: null } }, { localMarketplaceSource: true }),
    /exact ref, commit SHA/u,
  );
  assert.throws(
    () => resolveInstallSourceType(remoteExact, { localMarketplaceSource: false }),
    /locally verified marketplace manifest/u,
  );
});

test('selected installed source owns version and inventory when checkout development is ahead', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-selected-install-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.claude-plugin'));
  await mkdir(join(root, 'runtime'));
  await writeFile(join(root, '.claude-plugin', 'plugin.json'), `${JSON.stringify({ name: 'nova-plugin', version: '4.0.0' })}\n`);
  await writeFile(join(root, 'runtime', 'workflow-permissions.json'), `${JSON.stringify({
    knownGoodClaudeCli: '2.1.205',
    pluginNamespace: 'nova-plugin',
    expectedInventory: { combinedSkillCount: 2, commandIds: ['route'], skillNames: ['nova-route'] },
    primaryEntrypoints: ['route'],
  })}\n`);
  const marketplace = {
    plugins: [{ name: 'nova-plugin', version: '4.0.0', source: { ref: 'v4.0.0', sha: 'a'.repeat(40) } }],
  };
  const selected = selectMarketplacePlugin(marketplace);
  const movingCheckoutManifest = { name: 'nova-plugin', version: '4.1.0' };
  const contract = loadInstalledSourceContract(root, selected);
  assert.equal(contract.pluginManifest.version, '4.0.0');
  assert.notEqual(contract.pluginManifest.version, movingCheckoutManifest.version);
  assert.deepEqual(contract.expectedSkills, ['nova-route', 'route']);
  assert.throws(
    () => loadInstalledSourceContract(root, { ...selected, version: '4.1.0' }),
    /does not match marketplace/u,
  );
});

test('stable local marketplace installs use the governed exact-tag tree digest', () => {
  const stableDigest = 'b'.repeat(64);
  const stableCommit = 'a'.repeat(40);
  const marketplace = {
    plugins: [{
      name: 'nova-plugin',
      version: '4.0.0',
      source: {
        source: 'git-subdir',
        url: 'https://github.com/owner/repository.git',
        path: 'nova-plugin',
        ref: 'v4.0.0',
        sha: stableCommit,
      },
    }],
  };
  const releaseChannels = {
    stable: { tag: 'v4.0.0', commit: stableCommit, pluginTreeSha256: stableDigest },
  };
  assert.deepEqual(resolveSourceTreeIdentity({
    marketplace,
    releaseChannels,
    checkoutDigest: 'c'.repeat(64),
    localMarketplaceSource: true,
  }), {
    digest: stableDigest,
    label: `governed stable source v4.0.0@${stableCommit}`,
    ref: 'v4.0.0',
    commit: stableCommit,
  });
  assert.throws(() => resolveSourceTreeIdentity({
    marketplace,
    releaseChannels,
    checkoutDigest: 'c'.repeat(64),
    localMarketplaceSource: false,
  }), /locally verified marketplace manifest/u);
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

test('install inventory rejects hard-linked files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-tree-hardlink-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'source.txt'), 'same inode');
  await link(join(root, 'source.txt'), join(root, 'linked.txt'));
  assert.throws(() => treeManifest(root), /must not be hard linked/u);
  assert.throws(() => treeDigest(root), /must not be hard linked/u);
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

test('tree manifests reject a symlink root', { skip: process.platform === 'win32' }, async (t) => {
  const container = await mkdtemp(join(tmpdir(), 'nova-tree-root-link-'));
  t.after(() => rm(container, { recursive: true, force: true }));
  await mkdir(join(container, 'real'));
  await writeFile(join(container, 'real', 'file.txt'), 'safe');
  await symlink('real', join(container, 'linked'));
  assert.throws(() => treeManifest(join(container, 'linked')), /root must be a real non-symlink directory/u);
  assert.throws(() => treeDigest(join(container, 'linked')), /root must be a real non-symlink directory/u);
});

test('portable manifest paths reject backslashes and ambiguous components before normalization', () => {
  assert.equal(assertPortableRelativePath('nested/file.txt', 'manifest path'), 'nested/file.txt');
  assert.equal(assertPortableRelativePath('.github/workflows/ci.yml', 'manifest path'), '.github/workflows/ci.yml');
  for (const path of [
    'nested\\file.txt', './file.txt', 'nested/../file.txt', 'nested//file.txt', '.', '..',
    'C:relative.txt', 'CON', 'con.txt', 'CON .txt', 'NUL.json', 'COM1.log', 'LPT9', 'file.', 'file ',
    'nested/a:b', 'nested/bad<name', `nested/control-${String.fromCharCode(1)}`,
  ]) {
    assert.throws(() => assertPortableRelativePath(path, 'manifest path'), /portable|traversal|dot|empty/u, path);
  }
});

test('tree manifests reject non-portable POSIX names and escaping symlink targets', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-tree-non-portable-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'back\\slash'), 'ambiguous');
  assert.throws(() => treeManifest(root), /non-portable|portable/u);
  await rm(join(root, 'back\\slash'));
  await writeFile(join(root, 'tool'), 'safe');
  await symlink('../outside', join(root, 'escaping'));
  assert.throws(() => treeManifest(root), /symlink target.*traversal/u);
});

test('tree manifest ordering uses fixed UTF-8 byte order', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-tree-byte-order-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['a.txt', '中.txt', 'Z.txt', 'Ω.txt']) await writeFile(join(root, name), name);
  assert.deepEqual(treeManifest(root).map((entry) => entry.path), ['Z.txt', 'a.txt', 'Ω.txt', '中.txt']);
});

test('tree manifests reject normalized case collisions', { skip: process.platform !== 'linux' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-tree-case-collision-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'Foo'), 'upper');
  await writeFile(join(root, 'foo'), 'lower');
  assert.throws(() => treeManifest(root), /normalized case collision/u);
});
