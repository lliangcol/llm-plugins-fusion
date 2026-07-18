import { evaluateCapabilityPolicy, requiredCapabilities } from '../../framework/core/capability-policy.mjs';
import { behaviorInputType } from '../../framework/core/behavior-input-contract.mjs';

const enforcementDimensions = Object.freeze({
  inputs: new Set(['native', 'adapter', 'advisory', 'unsupported']),
  approval: new Set(['native', 'hook', 'adapter', 'advisory', 'unsupported']),
  output: new Set(['native', 'adapter', 'advisory', 'unsupported']),
  effects: new Set(['native-and-hook', 'adapter', 'advisory', 'unsupported']),
});
const executableEnforcement = new Set(['native', 'native-and-hook', 'hook', 'adapter']);
const adapterEnforcementLevels = new Set(['native-and-hook', 'adapter', 'advisory', 'unsupported']);
const fallbackLevels = new Set(['fail-closed', 'report-unsupported']);

function defaultContractEnforcement(adapter) {
  const level = adapter?.enforcement ?? 'unsupported';
  if (level === 'native-and-hook') return { inputs: 'adapter', approval: 'hook', output: 'adapter', effects: 'native-and-hook' };
  if (level === 'adapter') return { inputs: 'adapter', approval: 'adapter', output: 'adapter', effects: 'adapter' };
  return { inputs: 'advisory', approval: 'advisory', output: 'advisory', effects: 'advisory' };
}

function workflowInputs(contract) {
  const typed = Object.hasOwn(contract, 'inputs');
  const inputs = typed ? contract.inputs : contract.behaviorContract?.inputs;
  if (!Array.isArray(inputs)) throw new TypeError('workflow inputs must be an array');
  for (const input of inputs) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('workflow input must be an object');
    if (typed && input.type === undefined) throw new TypeError('typed workflow input must declare type');
    behaviorInputType(input);
  }
  return inputs;
}

function requiredEnforcementDimensions(contract, available, inputs) {
  const required = new Set(['inputs', 'output']);
  const capabilities = requiredCapabilities(contract, contract.permissionPolicy);
  if ((contract.effects ?? []).length > 0 || capabilities.length > 0) required.add('effects');
  if (inputs.some((input) => behaviorInputType(input) === 'approval')) required.add('approval');
  if (capabilities.some((capability) => {
    const authorization = contract.permissionPolicy?.[capability];
    const availability = available[capability];
    return authorization === 'prompt' || authorization === 'explicit' || availability === 'prompt' || availability === 'explicit';
  })) required.add('approval');
  return [...required];
}

function invalidEnforcementReason(enforcement, prefix) {
  for (const [dimension, allowed] of Object.entries(enforcementDimensions)) {
    if (!allowed.has(enforcement[dimension])) return `${prefix}:${dimension}`;
  }
  return null;
}

export function negotiateWorkflowSupport(compiled, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { status: 'unsupported', workflowId: undefined, adapterId: undefined, reasons: ['invalid-negotiation-options'] };
  }
  const { workflowId, adapterId, available = {}, approved = [], hostEnforcement = {} } = /** @type {any} */ (options);
  if (!Array.isArray(compiled?.runtimeContracts) || !Array.isArray(compiled?.adapters)) {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-compiled-bundle'] };
  }
  if (!available || typeof available !== 'object' || Array.isArray(available) || !Array.isArray(approved) || !hostEnforcement || typeof hostEnforcement !== 'object' || Array.isArray(hostEnforcement)) {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-negotiation-options'] };
  }
  const workflow = compiled.runtimeContracts.find((entry) => entry?.id === workflowId);
  if (!workflow) return { status: 'unsupported', workflowId, adapterId, reasons: ['unknown-workflow'] };
  const adapter = compiled.adapters.find((entry) => entry?.id === adapterId);
  if (!adapter) return { status: 'unsupported', workflowId, adapterId, reasons: ['unknown-adapter'] };

  if (!adapterEnforcementLevels.has(adapter.enforcement)) {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-adapter-enforcement'] };
  }
  if (adapter.enforcement === 'unsupported') {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['adapter-unsupported'] };
  }
  if (adapter.schemaVersion === 2 && adapter.contractEnforcement === undefined) {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-adapter-contract-enforcement'] };
  }
  if (adapter.contractEnforcement !== undefined) {
    if (!adapter.contractEnforcement || typeof adapter.contractEnforcement !== 'object' || Array.isArray(adapter.contractEnforcement)) {
      return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-adapter-contract-enforcement'] };
    }
    const invalidAdapterKey = Object.keys(adapter.contractEnforcement)
      .find((key) => key !== 'fallback' && !Object.hasOwn(enforcementDimensions, key));
    if (invalidAdapterKey || (adapter.contractEnforcement.fallback !== undefined && !fallbackLevels.has(adapter.contractEnforcement.fallback))) {
      return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-adapter-contract-enforcement'] };
    }
    if (adapter.schemaVersion === 2 && [...Object.keys(enforcementDimensions), 'fallback'].some((key) => !Object.hasOwn(adapter.contractEnforcement, key))) {
      return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-adapter-contract-enforcement'] };
    }
  }

  const invalidHostKey = Object.keys(hostEnforcement).find((key) => !Object.hasOwn(enforcementDimensions, key));
  if (invalidHostKey) return { status: 'unsupported', workflowId, adapterId, reasons: [`invalid-host-enforcement:${invalidHostKey}`] };
  const enforcement = { ...defaultContractEnforcement(adapter), ...(adapter.contractEnforcement ?? {}), ...hostEnforcement };
  const invalidEnforcement = invalidEnforcementReason(enforcement, 'invalid-enforcement');
  if (invalidEnforcement) return { status: 'unsupported', workflowId, adapterId, reasons: [invalidEnforcement], enforcement };
  let unenforced;
  let inputs;
  try {
    inputs = workflowInputs(workflow);
  } catch {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-workflow-input-contract'], enforcement };
  }
  try {
    unenforced = requiredEnforcementDimensions(workflow, available, inputs)
      .filter((dimension) => !executableEnforcement.has(enforcement[dimension]))
      .map((dimension) => `unenforced:${dimension}`);
  } catch {
    return { status: 'unsupported', workflowId, adapterId, reasons: ['invalid-workflow-capability-contract'], enforcement };
  }
  if (unenforced.length > 0) {
    return { status: 'unsupported', workflowId, adapterId, reasons: unenforced, enforcement };
  }

  const capability = evaluateCapabilityPolicy({ workflow, permissionPolicy: workflow.permissionPolicy, available, approved });
  if (capability.decision === 'fallback-unsupported-capability') {
    return { status: 'unsupported', workflowId, adapterId, reasons: capability.reasons, enforcement };
  }
  if (capability.decision === 'blocked-approval') {
    return { status: 'approval-required', workflowId, adapterId, reasons: capability.reasons, enforcement };
  }
  return { status: 'supported', workflowId, adapterId, reasons: [], enforcement };
}

export function testConformance(compiled) {
  const failures = [];
  if (compiled.runtimeContracts.length !== compiled.product.expectedWorkflowCount) failures.push('workflow-count-mismatch');
  if (new Set(compiled.runtimeContracts.map((entry) => entry.id)).size !== compiled.runtimeContracts.length) failures.push('duplicate-workflow-id');
  for (const contract of compiled.runtimeContracts) {
    if (!contract.behaviorContract || contract.behaviorContract.conflictPolicy !== 'fail-closed') failures.push(`${contract.id}:behavior-not-fail-closed`);
    if (!Array.isArray(contract.requiredInputs)) failures.push(`${contract.id}:required-inputs-missing`);
  }
  return { passed: failures.length === 0, failures, workflowCount: compiled.runtimeContracts.length };
}

export function evaluateBundle(compiled) {
  const conformance = testConformance(compiled);
  return { mode: 'deterministic-static-preview', taskSuccess: conformance.passed ? 1 : 0, safetyPassed: conformance.passed, workflowCoverage: compiled.product.expectedWorkflowCount ? conformance.workflowCount / compiled.product.expectedWorkflowCount : 0, claimBoundary: 'Static compiler/conformance evidence only; no assistant was invoked.' };
}
