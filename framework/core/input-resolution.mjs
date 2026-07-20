/** Generic required-input resolution shared by adapters and simulations. */
import { isDeepStrictEqual } from 'node:util';
import { behaviorInputValueIssue } from './behavior-input-contract.mjs';

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
      if (values.slice(1).some((value) => !isDeepStrictEqual(value, values[0]))) {
        invalidExactValues.push({ input: input.name, reason: 'conflicting-alias-values', providedBy: candidates });
        continue;
      }
    }
    let value = candidates.length ? providedInputs[candidates[0]] : input.default;
    if (value === undefined) {
      if (input.required) missingRequired.push(input.name);
      continue;
    }
    const issue = behaviorInputValueIssue(input, value);
    if (issue) {
      invalidExactValues.push({ input: input.name, ...issue, value });
      continue;
    }
    Object.defineProperty(normalizedInputs, input.name, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  return {
    valid: missingRequired.length === 0 && invalidExactValues.length === 0,
    normalizedInputs,
    missingRequired,
    invalidExactValues,
  };
}
