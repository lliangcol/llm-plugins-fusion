#!/usr/bin/env node
/** Validate isolated local or exact-ref Claude marketplace installation. */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { captureProcess, runProcess } from './lib/process-runner.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { runRouteSmoke } from './validate-plugin-route-live.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

assertNodeVersion({ label: 'plugin install smoke' });

function usage() {
  return 'Usage: node scripts/validate-plugin-install.mjs [--dry-run | --accept-user-scope-mutation] --isolated-home [--marketplace-source <path|owner/repo@ref>] [--expected-ref <ref>] [--inventory-out <path>] [--route-smoke-out <path>]';
}

export function parseArgs(args) {
  const options = {
    dryRun: false,
    acceptedUserScopeMutation: false,
    isolatedHome: false,
    marketplaceSource: './',
    expectedRef: null,
    inventoryOut: null,
    routeSmokeOut: null,
    help: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--accept-user-scope-mutation' || arg === '--yes') options.acceptedUserScopeMutation = true;
    else if (arg === '--isolated-home') options.isolatedHome = true;
    else if (arg === '--marketplace-source') {
      options.marketplaceSource = requireOptionValue(args, index, arg);
      index += 1;
    } else if (arg === '--expected-ref') {
      options.expectedRef = requireOptionValue(args, index, arg);
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

function relativeFiles(rootDir, current = rootDir) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const abs = resolve(current, entry.name);
    if (entry.isDirectory()) files.push(...relativeFiles(rootDir, abs));
    else if (entry.isFile()) files.push(relative(rootDir, abs).replaceAll('\\', '/'));
  }
  return files.sort();
}

export function treeDigest(rootDir) {
  const hash = createHash('sha256');
  for (const relPath of relativeFiles(rootDir)) {
    hash.update(relPath);
    hash.update('\0');
    hash.update(readFileSync(resolve(rootDir, relPath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

function normalizeExpectedInventory(permissionSpec) {
  return [...permissionSpec.expectedInventory.commandIds, ...permissionSpec.expectedInventory.skillNames].sort();
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

async function captureJson(label, command, args, env) {
  const output = await capture(label, command, args, env);
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`${label}: failed to parse JSON output: ${error.message}`);
  }
}

function configureIsolatedHome() {
  const isolatedHomeDir = mkdtempSync(resolve(tmpdir(), 'llm-plugins-fusion-claude-home-'));
  const configHome = resolve(isolatedHomeDir, '.config');
  const dataHome = resolve(isolatedHomeDir, '.local', 'share');
  const stateHome = resolve(isolatedHomeDir, '.local', 'state');
  mkdirSync(configHome, { recursive: true });
  mkdirSync(dataHome, { recursive: true });
  mkdirSync(stateHome, { recursive: true });
  return {
    dir: isolatedHomeDir,
    env: {
      ...process.env,
      HOME: isolatedHomeDir,
      USERPROFILE: isolatedHomeDir,
      XDG_CONFIG_HOME: configHome,
      XDG_DATA_HOME: dataHome,
      XDG_STATE_HOME: stateHome,
    },
  };
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

  const marketplace = readJson('.claude-plugin/marketplace.json');
  const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
  const permissionSpec = readJson('nova-plugin/runtime/workflow-permissions.json');
  const knownGoodSnapshot = readJson('fixtures/runtime/claude-2.1.205-inventory.json');
  const marketplaceName = marketplace.name;
  const pluginId = `${plugin.name}@${marketplaceName}`;
  const expectedSkills = normalizeExpectedInventory(permissionSpec);
  const marketplaceSource = normalizeMarketplaceSource(options.marketplaceSource);
  const localMarketplaceSource = existsSync(marketplaceSource);
  if (
    knownGoodSnapshot.claudeCliVersion !== permissionSpec.knownGoodClaudeCli
    || knownGoodSnapshot.skillsCount !== permissionSpec.expectedInventory.combinedSkillCount
    || JSON.stringify([...knownGoodSnapshot.skills].sort()) !== JSON.stringify(expectedSkills)
  ) {
    console.error('ERROR known-good Claude inventory snapshot differs from canonical permission source.');
    return 1;
  }

  console.log(`Marketplace: ${marketplaceName}`);
  console.log(`Marketplace source: ${marketplaceSource}`);
  console.log(`Expected ref: ${options.expectedRef ?? 'not asserted'}`);
  console.log(`Plugin: ${plugin.name}`);
  console.log(`Expected install id: ${pluginId}`);
  console.log(`Expected version: ${plugin.version}`);
  console.log(`Expected installed Skills: ${permissionSpec.expectedInventory.combinedSkillCount}`);
  console.log(`Isolated home: ${options.isolatedHome ? 'enabled' : 'disabled'}`);

  if (options.dryRun) {
    console.log('\nDry run only. Planned checks:');
    for (const step of [
      'create and remove temporary HOME, USERPROFILE, XDG_CONFIG_HOME, XDG_DATA_HOME, and XDG_STATE_HOME',
      'claude --version',
      'claude plugin validate . and nova-plugin',
      `claude plugin marketplace add ${marketplaceSource}`,
      'claude plugin marketplace list --json and ref assertion',
      `install/update ${pluginId} in isolated user scope`,
      'claude plugin list --json and installed tree digest',
      'claude plugin details and exact 42-item Skills inventory comparison',
      ...(options.routeSmokeOut ? ['OAuth /nova-plugin:route invocation with isolated configuration and zero project writes'] : []),
    ]) console.log(`- ${step}`);
    console.log('\nNo Claude CLI commands were run and no user-scope plugin state was changed.');
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

  const isolated = configureIsolatedHome();
  try {
    const claudeVersion = (await capture('claude --version', 'claude', ['--version'], isolated.env)).trim();
    await run('claude plugin validate .', 'claude', ['plugin', 'validate', '.'], isolated.env);
    await run('claude plugin validate nova-plugin', 'claude', ['plugin', 'validate', 'nova-plugin'], isolated.env);
    await run('add marketplace', 'claude', ['plugin', 'marketplace', 'add', marketplaceSource], isolated.env);

    const marketplaces = await captureJson(
      'claude plugin marketplace list --json',
      'claude',
      ['plugin', 'marketplace', 'list', '--json'],
      isolated.env,
    );
    const addedMarketplace = marketplaceEntry(marketplaces, marketplaceName);
    if (!addedMarketplace) throw new Error(`marketplace ${marketplaceName} was not listed after add`);
    assertMarketplaceRef(addedMarketplace, options.expectedRef, localMarketplaceSource);

    await run('install plugin', 'claude', ['plugin', 'install', pluginId, '--scope', 'user'], isolated.env);
    await run('update plugin', 'claude', ['plugin', 'update', pluginId, '--scope', 'user'], isolated.env);
    const installedPlugins = await captureJson(
      'claude plugin list --json',
      'claude',
      ['plugin', 'list', '--json'],
      isolated.env,
    );
    const installed = installedPlugins.find((entry) => entry.id === pluginId && entry.scope === 'user');
    if (!installed) throw new Error(`installed plugin ${pluginId} not found in user scope`);
    if (installed.version !== plugin.version) {
      throw new Error(`installed version ${installed.version} does not match ${plugin.version}`);
    }
    if (!installed.installPath || !existsSync(installed.installPath) || !statSync(installed.installPath).isDirectory()) {
      throw new Error('installed plugin path is missing or is not a directory');
    }

    const details = await capture(
      'claude plugin details',
      'claude',
      ['plugin', 'details', pluginId],
      isolated.env,
    );
    const inventory = parsePluginDetails(details);
    if (inventory.count !== permissionSpec.expectedInventory.combinedSkillCount) {
      throw new Error(`installed Skills count ${inventory.count} does not match expected ${permissionSpec.expectedInventory.combinedSkillCount}`);
    }
    if (JSON.stringify(inventory.skills) !== JSON.stringify(expectedSkills)) {
      throw new Error('installed Skills inventory differs from canonical expected inventory');
    }
    if (!inventory.skills.includes('route') || !inventory.skills.includes('nova-route')) {
      throw new Error('installed inventory must include route and nova-route');
    }
    if (!permissionSpec.primaryEntrypoints.includes('route') || permissionSpec.primaryEntrypoints.includes('nova-route')) {
      throw new Error('only route may be the primary entrypoint; nova-route is compatibility-only');
    }

    const sourceTreeDigest = treeDigest(resolve(root, 'nova-plugin'));
    const installedTreeDigest = treeDigest(installed.installPath);
    if (sourceTreeDigest !== installedTreeDigest) {
      throw new Error(`installed tree digest ${installedTreeDigest} differs from checkout ${sourceTreeDigest}`);
    }

    const routeSmoke = options.routeSmokeOut
      ? await runRouteSmoke({ pluginDir: installed.installPath, outPath: options.routeSmokeOut, env: isolated.env })
      : null;
    const evidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      claudeVersion,
      knownGoodClaudeCli: permissionSpec.knownGoodClaudeCli,
      marketplace: { name: marketplaceName, source: marketplaceSource, ref: addedMarketplace.ref ?? null },
      plugin: { id: pluginId, version: installed.version, installPath: installed.installPath },
      inventory,
      primaryEntrypoints: permissionSpec.primaryEntrypoints.map((id) => `/${permissionSpec.pluginNamespace}:${id}`),
      sourceTreeDigest,
      installedTreeDigest,
      routeSmoke,
    };
    if (options.inventoryOut) {
      const outPath = resolve(root, options.inventoryOut);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      console.log(`Wrote inventory evidence to ${relative(root, outPath).replaceAll('\\', '/')}`);
    }
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
