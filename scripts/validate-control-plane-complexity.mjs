#!/usr/bin/env node
/** Enforce source-owned complexity budgets without treating line count as quality. */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { registryMetadata } from './lib/validation-task-registry.mjs';
import { releaseStates } from './lib/release-state-machine.mjs';

const root = resolve(import.meta.dirname, '..');
const jsonPath = resolve(root, 'docs/generated/control-plane-inventory.json');
const markdownPath = resolve(root, 'docs/generated/control-plane-inventory.md');
const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const load = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

function workflowInventory() {
  return readdirSync(resolve(root, '.github/workflows')).filter((name) => /\.ya?ml$/u.test(name)).sort().map((name) => {
    const path = `.github/workflows/${name}`;
    const content = readFileSync(resolve(root, path), 'utf8');
    const jobs = [];
    let inJobs = false;
    for (const line of content.split(/\r?\n/u)) {
      if (line === 'jobs:') { inJobs = true; continue; }
      if (inJobs && /^\S/u.test(line)) inJobs = false;
      const match = inJobs ? /^  ([A-Za-z0-9_-]+):\s*$/u.exec(line) : null;
      if (match) jobs.push(match[1]);
    }
    return { path, owner: 'GitHub Actions control plane', inputs: ['repository source', 'GitHub event context'], outputs: jobs, generated: false, scope: 'maintainer', qualityGate: 'scripts/validate-github-workflows.mjs' };
  });
}

export function buildInventory() {
  const packageJson = load('package.json');
  const productLanes = load('governance/product-lanes.json');
  const scripts = readdirSync(resolve(root, 'scripts')).filter((name) => name.endsWith('.mjs')).sort();
  const governanceSources = readdirSync(resolve(root, 'governance')).filter((name) => name.endsWith('.json') && !name.includes('.generated.')).sort();
  return {
    schemaVersion: 1,
    sourceDigests: {
      packageScripts: digest(JSON.stringify(packageJson.scripts)),
      validationRegistry: digest(readFileSync(resolve(root, 'scripts/lib/validation-task-registry.mjs'))),
      productLanes: digest(readFileSync(resolve(root, 'governance/product-lanes.json'))),
    },
    boundaries: [
      { id: 'plugin-archive', path: 'nova-plugin/', owner: 'plugin runtime', input: 'canonical skills, generated commands, agents, packs, hooks, runtime contracts', output: 'installable nova-plugin archive', generated: false, scope: 'user-runtime', qualityGate: 'scripts/scan-distribution-risk.mjs' },
      { id: 'marketplace-metadata', path: '.claude-plugin/', owner: 'registry generator', input: '.claude-plugin/registry.source.json and plugin.json', output: 'marketplace projections', generated: true, scope: 'distribution', qualityGate: 'scripts/generate-registry.mjs' },
      { id: 'maintainer-control-plane', path: 'scripts/, governance/, schemas/, tests/, .github/', owner: 'maintainers', input: 'repository sources and external evidence', output: 'validation, evidence, CI and release decisions', generated: false, scope: 'maintainer', qualityGate: 'scripts/validate-all.mjs' },
      { id: 'generated-projections', path: 'docs/generated/ and governed generated JSON', owner: 'source-specific generators', input: 'authoritative JSON, JS, and workflow sources', output: 'reviewable projections', generated: true, scope: 'documentation', qualityGate: 'npm run validate:drift' },
      { id: 'external-evidence', path: 'CI artifacts and candidate/control bundles', owner: 'credentialed CI or release operator', input: 'exact ref, isolated identity, credentials when authorized', output: 'non-source-controlled live evidence', generated: true, scope: 'external', qualityGate: 'release readiness and promotion gates' },
    ],
    packageScripts: Object.entries(packageJson.scripts).sort(([a], [b]) => a.localeCompare(b)).map(([name, command]) => ({ name, command, owner: 'maintainer task catalog', scope: 'maintainer' })),
    validationTasks: registryMetadata(),
    workflows: workflowInventory(),
    governanceSources: governanceSources.map((name) => ({ path: `governance/${name}`, owner: 'governed repository policy', generated: false, qualityGate: 'scripts/validate-schemas.mjs' })),
    generators: scripts.filter((name) => name.startsWith('generate-')).map((name) => ({ path: `scripts/${name}`, owner: 'maintainer control plane', outputScope: 'generated projection' })),
    deferredProductLanes: productLanes.lanes.filter((lane) => lane.status === 'deferred').map(({ id, summary }) => ({ id, summary })),
  };
}

function renderInventory(data) {
  return `# Control-plane inventory\n\nGenerated from package scripts, the runnable validation registry, GitHub workflows, governance sources, generators, and product lanes.\n\n- Package scripts: ${data.packageScripts.length}\n- Runnable validation tasks: ${data.validationTasks.length}\n- GitHub workflows: ${data.workflows.length}\n- Governance sources: ${data.governanceSources.length}\n- Generators: ${data.generators.length}\n\n| Boundary | Path | Scope | Generated | Quality gate |\n| --- | --- | --- | --- | --- |\n${data.boundaries.map((item) => `| \`${item.id}\` | \`${item.path}\` | ${item.scope} | ${item.generated ? 'yes' : 'no'} | \`${item.qualityGate}\` |`).join('\n')}\n\nDeferred lanes are not current capabilities: ${data.deferredProductLanes.map((lane) => `\`${lane.id}\``).join(', ')}.\n`;
}

function checkOrWriteInventory(data, { write = false } = {}) {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const markdown = renderInventory(data);
  if (write) {
    writeFileSync(jsonPath, json, 'utf8');
    writeFileSync(markdownPath, markdown, 'utf8');
    return;
  }
  if (!existsSync(jsonPath) || readFileSync(jsonPath, 'utf8') !== json) throw new Error('control-plane JSON inventory is stale; run with --write');
  if (!existsSync(markdownPath) || readFileSync(markdownPath, 'utf8') !== markdown) throw new Error('control-plane Markdown inventory is stale; run with --write');
}

export function inventoryBudgetErrors(budget, inventory) {
  const metrics = [
    ['package scripts', inventory.packageScripts.length, 'maximumPackageScripts'],
    ['validation tasks', inventory.validationTasks.length, 'maximumValidationTasks'],
    ['workflow files', inventory.workflows.length, 'maximumWorkflowFiles'],
    ['governance sources', inventory.governanceSources.length, 'maximumGovernanceSources'],
    ['generators', inventory.generators.length, 'maximumGenerators'],
  ];
  return metrics.flatMap(([label, actual, budgetKey]) => {
    const maximum = budget[budgetKey];
    if (!Number.isInteger(maximum) || maximum < 1) return [`invalid ${budgetKey}: expected a positive integer`];
    return actual > maximum ? [`${label} ${actual} > ${maximum}`] : [];
  });
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) {
    console.error('Usage: node scripts/validate-control-plane-complexity.mjs [--write]');
    return 1;
  }
  const budget = JSON.parse(readFileSync(resolve(root, 'governance/complexity-budget.json'), 'utf8'));
  const inventory = buildInventory();
  const workflowDir = resolve(root, '.github/workflows');
  const workflowFiles = inventory.workflows.map(({ path }) => path.split('/').at(-1));
  const errors = inventoryBudgetErrors(budget, inventory);

  for (const name of workflowFiles.filter((file) => /release|promote/u.test(file))) {
    const model = parseDocument(readFileSync(resolve(workflowDir, name), 'utf8')).toJS();
    const logicLines = Object.values(model.jobs ?? {}).flatMap((job) => job.steps ?? [])
      .filter((step) => typeof step.run === 'string')
      .reduce((total, step) => total + step.run.split(/\r?\n/u).filter((line) => line.trim()).length, 0);
    if (logicLines > budget.maximumReleaseYamlLogicLines) errors.push(`${name} release YAML logic lines ${logicLines} > ${budget.maximumReleaseYamlLogicLines}`);
  }

  const publicDocs = ['README.md', 'SECURITY.md', 'ROADMAP.md', 'CLAUDE.md', 'AGENTS.md'];
  const manualFacts = publicDocs.reduce((total, path) => total + (readFileSync(resolve(root, path), 'utf8').match(/<!--\s*current-fact:manual\s*-->/gu)?.length ?? 0), 0);
  if (manualFacts > budget.maximumManualCurrentFacts) errors.push(`manual current facts ${manualFacts} > ${budget.maximumManualCurrentFacts}`);
  if (4 > budget.maximumGeneratedProjectionLayers) errors.push(`generated projection layers 4 > ${budget.maximumGeneratedProjectionLayers}`);
  if (releaseStates.length > budget.maximumReleaseStateTransitions) errors.push(`release states ${releaseStates.length} > ${budget.maximumReleaseStateTransitions}`);

  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    return 1;
  }
  try {
    checkOrWriteInventory(inventory, { write: args.includes('--write') });
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
  console.log(`OK control-plane complexity budget (packageScripts=${inventory.packageScripts.length}, validationTasks=${inventory.validationTasks.length}, workflows=${workflowFiles.length}, governanceSources=${inventory.governanceSources.length}, generators=${inventory.generators.length}, releaseStates=${releaseStates.length}, manualFacts=${manualFacts})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
