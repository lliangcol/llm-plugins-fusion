#!/usr/bin/env node
/**
 * Schema validation script
 * Validates plugin.json, registry.source.json, marketplace.json, and
 * marketplace.metadata.json against their JSON schemas, then checks
 * name/version alignment and generated registry/catalog drift.
 * Development dependencies: Ajv and ajv-formats. The distributed plugin archive remains dependency-free.
 *
 * Usage: node scripts/validate-schemas.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateRegistryFiles } from './generate-registry.mjs';
import { SEMVER_PATTERN_SOURCE } from './lib/semver.mjs';
import { compileStandardSchema, validateStandardSchema } from './lib/schema-engine.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function loadJson(relPath) {
  const full = resolve(root, relPath);
  return JSON.parse(readFileSync(full, 'utf8'));
}

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

const supportedSchemaKeywords = new Set([
  '$schema', '$id', 'title', 'description', 'type', 'required', 'pattern', 'format',
  'minLength', 'minimum', 'additionalProperties', 'properties', 'items', 'minItems',
  'uniqueItems', 'enum', 'oneOf', 'const',
]);

export function validateLegacySchemaKeywords(schema, path = '(root)') {
  const errors = [];
  for (const key of Object.keys(schema)) {
    if (!supportedSchemaKeywords.has(key)) errors.push(`${path}: unsupported schema keyword ${key}`);
  }
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    errors.push(...validateLegacySchemaKeywords(child, `${path}.properties.${key}`));
  }
  if (schema.format && !['uri', 'date', 'date-time', 'email'].includes(schema.format)) errors.push(`${path}: unsupported schema format ${schema.format}`);
  if (schema.items && typeof schema.items === 'object') errors.push(...validateLegacySchemaKeywords(schema.items, `${path}.items`));
  for (const [index, child] of (schema.oneOf ?? []).entries()) errors.push(...validateLegacySchemaKeywords(child, `${path}.oneOf[${index}]`));
  return errors;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Dependency-free schema subset. Unsupported keywords fail closed above.
export function validateLegacySubset(schema, data, path = '') {
  const errors = [];

  if (schema.oneOf) {
    const matchCount = schema.oneOf.reduce((acc, sub) => acc + (validateLegacySubset(sub, data, path).length === 0 ? 1 : 0), 0);
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
    const typeMatches = types.some((type) => type === jsType || (type === 'integer' && jsType === 'number' && Number.isInteger(data)));
    if (!typeMatches) {
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
    if (schema.format === 'date' && !isValidIsoDate(data)) {
      errors.push(`${path}: value "${data}" is not a valid ISO-8601 date (YYYY-MM-DD)`);
    }
    if (schema.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(data) || Number.isNaN(Date.parse(data)))) {
      errors.push(`${path}: value "${data}" is not a valid RFC 3339 date-time`);
    }
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      errors.push(`${path}: value "${data}" is not a valid email`);
    }
  }

  if ((typeof data === 'number') && schema.minimum !== undefined && data < schema.minimum) {
    errors.push(`${path}: number ${data} < minimum ${schema.minimum}`);
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
          errors.push(...validateLegacySubset(subSchema, data[key], `${path}.${key}`));
        }
      }
    }
  }

  if (schema.type === 'array' || Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: array length ${data.length} < minItems ${schema.minItems}`);
    }
    if (schema.uniqueItems && new Set(data.map(canonicalJson)).size !== data.length) {
      errors.push(`${path}: array items must be unique`);
    }
    if (schema.items) {
      data.forEach((item, i) => {
        errors.push(...validateLegacySubset(schema.items, item, `${path}[${i}]`));
      });
    }
  }

  return errors;
}

export function validateSchemaKeywords(schema) {
  try { compileStandardSchema(schema); return []; } catch (error) { return [`schema compilation failed: ${error.message}`]; }
}

export function validate(schema, data) {
  return validateStandardSchema(schema, data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
    schema: loadJson('schemas/marketplace.schema.json'),
    data: loadJson('.claude-plugin/marketplace.canary.json'),
    label: '.claude-plugin/marketplace.canary.json',
  },
  {
    schema: loadJson('schemas/marketplace-metadata.schema.json'),
    data: loadJson('.claude-plugin/marketplace.metadata.json'),
    label: '.claude-plugin/marketplace.metadata.json',
  },
  {
    schema: loadJson('schemas/workflow-spec.schema.json'),
    data: loadJson('workflow-specs/workflows.json'),
    label: 'workflow-specs/workflows.json',
  },
  {
    schema: loadJson('schemas/workflow-framework.schema.json'),
    data: loadJson('workflow-specs/framework.json'),
    label: 'workflow-specs/framework.json',
  },
  {
    schema: loadJson('schemas/workflow-behaviors.schema.json'),
    data: loadJson('workflow-specs/behaviors.json'),
    label: 'workflow-specs/behaviors.json',
  },
  {
    schema: loadJson('schemas/workflow-product.schema.json'),
    data: loadJson('workflow-specs/nova.product.json'),
    label: 'workflow-specs/nova.product.json',
  },
  ...['claude', 'codex', 'generic'].map((id) => ({
    schema: loadJson('schemas/workflow-adapter.schema.json'),
    data: loadJson(`workflow-specs/adapters/${id}.json`),
    label: `workflow-specs/adapters/${id}.json`,
  })),
  {
    schema: loadJson('schemas/shell-command-policy.schema.json'),
    data: loadJson('.nova/shell-policy.json'),
    label: '.nova/shell-policy.json',
  },
  {
    schema: loadJson('schemas/workflow-framework.schema.json'),
    data: loadJson('fixtures/products/minimal-plugin/framework.json'),
    label: 'fixtures/products/minimal-plugin/framework.json',
  },
  {
    schema: loadJson('schemas/workflow-spec.schema.json'),
    data: loadJson('fixtures/products/minimal-plugin/workflows.json'),
    label: 'fixtures/products/minimal-plugin/workflows.json',
  },
  {
    schema: loadJson('schemas/workflow-behaviors.schema.json'),
    data: loadJson('fixtures/products/minimal-plugin/behaviors.json'),
    label: 'fixtures/products/minimal-plugin/behaviors.json',
  },
  {
    schema: loadJson('schemas/workflow-product.schema.json'),
    data: loadJson('fixtures/products/minimal-plugin/product.json'),
    label: 'fixtures/products/minimal-plugin/product.json',
  },
  {
    schema: loadJson('schemas/workflow-adapter.schema.json'),
    data: loadJson('fixtures/products/minimal-plugin/adapters/mock.json'),
    label: 'fixtures/products/minimal-plugin/adapters/mock.json',
  },
  {
    schema: loadJson('schemas/workflow-permissions.schema.json'),
    data: loadJson('nova-plugin/runtime/workflow-permissions.json'),
    label: 'nova-plugin/runtime/workflow-permissions.json',
  },
  {
    schema: loadJson('schemas/product-lanes.schema.json'),
    data: loadJson('governance/product-lanes.json'),
    label: 'governance/product-lanes.json',
  },
  {
    schema: loadJson('schemas/release-channels.schema.json'),
    data: loadJson('governance/release-channels.json'),
    label: 'governance/release-channels.json',
  },
  {
    schema: loadJson('schemas/stable-install-proof.schema.json'),
    data: loadJson('governance/stable-install-proof.json'),
    label: 'governance/stable-install-proof.json',
  },
  {
    schema: loadJson('schemas/complexity-budget.schema.json'),
    data: loadJson('governance/complexity-budget.json'),
    label: 'governance/complexity-budget.json',
  },
  {
    schema: loadJson('schemas/fact-graph.schema.json'),
    data: loadJson('governance/facts.generated.json'),
    label: 'governance/facts.generated.json',
  },
  {
    schema: loadJson('schemas/project-state.schema.json'),
    data: loadJson('governance/project-state.generated.json'),
    label: 'governance/project-state.generated.json',
  },
  {
    schema: loadJson('schemas/adapter-evidence.schema.json'),
    data: loadJson('governance/compatibility-evidence.generated.json'),
    label: 'governance/compatibility-evidence.generated.json',
  },
  {
    schema: loadJson('schemas/eval-result.schema.json'),
    data: loadJson('evals/baselines/static-contract.json'),
    label: 'evals/baselines/static-contract.json',
  },
  {
    schema: loadJson('schemas/eval-result.schema.json'),
    data: loadJson('evals/baselines/adapter-simulation.json'),
    label: 'evals/baselines/adapter-simulation.json',
  },
];

const versionPatterns = [
  targets[0].schema.properties.version.pattern,
  targets[2].schema.properties.plugins.items.properties.version.pattern,
  targets[4].schema.properties.plugins.items.properties.version.pattern,
];
if (versionPatterns.some((pattern) => pattern !== SEMVER_PATTERN_SOURCE)) {
  console.error('✗ schema SemVer pattern alignment');
  console.error('  - plugin and marketplace version schemas must match scripts/lib/semver.mjs');
  process.exit(1);
}
console.log('✓ schema SemVer pattern alignment');

let allPassed = true;
const schemaPaths = [
  'schemas/plugin.schema.json',
  'schemas/registry-source.schema.json',
  'schemas/marketplace.schema.json',
  'schemas/marketplace-metadata.schema.json',
  'schemas/workflow-permissions.schema.json',
  'schemas/workflow-spec.schema.json',
  'schemas/workflow-framework.schema.json',
  'schemas/workflow-behaviors.schema.json',
  'schemas/workflow-adapter.schema.json',
  'schemas/workflow-product.schema.json',
  'schemas/shell-command-policy.schema.json',
  'schemas/validation-report.schema.json',
  'schemas/release-evidence.schema.json',
  'schemas/product-lanes.schema.json',
  'schemas/project-state.schema.json',
  'schemas/release-candidate.schema.json',
  'schemas/candidate-core.schema.json',
  'schemas/promotion-intent.schema.json',
  'schemas/release-event.schema.json',
  'schemas/release-ledger.schema.json',
  'schemas/control-bundle.schema.json',
  'schemas/stable-install-proof.schema.json',
  'schemas/release-channels.schema.json',
  'schemas/complexity-budget.schema.json',
  'schemas/fact-graph.schema.json',
  'schemas/adapter-evidence.schema.json',
  'schemas/eval-result.schema.json',
];
for (const schemaPath of schemaPaths) {
  const schema = loadJson(schemaPath);
  const fileName = schemaPath.split('/').at(-1);
  const expectedId = `https://raw.githubusercontent.com/lliangcol/llm-plugins-fusion/main/schemas/${fileName}`;
  if (schema.$id !== expectedId) {
    allPassed = false;
    console.error(`✗ ${schemaPath} $id`);
    console.error(`  - got ${schema.$id ?? '(missing)'}, expected ${expectedId}`);
  } else {
    console.log(`✓ ${schemaPath} $id`);
  }
  const keywordErrors = validateSchemaKeywords(schema);
  if (keywordErrors.length) {
    allPassed = false;
    console.error(`✗ ${schemaPath} supported keyword boundary`);
    for (const error of keywordErrors) console.error(`  - ${error}`);
  }
}

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
  const plugins = Array.isArray(container.plugins) ? container.plugins : [];
  const entry = plugins.find((item) => item?.name === name);
  if (!entry) {
    allPassed = false;
    console.error(`✗ ${label}`);
    console.error(`  - missing plugin entry for ${name}`);
  }
  return entry;
}

function validateUniqueValues(items, label, fieldLabel, selector) {
  if (!Array.isArray(items)) return;
  const seen = new Map();
  for (const [index, item] of items.entries()) {
    const value = selector(item);
    if (typeof value !== 'string' || value.length === 0) continue;
    if (seen.has(value)) {
      allPassed = false;
      console.error(`✗ ${label}`);
      console.error(`  - duplicate ${fieldLabel} "${value}" at indexes ${seen.get(value)} and ${index}`);
    } else {
      seen.set(value, index);
    }
  }
}

const plugin = loadJson('nova-plugin/.claude-plugin/plugin.json');
const registrySource = loadJson('.claude-plugin/registry.source.json');
const marketplace = loadJson('.claude-plugin/marketplace.json');
const metadata = loadJson('.claude-plugin/marketplace.metadata.json');
const releaseChannels = loadJson('governance/release-channels.json');
const stableInstallProof = loadJson('governance/stable-install-proof.json');
validateUniqueValues(registrySource.plugins ?? [], '.claude-plugin/registry.source.json', 'plugin source', (entry) => entry?.localSource);
validateUniqueValues(marketplace.plugins ?? [], '.claude-plugin/marketplace.json', 'plugin name', (entry) => entry?.name);
validateUniqueValues(metadata.plugins ?? [], '.claude-plugin/marketplace.metadata.json', 'plugin name', (entry) => entry?.name);
const marketplaceEntry = findPluginEntry(marketplace, plugin.name, '.claude-plugin/marketplace.json');
const metadataEntry = findPluginEntry(metadata, plugin.name, '.claude-plugin/marketplace.metadata.json');

if (marketplaceEntry && marketplaceEntry.version !== releaseChannels.stable.version) {
  allPassed = false;
  console.error('✗ marketplace version alignment');
  console.error(`  - .claude-plugin/marketplace.json has ${marketplaceEntry.version}, expected stable ${releaseChannels.stable.version}`);
}

if (metadataEntry && metadataEntry.version !== releaseChannels.stable.version) {
  allPassed = false;
  console.error('✗ marketplace metadata version alignment');
  console.error(`  - .claude-plugin/marketplace.metadata.json has ${metadataEntry.version}, expected stable ${releaseChannels.stable.version}`);
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

if (marketplaceEntry && metadataEntry && marketplaceEntry.version === releaseChannels.stable.version && metadataEntry.version === releaseChannels.stable.version) {
  console.log('✓ marketplace name/version alignment');
}

if (releaseChannels.stable.state === 'INSTALL_PROVEN') {
  const expectedProofPath = 'governance/stable-install-proof.json';
  const identityMatches = stableInstallProof.stable?.version === releaseChannels.stable.version
    && stableInstallProof.stable?.tag === releaseChannels.stable.tag
    && stableInstallProof.stable?.commit === releaseChannels.stable.commit;
  const digestMatches = stableInstallProof.candidateTreeDigest === releaseChannels.stable.pluginTreeSha256
    && stableInstallProof.installedTreeDigest === releaseChannels.stable.pluginTreeSha256
    && stableInstallProof.matches === true;
  if (releaseChannels.stable.stableInstallProof !== expectedProofPath || !identityMatches || !digestMatches) {
    allPassed = false;
    console.error('✗ stable install proof alignment');
    console.error('  - INSTALL_PROVEN requires the canonical proof path, matching stable identity, and matching plugin tree digests');
  } else {
    console.log('✓ stable install proof alignment');
  }
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
}
