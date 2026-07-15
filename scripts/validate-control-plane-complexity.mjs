#!/usr/bin/env node
/** Enforce source-owned complexity budgets without treating line count as quality. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { buildInventory } from './generate-control-plane-inventory.mjs';
import { releaseStates } from './lib/release-state-machine.mjs';

const root = resolve(import.meta.dirname, '..');

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

export function main() {
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
  console.log(`OK control-plane complexity budget (packageScripts=${inventory.packageScripts.length}, validationTasks=${inventory.validationTasks.length}, workflows=${workflowFiles.length}, governanceSources=${inventory.governanceSources.length}, generators=${inventory.generators.length}, releaseStates=${releaseStates.length}, manualFacts=${manualFacts})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
