/** Generic capability-policy evaluation with requirements separate from authorization. */
export const permissionStates = Object.freeze(['denied', 'prompt', 'preapproved', 'unsupported', 'explicit']);

const effectCapabilities = Object.freeze({
  'workspace-read': 'workspaceRead',
  'workspace-write': 'workspaceWrite',
  'artifact-write': 'workspaceWrite',
  shell: 'shell',
  network: 'network',
  credentials: 'credentials',
  'user-scope-mutation': 'userScopeMutation',
  'external-publish': 'externalPublish',
  'git-history-mutation': 'gitHistoryMutation',
});

const runtimeNeedStates = new Set(['none', 'optional', 'required']);
const capabilityGrantStates = new Set(['prompt', 'preapproved', 'explicit']);
const credentialSources = new Set(['none', 'assistant-owned-authentication', 'consumer-owned-authentication']);
const versionEvidenceStates = new Set(['none', 'versioned-evidence']);

function assertCapabilityRequirements(workflow, permissionPolicy) {
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    throw new TypeError('workflow must be an object');
  }
  if (!permissionPolicy || typeof permissionPolicy !== 'object' || Array.isArray(permissionPolicy)) {
    throw new TypeError('permissionPolicy must be an object');
  }
  if (workflow.effects !== undefined) {
    if (!Array.isArray(workflow.effects)) throw new TypeError('workflow effects must be an array');
    if (workflow.effects.some((effect) => !Object.hasOwn(effectCapabilities, effect))) {
      throw new TypeError('workflow effects contain an unknown value');
    }
  }
  const runtime = workflow.runtimeRequirements;
  if (runtime === undefined) return;
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    throw new TypeError('runtimeRequirements must be an object');
  }
  if (!Array.isArray(runtime.executables)) throw new TypeError('runtime executables must be an array');
  if (runtime.executables.some((entry) => (
    !entry
    || typeof entry !== 'object'
    || Array.isArray(entry)
    || typeof entry.name !== 'string'
    || entry.name.length === 0
    || typeof entry.required !== 'boolean'
    || !versionEvidenceStates.has(entry.versionEvidence)
  ))) {
    throw new TypeError('runtime executable entries are invalid');
  }
  const network = runtime.network;
  if (!network || typeof network !== 'object' || Array.isArray(network) || !runtimeNeedStates.has(network.need) || typeof network.purpose !== 'string') {
    throw new TypeError('runtime network requirement is invalid');
  }
  const credentials = runtime.credentials;
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials) || !runtimeNeedStates.has(credentials.need) || !credentialSources.has(credentials.source)) {
    throw new TypeError('runtime credentials requirement is invalid');
  }
}

export function requiredCapabilities(workflow, permissionPolicy = {}) {
  assertCapabilityRequirements(workflow, permissionPolicy);
  const required = new Set();
  const effects = workflow.effects;
  for (const effect of effects ?? []) {
    const capability = effectCapabilities[effect];
    if (capability) required.add(capability);
  }
  // V5 contracts did not declare effects, so retain their write requirement.
  // For V6, effects are authoritative and authorization alone is not a need.
  const legacyWriteAuthorization = Object.hasOwn(permissionPolicy, 'workspaceWrite') ? permissionPolicy.workspaceWrite : 'unsupported';
  if (!Array.isArray(effects) && capabilityGrantStates.has(legacyWriteAuthorization)) required.add('workspaceWrite');
  if (workflow.runtimeRequirements?.executables?.some((entry) => entry.required)) required.add('shell');
  if (workflow.runtimeRequirements?.network?.need === 'required') required.add('network');
  if (workflow.runtimeRequirements?.credentials?.need === 'required') required.add('credentials');
  return [...required];
}

export function evaluateCapabilityPolicy(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { decision: 'fallback-unsupported-capability', reasons: ['invalid-capability-policy-input'] };
  }
  const { workflow, permissionPolicy, available = {}, approved = [] } = /** @type {any} */ (options);
  if (!available || typeof available !== 'object' || Array.isArray(available) || !Array.isArray(approved)) {
    return { decision: 'fallback-unsupported-capability', reasons: ['invalid-capability-policy-input'] };
  }
  let capabilities;
  try {
    capabilities = requiredCapabilities(workflow, permissionPolicy);
  } catch {
    return { decision: 'fallback-unsupported-capability', reasons: ['invalid-workflow-capability-contract'] };
  }
  for (const capability of capabilities) {
    const authorization = Object.hasOwn(permissionPolicy, capability) ? permissionPolicy[capability] : 'unsupported';
    const availability = Object.hasOwn(available, capability) ? available[capability] : 'unsupported';
    if (!permissionStates.includes(authorization) || !permissionStates.includes(availability)) {
      return { decision: 'fallback-unsupported-capability', reasons: [capability] };
    }
    if (authorization === 'unsupported' || authorization === 'denied' || availability === 'unsupported' || availability === 'denied') {
      return { decision: 'fallback-unsupported-capability', reasons: [capability] };
    }
    if ((authorization === 'prompt' || authorization === 'explicit' || availability === 'prompt' || availability === 'explicit') && !approved.includes(capability)) {
      return { decision: 'blocked-approval', reasons: [capability] };
    }
  }
  return { decision: 'ready', reasons: [] };
}
