const BEHAVIOR_INPUT_TYPES = new Set([
  'string',
  'enum',
  'boolean',
  'path',
  'artifact-reference',
  'review-reference',
  'approval',
]);

export const PATH_LIKE_INPUT_TYPES = Object.freeze([
  'path',
  'artifact-reference',
  'review-reference',
]);

const pathLikeInputTypes = new Set(PATH_LIKE_INPUT_TYPES);
export const BEHAVIOR_INPUT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function isJsonScalar(value) {
  return value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0));
}

function hasDuplicateExactValues(values) {
  return values.some((value, index) => values.slice(0, index).some((earlier) => Object.is(earlier, value)));
}

export function behaviorInputType(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('behavior input must be an object');
  }
  if (input.type !== undefined) {
    if (!BEHAVIOR_INPUT_TYPES.has(input.type)) {
      throw new Error(`${input.name ?? 'behavior input'}: unsupported behavior input type ${String(input.type)}`);
    }
    return input.type;
  }
  if (typeof input.default === 'boolean'
    || (Array.isArray(input.exactValues)
      && input.exactValues.length > 0
      && input.exactValues.every((value) => typeof value === 'boolean'))) return 'boolean';
  if (Object.hasOwn(input, 'exactValues')) return 'enum';
  return 'string';
}

export function behaviorInputValueIssue(input, value) {
  const type = behaviorInputType(input);
  if (Array.isArray(input.exactValues)
    && !input.exactValues.some((allowed) => Object.is(allowed, value))) {
    return { reason: 'not-an-exact-value', allowed: input.exactValues };
  }
  if (type === 'boolean' && typeof value !== 'boolean') {
    return { reason: 'wrong-type', expectedType: 'boolean' };
  }
  if ((type === 'string' || pathLikeInputTypes.has(type)) && typeof value !== 'string') {
    return { reason: 'wrong-type', expectedType: 'string' };
  }
  if (type === 'enum' && !Array.isArray(input.exactValues)) {
    return { reason: 'invalid-input-contract', expectedType: 'enum' };
  }
  if (type === 'approval' && !Array.isArray(input.exactValues)) {
    return { reason: 'invalid-input-contract', expectedType: 'approval' };
  }
  return null;
}

export function behaviorInputAcceptsValue(input, value) {
  return behaviorInputValueIssue(input, value) === null;
}

export function validateBehaviorInputDefinition(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('behavior input must be an object');
  }
  if (typeof input.name !== 'string' || !BEHAVIOR_INPUT_NAME_PATTERN.test(input.name)) {
    throw new Error('behavior input name must be an UPPER_SNAKE_CASE identity');
  }
  if (typeof input.required !== 'boolean') {
    throw new Error(`${input.name}: behavior input required must be a boolean`);
  }
  const type = behaviorInputType(input);
  const hasExactValues = Object.hasOwn(input, 'exactValues');
  if (hasExactValues) {
    if (!Array.isArray(input.exactValues) || input.exactValues.length === 0) {
      throw new Error(`${input.name}: exactValues must be a non-empty array`);
    }
    if (hasDuplicateExactValues(input.exactValues)) {
      throw new Error(`${input.name}: exactValues must be unique`);
    }
    if (input.exactValues.some((value) => !isJsonScalar(value))) {
      throw new Error(`${input.name}: exactValues must contain only canonical finite JSON scalar values`);
    }
    if (['string', ...PATH_LIKE_INPUT_TYPES].includes(type)) {
      throw new Error(`${input.name}: exactValues requires an enum, boolean, or approval input type`);
    }
    if (type === 'boolean' && input.exactValues.some((value) => typeof value !== 'boolean')) {
      throw new Error(`${input.name}: boolean exactValues must contain only booleans`);
    }
    if (type === 'approval' && input.exactValues.some((value) => value !== true && value !== 'true')) {
      throw new Error(`${input.name}: approval exactValues may contain only true or "true"`);
    }
  }
  if (type === 'enum' && !hasExactValues) {
    throw new Error(`${input.name}: enum behavior input requires exactValues`);
  }
  if (type === 'approval' && Object.hasOwn(input, 'default')) {
    throw new Error(`${input.name}: approval behavior input must not declare a default`);
  }
  if (type === 'approval' && !hasExactValues) {
    throw new Error(`${input.name}: approval behavior input requires exactValues`);
  }
  if (Object.hasOwn(input, 'default')) {
    const issue = behaviorInputValueIssue(input, input.default);
    if (issue) {
      throw new Error(`${input.name}: default has ${issue.reason}`);
    }
  }
  return type;
}

export function validateBehaviorPredicateInputs(predicate, inputsByName, label) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) {
    throw new Error(`${label}: predicate must be an object`);
  }
  if (['input-present', 'path-readable', 'path-writable', 'input-equals', 'input-in'].includes(predicate.op)) {
    const input = inputsByName.get(predicate.input);
    if (!input) throw new Error(`${label}: predicate references unknown input ${predicate.input}`);
    if (predicate.op === 'path-readable' || predicate.op === 'path-writable') {
      if (!pathLikeInputTypes.has(behaviorInputType(input))) {
        throw new Error(`${label}: ${predicate.op} input ${predicate.input} must be path-like`);
      }
      const permission = predicate.op === 'path-readable' ? 'readable' : 'writable';
      if (input.pathPolicy?.[permission] !== true) {
        throw new Error(`${label}: ${predicate.op} input ${predicate.input} pathPolicy.${permission} must be true`);
      }
    }
    if (predicate.op === 'input-equals') {
      const issue = behaviorInputValueIssue(input, predicate.value);
      if (issue) throw new Error(`${label}: input-equals value for ${predicate.input} has ${issue.reason}`);
    }
    if (predicate.op === 'input-in') {
      if (!Array.isArray(predicate.values) || predicate.values.length === 0) {
        throw new Error(`${label}: input-in predicate for ${predicate.input} requires values`);
      }
      for (const value of predicate.values) {
        const issue = behaviorInputValueIssue(input, value);
        if (issue) throw new Error(`${label}: input-in value for ${predicate.input} has ${issue.reason}`);
      }
    }
    return;
  }
  if (predicate.op === 'all' || predicate.op === 'any') {
    if (!Array.isArray(predicate.args) || predicate.args.length === 0) {
      throw new Error(`${label}: ${predicate.op} predicate requires args`);
    }
    for (const child of predicate.args) validateBehaviorPredicateInputs(child, inputsByName, label);
    return;
  }
  if (predicate.op === 'not') {
    validateBehaviorPredicateInputs(predicate.arg, inputsByName, label);
    return;
  }
  if (predicate.op === 'semantic-condition' || predicate.op === 'capability-state') return;
  throw new Error(`${label}: unsupported predicate op ${predicate.op ?? 'missing'}`);
}
