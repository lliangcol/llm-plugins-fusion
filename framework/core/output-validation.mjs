/** Minimal structural output validation; adapters may add stricter checks. */
export function validateOutputFields(output, requiredFields) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return { valid: false, missing: [...requiredFields] };
  const missing = requiredFields.filter((field) => !(field in output));
  return { valid: missing.length === 0, missing };
}
