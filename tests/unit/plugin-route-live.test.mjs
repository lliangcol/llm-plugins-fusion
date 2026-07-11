import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateRouteResult } from '../../scripts/validate-plugin-route-live.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('live route result validator accepts fixed structure and real inventory', async () => {
  const spec = JSON.parse(await readFile(
    resolve(root, 'nova-plugin/runtime/workflow-permissions.json'),
    'utf8',
  ));
  const result = `## Recommended Route

- Command: /nova-plugin:review
- Skill: nova-review
- Core agent: reviewer
- Capability packs: docs
- Required inputs: README diff
- Validation expectations: link and docs validation
- Fallback path: /nova-plugin:explore
`;
  assert.deepEqual(validateRouteResult(result, spec).commandMatches, ['explore', 'review']);
});

test('live route result validator rejects bare, invented, or incomplete output', async () => {
  const spec = JSON.parse(await readFile(
    resolve(root, 'nova-plugin/runtime/workflow-permissions.json'),
    'utf8',
  ));
  assert.throws(() => validateRouteResult('## Recommended Route\n- Command: /review', spec), /missing Skill:/);
  const invented = `## Recommended Route
- Command: /nova-plugin:invented
- Skill: invented
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: none
`;
  assert.throws(() => validateRouteResult(invented, spec), /invented command/);
});
