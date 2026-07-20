import { isDeepStrictEqual } from 'node:util';
import {
  behaviorInputType,
  PATH_LIKE_INPUT_TYPES,
  validateBehaviorInputDefinition,
  validateBehaviorPredicateInputs,
} from '../core/behavior-input-contract.mjs';
import { assertRuntimeRequirements, isCapabilityGrantState } from '../core/capability-policy.mjs';
import { semverMajor } from '../core/semver.mjs';
import { ownRecordValue } from '../core/own-record.mjs';
import { assertPortableWorkflowContractPath } from '../io/portable-path.mjs';

export { behaviorInputType };

const APPROVAL_POLICY_KEYS = ['mustBeExplicit', 'mayInfer', 'scope', 'oneShot', 'expires'];
const TYPED_INPUT_KEYS = ['name', 'required', 'type', 'values', 'pathPolicy', 'approvalPolicy'];
export const CONTRACT_EVIDENCE_REQUIREMENTS = Object.freeze([
  'authorization-decision',
  'effects-observed',
  'validation-result',
]);
export const CONTRACT_EFFECT_CAPABILITIES = Object.freeze({
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

const CONTRACT_VERSION_MAJORS = Object.freeze({
  5: Object.freeze({ workflow: 5, runtime: 3, adapter: 2 }),
  6: Object.freeze({ framework: 5, workflow: 6, runtime: 4, adapter: 3, compatibilityProjection: 5 }),
});
const CONTRACT_AUTHORIZATION_DENIALS = new Set(['denied', 'unsupported']);

function contractVersionHasMajor(value, expectedMajor) {
  return semverMajor(value) === expectedMajor;
}

export function expectedEnforcementRequirements(effects) {
  if (!Array.isArray(effects)) throw new TypeError('effects must be an array');
  return effects.map((effect) => `enforce:${effect}`);
}

function sameOrderedValues(left, right) {
  return Array.isArray(left) && Array.isArray(right) && isDeepStrictEqual(left, right);
}

function sameValueInventory(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const leftValues = new Set(left);
  const rightValues = new Set(right);
  if (leftValues.size !== left.length || rightValues.size !== right.length) return false;
  return leftValues.size === rightValues.size && [...leftValues].every((value) => rightValues.has(value));
}

function hasSameProjectedField(actual, expected, key) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.hasOwn(actual, key) === Object.hasOwn(expected, key)
    && isDeepStrictEqual(actual[key], expected[key]);
}

export function projectTypedInput(input) {
  const type = validateBehaviorInputDefinition(input);
  const result = { name: input.name, type, required: input.required };
  if (type === 'enum') {
    if (!Array.isArray(input.exactValues) || input.exactValues.length === 0) {
      throw new Error(`${input.name}: enum behavior input requires exactValues`);
    }
    result.values = structuredClone(input.exactValues);
  }
  if (['path', 'artifact-reference', 'review-reference'].includes(type)) {
    if (!input.pathPolicy) throw new Error(`${input.name}: typed path input requires pathPolicy`);
    result.pathPolicy = structuredClone(input.pathPolicy);
  } else if (input.pathPolicy) throw new Error(`${input.name}: pathPolicy requires a path-like input type`);
  if (type === 'approval') {
    result.approvalPolicy = {
      mustBeExplicit: true,
      mayInfer: false,
      scope: input.name,
      oneShot: true,
      expires: null,
    };
  }
  return result;
}

/** Validate canonical and alias identities for one v1/v2 behavior input set. */
export function validateBehaviorInputIdentities(behavior) {
  if (!Array.isArray(behavior?.inputs) || behavior.inputs.length === 0) {
    throw new Error(`${behavior?.id ?? 'behavior'}: inputs must be a non-empty array`);
  }
  const canonicalNames = [];
  for (const input of behavior.inputs) {
    projectTypedInput(input);
    if (!Array.isArray(input.aliases)) throw new Error(`${behavior.id}.${input.name}: aliases must be an array`);
    if (input.aliases.some((alias) => typeof alias !== 'string' || alias.length === 0)) {
      throw new Error(`${behavior.id}.${input.name}: aliases must contain only non-empty strings`);
    }
    canonicalNames.push(input.name);
  }
  const duplicateCanonicalNames = canonicalNames
    .filter((name, index) => canonicalNames.indexOf(name) !== index);
  if (duplicateCanonicalNames.length > 0) {
    throw new Error(`${behavior.id}: behavior input names must be unique: ${[...new Set(duplicateCanonicalNames)].sort().join(', ')}`);
  }
  const canonicalNameSet = new Set(canonicalNames);
  const aliasOwners = new Map();
  for (const input of behavior.inputs) {
    for (const alias of input.aliases) {
      if (canonicalNameSet.has(alias)) {
        throw new Error(`${behavior.id}: behavior input alias ${alias} conflicts with a canonical input name`);
      }
      const existingOwner = aliasOwners.get(alias);
      if (existingOwner) {
        throw new Error(`${behavior.id}: behavior input alias ${alias} is shared by ${existingOwner} and ${input.name}`);
      }
      aliasOwners.set(alias, input.name);
    }
  }
}

/** Validate behavior structures whose cross-item identity cannot be expressed by JSON Schema. */
export function validateBehaviorContractStructure(behavior, schemaVersion) {
  if (!behavior || typeof behavior !== 'object' || Array.isArray(behavior)) {
    throw new Error('behavior must be an object');
  }
  if (typeof behavior.id !== 'string' || behavior.id.length === 0) {
    throw new Error('behavior id must be a non-empty string');
  }
  validateBehaviorInputIdentities(behavior);
  if (schemaVersion === 1 && Object.hasOwn(behavior, 'effects')) {
    throw new Error(`${behavior.id}: behavior schema v1 must not declare effects`);
  }
  if (schemaVersion === 2 && !Array.isArray(behavior.effects)) {
    throw new Error(`${behavior.id}: behavior schema v2 effects must be an array`);
  }

  if (!Array.isArray(behavior.workflowSteps) || behavior.workflowSteps.length === 0) {
    throw new Error(`${behavior.id}: workflowSteps must be a non-empty array`);
  }
  const workflowStepIds = behavior.workflowSteps.map((step) => step?.id);
  if (workflowStepIds.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new Error(`${behavior.id}: workflowSteps ids must be non-empty strings`);
  }
  if (new Set(workflowStepIds).size !== workflowStepIds.length) {
    throw new Error(`${behavior.id}: workflowSteps ids must be unique`);
  }

  if (!Array.isArray(behavior.decisionTable) || behavior.decisionTable.length === 0) {
    throw new Error(`${behavior.id}: decisionTable must be a non-empty array`);
  }
  const inputsByName = new Map(behavior.inputs.map((input) => [input.name, input]));
  for (const [index, decision] of behavior.decisionTable.entries()) {
    if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
      throw new Error(`${behavior.id}: decision ${index} must be an object`);
    }
    const predicate = decision.predicate ?? (typeof decision.when === 'object' ? decision.when : null);
    if (predicate) validateBehaviorPredicateInputs(predicate, inputsByName, behavior.id);
  }

  const outputFields = behavior.output?.fields;
  const outputOrder = behavior.output?.order;
  if (!Array.isArray(outputFields) || outputFields.length === 0) {
    throw new Error(`${behavior.id}: output fields must be a non-empty array`);
  }
  const outputFieldNames = outputFields.map((field) => field?.name);
  if (outputFieldNames.some((name) => typeof name !== 'string' || name.length === 0)) {
    throw new Error(`${behavior.id}: output field names must be non-empty strings`);
  }
  if (new Set(outputFieldNames).size !== outputFieldNames.length) {
    throw new Error(`${behavior.id}: output field names must be unique`);
  }
  if (!sameValueInventory(outputOrder, outputFieldNames)) {
    throw new Error(`${behavior.id}: output order must exactly match the output field inventory`);
  }

  const failureFields = behavior.failureOutput?.fields;
  const failureOrder = behavior.failureOutput?.order;
  if (!Array.isArray(failureFields) || failureFields.length === 0) {
    throw new Error(`${behavior.id}: failureOutput fields must be a non-empty array`);
  }
  if (failureFields.some((name) => typeof name !== 'string' || name.length === 0)) {
    throw new Error(`${behavior.id}: failureOutput fields must contain only non-empty strings`);
  }
  if (new Set(failureFields).size !== failureFields.length) {
    throw new Error(`${behavior.id}: failureOutput fields must be unique`);
  }
  if (!sameValueInventory(failureOrder, failureFields)) {
    throw new Error(`${behavior.id}: failureOutput order must exactly match the failure field inventory`);
  }
}

/**
 * Validate the cross-domain input contract without filesystem or process access.
 * Contract v5/v1 keeps its required-input compatibility check. Contract v6/v2
 * additionally requires the typed projection to remain an exact projection of
 * behavior inputs and the v5 compatibility-required list.
 * @param {{ schemaVersion?: number, contractVersions?: Record<string, string>, permissionProfiles?: Record<string, any>, workflows?: any[] }} workflowSpec
 * @param {{ schemaVersion?: number, behaviors?: any[] }} behaviorSpec
 * @returns {string[]}
 */
export function validateContractCoherence(workflowSpec, behaviorSpec) {
  const failures = [];
  const expectedContractVersions = CONTRACT_VERSION_MAJORS[workflowSpec?.schemaVersion];
  if (expectedContractVersions) {
    for (const [name, major] of Object.entries(expectedContractVersions)) {
      const actual = workflowSpec?.contractVersions?.[name];
      if (!contractVersionHasMajor(actual, major)) {
        failures.push(`workflow schema v${workflowSpec.schemaVersion} requires contractVersions.${name} major ${major}`);
      }
    }
  }
  const expectedBehaviorSchemaVersion = workflowSpec?.schemaVersion === 6
    ? 2
    : workflowSpec?.schemaVersion === 5 ? 1 : null;
  if (expectedBehaviorSchemaVersion !== null && behaviorSpec?.schemaVersion !== expectedBehaviorSchemaVersion) {
    failures.push(`workflow schema v${workflowSpec.schemaVersion} requires behavior schema v${expectedBehaviorSchemaVersion}`);
  }
  if (!Array.isArray(workflowSpec?.workflows)) failures.push('workflow spec workflows must be an array');
  if (!Array.isArray(behaviorSpec?.behaviors)) failures.push('behavior spec behaviors must be an array');
  const workflows = Array.isArray(workflowSpec?.workflows) ? workflowSpec.workflows : [];
  const behaviors = Array.isArray(behaviorSpec?.behaviors) ? behaviorSpec.behaviors : [];
  const workflowIds = workflows.map((workflow) => workflow?.id);
  const behaviorIds = behaviors.map((behavior) => behavior?.id);
  for (const [index, id] of workflowIds.entries()) {
    if (typeof id !== 'string' || id.length === 0) failures.push(`workflow at index ${index} must declare a non-empty id`);
  }
  for (const [index, id] of behaviorIds.entries()) {
    if (typeof id !== 'string' || id.length === 0) failures.push(`behavior at index ${index} must declare a non-empty id`);
  }
  const duplicateWorkflowIds = workflowIds
    .filter((id, index) => typeof id === 'string' && workflowIds.indexOf(id) !== index);
  if (duplicateWorkflowIds.length > 0) {
    failures.push(`workflow ids must be unique: ${[...new Set(duplicateWorkflowIds)].sort().join(', ')}`);
  }
  const duplicateBehaviorIds = behaviorIds
    .filter((id, index) => typeof id === 'string' && behaviorIds.indexOf(id) !== index);
  if (duplicateBehaviorIds.length > 0) {
    failures.push(`behavior ids must be unique: ${[...new Set(duplicateBehaviorIds)].sort().join(', ')}`);
  }
  const workflowIdSet = new Set(workflowIds.filter((id) => typeof id === 'string' && id.length > 0));
  const behaviorIdSet = new Set(behaviorIds.filter((id) => typeof id === 'string' && id.length > 0));
  const missingBehaviorIds = [...workflowIdSet].filter((id) => !behaviorIdSet.has(id)).sort();
  if (missingBehaviorIds.length > 0) failures.push(`workflows without behaviors: ${missingBehaviorIds.join(', ')}`);
  const orphanBehaviorIds = [...behaviorIdSet].filter((id) => !workflowIdSet.has(id)).sort();
  if (orphanBehaviorIds.length > 0) failures.push(`behaviors without workflows: ${orphanBehaviorIds.join(', ')}`);

  const invalidBehaviors = new WeakSet();
  for (const behavior of behaviors) {
    if (!behavior || typeof behavior !== 'object' || Array.isArray(behavior)) {
      failures.push('behavior must be an object');
      continue;
    }
    try {
      validateBehaviorContractStructure(behavior, behaviorSpec?.schemaVersion);
    } catch (error) {
      failures.push(error.message);
      invalidBehaviors.add(behavior);
    }
  }
  const behaviorById = new Map(behaviors.map((behavior) => [behavior?.id, behavior]));

  for (const workflow of workflows) {
    const behavior = behaviorById.get(workflow?.id);
    if (!behavior || invalidBehaviors.has(behavior)) continue;
    if (!Array.isArray(behavior.inputs)) {
      failures.push(`${workflow.id}: behavior inputs must be an array`);
      continue;
    }

    const behaviorRequired = behavior.inputs.filter((input) => input.required).map((input) => input.name);
    const compatibilityRequired = workflowSpec.schemaVersion === 6
      ? workflow.compatibilityProjection?.requiredInputs
      : workflow.requiredInputs;
    if (!sameOrderedValues(behaviorRequired, compatibilityRequired)) {
      failures.push(`${workflow.id}: behavior required inputs differ from workflow policy`);
    }

    try {
      assertPortableWorkflowContractPath(workflow.contractPath, `${workflow.id}.contractPath`);
    } catch (error) {
      failures.push(error.message);
    }

    const pathInputs = behavior.inputs.filter((input) => PATH_LIKE_INPUT_TYPES.includes(behaviorInputType(input)));
    const sourceProfile = ownRecordValue(workflowSpec.permissionProfiles, workflow.permissionProfile);
    if (sourceProfile) {
      for (const input of pathInputs) {
        for (const [pathPermission, capability] of [
          ['readable', 'workspaceRead'],
          ['writable', 'workspaceWrite'],
        ]) {
          if (input.pathPolicy?.[pathPermission] !== true) continue;
          const authorization = sourceProfile.permissionPolicy?.[capability];
          if (!isCapabilityGrantState(authorization)) {
            failures.push(`${workflow.id}.${input.name}: ${pathPermission} path input requires ${capability} authorization, got ${authorization ?? 'missing'}`);
          }
        }
      }
    }

    const runtimeRequirements = workflow.runtimeRequirements ?? {
      executables: [],
      network: { need: 'none', purpose: 'none' },
      credentials: { need: 'none', source: 'none' },
    };
    try {
      assertRuntimeRequirements(runtimeRequirements);
    } catch (error) {
      failures.push(`${workflow.id}: ${error.message}`);
    }

    if (workflowSpec.schemaVersion !== 6) continue;

    const workflowEffects = Array.isArray(workflow.effects) ? workflow.effects : [];
    if (!Array.isArray(workflow.effects)) {
      failures.push(`${workflow.id}: effects must be an array`);
    } else if (workflow.effects.length === 0) {
      failures.push(`${workflow.id}: effects must declare at least one governed capability`);
    }
    for (const input of pathInputs) {
      if (input.pathPolicy?.readable === true && !workflowEffects.includes('workspace-read')) {
        failures.push(`${workflow.id}.${input.name}: readable path input requires workspace-read effect`);
      }
      if (input.pathPolicy?.writable === true) {
        const expectedEffect = input.pathPolicy.root === 'artifact-root' ? 'artifact-write' : 'workspace-write';
        if (!workflowEffects.includes(expectedEffect)) {
          failures.push(`${workflow.id}.${input.name}: writable ${input.pathPolicy.root} path input requires ${expectedEffect} effect`);
        }
      }
    }

    if (workflow.authorizationProfile !== workflow.permissionProfile) {
      failures.push(`${workflow.id}: authorizationProfile must equal permissionProfile`);
    }
    if (workflow.compatibilityProjection?.permissionProfile !== workflow.permissionProfile) {
      failures.push(`${workflow.id}: compatibility permission profile must equal permissionProfile`);
    }
    if (workflow.compatibilityProjection?.sourceVersion !== 5) {
      failures.push(`${workflow.id}: compatibility projection sourceVersion must be 5`);
    }

    const profile = ownRecordValue(workflowSpec.permissionProfiles, workflow.authorizationProfile);
    if (!profile) {
      failures.push(`${workflow.id}: unknown authorization profile ${workflow.authorizationProfile}`);
    } else {
      const declaredCapabilities = new Set(workflowEffects
        .map((effect) => CONTRACT_EFFECT_CAPABILITIES[effect])
        .filter(Boolean));
      for (const effect of workflowEffects) {
        const capability = CONTRACT_EFFECT_CAPABILITIES[effect];
        if (!capability) {
          failures.push(`${workflow.id}: unknown effect ${effect}`);
          continue;
        }
        const authorization = profile.permissionPolicy?.[capability];
        if (!isCapabilityGrantState(authorization)) {
          failures.push(`${workflow.id}: effect ${effect} requires unavailable authorization ${capability}:${authorization ?? 'missing'}`);
        }
      }
      for (const [capability, authorization] of Object.entries(profile.permissionPolicy ?? {})) {
        if (CONTRACT_AUTHORIZATION_DENIALS.has(authorization)) continue;
        if (!isCapabilityGrantState(authorization)) {
          failures.push(`${workflow.id}: authorization ${capability} has invalid state ${authorization}`);
        } else if (!declaredCapabilities.has(capability)) {
          failures.push(`${workflow.id}: authorized capability ${capability}:${authorization} is not declared by workflow effects`);
        }
      }
    }
    const expectedEnforcement = expectedEnforcementRequirements(workflowEffects);
    if (!sameOrderedValues(workflow.enforcementRequirements, expectedEnforcement)) {
      failures.push(`${workflow.id}: enforcement requirements must exactly match declared effects`);
    }
    if (!sameOrderedValues(workflow.evidenceRequirements, CONTRACT_EVIDENCE_REQUIREMENTS)) {
      failures.push(`${workflow.id}: evidence requirements must exactly match the governed baseline`);
    }

    if (!Array.isArray(behavior.effects)) {
      failures.push(`${workflow.id}: behavior effects must be an array`);
    } else {
      for (const effect of behavior.effects) {
        if (!CONTRACT_EFFECT_CAPABILITIES[effect]) failures.push(`${workflow.id}: unknown behavior effect ${effect}`);
        else if (!workflowEffects.includes(effect)) failures.push(`${workflow.id}: behavior effect ${effect} is not declared by the workflow contract`);
      }
    }

    if (Array.isArray(runtimeRequirements.executables)
      && runtimeRequirements.executables.length > 0
      && !workflowEffects.includes('shell')) {
      failures.push(`${workflow.id}: executable runtime requirements require the shell effect`);
    }
    if (runtimeRequirements.network?.need !== undefined
      && runtimeRequirements.network.need !== 'none'
      && !workflowEffects.includes('network')) {
      failures.push(`${workflow.id}: ${runtimeRequirements.network.need} network runtime requirements require the network effect`);
    }
    if (runtimeRequirements.credentials?.need !== undefined
      && runtimeRequirements.credentials.need !== 'none'
      && !workflowEffects.includes('credentials')) {
      failures.push(`${workflow.id}: ${runtimeRequirements.credentials.need} credential runtime requirements require the credentials effect`);
    }

    if (!sameOrderedValues(workflow.requiredInputs, compatibilityRequired)) {
      failures.push(`${workflow.id}: compatibility required inputs differ from legacy workflow policy`);
    }
    if (!Array.isArray(workflow.inputs)) {
      failures.push(`${workflow.id}: Contract v6 typed inputs must be an array`);
      continue;
    }

    const behaviorNames = behavior.inputs.map((input) => input?.name);
    const typedNames = workflow.inputs.map((input) => input?.name);
    if (!sameOrderedValues(typedNames, behaviorNames)) {
      failures.push(`${workflow.id}: typed input names or order differ from behavior inputs`);
      continue;
    }
    if (new Set(typedNames).size !== typedNames.length) {
      failures.push(`${workflow.id}: typed input names must be unique`);
    }

    const typedRequired = workflow.inputs.filter((input) => input.required).map((input) => input.name);
    if (!sameOrderedValues(typedRequired, compatibilityRequired)) {
      failures.push(`${workflow.id}: typed required inputs differ from compatibility policy`);
    }

    for (const [index, behaviorInput] of behavior.inputs.entries()) {
      const typedInput = workflow.inputs[index];
      if (!typedInput || typeof typedInput !== 'object' || Array.isArray(typedInput)) {
        failures.push(`${workflow.id}.${behaviorInput.name}: typed input must be an object`);
        continue;
      }
      const unexpectedTypedKeys = Object.keys(typedInput).filter((key) => !TYPED_INPUT_KEYS.includes(key)).sort();
      if (unexpectedTypedKeys.length > 0) {
        failures.push(`${workflow.id}.${behaviorInput.name}: typed input contains unsupported keys: ${unexpectedTypedKeys.join(', ')}`);
      }
      let expected;
      try {
        expected = projectTypedInput(behaviorInput);
      } catch (error) {
        failures.push(`${workflow.id}.${behaviorInput.name}: ${error.message}`);
        continue;
      }

      for (const key of TYPED_INPUT_KEYS) {
        if (hasSameProjectedField(typedInput, expected, key)) continue;
        if (key === 'values') failures.push(`${workflow.id}.${behaviorInput.name}: typed enum values differ from behavior exactValues`);
        else if (key === 'pathPolicy') failures.push(`${workflow.id}.${behaviorInput.name}: typed pathPolicy differs from behavior pathPolicy`);
        else if (key === 'approvalPolicy') failures.push(`${workflow.id}.${behaviorInput.name}: typed approvalPolicy differs from the explicit approval contract`);
        else failures.push(`${workflow.id}.${behaviorInput.name}: typed input ${key} differs from behavior input`);
      }

      if (expected.type === 'approval') {
        const unexpectedApprovalKeys = Object.keys(typedInput.approvalPolicy ?? {}).filter((key) => !APPROVAL_POLICY_KEYS.includes(key));
        if (unexpectedApprovalKeys.length > 0) {
          failures.push(`${workflow.id}.${behaviorInput.name}: typed approvalPolicy contains unsupported keys: ${unexpectedApprovalKeys.sort().join(', ')}`);
        }
      }
    }
  }
  return failures;
}
