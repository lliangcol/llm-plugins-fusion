import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildOAuthRouteEnvironment,
  loadRouteInventory,
  projectSnapshot,
  routeInvocationArgs,
  validateRouteResult,
} from '../../scripts/validate-plugin-route-live.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pluginDir = resolve(root, 'nova-plugin');

async function routeInventory() {
  const spec = JSON.parse(await readFile(
    resolve(pluginDir, 'runtime/workflow-permissions.json'),
    'utf8',
  ));
  return loadRouteInventory(pluginDir, spec);
}

test('live route result validator accepts fixed structure and real inventory', async () => {
  const inventory = await routeInventory();
  const result = `## Recommended Route

- Command: /nova-plugin:review
- Skill: nova-review
- Core agent: reviewer
- Capability packs: docs
- Required inputs: README diff
- Validation expectations: link and docs validation
- Fallback path: /nova-plugin:explore
`;
  const validation = validateRouteResult(result, inventory);
  assert.deepEqual(validation.commandMatches, ['explore', 'review']);
  assert.deepEqual(validation.skills, ['nova-review']);
  assert.deepEqual(validation.agents, ['reviewer']);
  assert.deepEqual(validation.packs, ['docs']);
});

test('live route result validator rejects bare, invented, or incomplete output', async () => {
  const inventory = await routeInventory();
  assert.throws(() => validateRouteResult('## Recommended Route\n- Command: /review', inventory), /missing Skill:/);
  const invented = `## Recommended Route
- Command: /nova-plugin:invented
- Skill: invented
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: none
`;
  assert.throws(() => validateRouteResult(invented, inventory), /invented command/);

  for (const [field, value, message] of [
    ['Skill', 'nova-does-not-exist', /invented skill/],
    ['Core agent', 'imaginary-agent', /invented core agent/],
    ['Capability packs', 'imaginary-pack', /invented capability pack/],
  ]) {
    const invalid = `## Recommended Route
- Command: /nova-plugin:review
- Skill: ${field === 'Skill' ? value : 'nova-review'}
- Core agent: ${field === 'Core agent' ? value : 'reviewer'}
- Capability packs: ${field === 'Capability packs' ? value : 'docs'}
- Required inputs: diff
- Validation expectations: docs
- Fallback path: /nova-plugin:explore
`;
    assert.throws(() => validateRouteResult(invalid, inventory), message);
  }
});

test('project snapshot detects every worktree file change outside .git', async (t) => {
  const project = mkdtempSync(resolve(tmpdir(), 'nova-route-snapshot-'));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  await writeFile(resolve(project, 'README.md'), 'before\n');
  const before = projectSnapshot(project);
  await mkdir(resolve(project, 'ignored'), { recursive: true });
  await writeFile(resolve(project, 'ignored', 'side-effect.txt'), 'unexpected\n');
  const after = projectSnapshot(project);
  assert.notEqual(after.digest, before.digest);
  assert.deepEqual(after.files.map((entry) => entry.path), ['ignored', 'ignored/side-effect.txt', 'README.md']);
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
