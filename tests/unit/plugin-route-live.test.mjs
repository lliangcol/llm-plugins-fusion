import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildOAuthRouteEnvironment,
  captureRouteAssistantInvocation,
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
  resolveDefaultAssistantInvocation,
  runRouteSmoke,
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

- Canonical skill: nova-review
- Command entrypoint: /nova-plugin:review
- Variant parameters: {}
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
- Canonical skill: nova-review
- Command entrypoint: /nova-plugin:review
- Variant parameters: {}
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: none
`;
  assert.throws(
    () => validateRouteResult(valid.replace('nova-review', 'nova-explore'), inventory),
    /entrypoint-canonical relationship differs/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('reviewer', 'builder'), inventory),
    /command-agent relationship differs/,
  );
});

test('live route result validator rejects bare, invented, or incomplete output', async () => {
  const inventory = await routeInventory();
  assert.throws(() => validateRouteResult('## Recommended Route\n- Command entrypoint: /review', inventory), /missing Canonical skill:/);
  const invented = `## Recommended Route
- Canonical skill: invented
- Command entrypoint: /nova-plugin:invented
- Variant parameters: {}
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: none
`;
  assert.throws(() => validateRouteResult(invented, inventory), /invented command/);

  const valid = `## Recommended Route
- Canonical skill: nova-review
- Command entrypoint: /nova-plugin:review
- Variant parameters: {}
- Core agent: reviewer
- Capability packs: docs
- Required inputs: diff
- Validation expectations: docs
- Fallback path: /nova-plugin:explore
`;
  assert.throws(
    () => validateRouteResult(`${valid}- Closing: extra\n`, inventory),
    /exactly the heading and eight field lines/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('- Canonical skill:', '- Core agent:').replace('- Core agent: reviewer', '- Canonical skill: nova-review'), inventory),
    /field order or label differs/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('- Required inputs: diff', '- Required inputs:'), inventory),
    /value is empty/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('nova-review', 'NOVA-REVIEW'), inventory),
    /invented skill/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('nova-review', 'nova-review, nova-review'), inventory),
    /duplicate identifiers/,
  );
  assert.throws(
    () => validateRouteResult(valid.replace('Variant parameters: {}', 'Variant parameters: None'), inventory),
    /exact JSON object/,
  );

  for (const [field, value, message] of [
    ['Canonical skill', 'nova-does-not-exist', /invented skill/],
    ['Core agent', 'imaginary-agent', /invented core agent/],
    ['Capability packs', 'imaginary-pack', /invented capability pack/],
  ]) {
    const invalid = `## Recommended Route
- Canonical skill: ${field === 'Canonical skill' ? value : 'nova-review'}
- Command entrypoint: /nova-plugin:review
- Variant parameters: {}
- Core agent: ${field === 'Core agent' ? value : 'reviewer'}
- Capability packs: ${field === 'Capability packs' ? value : 'docs'}
- Required inputs: diff
- Validation expectations: docs
- Fallback path: /nova-plugin:explore
`;
    assert.throws(() => validateRouteResult(invalid, inventory), message);
  }
});

test('project snapshot detects worktree and Git control-file changes', async (t) => {
  const project = mkdtempSync(resolve(tmpdir(), 'nova-route-snapshot-'));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  await writeFile(resolve(project, 'README.md'), 'before\n');
  await mkdir(resolve(project, '.git'));
  await writeFile(resolve(project, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  const before = projectSnapshot(project);
  await mkdir(resolve(project, 'ignored'), { recursive: true });
  await writeFile(resolve(project, 'ignored', 'side-effect.txt'), 'unexpected\n');
  await writeFile(resolve(project, '.git', 'HEAD'), 'ref: refs/heads/changed\n');
  const after = projectSnapshot(project);
  assert.notEqual(after.digest, before.digest);
  assert.deepEqual(after.files.map((entry) => entry.path), ['.git', '.git/HEAD', 'ignored', 'ignored/side-effect.txt', 'README.md']);
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
    {
      CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test-token',
      HOME: '/original',
      PATH: dirname(process.execPath),
      KEEP: 'must-not-pass',
    },
    isolatedHome,
  );
  assert.equal(env.HOME, isolatedHome);
  assert.equal(env.CLAUDE_CONFIG_DIR, resolve(isolatedHome, '.claude'));
  assert.equal(env.TMPDIR, resolve(isolatedHome, 'tmp'));
  assert.equal(env.KEEP, undefined);
  const args = routeInvocationArgs('/installed/nova-plugin');
  assert.equal(args.includes('--bare'), false);
  assert.deepEqual(args.slice(0, 2), ['--plugin-dir', '/installed/nova-plugin']);
  assert.ok(args.includes('dontAsk'));
  assert.ok(routeAllowedTools.includes('Skill(nova-plugin:route)'));
  assert.ok(routeAllowedTools.includes('Skill(nova-plugin:nova-route)'));
  assert.deepEqual(
    args.slice(args.indexOf('--allowedTools'), args.indexOf('--allowedTools') + 2),
    ['--allowedTools', routeAllowedTools.join(',')],
  );
  assert.deepEqual(
    args.slice(args.indexOf('--append-system-prompt'), args.indexOf('--append-system-prompt') + 2),
    ['--append-system-prompt', routeSystemPrompt],
  );
  assert.match(routeSystemPrompt, /Copy these five lines verbatim/);
  assert.match(routeSystemPrompt, /- Canonical skill: nova-review/);
  assert.match(routeSystemPrompt, /- Core agent: reviewer/);
  assert.match(routeSystemPrompt, /- Capability packs: docs/);
  assert.deepEqual(
    args.slice(args.indexOf('--max-turns'), args.indexOf('--max-turns') + 2),
    ['--max-turns', String(routeMaxTurns)],
  );
  assert.ok(args.includes('Write,Edit,NotebookEdit,Bash'));
});

test('OAuth route environment rejects inherited runtime, model, endpoint, and shell overrides', () => {
  for (const [name, value] of [
    ['NODE_OPTIONS', '--require=/tmp/inject.cjs'],
    ['NODE_PATH', '/tmp/modules'],
    ['BASH_ENV', '/tmp/startup.sh'],
    ['ANTHROPIC_MODEL', 'uncontrolled-model'],
    ['ANTHROPIC_BASE_URL', 'https://uncontrolled.invalid'],
    ['CLAUDE_CODE_MODEL', 'uncontrolled-model'],
    ['CLAUDE_CODE_USE_BEDROCK', '1'],
    ['AWS_ACCESS_KEY_ID', 'competing-access-key'],
  ]) {
    assert.throws(
      () => buildOAuthRouteEnvironment({
        CLAUDE_CODE_OAUTH_TOKEN: 'oauth-test-token',
        PATH: dirname(process.execPath),
        [name]: value,
      }, '/tmp/nova-oauth-test'),
      new RegExp(`forbids inherited overrides: ${name}`, 'u'),
    );
  }
});

test('OAuth route invocation uses one fixed assistant command and revalidates it before and after execution', async () => {
  let identityChecks = 0;
  const calls = [];
  const invocation = {
    command: '/trusted/physical/claude',
    argsPrefix: ['fixed-prefix'],
    assertIdentity() { identityChecks += 1; },
  };
  const result = await captureRouteAssistantInvocation(
    invocation,
    ['--version'],
    { cwd: '/fixture', env: { PATH: '/untrusted' } },
    async (label, command, args, options) => {
      calls.push({ label, command, args, options });
      return { ok: true, code: 0 };
    },
  );
  assert.equal(result.ok, true);
  assert.equal(identityChecks, 2);
  assert.deepEqual(calls, [{
    label: 'OAuth route smoke',
    command: '/trusted/physical/claude',
    args: ['fixed-prefix', '--version'],
    options: { cwd: '/fixture', env: { PATH: '/untrusted' } },
  }]);

  let failureChecks = 0;
  await assert.rejects(
    captureRouteAssistantInvocation(
      { ...invocation, assertIdentity() { failureChecks += 1; } },
      [],
      {},
      async () => { throw new Error('simulated capture failure'); },
    ),
    /simulated capture failure/u,
  );
  assert.equal(failureChecks, 2);
  await assert.rejects(
    captureRouteAssistantInvocation({ command: 'claude', argsPrefix: [] }, [], {}),
    /fixed assistant invocation/u,
  );
});

test('standalone route resolver uses the cycle-free shared resolver and pins a Node shebang interpreter', { skip: process.platform === 'win32' }, async (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-route-default-assistant-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const trustedBin = resolve(fixture, 'bin');
  await mkdir(trustedBin);
  const trustedClaude = resolve(trustedBin, 'claude');
  await writeFile(trustedClaude, '#!/usr/bin/env node\nconsole.log("fixture");\n');
  await chmod(trustedClaude, 0o755);

  const invocation = await resolveDefaultAssistantInvocation({ PATH: trustedBin });
  assert.equal(invocation.command, realpathSync.native(process.execPath));
  assert.deepEqual(invocation.argsPrefix, [realpathSync.native(trustedClaude)]);
  assert.equal(invocation.environment.PATH, realpathSync.native(trustedBin));
  assert.doesNotThrow(() => invocation.assertIdentity());
});

test('route smoke rejects unsafe evidence output before assistant or OAuth execution', async () => {
  await assert.rejects(
    runRouteSmoke({ pluginDir, outPath: 'package.json', env: {} }),
    /must name a JSON file under/u,
  );
});

test('route output shape diagnostics expose structure without response text', () => {
  const result = `Alternate heading\n- Canonical skill: nova-review\n- Command entrypoint: /nova-plugin:review\nprivate response text`;
  const shape = routeOutputShape(result);
  assert.equal(shape.startsWithRequiredHeading, false);
  assert.deepEqual(shape.requiredFieldsPresent, ['Canonical skill:', 'Command entrypoint:']);
  assert.equal(shape.namespacedCommandCount, 1);
  assert.match(shape.sha256, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(shape), /private response text|nova-review/);
});

test('stable route command executes directly and preserves the strict output boundary', async () => {
  const command = await readFile(resolve(root, 'nova-plugin/commands/route.md'), 'utf8');
  assert.match(command, /canonical skill `\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/nova-route\/SKILL\.md`/);
  assert.match(command, /selector keys declared for `route` in `\$\{CLAUDE_PLUGIN_ROOT\}\/runtime\/resolved-variant-contracts\.json`/);
  assert.match(command, /complete resolved runtime contract is authoritative/iu);
  assert.doesNotMatch(command, /selector keys declared for `nova-route`/u);
  assert.doesNotMatch(command, /Skill\(nova-plugin:nova-route\)/);
  const contract = await readFile(resolve(root, 'nova-plugin/skills/nova-route/SKILL.md'), 'utf8');
  assert.ok(contract.includes(routeOutputContract.heading));
  for (const field of routeOutputContract.requiredFields) assert.ok(contract.includes(field));
});

test('route validation diagnostics classify failures without output values', () => {
  for (const [message, code] of [
    ['route output does not start with heading', 'heading'],
    ['route output does not contain exactly the heading and eight field lines', 'line-count'],
    ['route output field order or label differs at Canonical skill:', 'field-layout'],
    ['route output Canonical skill: value is empty', 'empty-field-value'],
    ['route output is missing Canonical skill:', 'required-field'],
    ['route output invented command private-value', 'command-inventory'],
    ['route output invented skill private-value', 'skill-inventory'],
    ['route output invented core agent private-value', 'agent-inventory'],
    ['route output invented capability pack private-value', 'pack-inventory'],
    ['route output entrypoint-canonical relationship differs', 'entrypoint-canonical-relationship'],
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
