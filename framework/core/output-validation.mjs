/** Minimal structural output validation; adapters may add stricter checks. */
export function validateOutputFields(output, requiredFields) {
  if (!Array.isArray(requiredFields)
    || requiredFields.some((field) => typeof field !== 'string' || field.length === 0)
    || new Set(requiredFields).size !== requiredFields.length) {
    throw new TypeError('requiredFields must be an array of unique non-empty strings');
  }
  if (!output || typeof output !== 'object' || Array.isArray(output)) return { valid: false, missing: [...requiredFields] };
  const missing = requiredFields.filter((field) => !Object.hasOwn(output, field));
  return { valid: missing.length === 0, missing };
}
