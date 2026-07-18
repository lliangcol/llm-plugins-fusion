import { isDeepStrictEqual } from 'node:util';

export const CURRENT_PROTOCOL_VERSIONS = Object.freeze({
  framework: '5.0.0',
  workflow: '6.0.0',
  runtime: '4.0.0',
  adapter: '3.0.0',
  compatibilityProjection: '5.0.0',
});

const ADAPTER_PROTOCOL_KEYS = Object.freeze(['workflow', 'runtime', 'adapter']);
const ADAPTER_CONTRACT_KEYS = Object.freeze(['inputs', 'approval', 'output', 'effects', 'fallback']);
const ADAPTER_CONTRACT_VALUES = Object.freeze({
  inputs: new Set(['native', 'adapter', 'advisory', 'unsupported']),
  approval: new Set(['native', 'hook', 'adapter', 'advisory', 'unsupported']),
  output: new Set(['native', 'adapter', 'advisory', 'unsupported']),
  effects: new Set(['native-and-hook', 'adapter', 'advisory', 'unsupported']),
  fallback: new Set(['fail-closed', 'report-unsupported']),
});
const EVIDENCE_LEVELS = Object.freeze(['L1', 'L2', 'L3', 'L4']);

function vocabulary(framework, key) {
  return new Set(Array.isArray(framework?.[key]) ? framework[key] : []);
}

function protocolValueMatchesMajor(value, major) {
  return typeof value === 'string' && new RegExp(`^${major}\\.`).test(value);
}

function predicateNodes(predicate, nodes = []) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return nodes;
  nodes.push(predicate);
  if (Array.isArray(predicate.args)) for (const child of predicate.args) predicateNodes(child, nodes);
  if (predicate.arg) predicateNodes(predicate.arg, nodes);
  return nodes;
}

function validateAdapterLevelContract(adapter, id, failures) {
  const declaredIndex = EVIDENCE_LEVELS.indexOf(adapter?.declaredLevel);
  const maximumIndex = EVIDENCE_LEVELS.indexOf(adapter?.maximumSupportedLevel);
  if (declaredIndex < 0) failures.push(`${id}: declaredLevel must be one of ${EVIDENCE_LEVELS.join(', ')}`);
  if (maximumIndex < 0) failures.push(`${id}: maximumSupportedLevel must be one of ${EVIDENCE_LEVELS.join(', ')}`);
  if (declaredIndex < 0 || maximumIndex < 0) return;
  if (declaredIndex > maximumIndex) {
    failures.push(`${id}: declaredLevel must not exceed maximumSupportedLevel`);
    return;
  }
  const expected = EVIDENCE_LEVELS.slice(declaredIndex + 1, maximumIndex + 1);
  if (!isDeepStrictEqual(adapter.evidenceRequiredFor, expected)) {
    failures.push(`${id}: evidenceRequiredFor must exactly equal ${JSON.stringify(expected)} for ${adapter.declaredLevel} through ${adapter.maximumSupportedLevel}`);
  }
}

function validateAdapterContract(adapter, id, failures) {
  const contract = adapter?.contractEnforcement;
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    failures.push(`${id}: adapter schema v2 requires contractEnforcement`);
    return;
  }
  const actualKeys = Object.keys(contract).sort();
  const expectedKeys = [...ADAPTER_CONTRACT_KEYS].sort();
  if (!isDeepStrictEqual(actualKeys, expectedKeys)) {
    failures.push(`${id}: contractEnforcement must contain exactly ${ADAPTER_CONTRACT_KEYS.join(', ')}`);
    return;
  }
  for (const key of ADAPTER_CONTRACT_KEYS) {
    if (!ADAPTER_CONTRACT_VALUES[key].has(contract[key])) {
      failures.push(`${id}: contractEnforcement.${key} has unsupported value ${String(contract[key])}`);
    }
  }
}

function validateVocabularyBindings(bundle, failures) {
  const permissionStates = vocabulary(bundle.framework, 'permissionStates');
  const permissionPolicyKeys = vocabulary(bundle.framework, 'permissionPolicyKeys');
  const riskLevels = vocabulary(bundle.framework, 'riskLevels');
  const runtimeNeedLevels = vocabulary(bundle.framework, 'runtimeNeedLevels');
  const credentialSources = vocabulary(bundle.framework, 'credentialSources');
  const enforcementLevels = vocabulary(bundle.framework, 'enforcementLevels');

  for (const [profileId, profile] of Object.entries(bundle.workflows?.permissionProfiles ?? {})) {
    for (const [key, state] of Object.entries(profile?.permissionPolicy ?? {})) {
      if (!permissionPolicyKeys.has(key)) failures.push(`permission profile ${profileId} uses permission key ${key} outside framework.permissionPolicyKeys`);
      if (!permissionStates.has(state)) failures.push(`permission profile ${profileId} uses permission state ${state} outside framework.permissionStates`);
    }
  }
  for (const workflow of bundle.workflows?.workflows ?? []) {
    const id = workflow?.id ?? 'unknown-workflow';
    if (!riskLevels.has(workflow?.risk)) failures.push(`${id}: risk ${workflow?.risk ?? 'missing'} is outside framework.riskLevels`);
    if (workflow?.runtimeRequirements) {
      const networkNeed = workflow.runtimeRequirements.network?.need;
      const credentialNeed = workflow.runtimeRequirements.credentials?.need;
      const credentialSource = workflow.runtimeRequirements.credentials?.source;
      if (!runtimeNeedLevels.has(networkNeed)) failures.push(`${id}: network need ${networkNeed ?? 'missing'} is outside framework.runtimeNeedLevels`);
      if (!runtimeNeedLevels.has(credentialNeed)) failures.push(`${id}: credential need ${credentialNeed ?? 'missing'} is outside framework.runtimeNeedLevels`);
      if (!credentialSources.has(credentialSource)) failures.push(`${id}: credential source ${credentialSource ?? 'missing'} is outside framework.credentialSources`);
    }
  }
  for (const behavior of bundle.behaviors?.behaviors ?? []) {
    const id = behavior?.id ?? 'unknown-behavior';
    for (const [index, decision] of (behavior?.decisionTable ?? []).entries()) {
      const predicate = decision?.predicate ?? (typeof decision?.when === 'object' ? decision.when : null);
      for (const node of predicateNodes(predicate)) {
        if (node.op !== 'capability-state') continue;
        if (!permissionPolicyKeys.has(node.capability)) {
          failures.push(`${id}: decision ${index} predicate uses unknown framework capability ${String(node.capability)}`);
        }
        if (!permissionStates.has(node.state)) {
          failures.push(`${id}: decision ${index} predicate uses unknown framework permission state ${String(node.state)}`);
        }
      }
    }
  }
  for (const adapter of bundle.adapters ?? []) {
    const id = adapter?.id ?? 'unknown-adapter';
    if (!enforcementLevels.has(adapter?.enforcement)) {
      failures.push(`${id}: enforcement ${adapter?.enforcement ?? 'missing'} is outside framework.enforcementLevels`);
    }
  }
}

/**
 * Validate the supported framework/workflow/behavior/adapter protocol lanes and
 * bind framework vocabularies to the values consumed by the product bundle.
 * This function is pure and intentionally independent of JSON Schema tooling.
 * @param {{ framework?: any, workflows?: any, behaviors?: any, adapters?: any[] }} bundle
 * @returns {string[]}
 */
export function validateProductProtocolCoherence(bundle = {}) {
  const failures = [];
  const frameworkVersion = bundle.framework?.schemaVersion;
  const workflowVersion = bundle.workflows?.schemaVersion;
  const behaviorVersion = bundle.behaviors?.schemaVersion;
  const adapters = Array.isArray(bundle.adapters) ? bundle.adapters : [];

  if (![4, 5].includes(frameworkVersion)) failures.push(`unsupported framework schema version ${frameworkVersion ?? 'missing'}`);
  if (![5, 6].includes(workflowVersion)) failures.push(`unsupported workflow schema version ${workflowVersion ?? 'missing'}`);
  const expectedBehaviorVersion = workflowVersion === 5 ? 1 : workflowVersion === 6 ? 2 : null;
  if (expectedBehaviorVersion !== null && behaviorVersion !== expectedBehaviorVersion) {
    failures.push(`workflow schema v${workflowVersion} requires behavior schema v${expectedBehaviorVersion}`);
  }

  if (frameworkVersion === 4) {
    if (workflowVersion !== 5) failures.push('framework schema v4 requires workflow schema v5');
    if (bundle.framework?.protocolVersions !== undefined) failures.push('framework schema v4 forbids protocolVersions');
  }
  if (frameworkVersion === 5) {
    if (!isDeepStrictEqual(bundle.framework?.protocolVersions, CURRENT_PROTOCOL_VERSIONS)) {
      failures.push('framework schema v5 protocolVersions must equal the current framework protocol tuple');
    }
    if (workflowVersion === 5
      && bundle.framework?.protocolVersions?.compatibilityProjection !== bundle.workflows?.contractVersions?.workflow) {
      failures.push('framework protocolVersions.compatibilityProjection must equal the v5 workflow contract version');
    }
    if (workflowVersion === 6) {
      if (!isDeepStrictEqual(bundle.framework?.protocolVersions, bundle.workflows?.contractVersions)) {
        failures.push('workflow schema v6 contractVersions must exactly equal framework protocolVersions');
      }
      for (const key of Object.keys(CURRENT_PROTOCOL_VERSIONS)) {
        if (bundle.framework?.protocolVersions?.[key] !== bundle.workflows?.contractVersions?.[key]) {
          failures.push(`framework protocolVersions.${key} must equal workflow contractVersions.${key}`);
        }
      }
    }
  }

  const expectedWorkflowTuple = workflowVersion === 5
    ? { workflow: 5, runtime: 3, adapter: 2 }
    : workflowVersion === 6
      ? { framework: 5, workflow: 6, runtime: 4, adapter: 3, compatibilityProjection: 5 }
      : {};
  for (const [key, major] of Object.entries(expectedWorkflowTuple)) {
    if (!protocolValueMatchesMajor(bundle.workflows?.contractVersions?.[key], major)) {
      failures.push(`workflow schema v${workflowVersion} requires contractVersions.${key} major ${major}`);
    }
  }

  const expectedAdapterVersion = frameworkVersion === 4 ? 1 : frameworkVersion === 5 ? 2 : null;
  for (const adapter of adapters) {
    const id = adapter?.id ?? 'unknown-adapter';
    if (expectedAdapterVersion !== null && adapter?.schemaVersion !== expectedAdapterVersion) {
      failures.push(`${id}: framework schema v${frameworkVersion} requires adapter schema v${expectedAdapterVersion}`);
    }
    if (adapter?.schemaVersion === 1) {
      if (adapter.protocolVersions !== undefined) failures.push(`${id}: adapter schema v1 forbids protocolVersions`);
      if (adapter.contractEnforcement !== undefined) failures.push(`${id}: adapter schema v1 forbids contractEnforcement`);
    }
    if (adapter?.schemaVersion === 2) {
      const protocolKeys = Object.keys(adapter?.protocolVersions ?? {}).sort();
      if (!isDeepStrictEqual(protocolKeys, [...ADAPTER_PROTOCOL_KEYS].sort())) {
        failures.push(`${id}: adapter protocolVersions must contain exactly ${ADAPTER_PROTOCOL_KEYS.join(', ')}`);
      }
      for (const key of ADAPTER_PROTOCOL_KEYS) {
        if (adapter?.protocolVersions?.[key] !== bundle.framework?.protocolVersions?.[key]) {
          failures.push(`${id}: adapter protocolVersions.${key} must equal framework protocolVersions.${key}`);
        }
      }
      validateAdapterContract(adapter, id, failures);
    }
    validateAdapterLevelContract(adapter, id, failures);
  }

  validateVocabularyBindings(bundle, failures);
  return failures;
}

/** @param {{ framework?: any, workflows?: any, behaviors?: any, adapters?: any[] }} bundle */
export function assertProductProtocolCoherence(bundle) {
  const failures = validateProductProtocolCoherence(bundle);
  if (failures.length > 0) throw new Error(`product protocol coherence failed:\n- ${failures.join('\n- ')}`);
}
