import assert from 'node:assert/strict';
import test from 'node:test';
import { validate, validateSchemaKeywords } from '../../scripts/validate-schemas.mjs';

test('schema validator enforces integer, minimum, date-time, and deep uniqueItems', () => {
  assert.deepEqual(validate({ type: 'integer', minimum: 0 }, 1), []);
  assert.notDeepEqual(validate({ type: 'integer' }, 1.5), []);
  assert.notDeepEqual(validate({ type: 'number', minimum: 0 }, -1), []);
  assert.deepEqual(validate({ type: 'string', format: 'date-time' }, '2026-07-12T10:20:30Z'), []);
  assert.notDeepEqual(validate({ type: 'string', format: 'date-time' }, 'not-a-date'), []);
  assert.notDeepEqual(validate({ type: 'array', uniqueItems: true }, [{ a: 1, b: 2 }, { b: 2, a: 1 }]), []);
});

test('standard schema engine supports registered keywords and rejects unknown ones', () => {
  assert.deepEqual(validateSchemaKeywords({ type: 'string' }), []);
  assert.deepEqual(validateSchemaKeywords({ type: 'array', contains: { const: 'x' } }), []);
  assert.deepEqual(validateSchemaKeywords({ type: 'string', format: 'hostname' }), []);
  assert.match(validateSchemaKeywords({ type: 'string', inventedKeyword: true })[0], /strict mode: unknown keyword/);
  assert.notDeepEqual(validate({ type: 'array', contains: { const: 'x' } }, ['y']), []);
});
