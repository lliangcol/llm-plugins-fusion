import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildOAuthRouteEnvironment,
  routeInvocationArgs,
  validateRouteResult,
} from '../../scripts/validate-plugin-route-live.mjs';

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

test('OAuth route environment requires an unambiguous subscription token', () => {
  assert.throws(
    () => buildOAuthRouteEnvironment({}, '/tmp/nova-oauth-test'),
    /CLAUDE_CODE_OAUTH_TOKEN is required/,
  );
  for (const variable of [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY',
  ]) {
    assert.throws(
      () => buildOAuthRouteEnvironment({
        CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test-token',
        [variable]: 'enabled',
      }, '/tmp/nova-oauth-test'),
      new RegExp(variable),
    );
  }
});

test('OAuth route invocation isolates configuration without bare mode', (t) => {
  const isolatedHome = mkdtempSync(resolve(tmpdir(), 'nova-oauth-test-'));
  t.after(() => rmSync(isolatedHome, { recursive: true, force: true }));
  const env = buildOAuthRouteEnvironment(
    { CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test-token', HOME: '/original' },
    isolatedHome,
  );
  assert.equal(env.HOME, isolatedHome);
  assert.equal(env.CLAUDE_CONFIG_DIR, resolve(isolatedHome, '.claude'));
  const args = routeInvocationArgs('/installed/nova-plugin');
  assert.equal(args.includes('--bare'), false);
  assert.deepEqual(args.slice(0, 2), ['--plugin-dir', '/installed/nova-plugin']);
  assert.ok(args.includes('dontAsk'));
  assert.ok(args.includes('Write,Edit,NotebookEdit,Bash'));
});
