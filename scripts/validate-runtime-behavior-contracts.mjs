#!/usr/bin/env node
/** Verify that every direct command loads both policy summary and authored behavior. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';
import { checkOrWrite as checkBehaviorSurfaces } from './generate-behavior-surfaces.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const { spec, behaviorSpec } = loadNovaWorkflowModel(root);
const behaviors = new Map(behaviorSpec.behaviors.map((behavior) => [behavior.id, behavior]));

checkBehaviorSurfaces();

assert.equal(behaviors.size, spec.workflows.length, 'behavior IR count differs from workflow count');

for (const workflow of spec.workflows) {
  const commandPath = resolve(root, 'nova-plugin/commands', `${workflow.id}.md`);
  const skillPath = resolve(root, 'nova-plugin', workflow.contractPath);
  const runtimePath = resolve(root, 'nova-plugin/runtime/contracts', `${workflow.id}.json`);
  const command = readFileSync(commandPath, 'utf8');
  const skill = readFileSync(skillPath, 'utf8');
  const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const behavior = behaviors.get(workflow.id);
  const runtimeReference = `\${CLAUDE_PLUGIN_ROOT}/runtime/contracts/${workflow.id}.json`;
  const skillReference = `\${CLAUDE_PLUGIN_ROOT}/${workflow.contractPath}`;

  assert.ok(behavior, `${workflow.id}: behavior IR missing`);
  assert.equal(runtime.schemaVersion, 3, `${workflow.id}: runtime contract schema must be v3`);
  assert.equal(runtime.id, workflow.id, `${workflow.id}: runtime id drift`);
  assert.deepEqual(runtime.requiredInputs, workflow.requiredInputs, `${workflow.id}: required input drift`);
  assert.equal(runtime.outputContract, workflow.outputContract, `${workflow.id}: output contract drift`);
  const behaviorRequired = behavior.inputs.filter((input) => input.required).map((input) => input.name);
  assert.deepEqual(behaviorRequired, workflow.requiredInputs, `${workflow.id}: behavior required input drift`);
  const inputNames = behavior.inputs.flatMap((input) => [input.name, ...input.aliases]);
  assert.equal(new Set(inputNames).size, inputNames.length, `${workflow.id}: canonical inputs and aliases must be unique`);
  const outputFieldNames = behavior.output.fields.map((field) => field.name);
  assert.equal(behavior.output.order.every((field) => outputFieldNames.includes(field)), true, `${workflow.id}: output order references unknown field`);
  assert.deepEqual(behavior.failureOutput.order, behavior.failureOutput.fields, `${workflow.id}: failure fields and order must be exact`);
  assert.equal(runtime.behaviorContract?.source, 'workflow-specs/behaviors.json', `${workflow.id}: behavior source drift`);
  assert.equal(runtime.behaviorContract?.guidanceReference, `../../${workflow.contractPath}`, `${workflow.id}: guidance reference drift`);
  assert.equal(runtime.behaviorContract?.conflictPolicy, 'fail-closed', `${workflow.id}: conflict policy must fail closed`);
  const { schemaVersion, source, guidanceReference, conflictPolicy, ...compiledBehavior } = runtime.behaviorContract;
  assert.equal(schemaVersion, behaviorSpec.schemaVersion, `${workflow.id}: behavior schema version drift`);
  assert.equal(source, 'workflow-specs/behaviors.json', `${workflow.id}: behavior source missing`);
  assert.equal(guidanceReference, `../../${workflow.contractPath}`, `${workflow.id}: guidance path drift`);
  assert.equal(conflictPolicy, 'fail-closed', `${workflow.id}: behavior conflict policy drift`);
  assert.deepEqual(compiledBehavior, Object.fromEntries(Object.entries(behavior).filter(([key]) => key !== 'id')), `${workflow.id}: compiled behavior differs from IR`);
  assert.equal(command.includes(runtimeReference), true, `${workflow.id}: command does not load runtime summary`);
  assert.equal(command.includes(skillReference), true, `${workflow.id}: command does not load authored behavior`);
  assert.match(command, /authoritative behavioral contract/iu, `${workflow.id}: authored behavior authority is unclear`);
  assert.match(command, /fail closed/iu, `${workflow.id}: conflict handling is not fail closed`);
  assert.match(skill, /## Workflow Contract/iu, `${workflow.id}: authored behavior has no workflow contract`);
  assert.match(skill, /BEGIN GENERATED BEHAVIOR CONTRACT/u, `${workflow.id}: generated behavior surface missing`);
  assert.match(skill, /This block is authoritative/iu, `${workflow.id}: behavior authority missing`);
}

console.log(`OK behavior-complete direct command contracts (${spec.workflows.length}/${spec.workflows.length})`);
