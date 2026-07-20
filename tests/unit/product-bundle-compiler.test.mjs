import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';

test('pure product bundle compiler emits canonical skills and generated aliases without I/O', () => {
  const behavior = (id, purpose) => ({
    id,
    inputs: [{
      name: 'DEPTH',
      required: false,
      aliases: [],
      description: 'Exact workflow depth.',
      default: 'normal',
      exactValues: ['normal', 'deep'],
    }],
    purpose,
    decisionTable: [{ when: 'DEPTH is resolved.', action: 'Compile the requested workflow.' }],
    invariants: ['Remain within the compiled workflow contract.'],
    stopConditions: ['Required contract data is unavailable.'],
    workflowSteps: [{ id: 'compile', action: 'Compile the workflow contract.' }],
    deviationPolicy: { mode: 'forbid', instructions: 'Do not invent contract behavior.' },
    output: {
      mode: 'chat',
      fields: [{ name: 'result', required: true, description: 'Compiled result.' }],
      order: ['result'],
      severityLevels: [],
    },
    validation: ['Confirm the compiled result matches the source contract.'],
    failureOutput: { fields: ['status'], order: ['status'] },
  });
  const bundle = {
    framework: {
      schemaVersion: 4,
      permissionStates: ['denied'],
      permissionPolicyKeys: [],
      riskLevels: ['none'],
      runtimeNeedLevels: ['none'],
      credentialSources: ['none'],
      enforcementLevels: ['advisory'],
    },
    product: { pluginNamespace: 'fixture', runtimeCompatibility: { 'claude-code': '1' }, primaryEntrypoints: ['route'], tools: ['Read'] },
    workflows: { schemaVersion: 5, contractVersions: { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' }, permissionProfiles: { read: { permissionPolicy: {} } }, workflows: [
      { id: 'route', canonicalSurfaceId: 'route', compatibilityAlias: false, variantPreset: {}, permissionProfile: 'read', requiredInputs: [], stage: 'explore', ownerAgents: ['owner'], recommendedPacks: [], outputContract: 'route-v1', risk: 'none', contractPath: 'contracts/route.md' },
      { id: 'legacy', canonicalSurfaceId: 'route', compatibilityAlias: true, variantPreset: { DEPTH: 'deep' }, permissionProfile: 'read', requiredInputs: [], stage: 'explore', ownerAgents: ['owner'], recommendedPacks: [], outputContract: 'legacy-v1', risk: 'none', contractPath: 'contracts/legacy.md' },
    ] },
    behaviors: { schemaVersion: 1, behaviors: [
      behavior('route', 'route'),
      behavior('legacy', 'legacy'),
    ] },
    adapters: [{
      schemaVersion: 1,
      id: 'fixture',
      enforcement: 'advisory',
      declaredLevel: 'L1',
      maximumSupportedLevel: 'L1',
      evidenceRequiredFor: [],
    }],
  };
  const compiled = compileProductBundle(bundle);
  assert.deepEqual(compiled.canonicalSkills, ['route']);
  assert.deepEqual(compiled.commandWrappers[1], { id: 'legacy', canonicalSurfaceId: 'route', variantPreset: { DEPTH: 'deep' }, deprecated: true });
  assert.deepEqual(compiled.spec.runtimeCompatibility, { 'claude-code': '1' });
  assert.equal('knownGoodClaudeCli' in compiled.spec, false);
  assert.equal(compiled.runtimeContracts.length, 2);
  assert.equal(compiled.runtimeContracts[0].behaviorContract.schemaVersion, 1);
  assert.equal(compiled.runtimeContracts[0].behaviorContract.source, 'caller-provided-behavior-spec');
});

test('pure product bundle compiler rejects duplicate adapter identities', () => {
  const bundle = {
    framework: {},
    product: { pluginNamespace: 'fixture', runtimeCompatibility: {}, primaryEntrypoints: [], tools: [] },
    workflows: { workflows: [] },
    behaviors: {},
    adapters: [
      { id: 'duplicate', enforcement: 'advisory' },
      { id: 'duplicate', enforcement: 'native-and-hook' },
    ],
  };
  assert.throws(() => compileProductBundle(bundle), /adapter ids must be present and unique/u);
});
