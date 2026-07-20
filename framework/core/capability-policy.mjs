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
export const RUNTIME_EXECUTABLE_NAME_PATTERN_SOURCE = String.raw`^[A-Za-z0-9][A-Za-z0-9._+-]*$`;
export const RUNTIME_NETWORK_PURPOSE_PATTERN_SOURCE = String.raw`^(?=.*\S)[^\u0000-\u001F\u007F-\u009F\u2028\u2029]+$`;
const executableNamePattern = new RegExp(RUNTIME_EXECUTABLE_NAME_PATTERN_SOURCE, 'u');
const networkPurposePattern = new RegExp(RUNTIME_NETWORK_PURPOSE_PATTERN_SOURCE, 'u');

function hasExactOwnDataKeys(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))) return false;
  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && Object.hasOwn(descriptor, 'value');
  });
}

function isDenseDataArray(value) {
  if (!Array.isArray(value)) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1 || !Object.hasOwn(value, 'length')) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, 'value')) return false;
  }
  return ownKeys.every((key) => key === 'length'
    || (typeof key === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(key) && Number(key) < value.length));
}

export function isCapabilityGrantState(value) {
  return capabilityGrantStates.has(value);
}

/** Validate the shared runtime-requirements structure before any policy decision. */
export function assertRuntimeRequirements(runtime) {
  if (runtime === undefined) return;
  if (!hasExactOwnDataKeys(runtime, ['executables', 'network', 'credentials'])) {
    throw new TypeError('runtimeRequirements must be an object');
  }
  if (!isDenseDataArray(runtime.executables)) throw new TypeError('runtime executables must be an array');
  if (runtime.executables.some((entry) => (
    !hasExactOwnDataKeys(entry, ['name', 'required', 'versionEvidence'])
    || typeof entry.name !== 'string'
    || !executableNamePattern.test(entry.name)
    || typeof entry.required !== 'boolean'
    || !versionEvidenceStates.has(entry.versionEvidence)
  ))) {
    throw new TypeError('runtime executable entries are invalid');
  }
  const executableNames = runtime.executables.map((entry) => entry.name);
  if (new Set(executableNames).size !== executableNames.length) {
    throw new TypeError('runtime executable names must be unique');
  }
  const network = runtime.network;
  if (!hasExactOwnDataKeys(network, ['need', 'purpose'])
    || !runtimeNeedStates.has(network.need)
    || typeof network.purpose !== 'string'
    || !networkPurposePattern.test(network.purpose)) {
    throw new TypeError('runtime network requirement is invalid');
  }
  if ((network.need === 'none') !== (network.purpose === 'none')) {
    throw new TypeError('network need is none iff purpose is none');
  }
  const credentials = runtime.credentials;
  if (!hasExactOwnDataKeys(credentials, ['need', 'source']) || !runtimeNeedStates.has(credentials.need) || !credentialSources.has(credentials.source)) {
    throw new TypeError('runtime credentials requirement is invalid');
  }
  if ((credentials.need === 'none') !== (credentials.source === 'none')) {
    throw new TypeError('credential need is none iff source is none');
  }
}

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
  assertRuntimeRequirements(workflow.runtimeRequirements);
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
