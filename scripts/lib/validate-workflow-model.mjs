import assert from 'node:assert/strict';
import { loadNovaWorkflowModel } from './workflow-model.mjs';

export function validateWorkflowModel(root) {
  const { spec, product, framework, adapters, behaviorSpec } = loadNovaWorkflowModel(root);
  const permissionStates = new Set(framework.permissionStates);
  const policyKeys = framework.permissionPolicyKeys;
  assert.equal(spec.schemaVersion, 5);
  assert.deepEqual(spec.contractVersions, { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' });
  assert.equal(framework.schemaVersion, 4);
  assert.equal(product.schemaVersion, 2);
  assert.equal(spec.pluginNamespace, product.pluginNamespace);
  assert.equal(spec.workflows.length, product.expectedWorkflowCount);
  assert.deepEqual([...spec.toolVocabulary].sort(), [...product.tools].sort());
  assert.equal(adapters.length, product.adapterDefinitions.length);
  assert.equal(behaviorSpec.behaviors.length, spec.workflows.length);
  for (const [profileName, profile] of Object.entries(spec.permissionProfiles)) {
    assert.deepEqual(Object.keys(profile).sort(), ['allowedTools', 'disallowedTools', 'permissionPolicy'].sort(), `${profileName}: profile keys drifted`);
    assert.deepEqual(Object.keys(profile.permissionPolicy).sort(), [...policyKeys].sort(), `${profileName}: incomplete permission policy`);
    for (const [capability, state] of Object.entries(profile.permissionPolicy)) assert.equal(permissionStates.has(state), true, `${profileName}.${capability}: invalid permission state ${state}`);
    assert.equal(new Set([...profile.allowedTools, ...profile.disallowedTools]).size, profile.allowedTools.length + profile.disallowedTools.length, `${profileName}: tool lists overlap`);
  }
  const ids = new Set();
  const canonicalSurfaces = new Set();
  for (const workflow of spec.workflows) {
    assert.equal(ids.has(workflow.id), false, `duplicate workflow ${workflow.id}`);
    ids.add(workflow.id);
    if (!workflow.compatibilityAlias) canonicalSurfaces.add(workflow.canonicalSurfaceId);
    const profile = spec.permissionProfiles[workflow.permissionProfile];
    assert.ok(profile, `${workflow.id}: unknown permission profile`);
    assert.equal(product.stages.includes(workflow.stage), true, `${workflow.id}: unknown product stage ${workflow.stage}`);
    assert.equal(framework.riskLevels.includes(workflow.risk), true, `${workflow.id}: unknown framework risk ${workflow.risk}`);
    for (const agent of workflow.ownerAgents) assert.equal(product.agents.includes(agent), true, `${workflow.id}: unknown agent ${agent}`);
    for (const pack of workflow.recommendedPacks) assert.equal(product.packs.includes(pack), true, `${workflow.id}: unknown pack ${pack}`);
    const requirements = workflow.runtimeRequirements;
    if (!requirements) continue;
    if (requirements.network.need === 'required') assert.equal(['prompt', 'preapproved'].includes(profile.permissionPolicy.network), true, `${workflow.id}: required network is not prompt/preapproved`);
    if (requirements.credentials.need === 'required') assert.equal(['explicit', 'preapproved'].includes(profile.permissionPolicy.credentials), true, `${workflow.id}: required credentials are not explicit/preapproved`);
  }
  for (const id of spec.primaryEntrypoints) assert.equal(ids.has(id), true, `unknown primary entrypoint ${id}`);
  if (product.pluginNamespace === 'nova-plugin') assert.deepEqual([...canonicalSurfaces].sort(), ['explore', 'finalize-work', 'implement-plan', 'produce-plan', 'review', 'route']);
  return { workflows: spec.workflows.length, adapters: adapters.length, permissionProfiles: Object.keys(spec.permissionProfiles).length };
}
