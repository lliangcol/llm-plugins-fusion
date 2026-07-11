import assert from 'node:assert/strict';
import test from 'node:test';
import { requireOptionValue } from '../../scripts/lib/cli-args.mjs';

test('requireOptionValue accepts values and rejects missing or option-shaped values', () => {
  assert.equal(requireOptionValue(['--out', 'result.txt'], 0, '--out'), 'result.txt');
  assert.throws(() => requireOptionValue(['--out'], 0, '--out'), /requires a value/);
  assert.throws(() => requireOptionValue(['--out', '--help'], 0, '--out'), /requires a value/);
});
