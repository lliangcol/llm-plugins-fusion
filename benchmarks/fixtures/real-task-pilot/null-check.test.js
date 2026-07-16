import assert from 'node:assert/strict';
import test from 'node:test';
import { displayName } from './null-check.js';

test('returns a trimmed profile name', () => {
  assert.equal(displayName({ profile: { name: ' Nova ' } }), 'Nova');
});

test('returns an empty name when the profile is absent', () => {
  assert.equal(displayName({}), '');
});
