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
  routeAllowedTools,
  routeFailureDetails,
  routeInvocationArgs,
  routeMaxTurns,
  routeOutputContract,
  routeOutputShape,
  routeSystemPrompt,
  routeValidationFailureCode,
  successfulRouteResponse,
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
  assert.deepEqual(validation.commandMatches, ['review']);
  assert.deepEqual(validation.skills, ['nova-review']);
  assert.deepEqual(validation.agents, ['reviewer']);
  assert.deepEqual(validation.packs, ['docs']);
});

test('live route result validator enforces command relationships', async () => {
  const inventory = await routeInventory();
  const valid = `## Recommended Route
- Command: /nova-plugin:review
- Skill: nova-review
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: none
`;
  assert.throws(
    () => validateRouteResult(valid.replace('nova-review', 'nova-explore'), inventory),
    /command-skill relationship differs/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('reviewer', 'builder'), inventory),
    /command-agent relationship differs/,
  );
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

  const valid = `## Recommended Route
- Command: /nova-plugin:review
- Skill: nova-review
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: /nova-plugin:explore
`;
  assert.throws(
    () => validateRouteResult(`${valid}- Closing: extra\n`, inventory),
    /exactly the heading and seven field lines/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('- Command:', '- Skill:').replace('- Skill: nova-review', '- Command: /nova-plugin:review'), inventory),
    /field order or label differs/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('- Required inputs: diff', '- Required inputs:'), inventory),
    /value is empty/,
  );

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
  assert.deepEqual(
    args.slice(args.indexOf('--allowedTools'), args.indexOf('--allowedTools') + 2),
    ['--allowedTools', routeAllowedTools.join(',')],
  );
  assert.deepEqual(
    args.slice(args.indexOf('--append-system-prompt'), args.indexOf('--append-system-prompt') + 2),
    ['--append-system-prompt', routeSystemPrompt],
  );
  assert.match(routeSystemPrompt, /Copy these four lines verbatim/);
  assert.match(routeSystemPrompt, /- Skill: nova-review/);
  assert.match(routeSystemPrompt, /- Core agent: reviewer/);
  assert.match(routeSystemPrompt, /- Capability packs: docs/);
  assert.deepEqual(
    args.slice(args.indexOf('--max-turns'), args.indexOf('--max-turns') + 2),
    ['--max-turns', String(routeMaxTurns)],
  );
  assert.ok(args.includes('Write,Edit,NotebookEdit,Bash'));
});

test('route output shape diagnostics expose structure without response text', () => {
  const result = `Alternate heading\n- Command: /nova-plugin:review\n- Skill: nova-review\nprivate response text`;
  const shape = routeOutputShape(result);
  assert.equal(shape.startsWithRequiredHeading, false);
  assert.deepEqual(shape.requiredFieldsPresent, ['Command:', 'Skill:']);
  assert.equal(shape.namespacedCommandCount, 1);
  assert.match(shape.sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(shape), /private response text|nova-review/);
});

test('stable route command executes directly and preserves the strict output boundary', async () => {
  const command = await readFile(resolve(root, 'nova-plugin/commands/route.md'), 'utf8');
  assert.match(command, /Execute this workflow directly from `\$ARGUMENTS`/);
  assert.match(command, /Do not invoke the compatibility skill `nova-route`/);
  assert.doesNotMatch(command, /Skill\(nova-plugin:nova-route\)/);
  const contract = await readFile(resolve(root, 'nova-plugin/skills/nova-route/SKILL.md'), 'utf8');
  assert.ok(contract.includes(routeOutputContract.heading));
  for (const field of routeOutputContract.requiredFields) assert.ok(contract.includes(field));
});

test('route validation diagnostics classify failures without output values', () => {
  for (const [message, code] of [
    ['route output does not start with heading', 'heading'],
    ['route output does not contain exactly the heading and seven field lines', 'line-count'],
    ['route output field order or label differs at Command:', 'field-layout'],
    ['route output Command: value is empty', 'empty-field-value'],
    ['route output is missing Command:', 'required-field'],
    ['route output invented command private-value', 'command-inventory'],
    ['route output invented skill private-value', 'skill-inventory'],
    ['route output invented core agent private-value', 'agent-inventory'],
    ['route output invented capability pack private-value', 'pack-inventory'],
    ['route output command-skill relationship differs', 'command-skill-relationship'],
    ['route output command-agent relationship differs', 'command-agent-relationship'],
  ]) assert.equal(routeValidationFailureCode(new Error(message)), code);
});

test('OAuth route failures report safe permission diagnostics without model output', () => {
  const details = routeFailureDetails({
    code: 1,
    timedOut: false,
    stdout: JSON.stringify({
      subtype: 'error_max_turns',
      terminal_reason: 'max_turns',
      result: 'unnecessary model transcript',
      permission_denials: [{
        tool_name: 'Skill',
        tool_input: { skill: 'nova-plugin:nova-route', args: 'private request text' },
      }],
      errors: ['Reached maximum number of turns (3)'],
    }),
    stderr: '',
  });
  assert.match(details, /exit=1 subtype=error_max_turns terminalReason=max_turns/);
  assert.match(details, /permissionDenials=Skill\(nova-plugin:nova-route\)/);
  assert.doesNotMatch(details, /unnecessary model transcript|private request text|Reached maximum/);

  const fallback = routeFailureDetails({
    code: null,
    errorMessage: 'spawn failed',
    stdout: '',
    stderr: 'sensitive diagnostic',
  });
  assert.equal(fallback, 'exit=unknown processError=spawn failed stderrPresent=true');
  assert.doesNotMatch(fallback, /sensitive diagnostic/);
});

test('OAuth route completion accepts only zero-exit or explicit Claude success JSON', () => {
  const result = 'strict route result';
  assert.equal(successfulRouteResponse({
    code: 0, timedOut: false, signal: null, stderr: '',
    stdout: JSON.stringify({ result }),
  }).result, result);
  assert.equal(successfulRouteResponse({
    code: 1, timedOut: false, signal: null, stderr: '',
    stdout: JSON.stringify({ subtype: 'success', terminal_reason: 'completed', result, permission_denials: [] }),
  }).result, result);
  for (const invocation of [
    { code: 2, timedOut: false, signal: null, stderr: '', stdout: JSON.stringify({ subtype: 'success', terminal_reason: 'completed', result }) },
    { code: 1, timedOut: false, signal: null, stderr: '', stdout: JSON.stringify({ subtype: 'error_max_turns', terminal_reason: 'max_turns', result }) },
    { code: 1, timedOut: false, signal: null, stderr: '', stdout: JSON.stringify({ subtype: 'success', terminal_reason: 'completed', result, is_error: true }) },
    { code: 1, timedOut: false, signal: null, stderr: '', stdout: JSON.stringify({ subtype: 'success', terminal_reason: 'completed', result, permission_denials: [{}] }) },
  ]) assert.equal(successfulRouteResponse(invocation), null);
  assert.equal(successfulRouteResponse({
    code: 1, timedOut: false, signal: null, stderr: 'warning',
    stdout: JSON.stringify({ subtype: 'success', terminal_reason: 'completed', result }),
  }).result, result);
});
