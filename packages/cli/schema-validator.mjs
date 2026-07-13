import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const SCHEMAS = Object.freeze({
  framework: 'workflow-framework.schema.json',
  product: 'workflow-product.schema.json',
  workflows: 'workflow-spec.schema.json',
  behaviors: 'workflow-behaviors.schema.json',
  adapter: 'workflow-adapter.schema.json',
});

const defaultSchemaRoot = fileURLToPath(new URL('../../schemas/', import.meta.url));

function createAjv(Version) {
  const ajv = new Version({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: true });
  /** @type {(instance: any) => any} */ (/** @type {unknown} */ (addFormats))(ajv);
  return ajv;
}

export function createSpecSchemaValidator({ schemaRoot = defaultSchemaRoot } = {}) {
  const validators = new Map();

  return (value, domain) => {
    const schemaDomain = domain.startsWith('adapter:') ? 'adapter' : domain;
    const schemaFile = SCHEMAS[schemaDomain];
    if (!schemaFile) return [`unknown schema domain: ${domain}`];
    let validate = validators.get(schemaDomain);
    if (!validate) {
      const schema = JSON.parse(readFileSync(resolve(schemaRoot, schemaFile), 'utf8'));
      const ajv = String(schema.$schema ?? '').includes('2020-12') ? createAjv(Ajv2020) : createAjv(Ajv);
      validate = ajv.compile(schema);
      validators.set(schemaDomain, validate);
    }
    if (validate(value)) return [];
    return (validate.errors ?? []).map((error) => (
      `${error.instancePath || '(root)'} ${error.message}${error.params ? ` ${JSON.stringify(error.params)}` : ''}`
    ));
  };
}
