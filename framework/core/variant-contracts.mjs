const variantValueTypes = new Set(['string', 'number', 'boolean']);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function hasOwn(value, name) {
  return Object.prototype.hasOwnProperty.call(value, name);
}

function valueIsAllowed(values, candidate) {
  return values.some((value) => Object.is(value, candidate));
}

export function normalizeVariantParameters(parameters = {}) {
  assertPlainObject(parameters, 'variant parameters');
  const normalized = {};
  for (const name of Object.keys(parameters).sort()) {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(name)) throw new TypeError(`invalid variant parameter name ${name}`);
    const value = parameters[name];
    if (value !== null && !variantValueTypes.has(typeof value)) {
      throw new TypeError(`variant parameter ${name} must be a scalar`);
    }
    if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) {
      throw new TypeError(`variant parameter ${name} must be a finite number and must not be negative zero`);
    }
    normalized[name] = value;
  }
  return normalized;
}

export function variantContractKey(canonicalSurfaceId, parameters = {}) {
  if (typeof canonicalSurfaceId !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(canonicalSurfaceId)) {
    throw new TypeError('canonical surface id must use kebab-case');
  }
  return `${canonicalSurfaceId}:${JSON.stringify(normalizeVariantParameters(parameters))}`;
}

function buildVariantContext(workflows, behaviorSpec) {
  if (!Array.isArray(workflows) || workflows.length === 0) throw new TypeError('workflows must be a non-empty array');
  if (!behaviorSpec || !Array.isArray(behaviorSpec.behaviors)) throw new TypeError('behaviorSpec.behaviors must be an array');

  const workflowById = new Map();
  const canonicalById = new Map();
  for (const workflow of workflows) {
    if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) throw new TypeError('workflow entries must be objects');
    if (workflowById.has(workflow.id)) throw new Error(`duplicate workflow ${workflow.id}`);
    workflowById.set(workflow.id, workflow);
    if (workflow.compatibilityAlias === false) {
      if (workflow.id !== workflow.canonicalSurfaceId) throw new Error(`${workflow.id}: canonical workflow id differs from canonical surface`);
      canonicalById.set(workflow.id, workflow);
    }
  }

  const behaviorById = new Map();
  for (const behavior of behaviorSpec.behaviors) {
    if (!behavior || typeof behavior !== 'object' || Array.isArray(behavior)) throw new TypeError('behavior entries must be objects');
    if (behaviorById.has(behavior.id)) throw new Error(`duplicate behavior ${behavior.id}`);
    behaviorById.set(behavior.id, behavior);
  }

  const selectorsByCanonicalId = new Map();
  for (const [canonicalSurfaceId] of canonicalById) {
    const behavior = behaviorById.get(canonicalSurfaceId);
    if (!behavior || !Array.isArray(behavior.inputs)) throw new Error(`${canonicalSurfaceId}: canonical behavior inputs are missing`);
    const inputs = new Map(behavior.inputs.map((input) => [input.name, input]));
    const selectorNames = new Set();
    for (const workflow of workflows) {
      if (workflow.canonicalSurfaceId !== canonicalSurfaceId) continue;
      for (const name of Object.keys(normalizeVariantParameters(workflow.variantPreset ?? {}))) selectorNames.add(name);
    }
    const schema = {};
    for (const name of [...selectorNames].sort()) {
      const input = inputs.get(name);
      if (!input) throw new Error(`${canonicalSurfaceId}: variant selector ${name} is not a canonical behavior input`);
      if (!Array.isArray(input.exactValues) || input.exactValues.length === 0) {
        throw new Error(`${canonicalSurfaceId}: variant selector ${name} must declare exactValues`);
      }
      const exactValues = input.exactValues.map((value) => normalizeVariantParameters({ [name]: value })[name]);
      if (new Set(exactValues.map((value) => JSON.stringify(value))).size !== exactValues.length) {
        throw new Error(`${canonicalSurfaceId}: variant selector ${name} has duplicate exactValues`);
      }
      const definition = { exactValues };
      if (hasOwn(input, 'default')) {
        const defaultValue = normalizeVariantParameters({ [name]: input.default })[name];
        if (!valueIsAllowed(exactValues, defaultValue)) {
          throw new Error(`${canonicalSurfaceId}: variant selector ${name} default is not an exact allowed value`);
        }
        definition.default = defaultValue;
      }
      schema[name] = definition;
    }
    selectorsByCanonicalId.set(canonicalSurfaceId, schema);
  }

  for (const workflow of workflows) {
    if (!canonicalById.has(workflow.canonicalSurfaceId)) {
      throw new Error(`${workflow.id}: unknown canonical surface ${workflow.canonicalSurfaceId}`);
    }
    const preset = normalizeVariantParameters(workflow.variantPreset ?? {});
    if (workflow.compatibilityAlias === false && Object.keys(preset).length !== 0) {
      throw new Error(`${workflow.id}: canonical workflow must use the default empty variant preset`);
    }
    if (workflow.compatibilityAlias === true && Object.keys(preset).length === 0) {
      throw new Error(`${workflow.id}: compatibility alias must declare a non-empty exact variant preset`);
    }
    if (workflow.compatibilityAlias === true) {
      const aliasInputs = new Map((behaviorById.get(workflow.id)?.inputs ?? []).map((input) => [input.name, input]));
      for (const [name, presetValue] of Object.entries(preset)) {
        const aliasInput = aliasInputs.get(name);
        if (!aliasInput) continue;
        if (!Array.isArray(aliasInput.exactValues)
          || aliasInput.exactValues.length !== 1
          || !Object.is(aliasInput.exactValues[0], presetValue)) {
          throw new Error(`${workflow.id}: compatibility alias selector ${name} exactValues must equal its preset value`);
        }
        if (hasOwn(aliasInput, 'default') && !Object.is(aliasInput.default, presetValue)) {
          throw new Error(`${workflow.id}: compatibility alias selector ${name} default must equal its preset value`);
        }
      }
    }
  }

  return { canonicalById, selectorsByCanonicalId };
}

function validateAndCompleteParameters(context, canonicalSurfaceId, parameters, applyDefaults) {
  const canonical = context.canonicalById.get(canonicalSurfaceId);
  if (!canonical) throw new Error(`unknown canonical surface ${canonicalSurfaceId}`);
  const schema = context.selectorsByCanonicalId.get(canonicalSurfaceId);
  const explicit = normalizeVariantParameters(parameters);
  for (const [name, value] of Object.entries(explicit)) {
    const definition = schema[name];
    if (!definition) throw new Error(`${canonicalSurfaceId}: undeclared variant selector ${name}`);
    if (!valueIsAllowed(definition.exactValues, value)) {
      throw new Error(`${canonicalSurfaceId}: variant selector ${name} has unsupported value ${JSON.stringify(value)}`);
    }
  }
  if (!applyDefaults) return explicit;
  const completed = { ...explicit };
  for (const [name, definition] of Object.entries(schema)) {
    if (!hasOwn(completed, name) && hasOwn(definition, 'default')) completed[name] = definition.default;
  }
  return normalizeVariantParameters(completed);
}

export function variantSelectorSchema(workflows, behaviorSpec, canonicalSurfaceId) {
  const context = buildVariantContext(workflows, behaviorSpec);
  const schema = context.selectorsByCanonicalId.get(canonicalSurfaceId);
  if (!schema) throw new Error(`unknown canonical surface ${canonicalSurfaceId}`);
  return Object.fromEntries(Object.entries(schema).map(([name, definition]) => [name, {
    exactValues: [...definition.exactValues],
    ...(hasOwn(definition, 'default') ? { default: definition.default } : {}),
  }]));
}

export function buildVariantResolutionIndex(workflows, behaviorSpec) {
  const context = buildVariantContext(workflows, behaviorSpec);
  const index = new Map();
  for (const workflow of workflows) {
    const variantParameters = validateAndCompleteParameters(
      context,
      workflow.canonicalSurfaceId,
      workflow.variantPreset ?? {},
      false,
    );
    const normalizedVariantParameters = validateAndCompleteParameters(
      context,
      workflow.canonicalSurfaceId,
      variantParameters,
      true,
    );
    const key = variantContractKey(workflow.canonicalSurfaceId, normalizedVariantParameters);
    if (index.has(key)) throw new Error(`${workflow.id}: duplicate normalized variant contract ${key}`);
    index.set(key, {
      workflow,
      variantParameters,
      normalizedVariantParameters,
      resolutionKind: workflow.compatibilityAlias ? 'exact-override' : 'canonical-default',
    });
  }
  return index;
}

export function resolveVariantWorkflow(workflows, behaviorSpec, canonicalSurfaceId, variantParameters = {}) {
  const context = buildVariantContext(workflows, behaviorSpec);
  const explicit = validateAndCompleteParameters(context, canonicalSurfaceId, variantParameters, false);
  const normalizedVariantParameters = validateAndCompleteParameters(context, canonicalSurfaceId, explicit, true);
  const exact = buildVariantResolutionIndex(workflows, behaviorSpec)
    .get(variantContractKey(canonicalSurfaceId, normalizedVariantParameters));
  if (exact) {
    return {
      ...exact,
      variantParameters: explicit,
      normalizedVariantParameters,
      matchedVariantPreset: exact.variantParameters,
    };
  }
  const conflictingAliases = [];
  const selectorSchema = context.selectorsByCanonicalId.get(canonicalSurfaceId);
  for (const workflow of workflows) {
    if (!workflow.compatibilityAlias || workflow.canonicalSurfaceId !== canonicalSurfaceId) continue;
    const preset = validateAndCompleteParameters(context, canonicalSurfaceId, workflow.variantPreset ?? {}, false);
    const specializationEntries = Object.entries(preset).filter(([name, value]) => {
      const definition = selectorSchema[name];
      return !hasOwn(definition, 'default') || !Object.is(definition.default, value);
    });
    if (specializationEntries.some(([name, value]) => Object.is(normalizedVariantParameters[name], value))) {
      conflictingAliases.push(workflow.id);
    }
  }
  if (conflictingAliases.length > 0) {
    throw new Error(`${canonicalSurfaceId}: conflicting variant selectors partially trigger ${conflictingAliases.join(', ')}`);
  }
  return {
    workflow: context.canonicalById.get(canonicalSurfaceId),
    variantParameters: explicit,
    normalizedVariantParameters,
    matchedVariantPreset: {},
    resolutionKind: 'canonical-fallback',
  };
}

export function listVariantResolutions(workflows, behaviorSpec) {
  return [...buildVariantResolutionIndex(workflows, behaviorSpec).values()];
}

export function variantSelectorKeys(workflows, behaviorSpec, canonicalSurfaceId) {
  return Object.keys(variantSelectorSchema(workflows, behaviorSpec, canonicalSurfaceId));
}

export function extractVariantParameters(workflows, behaviorSpec, canonicalSurfaceId, resolvedInputs = {}) {
  assertPlainObject(resolvedInputs, 'resolved inputs');
  const context = buildVariantContext(workflows, behaviorSpec);
  const selectors = Object.keys(context.selectorsByCanonicalId.get(canonicalSurfaceId) ?? {});
  if (!context.canonicalById.has(canonicalSurfaceId)) throw new Error(`unknown canonical surface ${canonicalSurfaceId}`);
  const extracted = Object.fromEntries(
    selectors.filter((name) => hasOwn(resolvedInputs, name)).map((name) => [name, resolvedInputs[name]]),
  );
  return validateAndCompleteParameters(context, canonicalSurfaceId, extracted, false);
}
