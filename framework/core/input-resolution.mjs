/** Generic required-input resolution shared by adapters and simulations. */
export function resolveRequiredInputs(requiredInputs, providedInputs) {
  const provided = providedInputs instanceof Map
    ? new Set(providedInputs.keys())
    : new Set(Array.isArray(providedInputs) ? providedInputs : Object.keys(providedInputs ?? {}));
  const missing = requiredInputs.filter((input) => !provided.has(input));
  return { complete: missing.length === 0, missing };
}
