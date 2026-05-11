#!/usr/bin/env node
/**
 * Validate the Claude Code marketplace consumer path for this repository.
 *
 * This is intentionally separate from validate-all because it depends on the
 * Claude CLI, network-capable package installation in CI, and user-scope plugin
 * installation state.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`ERROR ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`ERROR ${label}: exited with ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

function captureJson(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error) {
    console.error(`ERROR ${label}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    console.error(`ERROR ${label}: exited with ${result.status}`);
    process.exit(result.status ?? 1);
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

if (!marketplaceName) {
  console.error('ERROR .claude-plugin/marketplace.json is missing name');
  process.exit(1);
}

if (!pluginName) {
  console.error('ERROR nova-plugin/.claude-plugin/plugin.json is missing name');
  process.exit(1);
}

run('claude --version', 'claude', ['--version']);
run('claude plugin validate .', 'claude', ['plugin', 'validate', '.']);
run('claude plugin validate nova-plugin', 'claude', ['plugin', 'validate', 'nova-plugin']);
run('claude plugin marketplace add ./', 'claude', ['plugin', 'marketplace', 'add', './']);
run('claude plugin marketplace list', 'claude', ['plugin', 'marketplace', 'list']);
run(
  `claude plugin install ${pluginName}@${marketplaceName}`,
  'claude',
  ['plugin', 'install', `${pluginName}@${marketplaceName}`, '--scope', 'user'],
);
run(
  `claude plugin update ${pluginName}@${marketplaceName}`,
  'claude',
  ['plugin', 'update', `${pluginName}@${marketplaceName}`, '--scope', 'user'],
);

const installedPlugins = captureJson(
  'claude plugin list --json',
  'claude',
  ['plugin', 'list', '--json'],
);
const installed = installedPlugins.find((entry) => (
  entry.id === `${pluginName}@${marketplaceName}` && entry.scope === 'user'
));

if (!installed) {
  console.error(`ERROR installed plugin ${pluginName}@${marketplaceName} not found in user scope`);
  process.exit(1);
}

if (installed.version !== plugin.version) {
  console.error(
    `ERROR installed ${pluginName}@${marketplaceName} version is "${installed.version}", expected "${plugin.version}"`,
  );
  process.exit(1);
}

console.log(`\nOK installed ${pluginName}@${marketplaceName} version ${installed.version}`);
