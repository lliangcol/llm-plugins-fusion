#!/usr/bin/env node
/**
 * Schema validation script
 * Validates plugin.json and marketplace.json against their JSON schemas.
 * Dependencies: none (uses built-in fetch/readFile only)
 *
 * Usage: node scripts/validate-schemas.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadJson(relPath) {
  const full = resolve(root, relPath);
  return JSON.parse(readFileSync(full, 'utf8'));
}

// Minimal JSON Schema draft-07 validator (required/type/pattern/format/minLength/additionalProperties)
function validate(schema, data, path = '') {
  const errors = [];

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const jsType = Array.isArray(data) ? 'array' : typeof data;
    if (!types.includes(jsType)) {
      errors.push(`${path || '(root)'}: expected type ${types.join('|')}, got ${jsType}`);
      return errors;
    }
  }

  if (schema.type === 'string' || typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string length ${data.length} < minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: value "${data}" does not match pattern ${schema.pattern}`);
    }
    if (schema.format === 'uri') {
      try { new URL(data); } catch {
        errors.push(`${path}: value "${data}" is not a valid URI`);
      }
    }
  }

  if ((schema.type === 'object' || typeof data === 'object') && !Array.isArray(data) && data !== null) {
    const required = schema.required || [];
    for (const key of required) {
      if (!(key in data)) {
        errors.push(`${path || '(root)'}: missing required property "${key}"`);
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) {
          errors.push(`${path || '(root)'}: additional property "${key}" not allowed`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          errors.push(...validate(subSchema, data[key], `${path}.${key}`));
        }
      }
    }
  }

  if (schema.type === 'array' || Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: array length ${data.length} < minItems ${schema.minItems}`);
    }
    if (schema.uniqueItems && new Set(data).size !== data.length) {
      errors.push(`${path}: array items must be unique`);
    }
    if (schema.items) {
      data.forEach((item, i) => {
        errors.push(...validate(schema.items, item, `${path}[${i}]`));
      });
    }
  }

  return errors;
}

const targets = [
  {
    schema: loadJson('schemas/plugin.schema.json'),
    data: loadJson('nova-plugin/.claude-plugin/plugin.json'),
    label: 'nova-plugin/.claude-plugin/plugin.json',
  },
  {
    schema: loadJson('schemas/marketplace.schema.json'),
    data: loadJson('.claude-plugin/marketplace.json'),
    label: '.claude-plugin/marketplace.json',
  },
];

let allPassed = true;
for (const { schema, data, label } of targets) {
  const errors = validate(schema, data);
  if (errors.length === 0) {
    console.log(`✓ ${label}`);
  } else {
    allPassed = false;
    console.error(`✗ ${label}`);
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
  }
}

if (!allPassed) {
  process.exit(1);
}
