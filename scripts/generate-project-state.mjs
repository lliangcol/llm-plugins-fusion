#!/usr/bin/env node
/** Generate the machine-readable project truth aggregate from domain sources. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';
import { deriveEvaluationFacts } from './lib/evaluation-facts.mjs';

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
  'governance/evaluation-profiles.json',
  'evals/live/v5/cases.json',
  'evals/live/v5/labels.locked.json',
  'evals/critical-live/v5/cases.json',
  'benchmarks/real-tasks.json',
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
  const evaluation = deriveEvaluationFacts(repoRoot);

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
    evaluation,
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

export const startMarker = '<!-- generated:project-state:start -->';
export const endMarker = '<!-- generated:project-state:end -->';
export const projectFactDocuments = Object.freeze([
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'ROADMAP.md',
  'SECURITY.md',
  'docs/project/plans/current-remediation.md',
  'docs/operations/maintainers/status.md',
  'nova-plugin/docs/architecture/hooks-design.md',
  'evals/README.md',
]);

function laneIds(state, status) {
  return Object.entries(state.productLanes)
    .filter(([, lane]) => lane.status === status)
    .map(([id]) => `\`${id}\``)
    .join(', ') || 'None';
}

function launcherSummary(state, event) {
  return (state.hooks[event] ?? []).map((hook) => {
    const args = hook.args.length ? ` ${hook.args.join(' ')}` : '';
    return `\`${hook.command}${args}\``;
  }).join(', ') || 'None';
}

export function renderProjectFactBlock(state) {
  return `${startMarker}
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
\`node scripts/generate-project-state.mjs --write\` from repository domain
sources and \`governance/product-lanes.json\`.

- Plugin: \`${state.plugin.name}@${state.plugin.version}\`; production plugins: ${state.plugin.productionPluginCount}; public path: \`${state.plugin.publicPath}\`
- Runtime: Node.js \`${state.runtime.node}\`; distributed Bash helpers: \`${state.runtime.distributedBash}\`
- Inventory: ${state.inventory.commands} commands, ${state.inventory.skills} skills, ${state.inventory.activeAgents} active agents, ${state.inventory.capabilityPacks} capability packs
- Workflow contract: schema v${state.workflow.schemaVersion}, namespace \`${state.workflow.namespace}\`, ${state.workflow.count} workflows
- Evaluation datasets: \`${state.evaluation.livePaired.datasetId}\` has ${state.evaluation.livePaired.caseCount} cases and ${state.evaluation.livePaired.plannedInvocations} planned paired invocations; \`${state.evaluation.realTask.datasetId}\` has ${state.evaluation.realTask.taskCount} tasks and ${state.evaluation.realTask.plannedInvocations} planned invocations
- Package scripts: \`check\` is present; \`build\` is ${state.repositoryScripts.build ? 'present' : 'absent'}
- Active product lanes: ${laneIds(state, 'active')}
- Planned product lanes: ${laneIds(state, 'planned')}
- Deferred product lanes: ${laneIds(state, 'deferred')}
- Release model: \`${state.release.model}\`
- Active PreToolUse launcher: ${launcherSummary(state, 'PreToolUse')}
- Active PostToolUse launcher: ${launcherSummary(state, 'PostToolUse')}
${endMarker}`;
}

export function replaceProjectFactBlock(source, block) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if ((start === -1) !== (end === -1)) throw new Error('project-state generated block has only one marker');
  if (start !== -1) {
    if (end < start) throw new Error('project-state generated block markers are reversed');
    return `${source.slice(0, start)}${block}${source.slice(end + endMarker.length)}`;
  }
  const headingEnd = source.indexOf('\n');
  if (headingEnd === -1 || !source.startsWith('# ')) throw new Error('document must start with an H1 heading');
  return `${source.slice(0, headingEnd + 1)}\n${block}\n${source.slice(headingEnd + 1)}`;
}

export function syncDocFacts({ repoRoot = root, write = false } = {}) {
  const state = buildProjectState(repoRoot);
  const block = renderProjectFactBlock(state);
  const stale = [];
  for (const path of projectFactDocuments) {
    const target = resolve(repoRoot, path);
    const actual = readFileSync(target, 'utf8');
    const expected = replaceProjectFactBlock(actual, block);
    if (actual === expected) continue;
    if (write) writeFileSync(target, expected, 'utf8');
    else stale.push(path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} project fact blocks are stale; run node scripts/generate-project-state.mjs --write`);
  return projectFactDocuments;
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) {
    console.error('Usage: node scripts/generate-project-state.mjs [--write]');
    return 1;
  }
  try {
    const write = args.includes('--write');
    const result = checkOrWriteProjectState({ write });
    const facts = syncDocFacts({ write });
    console.log(`${result.written ? 'Wrote' : 'OK'} ${result.path} and project fact blocks (${facts.length} files)`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
