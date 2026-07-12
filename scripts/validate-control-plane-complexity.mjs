#!/usr/bin/env node
/** Enforce source-owned complexity budgets without treating line count as quality. */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { releaseStates } from './lib/release-state-machine.mjs';

const root = resolve(import.meta.dirname, '..');
const budget = JSON.parse(readFileSync(resolve(root, 'governance/complexity-budget.json'), 'utf8'));
const workflowDir = resolve(root, '.github/workflows');
const workflowFiles = readdirSync(workflowDir).filter((name) => name.endsWith('.yml'));
const errors = [];

if (workflowFiles.length > budget.maximumWorkflowFiles) errors.push(`workflow files ${workflowFiles.length} > ${budget.maximumWorkflowFiles}`);

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
  process.exit(1);
}
console.log(`OK control-plane complexity budget (workflows=${workflowFiles.length}, releaseStates=${releaseStates.length}, manualFacts=${manualFacts})`);
