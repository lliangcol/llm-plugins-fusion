#!/usr/bin/env node
/** Validate isolated local or exact-ref Claude marketplace installation. */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { captureProcess, runProcess } from './lib/process-runner.mjs';
import { createPhysicalReadBoundary, readPhysicalFile } from './lib/physical-read-boundary.mjs';
import {
  preparePluginEvidenceOutputPlan,
  validatePluginEvidenceOutputSelection,
  writePluginEvidenceOutput,
} from './lib/plugin-evidence-output.mjs';
import {
  assertTrustedClaudeInvocation,
  resolveTrustedClaudeInvocation,
  sanitizeIsolatedExecutablePath,
} from './lib/trusted-claude-invocation.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { runRouteSmoke } from './validate-plugin-route-live.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry } from './lib/diagnostics.mjs';
import {
  assertPortableRelativePath,
  comparePortablePaths,
  portablePathCollisionKey,
  portableRelativeFromRoot,
} from './lib/portable-path.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

export {
  assertTrustedClaudeInvocation,
  resolveTrustedClaudeInvocation,
  sanitizeIsolatedExecutablePath,
};

assertNodeVersion({ label: 'plugin install smoke' });

function usage() {
  return 'Usage: node scripts/validate-plugin-install.mjs [--dry-run [--isolated-home] [--json] [--output-json <path>] | --accept-user-scope-mutation --isolated-home] [--marketplace-source <local-path>] [--expected-ref <ref>] [--expected-commit <sha>] [--evidence-source <source>] [--inventory-out <path>] [--route-smoke-out <path>]';
}

export function parseArgs(args) {
  const options = {
    dryRun: false,
    acceptedUserScopeMutation: false,
    isolatedHome: false,
    marketplaceSource: './',
    expectedRef: null,
    expectedCommit: null,
    evidenceSource: null,
    inventoryOut: null,
    routeSmokeOut: null,
    json: false,
    outputJson: null,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--accept-user-scope-mutation' || arg === '--yes') options.acceptedUserScopeMutation = true;
    else if (arg === '--isolated-home') options.isolatedHome = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--output-json') {
      options.outputJson = requireOptionValue(args, index, arg);
      index += 1;
    }
    else if (arg === '--marketplace-source') {
      options.marketplaceSource = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === '--expected-ref') {
      options.expectedRef = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === '--expected-commit') {
      options.expectedCommit = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === '--evidence-source') {
      options.evidenceSource = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === '--inventory-out') {
      options.inventoryOut = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === '--route-smoke-out') {
      options.routeSmokeOut = requireOptionValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

export function parsePluginDetails(output) {
  const match = output.match(/^\s*Skills \((\d+)\)\s+(.+)$/m);
  if (!match) throw new Error('claude plugin details did not contain a Skills inventory line');
  const count = Number.parseInt(match[1], 10);
  const skills = match[2].split(',').map((value) => value.trim()).filter(Boolean).sort();
  if (skills.length !== count) {
    throw new Error(`plugin details reported ${count} Skills but listed ${skills.length}`);
  }
  return { count, skills };
}

export function normalizeMarketplaceSource(source, repositoryRoot = root) {
  const localPath = resolve(repositoryRoot, source);
  return existsSync(localPath) ? localPath : source;
}

export function assertMarketplaceRef(entry, expectedRef, localSource) {
  if (!expectedRef) return;
  if (expectedRef === 'local') {
    if (!localSource) throw new Error('expected ref "local" requires a filesystem marketplace source');
    if (entry.ref != null) {
      throw new Error(`local marketplace unexpectedly reported ref ${JSON.stringify(entry.ref)}`);
    }
    return;
  }
  if (entry.ref !== expectedRef) {
    throw new Error(`marketplace ref is ${JSON.stringify(entry.ref)}, expected ${JSON.stringify(expectedRef)}`);
  }
}

export function selectMarketplacePlugin(marketplace, name = 'nova-plugin') {
  const matches = marketplace?.plugins?.filter((entry) => entry.name === name) ?? [];
  if (matches.length !== 1) throw new Error(`marketplace must contain exactly one ${name} entry`);
  const [entry] = matches;
  if (typeof entry.version !== 'string' || entry.version.length === 0) {
    throw new Error(`marketplace ${name} entry must declare a version`);
  }
  return entry;
}

export function assertCandidateMarketplaceSource(marketplace, expectedRef, expectedCommit) {
  const entry = selectMarketplacePlugin(marketplace);
  const source = entry.source;
  if (source?.ref !== expectedRef) throw new Error(`candidate marketplace plugin ref is ${JSON.stringify(source?.ref)}, expected ${JSON.stringify(expectedRef)}`);
  if (source?.sha !== expectedCommit) throw new Error(`candidate marketplace plugin commit is ${JSON.stringify(source?.sha)}, expected ${JSON.stringify(expectedCommit)}`);
  const versionTag = `v${entry.version}`;
  const candidateSuffix = expectedRef.startsWith(versionTag) ? expectedRef.slice(versionTag.length) : '';
  if (expectedRef !== versionTag && !/^-rc\.[1-9][0-9]*$/u.test(candidateSuffix)) {
    throw new Error(`candidate marketplace version ${JSON.stringify(entry.version)} does not match approved tag ${JSON.stringify(expectedRef)}`);
  }
  return entry;
}

export function assertPublicEvidenceSource(source) {
  if (typeof source !== 'string' || source.length === 0 || source !== source.trim() || /\p{Cc}/u.test(source)) {
    throw new Error('install evidence source must be a non-empty public provenance label');
  }
  if (
    source.startsWith('/')
    || source.startsWith('\\')
    || source.startsWith('~')
    || /^(?:\.{1,2})(?:[\\/]|$)/u.test(source)
    || /^[A-Za-z]:/u.test(source)
    || /^file:/iu.test(source)
  ) {
    throw new Error('install evidence source must not contain a local filesystem path');
  }
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(source)) return source;
  const repositoryRef = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*@([A-Za-z0-9][A-Za-z0-9._/+\-]*)$/u.exec(source);
  if (!repositoryRef || repositoryRef[1].split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('install evidence source must be a stable public label or owner/repository@ref provenance');
  }
  return source;
}

export function resolveInstallEvidenceSource({ evidenceSource, marketplaceSource, localMarketplaceSource }) {
  return assertPublicEvidenceSource(
    evidenceSource ?? (localMarketplaceSource ? 'local-isolated-install' : marketplaceSource),
  );
}

export const installSourceTypes = Object.freeze([
  'local-manifest-local-plugin-bytes',
  'local-manifest-remote-exact-ref',
]);

export function resolveInstallSourceType(selectedPlugin, { localMarketplaceSource }) {
  if (!localMarketplaceSource) {
    throw new Error('install evidence requires a locally verified marketplace manifest');
  }
  const source = selectedPlugin?.source;
  if (typeof source === 'string' || source?.source === 'local') {
    return 'local-manifest-local-plugin-bytes';
  }
  if (source?.source === 'git-subdir' || source?.source === 'url') {
    if (typeof source.url !== 'string' || !/^https:\/\//u.test(source.url)
      || typeof source.ref !== 'string' || source.ref.length === 0
      || !/^[a-f0-9]{40}$/u.test(source.sha ?? '')
      || (source.source === 'git-subdir' && typeof source.path !== 'string')) {
      throw new Error('remote marketplace plugin source must bind an HTTPS URL, exact ref, commit SHA, and subdirectory when applicable');
    }
    if (source.source === 'git-subdir') assertPortableRelativePath(source.path, 'marketplace plugin source path');
    return 'local-manifest-remote-exact-ref';
  }
  throw new Error('marketplace plugin source kind is unsupported for install evidence');
}

function manifestMode(stat, type) {
  if (type === 'symlink') return '120000';
  const permissions = (stat.mode & 0o777).toString(8).padStart(3, '0');
  return `${type === 'directory' ? '040' : '100'}${permissions}`;
}

export function treeManifest(rootDir, { ignoreClaudeRuntimeMarkers = false } = {}, current = rootDir) {
  const currentStat = lstatSync(current);
  if (currentStat.isSymbolicLink() || !currentStat.isDirectory()) {
    const label = current === rootDir ? 'root' : 'directory';
    throw new Error(`install tree ${label} must be a real non-symlink directory`);
  }
  const entries = [];
  for (const name of readdirSync(current)) {
    const abs = resolve(current, name);
    const relPath = portableRelativeFromRoot(rootDir, abs, 'install tree manifest path');
    if (ignoreClaudeRuntimeMarkers && (relPath === '.in_use' || relPath.startsWith('.in_use/'))) continue;
    const stat = lstatSync(abs);
    if (stat.isDirectory()) {
      entries.push({ path: relPath, type: 'directory', mode: manifestMode(stat, 'directory') });
      entries.push(...treeManifest(rootDir, { ignoreClaudeRuntimeMarkers }, abs));
    } else if (stat.isFile()) {
      if (stat.nlink !== 1) throw new Error(`install tree file must not be hard linked: ${relPath}`);
      const content = readFileSync(abs);
      entries.push({
        path: relPath,
        type: 'file',
        mode: manifestMode(stat, 'file'),
        bytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
      });
    } else if (stat.isSymbolicLink()) {
      const target = assertPortableRelativePath(readlinkSync(abs), `install tree symlink target for ${relPath}`);
      entries.push({ path: relPath, type: 'symlink', mode: manifestMode(stat, 'symlink'), target });
    } else {
      throw new Error(`unsupported install tree entry: ${relPath}`);
    }
  }
  const collisionKeys = new Map();
  for (const entry of entries) {
    const key = portablePathCollisionKey(entry.path);
    const existing = collisionKeys.get(key);
    if (existing && existing !== entry.path) {
      throw new Error(`install tree manifest contains a normalized case collision: ${existing} and ${entry.path}`);
    }
    collisionKeys.set(key, entry.path);
  }
  return entries.sort((left, right) => comparePortablePaths(left.path, right.path));
}

export function treeDigest(rootDir, options = {}) {
  return createHash('sha256').update(JSON.stringify(treeManifest(rootDir, options))).digest('hex');
}

/**
 * Resolve the tree identity that a local marketplace manifest actually
 * installs. Stable marketplace manifests intentionally pin an older exact
 * tag, so their installed bytes must be compared with the governed stable
 * tree digest instead of the moving checkout.
 *
 * @param {{marketplace: any, releaseChannels: any, checkoutDigest: string, localMarketplaceSource: boolean, expectedRef?: string | null, expectedCommit?: string | null}} options
 */
export function resolveSourceTreeIdentity({
  marketplace,
  releaseChannels,
  checkoutDigest,
  localMarketplaceSource,
  expectedRef = null,
  expectedCommit = null,
}) {
  const selectedPlugin = selectMarketplacePlugin(marketplace);
  const source = selectedPlugin.source ?? {};
  const installSourceType = resolveInstallSourceType(selectedPlugin, { localMarketplaceSource });
  const ref = expectedRef === 'local' ? null : (expectedRef ?? source.ref ?? null);
  const commit = expectedCommit ?? source.sha ?? null;
  const stable = releaseChannels?.stable;
  if (
    localMarketplaceSource
    && ref === stable?.tag
    && commit === stable?.commit
    && /^[a-f0-9]{64}$/u.test(stable?.pluginTreeSha256 ?? '')
  ) {
    return {
      digest: stable.pluginTreeSha256,
      label: `governed stable source ${stable.tag}@${stable.commit}`,
      ref,
      commit,
    };
  }
  if (installSourceType === 'local-manifest-local-plugin-bytes' && ref === null && commit === null) {
    return { digest: checkoutDigest, label: 'local marketplace plugin bytes', ref, commit };
  }
  if (expectedRef && expectedRef !== 'local' && expectedCommit
    && source.ref === expectedRef && source.sha === expectedCommit) {
    return { digest: checkoutDigest, label: `governed exact candidate source ${expectedRef}@${expectedCommit}`, ref, commit };
  }
  throw new Error('remote exact plugin source is neither the governed stable source nor an explicitly bound candidate source');
}

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

export function readSelectedMarketplace(marketplaceSource, localMarketplaceSource) {
  if (!localMarketplaceSource) {
    throw new Error('--marketplace-source must be a local manifest path; remote owner/repository@ref sources are unsupported without a verified source reader');
  }
  const sourceStats = lstatSync(marketplaceSource);
  if (sourceStats.isSymbolicLink()) throw new Error('local marketplace source must not be a symlink');
  const boundaryRoot = sourceStats.isDirectory() ? marketplaceSource : dirname(marketplaceSource);
  const manifestPath = sourceStats.isDirectory()
    ? resolve(marketplaceSource, '.claude-plugin', 'marketplace.json')
    : marketplaceSource;
  const boundary = createPhysicalReadBoundary(boundaryRoot, 'local marketplace boundary');
  const manifest = readPhysicalFile(boundary, manifestPath, 'local marketplace manifest');
  return JSON.parse(manifest.buffer.toString('utf8'));
}

function resolveSelectedPluginTreeRoot(marketplaceSource, selectedPlugin, installSourceType) {
  if (installSourceType !== 'local-manifest-local-plugin-bytes') return resolve(root, 'nova-plugin');
  const sourceStats = lstatSync(marketplaceSource);
  if (!sourceStats.isDirectory()) {
    throw new Error('local plugin bytes require a directory marketplace source');
  }
  const requestedPath = typeof selectedPlugin.source === 'string'
    ? selectedPlugin.source
    : selectedPlugin.source?.path;
  const portablePath = String(requestedPath ?? '').replace(/^\.\//u, '');
  assertPortableRelativePath(portablePath, 'local marketplace plugin source path');
  const marketplaceBoundary = capturePhysicalDirectory(marketplaceSource, 'local marketplace root');
  const pluginBoundary = capturePhysicalDirectory(resolve(marketplaceBoundary.lexicalPath, portablePath), 'local marketplace plugin root');
  if (!isStrictlyInside(marketplaceBoundary.physicalPath, pluginBoundary.physicalPath)) {
    throw new Error('local marketplace plugin root must be strictly physically contained in the marketplace root');
  }
  return pluginBoundary.physicalPath;
}

function normalizeExpectedInventory(permissionSpec) {
  return [...permissionSpec.expectedInventory.commandIds, ...permissionSpec.expectedInventory.skillNames].sort();
}

function readInstalledSourceJson(pluginRoot, relPath) {
  const pluginBoundary = capturePhysicalDirectory(pluginRoot, 'installed plugin root');
  const path = resolve(pluginBoundary.lexicalPath, assertPortableRelativePath(relPath, 'installed source contract path'));
  const stats = lstatSync(path);
  const physicalPath = realpathSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1
    || !isStrictlyInside(pluginBoundary.physicalPath, physicalPath)) {
    throw new Error(`installed source contract must be a regular contained file: ${relPath}`);
  }
  const source = readFileSync(path, 'utf8');
  const after = lstatSync(path);
  if (after.dev !== stats.dev || after.ino !== stats.ino || realpathSync(path) !== physicalPath) {
    throw new Error(`installed source contract changed while reading: ${relPath}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`installed source contract is not valid JSON: ${relPath}`, { cause: error });
  }
}

export function loadInstalledSourceContract(pluginRoot, marketplaceEntry) {
  const pluginManifest = readInstalledSourceJson(pluginRoot, '.claude-plugin/plugin.json');
  const permissionSpec = readInstalledSourceJson(pluginRoot, 'runtime/workflow-permissions.json');
  if (pluginManifest.name !== marketplaceEntry?.name || pluginManifest.version !== marketplaceEntry?.version) {
    throw new Error(
      `installed plugin manifest ${JSON.stringify(pluginManifest.name)}@${JSON.stringify(pluginManifest.version)} does not match marketplace ${JSON.stringify(marketplaceEntry?.name)}@${JSON.stringify(marketplaceEntry?.version)}`,
    );
  }
  if (permissionSpec.pluginNamespace !== pluginManifest.name) {
    throw new Error('installed workflow permissions namespace does not match the selected plugin manifest');
  }
  if (!Array.isArray(permissionSpec.expectedInventory?.commandIds)
    || !Array.isArray(permissionSpec.expectedInventory?.skillNames)) {
    throw new Error('installed workflow permissions inventory lists are missing');
  }
  const expectedSkills = normalizeExpectedInventory(permissionSpec);
  if (!Number.isInteger(permissionSpec.expectedInventory?.combinedSkillCount)
    || expectedSkills.length !== permissionSpec.expectedInventory.combinedSkillCount
    || new Set(expectedSkills).size !== expectedSkills.length) {
    throw new Error('installed workflow permissions inventory count is inconsistent');
  }
  if (typeof permissionSpec.knownGoodClaudeCli !== 'string' || !Array.isArray(permissionSpec.primaryEntrypoints)) {
    throw new Error('installed workflow permissions omit known-good CLI or primary entrypoints');
  }
  return { pluginManifest, permissionSpec, expectedSkills };
}

export function diffInventory(actualSkills, expectedSkills) {
  const actual = [...actualSkills].sort();
  const expected = [...expectedSkills].sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    matches: JSON.stringify(actual) === JSON.stringify(expected),
    actualCount: actual.length,
    expectedCount: expected.length,
    missing: expected.filter((skill) => !actualSet.has(skill)),
    unexpected: actual.filter((skill) => !expectedSet.has(skill)),
    actualSha256: createHash('sha256').update(JSON.stringify(actual)).digest('hex'),
    expectedSha256: createHash('sha256').update(JSON.stringify(expected)).digest('hex'),
  };
}

export function buildInstallEvidence({
  generatedAt,
  claudeVersion,
  knownGoodClaudeCli,
  manifestValidation,
  marketplace,
  plugin,
  inventory,
  inventoryDiff,
  primaryEntrypoints,
  sourceTreeDigest,
  installedTreeDigest,
  routeSmoke,
  validationErrors = [],
}) {
  const errors = [...validationErrors];
  if (manifestValidation?.marketplace !== true) {
    errors.push('marketplace manifest validation did not pass');
  }
  if (manifestValidation?.plugin !== true) {
    errors.push('plugin manifest validation did not pass');
  }
  const publicMarketplace = { ...marketplace, source: assertPublicEvidenceSource(marketplace?.source) };
  if (!installSourceTypes.includes(publicMarketplace.installSourceType)) {
    throw new Error(`install evidence source type must be one of: ${installSourceTypes.join(', ')}`);
  }
  const publicPlugin = { id: plugin?.id, version: plugin?.version };
  return {
    schemaVersion: 2,
    generatedAt,
    claudeVersion,
    knownGoodClaudeCli,
    manifestValidation,
    marketplace: publicMarketplace,
    plugin: publicPlugin,
    inventory,
    inventoryDiff,
    primaryEntrypoints,
    sourceTreeDigest,
    installedTreeDigest,
    installedTreeIgnoredPaths: ['.in_use/**'],
    treeManifestVersion: 2,
    routeSmoke,
    validation: { passed: errors.length === 0, errors },
  };
}

async function run(label, command, args, env) {
  console.log(`\n== ${label} ==`);
  const result = await runProcess(label, command, args, {
    cwd: root,
    env,
    capture: false,
    timeoutMs: 300_000,
  });
  if (!result.ok) throw new Error(`${label}: ${result.errorMessage ?? `exited with ${result.code}`}`);
}

async function capture(label, command, args, env) {
  console.log(`\n== ${label} ==`);
  const result = await captureProcess(label, command, args, {
    cwd: root,
    env,
    timeoutMs: 300_000,
  });
  if (!result.ok) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${label}: ${result.errorMessage ?? `exited with ${result.code}`}`);
  }
  return result.stdout;
}

async function runClaude(label, invocation, args, env) {
  assertTrustedClaudeInvocation(invocation);
  try {
    return await run(label, invocation.command, [...invocation.argsPrefix, ...args], env);
  } finally {
    assertTrustedClaudeInvocation(invocation);
  }
}

async function captureClaude(label, invocation, args, env) {
  assertTrustedClaudeInvocation(invocation);
  try {
    return await capture(label, invocation.command, [...invocation.argsPrefix, ...args], env);
  } finally {
    assertTrustedClaudeInvocation(invocation);
  }
}

async function captureClaudeJson(label, invocation, args, env) {
  const output = await captureClaude(label, invocation, args, env);
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${label}: failed to parse JSON output: ${error.message}`);
  }
}

export function configureIsolatedHome(env = process.env, {
  workspaceRoot = root,
  platform = process.platform,
} = {}) {
  const forbiddenExact = new Set([
    'NODE_OPTIONS',
    'NODE_PATH',
    'NODE_TLS_REJECT_UNAUTHORIZED',
    'BASH_ENV',
    'ENV',
    'CDPATH',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'AWS_WEB_IDENTITY_TOKEN_FILE',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'AZURE_TENANT_ID',
  ]);
  const forbidden = Object.keys(env).filter((name) => (
    forbiddenExact.has(name)
    || name.startsWith('BASH_FUNC_')
    || name.startsWith('ANTHROPIC_')
    || name.startsWith('CLAUDE_CODE_USE_')
    || /^(?:CLAUDE|CLAUDE_CODE)_[A-Z0-9_]*(?:MODEL|BASE_URL)(?:_|$)/u.test(name)
  )).sort();
  if (forbidden.length > 0) {
    throw new Error(`isolated install environment forbids inherited overrides: ${forbidden.join(', ')}`);
  }
  const pathValue = platform === 'win32' ? (env.Path ?? env.PATH) : env.PATH;
  const safePath = sanitizeIsolatedExecutablePath(pathValue, { workspaceRoot, platform });
  const isolatedHomeDir = mkdtempSync(resolve(tmpdir(), 'llm-plugins-fusion-claude-home-'));
  const configHome = resolve(isolatedHomeDir, '.config');
  const dataHome = resolve(isolatedHomeDir, '.local', 'share');
  const stateHome = resolve(isolatedHomeDir, '.local', 'state');
  const claudeConfigDir = resolve(isolatedHomeDir, '.claude');
  const isolatedTemp = resolve(isolatedHomeDir, 'tmp');
  for (const directory of [configHome, dataHome, stateHome, claudeConfigDir, isolatedTemp]) {
    mkdirSync(directory, { recursive: true });
  }
  /** @type {Record<string, string>} */
  const isolatedEnv = {
    CI: '1',
    HOME: isolatedHomeDir,
    USERPROFILE: isolatedHomeDir,
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: stateHome,
    CLAUDE_CONFIG_DIR: claudeConfigDir,
    PATH: safePath,
    TMPDIR: isolatedTemp,
    TEMP: isolatedTemp,
    TMP: isolatedTemp,
    LANG: env.LANG ?? 'C.UTF-8',
    LC_ALL: env.LC_ALL ?? 'C.UTF-8',
    NO_COLOR: '1',
    TZ: env.TZ ?? 'UTC',
  };
  const allowedOptional = [
    'CLAUDE_CODE_OAUTH_TOKEN',
    'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY',
    'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy',
    'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  ];
  for (const name of allowedOptional) {
    if (typeof env[name] === 'string' && env[name] !== '') isolatedEnv[name] = env[name];
  }
  if (platform === 'win32') {
    isolatedEnv.Path = safePath;
    for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT']) {
      if (typeof env[name] === 'string' && env[name] !== '') isolatedEnv[name] = env[name];
    }
  }
  return {
    dir: isolatedHomeDir,
    env: isolatedEnv,
  };
}

function capturePhysicalDirectory(path, label) {
  if (typeof path !== 'string' || path.length === 0) throw new Error(`${label} is missing`);
  const lexicalPath = resolve(path);
  let stats;
  let physicalPath;
  try {
    stats = lstatSync(lexicalPath);
    physicalPath = realpathSync(lexicalPath);
  } catch (error) {
    throw new Error(`${label} is missing or unreadable`, { cause: error });
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} must be a real non-symlink directory`);
  }
  return { lexicalPath, physicalPath, dev: stats.dev, ino: stats.ino };
}

function isStrictlyInside(rootPath, candidatePath) {
  const relPath = relative(rootPath, candidatePath);
  return relPath !== '' && relPath !== '..' && !relPath.startsWith(`..${sep}`) && !isAbsolute(relPath);
}

/**
 * Capture or revalidate the physical installed-plugin root. Node.js exposes no
 * portable directory-handle-relative tree walk, so before/after identity checks
 * are best-effort TOCTOU mitigation rather than a race-free guarantee.
 */
export function assertIsolatedInstallPath(isolatedHomeDir, installPath, expected = null) {
  const isolatedHome = capturePhysicalDirectory(isolatedHomeDir, 'isolated home root');
  const installed = capturePhysicalDirectory(installPath, 'installed plugin root');
  if (!isStrictlyInside(isolatedHome.physicalPath, installed.physicalPath)) {
    throw new Error('installed plugin root must be strictly physically contained in the isolated home');
  }
  const snapshot = { isolatedHome, installed };
  if (expected) {
    for (const key of ['isolatedHome', 'installed']) {
      const before = expected[key];
      const after = snapshot[key];
      if (
        !before
        || after.lexicalPath !== before.lexicalPath
        || after.physicalPath !== before.physicalPath
        || after.dev !== before.dev
        || after.ino !== before.ino
      ) {
        throw new Error('isolated install path changed during tree digest validation');
      }
    }
  }
  return snapshot;
}

function marketplaceEntry(entries, name) {
  return entries.find((entry) => entry.name === name);
}

export async function main(args = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }
  if (options.help) {
    console.log(usage());
    return 0;
  }
  if (options.dryRun && options.acceptedUserScopeMutation) {
    console.error('ERROR --dry-run and --accept-user-scope-mutation are mutually exclusive.');
    return 1;
  }
  if (!options.dryRun && (options.json || options.outputJson)) {
    console.error('ERROR --json and --output-json are supported only with --dry-run.');
    return 1;
  }

  const outputEntries = [
    { key: 'outputJson', path: options.outputJson, label: 'dry-run diagnostic output' },
    { key: 'inventoryOut', path: options.inventoryOut, label: 'install inventory output' },
    { key: 'routeSmokeOut', path: options.routeSmokeOut, label: 'route smoke output' },
  ];
  try {
    const selectedOutputs = validatePluginEvidenceOutputSelection(root, outputEntries);
    for (const entry of selectedOutputs) options[entry.key] = entry.path;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }

  let installPlan;
  try {
    const marketplaceSource = normalizeMarketplaceSource(options.marketplaceSource);
    const localMarketplaceSource = existsSync(marketplaceSource);
    const marketplace = readSelectedMarketplace(marketplaceSource, localMarketplaceSource);
    const selectedPlugin = selectMarketplacePlugin(marketplace);
    const installSourceType = resolveInstallSourceType(selectedPlugin, { localMarketplaceSource });
    const selectedPluginTreeRoot = resolveSelectedPluginTreeRoot(marketplaceSource, selectedPlugin, installSourceType);
    const marketplaceName = marketplace.name;
    const evidenceSource = resolveInstallEvidenceSource({
      evidenceSource: options.evidenceSource,
      marketplaceSource,
      localMarketplaceSource,
    });
    if (localMarketplaceSource && options.expectedRef && options.expectedRef !== 'local') {
      if (!options.expectedCommit) throw new Error('an exact candidate marketplace requires --expected-commit');
      assertCandidateMarketplaceSource(marketplace, options.expectedRef, options.expectedCommit);
    }
    installPlan = {
      marketplaceSource,
      localMarketplaceSource,
      marketplace,
      selectedPlugin,
      installSourceType,
      selectedPluginTreeRoot,
      releaseChannels: readJson('governance/release-channels.json'),
      marketplaceName,
      pluginId: `${selectedPlugin.name}@${marketplaceName}`,
      evidenceSource,
      marketplaceManifestPath: lstatSync(marketplaceSource).isDirectory()
        ? resolve(marketplaceSource, '.claude-plugin', 'marketplace.json')
        : marketplaceSource,
    };
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
  const {
    marketplaceSource,
    localMarketplaceSource,
    marketplace,
    selectedPlugin,
    installSourceType,
    selectedPluginTreeRoot,
    releaseChannels,
    marketplaceName,
    pluginId,
    evidenceSource,
    marketplaceManifestPath,
  } = installPlan;
  try {
    validatePluginEvidenceOutputSelection(root, outputEntries, {
      protectedPaths: [marketplaceManifestPath],
    });
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
  const publicMarketplaceSource = localMarketplaceSource ? evidenceSource : marketplaceSource;

  if (!options.json) {
    console.log(`Marketplace: ${marketplaceName}`);
    console.log(`Marketplace source: ${publicMarketplaceSource}`);
    console.log(`Expected ref: ${options.expectedRef ?? 'not asserted'}`);
    console.log(`Plugin: ${selectedPlugin.name}`);
    console.log(`Expected install id: ${pluginId}`);
    console.log(`Expected version: ${selectedPlugin.version}`);
    console.log('Expected installed Skills: selected source-owned inventory');
    console.log(`Isolated home: ${options.isolatedHome ? 'enabled' : 'disabled'}`);
  }

  if (options.dryRun) {
    const steps = [
      'create and remove temporary HOME, USERPROFILE, XDG_CONFIG_HOME, XDG_DATA_HOME, XDG_STATE_HOME, and CLAUDE_CONFIG_DIR',
      'claude --version',
      'claude plugin validate marketplace and physically contained installed source',
      `claude plugin marketplace add ${publicMarketplaceSource}`,
      'claude plugin marketplace list --json and ref assertion',
      `install/update ${pluginId} in isolated user scope`,
      'claude plugin list --json and installed tree digest',
      'claude plugin details and exact selected source-owned Skills inventory comparison',
      ...(options.routeSmokeOut ? ['OAuth /nova-plugin:route invocation with isolated configuration and zero project writes'] : []),
    ];
    const report = diagnosticReport('validate-plugin-install --dry-run', [diagnosticResult({
      command: 'validate-plugin-install --dry-run', check: 'install-preview', status: 'passed', reasonCode: 'DRY_RUN_SAFE_PREVIEW',
      expected: 'no Claude CLI invocation or user-scope mutation', actual: { isolatedHome: options.isolatedHome, plannedChecks: steps.length },
    }, loadReasonRegistry(root))]);
    if (options.outputJson) {
      try {
        const outputPlan = preparePluginEvidenceOutputPlan(root, [outputEntries[0]], {
          protectedPaths: [marketplaceManifestPath],
        });
        writePluginEvidenceOutput(outputPlan, 'outputJson', `${JSON.stringify(report, null, 2)}\n`);
      } catch (error) {
        console.error(`ERROR ${error.message}`);
        return 1;
      }
    }
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else {
      console.log('\nDry run only. Planned checks:');
      for (const step of steps) console.log(`- ${step}`);
      console.log('\nNo Claude CLI commands were run and no user-scope plugin state was changed.');
    }
    return 0;
  }

  if (!options.acceptedUserScopeMutation) {
    console.error('ERROR isolated install smoke requires --accept-user-scope-mutation.');
    return 1;
  }
  if (!options.isolatedHome) {
    console.error('ERROR mutating install smoke requires --isolated-home; non-isolated user-scope mutation is not supported.');
    return 1;
  }

  let evidenceOutputPlan;
  try {
    evidenceOutputPlan = preparePluginEvidenceOutputPlan(root, outputEntries.slice(1), {
      protectedPaths: [marketplaceManifestPath],
    });
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }

  const isolated = configureIsolatedHome();
  try {
    const claudeInvocation = resolveTrustedClaudeInvocation({ env: isolated.env, workspaceRoot: root });
    const claudeVersion = (await captureClaude('claude --version', claudeInvocation, ['--version'], isolated.env)).trim();
    const manifestValidation = { marketplace: false, plugin: false };
    await runClaude('claude plugin validate marketplace', claudeInvocation, ['plugin', 'validate', localMarketplaceSource ? marketplaceSource : '.'], isolated.env);
    manifestValidation.marketplace = true;
    await runClaude('add marketplace', claudeInvocation, ['plugin', 'marketplace', 'add', marketplaceSource], isolated.env);

    const marketplaces = await captureClaudeJson(
      'claude plugin marketplace list --json',
      claudeInvocation,
      ['plugin', 'marketplace', 'list', '--json'],
      isolated.env,
    );
    const addedMarketplace = marketplaceEntry(marketplaces, marketplaceName);
    if (!addedMarketplace) throw new Error(`marketplace ${marketplaceName} was not listed after add`);
    if (!(localMarketplaceSource && options.expectedRef && options.expectedRef !== 'local')) {
      assertMarketplaceRef(addedMarketplace, options.expectedRef, localMarketplaceSource);
    }

    await runClaude('install plugin', claudeInvocation, ['plugin', 'install', pluginId, '--scope', 'user'], isolated.env);
    await runClaude('update plugin', claudeInvocation, ['plugin', 'update', pluginId, '--scope', 'user'], isolated.env);
    const installedPlugins = await captureClaudeJson(
      'claude plugin list --json',
      claudeInvocation,
      ['plugin', 'list', '--json'],
      isolated.env,
    );
    const installed = installedPlugins.find((entry) => entry.id === pluginId && entry.scope === 'user');
    if (!installed) throw new Error(`installed plugin ${pluginId} not found in user scope`);
    if (installed.version !== selectedPlugin.version) {
      throw new Error(`installed version ${installed.version} does not match selected marketplace version ${selectedPlugin.version}`);
    }
    const installedPathSnapshot = assertIsolatedInstallPath(isolated.dir, installed.installPath);
    const sourceTreeIdentity = resolveSourceTreeIdentity({
      marketplace,
      releaseChannels,
      checkoutDigest: treeDigest(selectedPluginTreeRoot),
      localMarketplaceSource,
      expectedRef: options.expectedRef,
      expectedCommit: options.expectedCommit,
    });
    const sourceTreeDigest = sourceTreeIdentity.digest;
    assertIsolatedInstallPath(isolated.dir, installed.installPath, installedPathSnapshot);
    const installedTreeDigest = treeDigest(installedPathSnapshot.installed.physicalPath, {
      ignoreClaudeRuntimeMarkers: true,
    });
    assertIsolatedInstallPath(isolated.dir, installed.installPath, installedPathSnapshot);
    if (sourceTreeDigest !== installedTreeDigest) {
      throw new Error(`installed tree digest ${installedTreeDigest} differs from ${sourceTreeIdentity.label} ${sourceTreeDigest}`);
    }
    await runClaude(
      'claude plugin validate installed source',
      claudeInvocation,
      ['plugin', 'validate', installedPathSnapshot.installed.physicalPath],
      isolated.env,
    );
    manifestValidation.plugin = true;
    const { pluginManifest, permissionSpec, expectedSkills } = loadInstalledSourceContract(
      installedPathSnapshot.installed.physicalPath,
      selectedPlugin,
    );
    assertIsolatedInstallPath(isolated.dir, installed.installPath, installedPathSnapshot);

    const details = await captureClaude(
      'claude plugin details',
      claudeInvocation,
      ['plugin', 'details', pluginId],
      isolated.env,
    );
    const inventory = parsePluginDetails(details);
    const inventoryDiff = diffInventory(inventory.skills, expectedSkills);
    const validationErrors = [];
    if (inventory.count !== permissionSpec.expectedInventory.combinedSkillCount) {
      validationErrors.push(`installed Skills count ${inventory.count} does not match expected ${permissionSpec.expectedInventory.combinedSkillCount}`);
    }
    if (!inventoryDiff.matches) {
      validationErrors.push(`installed Skills inventory differs: missing=[${inventoryDiff.missing.join(', ')}] unexpected=[${inventoryDiff.unexpected.join(', ')}]`);
    }
    if (!inventory.skills.includes('route') || !inventory.skills.includes('nova-route')) {
      validationErrors.push('installed inventory must include route and nova-route');
    }
    if (!permissionSpec.primaryEntrypoints.includes('route') || permissionSpec.primaryEntrypoints.includes('nova-route')) {
      validationErrors.push('only route may be the primary entrypoint; nova-route is compatibility-only');
    }

    const routeSmoke = options.routeSmokeOut && validationErrors.length === 0
      ? await runRouteSmoke({
        pluginDir: installedPathSnapshot.installed.physicalPath,
        outPath: options.routeSmokeOut,
        outputPlan: evidenceOutputPlan,
        env: isolated.env,
        assistantInvocation: {
          command: claudeInvocation.command,
          argsPrefix: claudeInvocation.argsPrefix,
          environment: isolated.env,
          assertIdentity: () => assertTrustedClaudeInvocation(claudeInvocation),
        },
        binding: {
          ref: sourceTreeIdentity.ref,
          commit: sourceTreeIdentity.commit,
          evidenceSource,
          artifactTreeDigest: sourceTreeDigest,
          installedTreeDigest,
          assistantVersion: claudeVersion,
        },
      })
      : null;
    const evidence = buildInstallEvidence({
      generatedAt: new Date().toISOString(),
      claudeVersion,
      knownGoodClaudeCli: permissionSpec.knownGoodClaudeCli,
      manifestValidation,
      marketplace: {
        name: marketplaceName,
        source: evidenceSource,
        ref: sourceTreeIdentity.ref,
        installSourceType,
      },
      plugin: { id: pluginId, version: pluginManifest.version },
      inventory,
      inventoryDiff,
      primaryEntrypoints: permissionSpec.primaryEntrypoints.map((id) => `/${permissionSpec.pluginNamespace}:${id}`),
      sourceTreeDigest,
      installedTreeDigest,
      routeSmoke,
      validationErrors,
    });
    if (options.inventoryOut) {
      writePluginEvidenceOutput(evidenceOutputPlan, 'inventoryOut', `${JSON.stringify(evidence, null, 2)}\n`);
      console.log(`Wrote inventory evidence to ${evidenceOutputPlan.outputs.inventoryOut.path}`);
    }
    if (validationErrors.length) throw new Error(validationErrors.join('; '));
    console.log(`\nOK installed ${pluginId} ${installed.version}; Skills=${inventory.count}; digest=${installedTreeDigest}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  } finally {
    rmSync(isolated.dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
