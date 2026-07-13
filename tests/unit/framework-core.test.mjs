import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveFromModule } from '../../scripts/lib/repo-root.mjs';
import { evaluateCapabilityPolicy } from '../../framework/core/capability-policy.mjs';
import { evidenceFreshness } from '../../framework/core/evidence-registry.mjs';
import { resolveBehaviorInputs, resolveRequiredInputs } from '../../framework/core/input-resolution.mjs';
import { validateOutputFields } from '../../framework/core/output-validation.mjs';
import { compileRuntimeContract } from '../../framework/compiler/compile-runtime-contracts.mjs';
import { compileRuntimeContracts } from '../../framework/compiler/compile-runtime-contracts.mjs';
import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '@llm-plugins-fusion/compiler';
import { loadWorkflowModel } from '../../scripts/lib/workflow-model.mjs';

test('framework core separates inputs, capability availability, and approvals', () => {
  assert.deepEqual(resolveRequiredInputs(['A', 'B'], ['A']), { complete: false, missing: ['B'] });
  const workflow = { runtimeRequirements: { executables: [{ required: true }], network: { need: 'required' }, credentials: { need: 'none' } } };
  const policy = { workspaceWrite: 'denied' };
  assert.equal(evaluateCapabilityPolicy({ workflow, permissionPolicy: policy, available: { shell: 'prompt', network: 'unsupported' }, approved: ['shell'] }).decision, 'fallback-unsupported-capability');
  assert.equal(evaluateCapabilityPolicy({ workflow, permissionPolicy: policy, available: { shell: 'prompt', network: 'prompt' }, approved: ['shell'] }).decision, 'blocked-approval');
});

test('behavior input resolution handles aliases, defaults, exact values, and conflicts', () => {
  const behavior = { inputs: [
    { name: 'REQUEST', required: true, aliases: ['INPUT'], description: 'request' },
    { name: 'MODE', required: false, aliases: [], description: 'mode', default: 'safe', exactValues: ['safe', 'fast'] },
  ] };
  assert.deepEqual(resolveBehaviorInputs(behavior, { INPUT: 'work' }), { valid: true, normalizedInputs: { REQUEST: 'work', MODE: 'safe' }, missingRequired: [], invalidExactValues: [] });
  assert.equal(resolveBehaviorInputs(behavior, { REQUEST: 'a', INPUT: 'b' }).invalidExactValues[0].reason, 'conflicting-alias-values');
  assert.equal(resolveBehaviorInputs(behavior, { REQUEST: 'work', MODE: 'unsafe' }).invalidExactValues[0].reason, 'not-an-exact-value');
});

test('runtime compiler supports a non-Nova, non-Claude three-workflow product fixture', () => {
  const root = resolveFromModule(import.meta.url, '../../fixtures/products/minimal-plugin');
  const loaded = loadWorkflowModel({ root, frameworkPath: 'framework.json', productPath: 'product.json', workflowsPath: 'workflows.json', behaviorsPath: 'behaviors.json' });
  const contracts = compileRuntimeContracts(loaded.spec, loaded.behaviorSpec);
  assert.equal(contracts.length, 3);
  assert.deepEqual(contracts.map((entry) => entry.stage), ['intake', 'shape', 'assure']);
  assert.deepEqual(contracts.map((entry) => entry.behaviorContract.guidanceReference), ['../../contracts/triage.md', '../../contracts/design.md', '../../contracts/verify.md']);
  assert.deepEqual(contracts.map((entry) => entry.behaviorContract.output.order), [['next step'], ['design'], ['verified', 'skipped', 'residual risk']]);
  assert.doesNotMatch(JSON.stringify(contracts), /nova|claude|codex/iu);
});

test('Contract v6 compiler remains product-neutral for the three-workflow fixture', () => {
  const root = resolveFromModule(import.meta.url, '../../fixtures/products/minimal-plugin');
  const loaded = loadWorkflowModel({ root, frameworkPath: 'framework.json', productPath: 'product.json', workflowsPath: 'workflows.json', behaviorsPath: 'behaviors.json' });
  const compiled = compileProductBundle({
    framework: { ...loaded.framework, schemaVersion: 5, protocolVersions: { framework: '5.0.0', workflow: '6.0.0', runtime: '4.0.0', adapter: '3.0.0', compatibilityProjection: '5.0.0' } },
    product: loaded.product,
    workflows: migrateWorkflowSpec(loaded.workflows, loaded.behaviors),
    behaviors: migrateBehaviorSpec(loaded.behaviors),
    adapters: loaded.adapters,
  });
  assert.equal(compiled.runtimeContracts.length, 3);
  assert.ok(compiled.runtimeContracts.every((contract) => contract.schemaVersion === 4));
  assert.doesNotMatch(JSON.stringify(compiled.runtimeContracts), /nova|claude|codex/iu);
});

test('framework output and evidence helpers expose explicit failures', () => {
  assert.deepEqual(validateOutputFields({ route: [] }, ['route', 'fallback']), { valid: false, missing: ['fallback'] });
  assert.deepEqual(evidenceFreshness({ a: 'one', b: 'two' }, (path) => ({ a: 'one', b: 'changed' })[path] ?? null), { current: false, staleReasons: ['b:digest-changed'] });
});

test('runtime compiler emits policy plus a required product-defined behavior reference', () => {
  const workflow = { id: 'review', stage: 'review', ownerAgents: ['reviewer'], recommendedPacks: [], requiredInputs: ['SCOPE'], outputContract: 'review-v1', risk: 'none', permissionProfile: 'read', contractPath: 'skills/acme-review/SKILL.md' };
  const behavior = { id: 'review', purpose: 'Review scope.', inputs: [{ name: 'SCOPE', required: true, aliases: [], description: 'Scope.' }], decisionTable: [{ when: 'SCOPE exists.', action: 'Review it.' }], invariants: ['No writes.'], stopConditions: ['SCOPE missing.'], workflowSteps: [{ id: 'review', action: 'Review.' }], deviationPolicy: { mode: 'forbid', instructions: 'No deviations.' }, output: { mode: 'chat', fields: [{ name: 'findings', required: true, description: 'Findings.' }], order: ['findings'], severityLevels: [] }, validation: ['Check evidence.'], failureOutput: { fields: ['status'], order: ['status'] } };
  const contract = compileRuntimeContract({ schemaVersion: 3, permissionProfiles: { read: { permissionPolicy: { workspaceWrite: 'denied' } } }, assistantEnforcement: { generic: 'advisory' } }, workflow, behavior);
  assert.equal(contract.id, 'review');
  assert.equal(contract.permissionPolicy.workspaceWrite, 'denied');
  assert.equal(contract.behaviorContract.guidanceReference, '../../skills/acme-review/SKILL.md');
  assert.equal(contract.behaviorContract.purpose, 'Review scope.');
  assert.equal(contract.behaviorContract.conflictPolicy, 'fail-closed');
});
