import { isDeepStrictEqual } from 'node:util';

const APPROVAL_POLICY_KEYS = ['mustBeExplicit', 'mayInfer', 'scope', 'oneShot', 'expires'];
const TYPED_INPUT_KEYS = ['name', 'required', 'type', 'values', 'pathPolicy', 'approvalPolicy'];

function sameOrderedValues(left, right) {
  return Array.isArray(left) && Array.isArray(right) && isDeepStrictEqual(left, right);
}

function hasSameProjectedField(actual, expected, key) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  return Object.hasOwn(actual, key) === Object.hasOwn(expected, key)
    && isDeepStrictEqual(actual[key], expected[key]);
}

export function behaviorInputType(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('behavior input must be an object');
  }
  if (input.type) return input.type;
  if (typeof input.default === 'boolean'
    || (Array.isArray(input.exactValues) && input.exactValues.length > 0 && input.exactValues.every((value) => typeof value === 'boolean'))) return 'boolean';
  if (Object.hasOwn(input, 'exactValues')) return 'enum';
  return 'string';
}

export function projectTypedInput(input) {
  const type = behaviorInputType(input);
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

/**
 * Validate the cross-domain input contract without filesystem or process access.
 * Contract v5/v1 keeps its required-input compatibility check. Contract v6/v2
 * additionally requires the typed projection to remain an exact projection of
 * behavior inputs and the v5 compatibility-required list.
 * @param {{ schemaVersion?: number, workflows?: any[] }} workflowSpec
 * @param {{ schemaVersion?: number, behaviors?: any[] }} behaviorSpec
 * @returns {string[]}
 */
export function validateContractCoherence(workflowSpec, behaviorSpec) {
  const failures = [];
  const expectedBehaviorSchemaVersion = workflowSpec?.schemaVersion === 6
    ? 2
    : workflowSpec?.schemaVersion === 5 ? 1 : null;
  if (expectedBehaviorSchemaVersion !== null && behaviorSpec?.schemaVersion !== expectedBehaviorSchemaVersion) {
    failures.push(`workflow schema v${workflowSpec.schemaVersion} requires behavior schema v${expectedBehaviorSchemaVersion}`);
  }
  const workflows = Array.isArray(workflowSpec?.workflows) ? workflowSpec.workflows : [];
  const behaviors = Array.isArray(behaviorSpec?.behaviors) ? behaviorSpec.behaviors : [];
  const behaviorById = new Map(behaviors.map((behavior) => [behavior?.id, behavior]));

  for (const workflow of workflows) {
    const behavior = behaviorById.get(workflow?.id);
    if (!behavior) continue;
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

    if (workflowSpec.schemaVersion !== 6) continue;

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
