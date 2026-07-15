import assert from 'node:assert/strict';
import { loadNovaWorkflowModel } from './workflow-model.mjs';

export function validateCompiledWorkflowModel({ spec, product, framework, adapters, behaviorSpec }) {
  const permissionStates = new Set(framework.permissionStates);
  const policyKeys = framework.permissionPolicyKeys;
  assert.equal(spec.schemaVersion, 5);
  assert.deepEqual(spec.contractVersions, { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' });
  assert.equal(framework.schemaVersion, 5);
  assert.deepEqual(framework.protocolVersions, { framework: '5.0.0', workflow: '6.0.0', runtime: '4.0.0', adapter: '3.0.0', compatibilityProjection: '5.0.0' });
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
  const workflowById = new Map(spec.workflows.map((workflow) => [workflow.id, workflow]));
  const behaviorById = new Map(behaviorSpec.behaviors.map((behavior) => [behavior.id, behavior]));
  const compatibilityAliases = spec.workflows.filter((workflow) => workflow.compatibilityAlias);
  if (compatibilityAliases.length > 0) {
    assert.ok(product.compatibilityAliasPolicy, 'products with compatibility aliases must declare compatibilityAliasPolicy');
  }
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
    const canonicalBehavior = behaviorById.get(workflow.canonicalSurfaceId);
    assert.ok(canonicalBehavior, `${workflow.id}: missing canonical behavior ${workflow.canonicalSurfaceId}`);
    const canonicalInputs = new Map(canonicalBehavior.inputs.map((input) => [input.name, input]));
    for (const [name, value] of Object.entries(workflow.variantPreset ?? {})) {
      const input = canonicalInputs.get(name);
      assert.ok(input, `${workflow.id}: variant preset ${name} is not a canonical ${workflow.canonicalSurfaceId} input`);
      if (input.exactValues) assert.equal(input.exactValues.some((allowed) => Object.is(allowed, value)), true, `${workflow.id}: variant preset ${name} has unsupported value ${JSON.stringify(value)}`);
    }
    const requirements = workflow.runtimeRequirements;
    if (!requirements) continue;
    if (requirements.network.need === 'required') assert.equal(['prompt', 'preapproved'].includes(profile.permissionPolicy.network), true, `${workflow.id}: required network is not prompt/preapproved`);
    if (requirements.credentials.need === 'required') assert.equal(['explicit', 'preapproved'].includes(profile.permissionPolicy.credentials), true, `${workflow.id}: required credentials are not explicit/preapproved`);
  }
  for (const id of spec.primaryEntrypoints) assert.equal(ids.has(id), true, `unknown primary entrypoint ${id}`);
  const canonicalTargets = spec.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => workflow.id).sort();
  assert.equal(product.automaticRouting?.identity, 'canonical-surface-plus-variant-parameters');
  assert.equal(product.automaticRouting?.compatibilityAliases, 'excluded');
  assert.deepEqual([...product.automaticRouting.canonicalTargets].sort(), canonicalTargets, 'automatic routing targets must equal the canonical workflow inventory');
  const automaticTargets = new Set(product.automaticRouting.canonicalTargets);
  for (const behavior of behaviorSpec.behaviors) {
    for (const [index, decision] of behavior.decisionTable.entries()) {
      if (!decision.route) continue;
      const target = workflowById.get(decision.route);
      assert.ok(target, `${behavior.id}: decision ${index} routes to unknown workflow ${decision.route}`);
      assert.equal(target.compatibilityAlias, false, `${behavior.id}: decision ${index} routes to compatibility alias ${decision.route}`);
      assert.equal(automaticTargets.has(decision.route), true, `${behavior.id}: decision ${index} route ${decision.route} is not automatic-routing eligible`);
      assert.equal(decision.variantParameters !== null && typeof decision.variantParameters === 'object' && !Array.isArray(decision.variantParameters), true, `${behavior.id}: decision ${index} lacks structured variantParameters`);
      const targetInputs = new Map(behaviorById.get(decision.route).inputs.map((input) => [input.name, input]));
      for (const [name, value] of Object.entries(decision.variantParameters)) {
        const input = targetInputs.get(name);
        assert.ok(input, `${behavior.id}: decision ${index} variant ${name} is not a canonical ${decision.route} input`);
        if (input.exactValues) assert.equal(input.exactValues.some((allowed) => Object.is(allowed, value)), true, `${behavior.id}: decision ${index} variant ${name} has unsupported value ${JSON.stringify(value)}`);
      }
    }
  }
  if (product.pluginNamespace === 'nova-plugin') assert.deepEqual([...canonicalSurfaces].sort(), ['explore', 'finalize-work', 'implement-plan', 'produce-plan', 'review', 'route']);
  if (product.pluginNamespace === 'nova-plugin') {
    const workflows = new Map(spec.workflows.map((workflow) => [workflow.id, workflow]));
    assert.equal(workflows.get('review')?.permissionProfile, 'read-only', 'review: canonical local review must use the read-only profile');
    assert.equal(workflows.get('implement-plan')?.permissionProfile, 'implementation', 'implement-plan: canonical local implementation must use the implementation profile');
  }
  return { workflows: spec.workflows.length, adapters: adapters.length, permissionProfiles: Object.keys(spec.permissionProfiles).length };
}

export function validateWorkflowModel(root) {
  return validateCompiledWorkflowModel(loadNovaWorkflowModel(root));
}
