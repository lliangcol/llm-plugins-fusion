#!/usr/bin/env node
/** Demonstrate fail-open gaps closed by the standard development-time engine. */

import assert from 'node:assert/strict';
import { validate, validateLegacySubset } from './validate-schemas.mjs';

const cases = [
  { id: 'contains', schema: { type: 'array', contains: { const: 'required' } }, data: ['other'] },
  { id: 'min-properties', schema: { type: 'object', minProperties: 2 }, data: { one: true } },
  { id: 'local-ref', schema: { $defs: { positive: { type: 'integer', minimum: 1 } }, $ref: '#/$defs/positive' }, data: 0 },
  { id: 'additional-property-schema', schema: { type: 'object', additionalProperties: { type: 'string' } }, data: { unsafe: 42 } },
];

for (const entry of cases) {
  assert.deepEqual(validateLegacySubset(entry.schema, entry.data), [], `${entry.id}: legacy subset no longer demonstrates the historical gap`);
  assert.notDeepEqual(validate(entry.schema, entry.data), [], `${entry.id}: standard engine failed open`);
}

console.log(`OK standard schema engine differential (${cases.length} historical fail-open cases rejected)`);
