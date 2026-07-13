import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function createAjv(Version) {
  const ajv = new Version({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: true });
  /** @type {(instance: any) => any} */ (/** @type {unknown} */ (addFormats))(ajv);
  return ajv;
}

function engineFor(schema) {
  return String(schema?.$schema ?? '').includes('2020-12') ? createAjv(Ajv2020) : createAjv(Ajv);
}

export function formatAjvErrors(errors = []) {
  return errors.map((error) => `${error.instancePath || '(root)'} ${error.message}${error.params ? ` ${JSON.stringify(error.params)}` : ''}`);
}

export function compileStandardSchema(schema) {
  return engineFor(schema).compile(schema);
}

export function validateStandardSchema(schema, data) {
  let validate;
  try { validate = compileStandardSchema(schema); } catch (error) { return [`schema compilation failed: ${error.message}`]; }
  return validate(data) ? [] : formatAjvErrors(validate.errors);
}
