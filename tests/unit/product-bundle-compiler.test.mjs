import assert from 'node:assert/strict';
import test from 'node:test';
import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';

test('pure product bundle compiler emits canonical skills and generated aliases without I/O', () => {
  const bundle = {
    framework: { schemaVersion: 1 },
    product: { pluginNamespace: 'fixture', runtimeCompatibility: { 'claude-code': '1' }, primaryEntrypoints: ['route'], tools: ['Read'] },
    workflows: { schemaVersion: 5, permissionProfiles: { read: { permissionPolicy: {} } }, workflows: [
      { id: 'route', canonicalSurfaceId: 'route', compatibilityAlias: false, variantPreset: {}, permissionProfile: 'read', requiredInputs: [], stage: 'explore', ownerAgents: ['owner'], recommendedPacks: [], outputContract: 'route-v1', risk: 'none' },
      { id: 'legacy', canonicalSurfaceId: 'route', compatibilityAlias: true, variantPreset: { DEPTH: 'deep' }, permissionProfile: 'read', requiredInputs: [], stage: 'explore', ownerAgents: ['owner'], recommendedPacks: [], outputContract: 'legacy-v1', risk: 'none' },
    ] },
    behaviors: { behaviors: [
      { id: 'route', inputs: [], purpose: 'route', decisionTable: [], invariants: [], stopConditions: [], workflowSteps: [], deviationPolicy: {}, output: {}, validation: [], failureOutput: {} },
      { id: 'legacy', inputs: [], purpose: 'legacy', decisionTable: [], invariants: [], stopConditions: [], workflowSteps: [], deviationPolicy: {}, output: {}, validation: [], failureOutput: {} },
    ] },
    adapters: [{ id: 'fixture', enforcement: 'advisory' }],
  };
  const compiled = compileProductBundle(bundle);
  assert.deepEqual(compiled.canonicalSkills, ['route']);
  assert.deepEqual(compiled.commandWrappers[1], { id: 'legacy', canonicalSurfaceId: 'route', variantPreset: { DEPTH: 'deep' }, deprecated: true });
  assert.deepEqual(compiled.spec.runtimeCompatibility, { 'claude-code': '1' });
  assert.equal('knownGoodClaudeCli' in compiled.spec, false);
  assert.equal(compiled.runtimeContracts.length, 2);
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
