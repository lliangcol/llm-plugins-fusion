/** Generic required-input resolution shared by adapters and simulations. */
export function resolveRequiredInputs(requiredInputs, providedInputs) {
  const provided = providedInputs instanceof Map
    ? new Set(providedInputs.keys())
    : new Set(Array.isArray(providedInputs) ? providedInputs : Object.keys(providedInputs ?? {}));
  const missing = requiredInputs.filter((input) => !provided.has(input));
  return { complete: missing.length === 0, missing };
}

export function resolveBehaviorInputs(behavior, providedInputs = {}) {
  const normalizedInputs = {};
  const missingRequired = [];
  const invalidExactValues = [];

  for (const input of behavior.inputs) {
    const candidates = [input.name, ...input.aliases].filter((name) => Object.hasOwn(providedInputs, name));
    if (candidates.length > 1) {
      const values = candidates.map((name) => providedInputs[name]);
      if (new Set(values.map((value) => JSON.stringify(value))).size > 1) {
        invalidExactValues.push({ input: input.name, reason: 'conflicting-alias-values', providedBy: candidates });
        continue;
      }
    }
    let value = candidates.length ? providedInputs[candidates[0]] : input.default;
    if (value === undefined) {
      if (input.required) missingRequired.push(input.name);
      continue;
    }
    if (input.exactValues && !input.exactValues.some((allowed) => Object.is(allowed, value))) {
      invalidExactValues.push({ input: input.name, reason: 'not-an-exact-value', value, allowed: input.exactValues });
      continue;
    }
    normalizedInputs[input.name] = value;
  }

  return {
    valid: missingRequired.length === 0 && invalidExactValues.length === 0,
    normalizedInputs,
    missingRequired,
    invalidExactValues,
  };
}
