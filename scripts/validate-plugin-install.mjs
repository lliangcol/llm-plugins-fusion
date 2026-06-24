#!/usr/bin/env node
/**
 * Validate the Claude Code marketplace consumer path for this repository.
 *
 * This is intentionally separate from validate-all because it depends on the
 * Claude CLI, network-capable package installation in CI, and user-scope plugin
 * installation state.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { captureProcess, runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const acceptedUserScopeMutation = args.has('--accept-user-scope-mutation') || args.has('--yes');

assertNodeVersion({ label: 'plugin install smoke' });

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: node scripts/validate-plugin-install.mjs [--dry-run | --accept-user-scope-mutation]

Validates the Claude Code marketplace consumer path.

Options:
  --dry-run                       Print planned checks without running Claude CLI commands.
  --accept-user-scope-mutation    Required before install/update mutates user-scope Claude plugin state.
  --yes                           Alias for --accept-user-scope-mutation.
`);
  process.exit(0);
}

for (const arg of args) {
  if (!['--dry-run', '--accept-user-scope-mutation', '--yes', '--help', '-h'].includes(arg)) {
    console.error(`ERROR unknown argument: ${arg}`);
    process.exit(1);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

async function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = await runProcess(label, command, args, {
    cwd: root,
    capture: false,
    timeoutMs: 300_000,
  });
  if (!result.ok) {
    const message = result.errorMessage
      ?? (result.code == null ? 'failed' : `exited with ${result.code}`);
    console.error(`ERROR ${label}: ${message}`);
    process.exit(result.code ?? 1);
  }
}

async function captureJson(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = await captureProcess(label, command, args, {
    cwd: root,
    timeoutMs: 300_000,
  });
  if (!result.ok) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    const message = result.errorMessage
      ?? (result.code == null ? 'failed' : `exited with ${result.code}`);
    console.error(`ERROR ${label}: ${message}`);
    process.exit(result.code ?? 1);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    console.error(`ERROR ${label}: failed to parse JSON output: ${error.message}`);
    process.exit(1);
  }
}

const marketplace = readJson('.claude-plugin/marketplace.json');
const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');

const marketplaceName = marketplace.name;
const pluginName = plugin.name;
const pluginId = `${pluginName}@${marketplaceName}`;

if (!marketplaceName) {
  console.error('ERROR .claude-plugin/marketplace.json is missing name');
  process.exit(1);
}

if (!pluginName) {
  console.error('ERROR nova-plugin/.claude-plugin/plugin.json is missing name');
  process.exit(1);
}

console.log(`Marketplace: ${marketplaceName}`);
console.log(`Plugin: ${pluginName}`);
console.log(`Expected install id: ${pluginId}`);
console.log(`Expected version: ${plugin.version}`);

if (dryRun) {
  console.log('\nDry run only. Planned checks:');
  for (const step of [
    'claude --version',
    'claude plugin validate .',
    'claude plugin validate nova-plugin',
    'claude plugin marketplace add ./',
    'claude plugin marketplace list',
    `claude plugin install ${pluginId} --scope user`,
    `claude plugin update ${pluginId} --scope user`,
    'claude plugin list --json',
    `confirm installed user-scope version is ${plugin.version}`,
  ]) {
    console.log(`- ${step}`);
  }
  console.log('\nNo Claude CLI commands were run and no user-scope plugin state was changed.');
  process.exit(0);
}

if (!acceptedUserScopeMutation) {
  console.error([
    'ERROR plugin install smoke mutates user-scope Claude Code plugin state.',
    'Run with --dry-run to inspect the planned checks, or rerun with',
    '--accept-user-scope-mutation only in CI, a disposable OS user, VM,',
    'or another isolated Claude Code profile.',
  ].join('\n'));
  process.exit(1);
}

await run('claude --version', 'claude', ['--version']);
await run('claude plugin validate .', 'claude', ['plugin', 'validate', '.']);
await run('claude plugin validate nova-plugin', 'claude', ['plugin', 'validate', 'nova-plugin']);
await run('claude plugin marketplace add ./', 'claude', ['plugin', 'marketplace', 'add', './']);
await run('claude plugin marketplace list', 'claude', ['plugin', 'marketplace', 'list']);
await run(
  `claude plugin install ${pluginId}`,
  'claude',
  ['plugin', 'install', pluginId, '--scope', 'user'],
);
await run(
  `claude plugin update ${pluginId}`,
  'claude',
  ['plugin', 'update', pluginId, '--scope', 'user'],
);

const installedPlugins = await captureJson(
  'claude plugin list --json',
  'claude',
  ['plugin', 'list', '--json'],
);
const installed = installedPlugins.find((entry) => (
  entry.id === pluginId && entry.scope === 'user'
));

if (!installed) {
  console.error(`ERROR installed plugin ${pluginId} not found in user scope`);
  process.exit(1);
}

if (installed.version !== plugin.version) {
  console.error(
    `ERROR installed ${pluginName}@${marketplaceName} version is "${installed.version}", expected "${plugin.version}"`,
  );
  process.exit(1);
}

console.log(`\nOK installed ${pluginId} version ${installed.version}`);
