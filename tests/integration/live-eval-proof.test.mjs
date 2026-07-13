import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');

test('live eval runner contains no model-visible proof token protocol', async () => {
  const source = await readFile(resolve(root, 'scripts/run-live-assistant-evals.mjs'), 'utf8');
  assert.doesNotMatch(source, /proofToken|adapterProof|randomBytes/u);
});
