#!/usr/bin/env node
/**
 * Schema validation script
 * Validates plugin.json, registry.source.json, marketplace.json, and
 * marketplace.metadata.json against their JSON schemas, then checks
 * name/version alignment and generated registry drift.
 * Dependencies: none (uses built-in fetch/readFile only)
 *
 * Usage: node scripts/validate-schemas.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRegistryFiles } from './generate-registry.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadJson(relPath) {
  const full = resolve(root, relPath);
  return JSON.parse(readFileSync(full, 'utf8'));
}

// Minimal JSON Schema draft-07 validator
// Supports: required/type/pattern/format/minLength/additionalProperties/properties/items/minItems/uniqueItems/enum/oneOf/const
function validate(schema, data, path = '') {
  const errors = [];

  if (schema.oneOf) {
    const matchCount = schema.oneOf.reduce((acc, sub) => acc + (validate(sub, data, path).length === 0 ? 1 : 0), 0);
    if (matchCount !== 1) {
      errors.push(`${path || '(root)'}: value must match exactly one of oneOf branches (matched ${matchCount})`);
    }
    // oneOf短路：交由上层处理，不再做 type 断言
    return errors;
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path || '(root)'}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path || '(root)'}: value ${JSON.stringify(data)} does not equal const ${JSON.stringify(schema.const)}`);
  }

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const jsType = Array.isArray(data) ? 'array' : (data === null ? 'null' : typeof data);
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
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      errors.push(`${path}: value "${data}" is not a valid ISO-8601 date (YYYY-MM-DD)`);
    }
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      errors.push(`${path}: value "${data}" is not a valid email`);
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
    schema: loadJson('schemas/registry-source.schema.json'),
    data: loadJson('.claude-plugin/registry.source.json'),
    label: '.claude-plugin/registry.source.json',
  },
  {
    schema: loadJson('schemas/marketplace.schema.json'),
    data: loadJson('.claude-plugin/marketplace.json'),
    label: '.claude-plugin/marketplace.json',
  },
  {
    schema: loadJson('schemas/marketplace-metadata.schema.json'),
    data: loadJson('.claude-plugin/marketplace.metadata.json'),
    label: '.claude-plugin/marketplace.metadata.json',
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

function findPluginEntry(container, name, label) {
  const entry = container.plugins?.find((item) => item.name === name);
  if (!entry) {
    allPassed = false;
    console.error(`✗ ${label}`);
    console.error(`  - missing plugin entry for ${name}`);
  }
  return entry;
}

const plugin = loadJson('nova-plugin/.claude-plugin/plugin.json');
const marketplace = loadJson('.claude-plugin/marketplace.json');
const metadata = loadJson('.claude-plugin/marketplace.metadata.json');
const marketplaceEntry = findPluginEntry(marketplace, plugin.name, '.claude-plugin/marketplace.json');
const metadataEntry = findPluginEntry(metadata, plugin.name, '.claude-plugin/marketplace.metadata.json');

if (marketplaceEntry && marketplaceEntry.version !== plugin.version) {
  allPassed = false;
  console.error('✗ marketplace version alignment');
  console.error(`  - .claude-plugin/marketplace.json has ${marketplaceEntry.version}, expected ${plugin.version}`);
}

if (metadataEntry && metadataEntry.version !== plugin.version) {
  allPassed = false;
  console.error('✗ marketplace metadata version alignment');
  console.error(`  - .claude-plugin/marketplace.metadata.json has ${metadataEntry.version}, expected ${plugin.version}`);
}

if (
  marketplaceEntry
  && metadataEntry
  && (marketplaceEntry.name !== metadataEntry.name || marketplaceEntry.version !== metadataEntry.version)
) {
  allPassed = false;
  console.error('✗ marketplace metadata alignment');
  console.error('  - marketplace.json and marketplace.metadata.json must agree on plugin name/version');
}

if (marketplaceEntry && metadataEntry && marketplaceEntry.version === plugin.version && metadataEntry.version === plugin.version) {
  console.log('✓ marketplace name/version alignment');
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n');
}

let generatedOutputsPassed = true;
try {
  for (const { relPath, content } of generateRegistryFiles(root)) {
    const current = normalizeNewlines(readFileSync(resolve(root, relPath), 'utf8'));
    if (current !== content) {
      generatedOutputsPassed = false;
      allPassed = false;
      console.error(`✗ generated registry output ${relPath}`);
      console.error('  - file is out of date; run node scripts/generate-registry.mjs --write');
    }
  }

  if (generatedOutputsPassed) {
    console.log('✓ generated registry outputs');
  }
} catch (error) {
  allPassed = false;
  console.error('✗ generated registry outputs');
  console.error(`  - ${error.message}`);
}

if (!allPassed) {
  process.exit(1);
}
