#!/usr/bin/env node
/** Generate the machine-readable project truth aggregate from domain sources. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

assertNodeVersion({ label: 'project state generation' });

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = 'governance/project-state.generated.json';
const sourcePaths = [
  'package.json',
  'nova-plugin/.claude-plugin/plugin.json',
  'workflow-specs/workflows.json',
  'workflow-specs/nova.product.json',
  'workflow-specs/framework.json',
  'workflow-specs/behaviors.json',
  'workflow-specs/adapters/claude.json',
  'workflow-specs/adapters/codex.json',
  'workflow-specs/adapters/generic.json',
  'docs/generated/surface-inventory.json',
  'governance/product-lanes.json',
  'governance/release-operations.json',
  'governance/adoption-evidence.json',
  'governance/evidence-governance.json',
  'nova-plugin/hooks/hooks.json',
  'nova-plugin/runtime/shell-command-policy.json',
  '.nova/shell-policy.json',
];

function readJson(repoRoot, path) {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8'));
}

function sha256(repoRoot, path) {
  return createHash('sha256').update(readFileSync(resolve(repoRoot, path))).digest('hex');
}

function hookLaunchers(hooks) {
  const result = {};
  for (const [event, groups] of Object.entries(hooks.hooks ?? {})) {
    result[event] = groups.flatMap((group) => (group.hooks ?? []).map((hook) => ({
      matcher: group.matcher ?? null,
      command: hook.command,
      args: hook.args ?? [],
      async: hook.async === true,
    })));
  }
  return result;
}

export function buildProjectState(repoRoot = root) {
  const pkg = readJson(repoRoot, 'package.json');
  const plugin = readJson(repoRoot, 'nova-plugin/.claude-plugin/plugin.json');
  const model = loadNovaWorkflowModel(repoRoot);
  const workflows = model.workflows;
  const inventory = readJson(repoRoot, 'docs/generated/surface-inventory.json');
  const productLanes = readJson(repoRoot, 'governance/product-lanes.json');
  const hooks = readJson(repoRoot, 'nova-plugin/hooks/hooks.json');
  const scriptNames = Object.keys(pkg.scripts ?? {}).sort();

  return {
    schemaVersion: 1,
    generatedFrom: 'repository-domain-sources',
    plugin: {
      name: plugin.name,
      version: plugin.version,
      productionPluginCount: inventory.source.registryPluginCount,
      publicPath: 'nova-plugin/',
    },
    runtime: {
      node: pkg.engines?.node ?? null,
      distributedBash: '3.2+',
    },
    inventory: {
      commands: inventory.counts.commands,
      skills: inventory.counts.skills,
      activeAgents: inventory.counts.activeAgents,
      capabilityPacks: inventory.counts.capabilityPacks,
      installedClaudeSkills: inventory.counts.installedSkills,
    },
    workflow: {
      schemaVersion: workflows.schemaVersion,
      namespace: model.product.pluginNamespace,
      count: workflows.workflows.length,
    },
    repositoryScripts: {
      names: scriptNames,
      check: pkg.scripts?.check ?? null,
      build: pkg.scripts?.build ?? null,
    },
    productLanes: Object.fromEntries(productLanes.lanes.map((lane) => [lane.id, {
      status: lane.status,
      summary: lane.summary,
    }])),
    hooks: hookLaunchers(hooks),
    release: {
      model: existsSync(resolve(repoRoot, '.github/workflows/release-candidate.yml'))
        ? 'candidate-and-promotion'
        : 'stable-tag-gated',
      immutableSignedTags: true,
      exactTagInstallGate: true,
    },
    sourceDigests: Object.fromEntries(sourcePaths.map((path) => [path, sha256(repoRoot, path)])),
  };
}

export function projectStateContent(repoRoot = root) {
  return `${JSON.stringify(buildProjectState(repoRoot), null, 2)}\n`;
}

export function checkOrWriteProjectState({ repoRoot = root, write = false } = {}) {
  const expected = projectStateContent(repoRoot);
  const target = resolve(repoRoot, outputPath);
  if (write) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, expected, 'utf8');
    return { path: outputPath, written: true };
  }
  if (!existsSync(target) || readFileSync(target, 'utf8') !== expected) {
    throw new Error(`${outputPath} is stale; run node scripts/generate-project-state.mjs --write`);
  }
  return { path: outputPath, written: false };
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) {
    console.error('Usage: node scripts/generate-project-state.mjs [--write]');
    return 1;
  }
  try {
    const result = checkOrWriteProjectState({ write: args.includes('--write') });
    console.log(`${result.written ? 'Wrote' : 'OK'} ${result.path}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
