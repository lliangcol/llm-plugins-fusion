import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCapabilityPolicy } from '../../framework/core/capability-policy.mjs';
import { evidenceFreshness } from '../../framework/core/evidence-registry.mjs';
import { resolveRequiredInputs } from '../../framework/core/input-resolution.mjs';
import { validateOutputFields } from '../../framework/core/output-validation.mjs';
import { compileRuntimeContract } from '../../framework/compiler/compile-runtime-contracts.mjs';

test('framework core separates inputs, capability availability, and approvals', () => {
  assert.deepEqual(resolveRequiredInputs(['A', 'B'], ['A']), { complete: false, missing: ['B'] });
  const workflow = { runtimeRequirements: { executables: [{ required: true }], network: { need: 'required' }, credentials: { need: 'none' } } };
  const policy = { workspaceWrite: 'denied' };
  assert.equal(evaluateCapabilityPolicy({ workflow, permissionPolicy: policy, available: { shell: 'prompt', network: 'unsupported' }, approved: ['shell'] }).decision, 'fallback-unsupported-capability');
  assert.equal(evaluateCapabilityPolicy({ workflow, permissionPolicy: policy, available: { shell: 'prompt', network: 'prompt' }, approved: ['shell'] }).decision, 'blocked-approval');
});

test('framework output and evidence helpers expose explicit failures', () => {
  assert.deepEqual(validateOutputFields({ route: [] }, ['route', 'fallback']), { valid: false, missing: ['fallback'] });
  assert.deepEqual(evidenceFreshness({ a: 'one', b: 'two' }, (path) => ({ a: 'one', b: 'changed' })[path] ?? null), { current: false, staleReasons: ['b:digest-changed'] });
});

test('runtime compiler emits a minimum policy contract without authored prose', () => {
  const workflow = { id: 'review', stage: 'review', ownerAgents: ['reviewer'], recommendedPacks: [], requiredInputs: ['SCOPE'], outputContract: 'review-v1', risk: 'none', permissionProfile: 'read' };
  const contract = compileRuntimeContract({ schemaVersion: 3, permissionProfiles: { read: { permissionPolicy: { workspaceWrite: 'denied' } } }, assistantEnforcement: { generic: 'advisory' } }, workflow);
  assert.equal(contract.id, 'review');
  assert.equal(contract.permissionPolicy.workspaceWrite, 'denied');
  assert.match(contract.authoredBehaviorReference, /nova-review/);
});
