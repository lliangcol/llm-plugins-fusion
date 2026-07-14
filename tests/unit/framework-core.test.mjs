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
import { negotiateWorkflowSupport } from '@llm-plugins-fusion/conformance';
import { loadWorkflowModel } from '../../scripts/lib/workflow-model.mjs';

test('framework core separates inputs, capability availability, and approvals', () => {
  assert.deepEqual(resolveRequiredInputs(['A', 'B'], ['A']), { complete: false, missing: ['B'] });
  const workflow = { runtimeRequirements: { executables: [{ name: 'tool', required: true, versionEvidence: 'versioned-evidence' }], network: { need: 'required', purpose: 'test' }, credentials: { need: 'none', source: 'none' } } };
  const policy = { shell: 'prompt', network: 'prompt', workspaceWrite: 'denied' };
  assert.equal(evaluateCapabilityPolicy({ workflow, permissionPolicy: policy, available: { shell: 'prompt', network: 'unsupported' }, approved: ['shell'] }).decision, 'fallback-unsupported-capability');
  assert.equal(evaluateCapabilityPolicy({ workflow, permissionPolicy: policy, available: { shell: 'prompt', network: 'prompt' }, approved: ['shell'] }).decision, 'blocked-approval');
  assert.equal(evaluateCapabilityPolicy({ workflow: { effects: ['shell'] }, permissionPolicy: { shell: 'denied' }, available: { shell: 'preapproved' } }).decision, 'fallback-unsupported-capability');
  assert.equal(evaluateCapabilityPolicy({ workflow: { effects: ['workspace-read'] }, permissionPolicy: { workspaceRead: 'explicit' }, available: { workspaceRead: 'preapproved' } }).decision, 'blocked-approval');
  assert.equal(evaluateCapabilityPolicy({ workflow: { effects: ['network'] }, permissionPolicy: { network: 'preapproved' }, available: { network: 'invalid' } }).decision, 'fallback-unsupported-capability');
  assert.equal(evaluateCapabilityPolicy({ workflow: { effects: [] }, permissionPolicy: { workspaceWrite: 'preapproved' }, available: {} }).decision, 'ready');
  assert.equal(evaluateCapabilityPolicy({ workflow: {}, permissionPolicy: { workspaceWrite: 'prompt' }, available: { workspaceWrite: 'prompt' } }).decision, 'blocked-approval');
  assert.deepEqual(evaluateCapabilityPolicy(null).reasons, ['invalid-capability-policy-input']);
  assert.deepEqual(evaluateCapabilityPolicy({ workflow: { effects: ['invented'] }, permissionPolicy: {}, available: {} }).reasons, ['invalid-workflow-capability-contract']);
  assert.deepEqual(evaluateCapabilityPolicy({ workflow: { effects: [undefined] }, permissionPolicy: {}, available: {} }).reasons, ['invalid-workflow-capability-contract']);
  assert.deepEqual(evaluateCapabilityPolicy({ workflow: { effects: [], runtimeRequirements: { executables: [null] } }, permissionPolicy: {}, available: {} }).reasons, ['invalid-workflow-capability-contract']);
  assert.deepEqual(evaluateCapabilityPolicy({ workflow: { effects: [], runtimeRequirements: {} }, permissionPolicy: {}, available: {} }).reasons, ['invalid-workflow-capability-contract']);
  assert.equal(evaluateCapabilityPolicy({ workflow: { effects: ['workspace-read'] }, permissionPolicy: { workspaceRead: 'preapproved' }, available: Object.create({ workspaceRead: 'preapproved' }) }).decision, 'fallback-unsupported-capability');
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
  assert.doesNotMatch(JSON.stringify(compiled), /nova|claude|codex/iu);
});

test('framework output and evidence helpers expose explicit failures', () => {
  assert.deepEqual(validateOutputFields({ route: [] }, ['route', 'fallback']), { valid: false, missing: ['fallback'] });
  assert.deepEqual(evidenceFreshness({ a: 'one', b: 'two' }, (path) => ({ a: 'one', b: 'changed' })[path] ?? null), { current: false, staleReasons: ['b:digest-changed'] });
});

test('static host negotiation combines adapter enforcement, capabilities, and approvals', () => {
  const compiled = {
    adapters: [{
      id: 'host',
      enforcement: 'adapter',
      contractEnforcement: { inputs: 'adapter', approval: 'adapter', output: 'adapter', effects: 'adapter', fallback: 'fail-closed' },
    }],
    runtimeContracts: [{
      id: 'change',
      effects: ['workspace-read', 'workspace-write'],
      permissionPolicy: { workspaceRead: 'preapproved', workspaceWrite: 'prompt' },
      runtimeRequirements: { executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'none' } },
    }],
  };
  assert.equal(negotiateWorkflowSupport(compiled, { workflowId: 'missing', adapterId: 'host' }).status, 'unsupported');
  assert.equal(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'missing' }).status, 'unsupported');
  const readable = { workspaceRead: 'preapproved' };
  assert.equal(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'unsupported' } }).status, 'unsupported');
  assert.equal(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'prompt' } }).status, 'approval-required');
  assert.equal(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'prompt' }, approved: ['workspaceWrite'] }).status, 'supported');
  assert.equal(negotiateWorkflowSupport({ ...compiled, adapters: [{ id: 'generic', enforcement: 'advisory' }] }, { workflowId: 'change', adapterId: 'generic', available: { ...readable, workspaceWrite: 'preapproved' } }).status, 'unsupported');
  assert.deepEqual(negotiateWorkflowSupport(null, { workflowId: 'change', adapterId: 'host' }).reasons, ['invalid-compiled-bundle']);
  assert.deepEqual(negotiateWorkflowSupport(compiled, null).reasons, ['invalid-negotiation-options']);
  assert.deepEqual(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'host', available: [], approved: [] }).reasons, ['invalid-negotiation-options']);
  assert.deepEqual(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'preapproved' }, hostEnforcement: { invented: 'adapter' } }).reasons, ['invalid-host-enforcement:invented']);
  assert.deepEqual(negotiateWorkflowSupport(compiled, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'preapproved' }, hostEnforcement: { effects: 'native' } }).reasons, ['invalid-enforcement:effects']);
  assert.deepEqual(negotiateWorkflowSupport({ ...compiled, runtimeContracts: [{ ...compiled.runtimeContracts[0], effects: ['invented'] }] }, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'preapproved' } }).reasons, ['invalid-workflow-capability-contract']);
  assert.deepEqual(negotiateWorkflowSupport({ ...compiled, adapters: [{ id: 'host', enforcement: 'unsupported' }] }, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'preapproved' }, hostEnforcement: { inputs: 'adapter', approval: 'adapter', output: 'adapter', effects: 'adapter' } }).reasons, ['adapter-unsupported']);
  assert.deepEqual(negotiateWorkflowSupport({ ...compiled, adapters: [{ id: 'host', schemaVersion: 2, enforcement: 'adapter' }] }, { workflowId: 'change', adapterId: 'host', available: { ...readable, workspaceWrite: 'preapproved' } }).reasons, ['invalid-adapter-contract-enforcement']);
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
