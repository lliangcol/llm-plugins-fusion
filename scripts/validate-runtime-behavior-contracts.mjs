#!/usr/bin/env node
/** Verify that every direct command loads both policy summary and authored behavior. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const spec = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.json'), 'utf8'));

for (const workflow of spec.workflows) {
  const commandPath = resolve(root, 'nova-plugin/commands', `${workflow.id}.md`);
  const skillPath = resolve(root, 'nova-plugin', workflow.contractPath);
  const runtimePath = resolve(root, 'nova-plugin/runtime/contracts', `${workflow.id}.json`);
  const command = readFileSync(commandPath, 'utf8');
  const skill = readFileSync(skillPath, 'utf8');
  const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const runtimeReference = `\${CLAUDE_PLUGIN_ROOT}/runtime/contracts/${workflow.id}.json`;
  const skillReference = `\${CLAUDE_PLUGIN_ROOT}/${workflow.contractPath}`;

  assert.equal(runtime.schemaVersion, 2, `${workflow.id}: runtime contract schema must be v2`);
  assert.equal(runtime.id, workflow.id, `${workflow.id}: runtime id drift`);
  assert.deepEqual(runtime.requiredInputs, workflow.requiredInputs, `${workflow.id}: required input drift`);
  assert.equal(runtime.outputContract, workflow.outputContract, `${workflow.id}: output contract drift`);
  assert.equal(runtime.behaviorContract?.loadRequired, true, `${workflow.id}: authored behavior must be required`);
  assert.equal(runtime.behaviorContract?.reference, `../../${workflow.contractPath}`, `${workflow.id}: behavior reference drift`);
  assert.equal(runtime.behaviorContract?.conflictPolicy, 'fail-closed', `${workflow.id}: conflict policy must fail closed`);
  assert.equal(command.includes(runtimeReference), true, `${workflow.id}: command does not load runtime summary`);
  assert.equal(command.includes(skillReference), true, `${workflow.id}: command does not load authored behavior`);
  assert.match(command, /authoritative behavioral contract/iu, `${workflow.id}: authored behavior authority is unclear`);
  assert.match(command, /fail closed/iu, `${workflow.id}: conflict handling is not fail closed`);
  assert.match(skill, /## Workflow Contract/iu, `${workflow.id}: authored behavior has no workflow contract`);
}

console.log(`OK direct command behavior contracts (${spec.workflows.length}/${spec.workflows.length})`);
