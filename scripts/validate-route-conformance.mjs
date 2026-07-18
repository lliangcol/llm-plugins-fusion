#!/usr/bin/env node
/** Validate public route cases against canonical workflow and inventory contracts. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCompiledVariantContract } from '../framework/compiler/compile-runtime-contracts.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const model = loadNovaWorkflowModelV6(root);
const spec = model.spec;
const fixture = readJson('evals/route/cases.json');
const workflows = new Map(spec.workflows.map((workflow) => [workflow.id, workflow]));
const canonicalTargets = new Set(readJson('workflow-specs/nova.product.json').automaticRouting.canonicalTargets);
const agents = new Set(['architect', 'builder', 'orchestrator', 'publisher', 'reviewer', 'verifier']);
const packs = new Set(['dependency', 'docs', 'frontend', 'java', 'marketplace', 'mcp', 'release', 'security']);

assert.equal(fixture.schemaVersion, 2);
assert.equal(fixture.executionMode, 'deterministic-canonical-route-contract');
assert.ok(fixture.cases.length >= 10 && fixture.cases.length <= 15, 'route suite must contain 10-15 cases');
assert.equal(new Set(fixture.cases.map((entry) => entry.id)).size, fixture.cases.length, 'route case ids must be unique');

for (const entry of fixture.cases) {
  assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(entry.request.length >= 20, `${entry.id}: request is too small`);
  assert.equal(entry.commands.length, 1, `${entry.id}: route must select exactly one immediate command`);
  assert.equal(entry.skills.length, 1, `${entry.id}: route must select exactly one immediate canonical skill`);
  assert.equal(entry.variantParameters.length, 1, `${entry.id}: route must declare exactly one variant parameter object`);
  assert.equal(entry.commands.length, entry.skills.length, `${entry.id}: command/skill count differs`);
  assert.equal(entry.commands.length, entry.variantParameters.length, `${entry.id}: command/variant count differs`);
  if (entry.commandAliases) assert.equal(entry.commandAliases.length, 1, `${entry.id}: route must declare exactly one resolved command alias`);
  const owners = new Set();
  const requiredInputs = [];
  const selectedWorkflows = [];
  for (let index = 0; index < entry.commands.length; index += 1) {
    const command = entry.commands[index];
    const workflow = workflows.get(command);
    assert.ok(workflow, `${entry.id}: invented command ${command}`);
    assert.equal(workflow.compatibilityAlias, false, `${entry.id}: exact route selects compatibility alias ${command}`);
    assert.ok(canonicalTargets.has(command), `${entry.id}: route ${command} is not automatic-routing eligible`);
    assert.equal(entry.skills[index], `nova-${workflow.canonicalSurfaceId}`, `${entry.id}: command/canonical-skill mapping differs`);
    const resolved = resolveCompiledVariantContract(spec, model.behaviorSpec, command, entry.variantParameters[index]);
    const aliasId = entry.commandAliases?.[index];
    if (aliasId) {
      assert.equal(resolved.resolvedWorkflowId, aliasId, `${entry.id}: expected alias differs from resolved variant contract`);
      assert.equal(resolved.compatibilityAlias, true, `${entry.id}: resolved ${aliasId} is not a compatibility alias`);
    } else {
      assert.equal(resolved.resolvedWorkflowId, command, `${entry.id}: unaliased variant must resolve to the canonical contract`);
    }
    const resolvedWorkflow = workflows.get(resolved.resolvedWorkflowId);
    assert.ok(resolvedWorkflow, `${entry.id}: resolved workflow ${resolved.resolvedWorkflowId} is missing`);
    assert.deepEqual(resolved.contract.inputs, resolvedWorkflow.inputs, `${entry.id}: resolved inputs differ`);
    assert.deepEqual(resolved.contract.effects, resolvedWorkflow.effects, `${entry.id}: resolved effects differ`);
    assert.equal(resolved.contract.authorizationProfile, resolvedWorkflow.authorizationProfile, `${entry.id}: resolved authorization differs`);
    assert.equal(resolved.contract.outputContract, resolvedWorkflow.outputContract, `${entry.id}: resolved output differs`);
    assert.deepEqual(resolved.contract.runtimeRequirements, resolvedWorkflow.runtimeRequirements ?? {
      executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'none' },
    }, `${entry.id}: resolved runtime requirements differ`);
    selectedWorkflows.push(resolved);
    for (const owner of resolved.contract.ownerAgents) owners.add(owner);
    for (const input of resolved.contract.requiredInputs) if (!requiredInputs.includes(input)) requiredInputs.push(input);
  }
  for (const agent of entry.coreAgents) {
    assert.ok(agents.has(agent), `${entry.id}: invented agent ${agent}`);
    assert.ok(owners.has(agent), `${entry.id}: ${agent} does not own a selected workflow`);
  }
  for (const pack of entry.packs) assert.ok(packs.has(pack), `${entry.id}: invented pack ${pack}`);
  assert.deepEqual(entry.requiredInputs, requiredInputs, `${entry.id}: resolved required inputs differ`);
  if (entry.zeroWrite) {
    for (const resolved of selectedWorkflows) {
      assert.equal(resolved.contract.permissionPolicy.workspaceWrite, 'denied', `${entry.id}: zero-write route resolves ${resolved.resolvedWorkflowId}`);
    }
  }
}

console.log(`OK route conformance passed (${fixture.cases.length} deterministic cases)`);
