#!/usr/bin/env node
/** Semantic validation for capability contract v3 and the nova product instance. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const spec = readJson('workflow-specs/workflows.json');
const product = readJson('workflow-specs/nova.product.json');
const permissionStates = new Set(['denied', 'prompt', 'preapproved', 'unsupported', 'explicit']);
const policyKeys = ['workspaceRead', 'workspaceWrite', 'shell', 'network', 'credentials', 'userScopeMutation', 'externalPublish', 'gitHistoryMutation'];

assert.equal(spec.schemaVersion, 3);
assert.equal(spec.pluginNamespace, product.pluginNamespace);
assert.equal(spec.workflows.length, product.expectedWorkflowCount);
assert.deepEqual([...spec.toolVocabulary].sort(), [...product.tools].sort());

for (const [profileName, profile] of Object.entries(spec.permissionProfiles)) {
  assert.deepEqual(Object.keys(profile).sort(), ['allowedTools', 'disallowedTools', 'permissionPolicy'].sort(), `${profileName}: profile keys drifted`);
  assert.deepEqual(Object.keys(profile.permissionPolicy).sort(), [...policyKeys].sort(), `${profileName}: incomplete permission policy`);
  for (const [capability, state] of Object.entries(profile.permissionPolicy)) {
    assert.equal(permissionStates.has(state), true, `${profileName}.${capability}: invalid permission state ${state}`);
  }
  assert.equal(new Set([...profile.allowedTools, ...profile.disallowedTools]).size, profile.allowedTools.length + profile.disallowedTools.length, `${profileName}: tool lists overlap`);
}

const ids = new Set();
for (const workflow of spec.workflows) {
  assert.equal(ids.has(workflow.id), false, `duplicate workflow ${workflow.id}`);
  ids.add(workflow.id);
  const profile = spec.permissionProfiles[workflow.permissionProfile];
  assert.ok(profile, `${workflow.id}: unknown permission profile`);
  for (const agent of workflow.ownerAgents) assert.equal(product.agents.includes(agent), true, `${workflow.id}: unknown agent ${agent}`);
  for (const pack of workflow.recommendedPacks) assert.equal(product.packs.includes(pack), true, `${workflow.id}: unknown pack ${pack}`);
  const requirements = workflow.runtimeRequirements;
  if (!requirements) continue;
  if (requirements.network.need === 'required') {
    assert.equal(['prompt', 'preapproved'].includes(profile.permissionPolicy.network), true, `${workflow.id}: required network is not prompt/preapproved`);
  }
  if (requirements.credentials.need === 'required') {
    assert.equal(['explicit', 'preapproved'].includes(profile.permissionPolicy.credentials), true, `${workflow.id}: required credentials are not explicit/preapproved`);
  }
}

for (const id of spec.primaryEntrypoints) assert.equal(ids.has(id), true, `unknown primary entrypoint ${id}`);
console.log(`OK workflow capability contract v3 (${spec.workflows.length} workflows, ${Object.keys(spec.permissionProfiles).length} permission profiles)`);
