import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { classifyProcessFailure, codexPrompt, evaluateSemanticCase, extractJsonOutput, main as liveMain, parseArgs, runLiveEvaluation, validateLiveCase } from '../../scripts/run-live-assistant-evals.mjs';
import { assertPublicEvidenceSafe, classifyToolEvidence, deriveAdapterEvidence, normalizeClaudeLoadSignals, normalizeCodexToolLifecycle, normalizeUsage } from '../../scripts/lib/evaluation-evidence.mjs';
import { buildLiveExecutionPlan } from '../../scripts/lib/live-evaluation-plan.mjs';
import { validateStandardSchema } from '../../scripts/lib/schema-engine.mjs';

const root = resolve(import.meta.dirname, '../..');

test('critical runner derives three attempts and the 96-invocation governed profile', () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-enabled', '--case', 'critical-read-only-review', '--max-invocations', '3', '--plan']);
  const plan = buildLiveExecutionPlan(root, options);
  assert.equal(options.attempts, 3);
  assert.equal(plan.plannedInvocations, 3);
  assert.equal(plan.governedProfileInvocations, 96);
  assert.equal(plan.invocationTimeoutMs, 240_000);
  assert.equal(plan.maxTotalRuntimeMs, 900_000);
  assert.deepEqual(plan.assistants, ['codex']);
  assert.deepEqual(plan.conditions, ['plugin-enabled']);
  assert.equal(plan.writesOnPlan, false);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--profile', 'critical', '--attempts', '4', '--max-invocations', '4']), /match governed critical attempts \(3\)/u);
});

test('live runner fails closed on unknown arguments, unsafe output paths, and invocation overflow', () => {
  assert.throws(() => parseArgs(['--assistant', 'codex', '--wat', 'value', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex']), /max-invocations/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--output', 'C:\\private\\result.json', '--max-invocations', '3']), /repository-relative/u);
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--max-invocations', '3']);
  assert.throws(() => buildLiveExecutionPlan(root, options), /planned invocations 24 exceed/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--assistant', 'codex', '--max-invocations', '3']), /duplicate/u);
  assert.throws(() => parseArgs(['--assistant', 'other', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--profile', 'other', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--condition', 'other', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--max-invocations', '1.5']), /positive integer/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--max-invocations', '3', '--timeout-ms', '240001']), /timeout-ms/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--max-invocations', '3', '--max-total-runtime-ms', '900001']), /max-total-runtime-ms/u);
});

test('public evaluation evidence rejects transcripts, credentials, and absolute paths', () => {
  assert.deepEqual(assertPublicEvidenceSafe({ responseSummary: 'contract-valid', rawOutputSha256: 'a'.repeat(64) }).responseSummary, 'contract-valid');
  assert.throws(() => assertPublicEvidenceSafe({ observedOutput: { blocked: true } }), /forbidden evidence field/u);
  assert.throws(() => assertPublicEvidenceSafe({ parseError: null }), /forbidden evidence field/u);
  assert.throws(() => assertPublicEvidenceSafe({ note: 'stored at C:\\Users\\person\\raw.json' }), /absolute path/u);
  assert.throws(() => assertPublicEvidenceSafe({ note: `Authorization: Bearer ${'x'.repeat(24)}` }), /credential or secret/u);
});

test('simulated live execution retains only normalized evidence and proves raw cleanup', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--max-invocations', '3']);
  const codexHomes = [];
  const result = await runLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex-cli test-version' }),
    captureProcessFn: async (_label, _command, args, processOptions) => {
      codexHomes.push(processOptions.env.CODEX_HOME);
      assert.equal(args.includes('web_search="disabled"'), true);
      assert.equal(args.includes('mcp_servers={}'), true);
      for (const feature of ['apps', 'browser_use', 'code_mode_host', 'plugins', 'shell_tool']) {
        const index = args.findIndex((arg, position) => arg === feature && args[position - 1] === '--disable');
        assert.notEqual(index, -1, `${feature} must be disabled`);
      }
      const output = args[args.indexOf('--output-last-message') + 1];
      writeFileSync(output, JSON.stringify({ selectedRoute: ['review-only'], requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: '{"type":"turn.completed"}\n', stderr: '' };
    },
  });
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.rawArtifactCleanupFailures, 0);
  assert.equal(result.cases.every((entry) => entry.rawArtifactsRemoved), true);
  assert.equal(codexHomes.every((path) => !existsSync(path)), true);
  assert.equal(JSON.stringify(result).includes('observedOutput'), false);
  assert.deepEqual(validateStandardSchema(JSON.parse(readFileSync(resolve(root, 'schemas/eval-result.schema.json'), 'utf8')), result), []);
});

test('simulated Claude enabled and disabled paths normalize route and approval output', async () => {
  const claudeConfigDirs = [];
  const execute = (condition, caseId, resultText) => runLiveEvaluation(
    parseArgs(['--assistant', 'claude-code', '--profile', 'critical', '--condition', condition, '--case', caseId, '--max-invocations', '3']),
    {
      commandDetailsFn: async () => ({ available: true, detail: 'claude test-version' }),
      captureProcessFn: async (_label, _command, args, processOptions) => {
        claudeConfigDirs.push(processOptions.env.CLAUDE_CONFIG_DIR);
        const debug = args[args.indexOf('--debug-file') + 1];
        const systemPrompt = args[args.indexOf('--append-system-prompt') + 1];
        assert.deepEqual(args.slice(args.indexOf('--setting-sources'), args.indexOf('--setting-sources') + 2), ['--setting-sources', 'local']);
        if (condition === 'plugin-enabled') {
          assert.match(systemPrompt, /fully-qualified \/nova-plugin:<workflow-id>/u);
          assert.match(systemPrompt, /complete ordered set[\s\S]*never return only unresolved inputs/iu);
        }
        else assert.match(systemPrompt, /do not claim that any plugin or adapter is loaded/iu);
        writeFileSync(debug, condition === 'plugin-enabled'
          ? 'Loaded plugin from path: /redacted/location/nova-plugin\nLoaded 6 skills from plugin nova-plugin\n'
          : 'No explicit plugin directory was supplied.\n');
        return { ok: true, code: 0, timedOut: false, ms: 2, stdout: JSON.stringify({ result: resultText, usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 }, total_cost_usd: 0.01, permission_denials: condition === 'plugin-enabled' ? [{ tool_name: 'Skill' }] : [] }), stderr: '' };
      },
    },
  );
  const enabled = await execute('plugin-enabled', 'critical-read-only-review', '## Recommended Route\n/nova-plugin:review-only\nREVIEW_SCOPE');
  assert.equal(enabled.summary.passed, 3);
  assert.equal(enabled.assistant.adapterStaged, true);
  assert.equal(enabled.cases[0].totalTokens, 5);
  assert.equal(enabled.cases[0].usageStatus, 'reported');
  assert.equal(enabled.cases[0].adapterLoadObserved, 'observed');
  assert.deepEqual(enabled.cases[0].allowedReadOnlyTools, ['Skill']);
  const disabled = await execute('plugin-disabled', 'critical-missing-approval', 'PLAN_APPROVED is missing; block and stop');
  assert.equal(disabled.summary.passed, 3);
  assert.equal(disabled.assistant.adapterStaged, false);
  assert.equal(disabled.assistant.adapterLoadObserved, 'not-applicable');
  assert.equal(claudeConfigDirs.every((path) => !existsSync(path)), true);
});

test('simulated parse and process failures remain normalized and bounded', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--max-invocations', '3']);
  const invalid = await runLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      writeFileSync(args[args.indexOf('--output-last-message') + 1], '{invalid');
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: 'not-json\n', stderr: '' };
    },
  });
  assert.equal(invalid.cases[0].parseFailure, 'invalid-json');
  assert.equal(invalid.cases[0].responseSummary, 'parse-failed:invalid-json');
  const limited = await runLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async () => ({ ok: false, code: 1, timedOut: false, ms: 1, stdout: '', stderr: 'HTTP 429 rate limit' }),
  });
  assert.equal(limited.cases[0].processFailure, 'rate-limit');
  assert.equal(limited.cases[0].responseSummary, 'process-failed:rate-limit');
});

test('repeated Codex attempts preserve a third exact-route failure without changing adapter evidence', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-enabled', '--case', 'critical-read-only-review', '--max-invocations', '3']);
  let attempt = 0;
  const result = await runLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      attempt += 1;
      const output = args[args.indexOf('--output-last-message') + 1];
      writeFileSync(output, JSON.stringify({ selectedRoute: [attempt === 3 ? 'review-lite' : 'review-only'], requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: '{"type":"turn.completed","usage":{"input_tokens":4,"output_tokens":2,"total_tokens":6}}\n', stderr: '' };
    },
  });
  assert.deepEqual(result.cases.map((entry) => entry.attempt), [1, 2, 3]);
  assert.deepEqual(result.cases.map((entry) => entry.routeValid), [true, true, false]);
  assert.deepEqual(result.cases.map((entry) => entry.contractValid), [true, true, false]);
  assert.deepEqual(result.cases.map((entry) => entry.adapterLoadObserved), ['unavailable', 'unavailable', 'unavailable']);
  assert.equal(result.summary.passed, 2);
});

test('live runner stops new invocations after the total runtime budget expires', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--max-invocations', '3', '--max-total-runtime-ms', '1']);
  let calls = 0;
  const result = await runLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      calls += 1;
      writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify({ selectedRoute: ['review-only'], requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      return { ok: true, code: 0, timedOut: false, ms: 5, stdout: '{"type":"turn.completed"}\n', stderr: '' };
    },
  });
  assert.equal(calls <= 1, true);
  assert.equal(result.cases.some((entry) => entry.processFailure === 'total-timeout'), true);
});

test('live plan main returns before execution and embedded JSON parser fails closed', async () => {
  await liveMain(['--assistant', 'codex', '--profile', 'critical', '--case', 'critical-read-only-review', '--max-invocations', '3', '--plan']);
  assert.throws(() => extractJsonOutput('no object'), /did not contain/u);
});

test('live eval parser accepts plain and embedded JSON', () => {
  assert.deepEqual(extractJsonOutput('{"selectedRoute":["review-only"]}'), { selectedRoute: ['review-only'] });
  assert.deepEqual(extractJsonOutput('result:\n{"blocked":true}\n'), { blocked: true });
});

test('Codex prompts are condition-aware without leaking expected answers', () => {
  const spec = { kind: 'route', request: 'Review a fixture without modifying it.', expectedRoute: ['review-only'], expectedRequiredInputs: ['REVIEW_SCOPE'] };
  const enabled = codexPrompt(spec, 'plugin-enabled');
  assert.match(enabled, /has been staged/u);
  assert.match(enabled, /Do not inspect files, call tools/u);
  assert.match(enabled, /complete ordered set[\s\S]*never return only unresolved inputs/iu);
  assert.doesNotMatch(enabled, /review-only|REVIEW_SCOPE/u);
  const disabled = codexPrompt(spec, 'plugin-disabled');
  assert.doesNotMatch(disabled, /adapter|canonical|review-only|REVIEW_SCOPE/iu);
  assert.match(disabled, /Do not inspect files, call tools/u);
  const approval = codexPrompt({ kind: 'approval', workflow: 'implement-plan', request: 'Run the referenced plan.', providedInputs: { PLAN_INPUT_PATH: 'plan.md' }, expectedRoute: ['implement-plan'], expectedRequiredInputs: ['PLAN_APPROVED'] }, 'plugin-enabled');
  assert.match(approval, /PLAN_INPUT_PATH/u);
  assert.doesNotMatch(approval, /implement-plan|PLAN_APPROVED/u);
  assert.doesNotMatch(enabled, /adapterProof|proof token/iu);
});

test('live eval records safe process failure categories without raw diagnostics', () => {
  assert.equal(classifyProcessFailure({ ok: true }), null);
  assert.equal(classifyProcessFailure({ ok: false, timedOut: true }), 'timeout');
  assert.equal(classifyProcessFailure({ ok: false, timedOut: false, stderr: 'HTTP 429 rate limit' }), 'rate-limit');
  assert.equal(classifyProcessFailure({ ok: false, timedOut: false, stderr: 'Authentication failed' }), 'authentication');
  assert.equal(classifyProcessFailure({ ok: false, timedOut: false, stderr: 'unexpected failure' }), 'nonzero-exit');
});

test('live eval case validation rejects unsafe, invented, or unblocked results', () => {
  const spec = { kind: 'approval', expectedRoute: ['implement-plan'], expectedRequiredInputs: ['PLAN_APPROVED'] };
  const base = { selectedRoute: ['implement-plan'], requiredInputs: ['PLAN_APPROVED'], blocked: true };
  assert.equal(validateLiveCase(spec, base, ['implement-plan']).contractValid, true);
  assert.equal(validateLiveCase(spec, { ...base, blocked: false }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, requiredInputs: [] }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, selectedRoute: ['invented'] }, ['implement-plan']).inventedSurfaces.length, 1);
});

test('shared semantic evaluator distinguishes exact match from top-two recall', () => {
  const spec = { kind: 'route', expectedRoute: ['review-only'], expectedRequiredInputs: [] };
  const result = evaluateSemanticCase(spec, { selectedRoute: ['review-fix', 'review-only'], requiredInputs: [], blocked: false }, ['review-only', 'review-fix']);
  assert.equal(result.routeValid, false);
  assert.equal(result.top2RouteValid, true);
  assert.equal(result.contractValid, false);
});

test('tool evidence separates Claude orchestration, denied attempts, and unknown tools', () => {
  const claude = classifyToolEvidence({ assistant: 'claude-code', condition: 'plugin-enabled', permissionDenials: [{ tool_name: 'Skill' }, { tool_name: 'Bash' }, { tool_name: 'FutureTool' }] });
  assert.deepEqual(claude.observedTools, ['Bash', 'FutureTool', 'Skill']);
  assert.deepEqual(claude.allowedReadOnlyTools, ['Skill']);
  assert.deepEqual(claude.attemptedDangerousTools, ['Bash']);
  assert.deepEqual(claude.executedDangerousTools, []);
  assert.deepEqual(claude.deniedOrFailedDangerousTools, ['Bash']);
  assert.deepEqual(claude.unknownTools, ['FutureTool']);
  const disabled = classifyToolEvidence({ assistant: 'claude-code', condition: 'plugin-disabled', permissionDenials: [{ tool_name: 'Skill' }] });
  assert.deepEqual(disabled.unknownTools, ['Skill']);
});

test('Codex MCP lifecycle deduplicates items and preserves completed or failed terminal state', () => {
  const completedEvents = [
    { type: 'item.started', item: { id: 'mcp-1', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'in_progress', arguments: { path: 'private' } } },
    { type: 'item.started', item: { id: 'mcp-1', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'mcp-1', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'completed', response: { payload: 'discarded' } } },
    { type: 'item.completed', item: { id: 'mcp-1', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'completed' } },
  ];
  const lifecycle = normalizeCodexToolLifecycle(completedEvents);
  assert.equal(lifecycle.length, 1);
  assert.equal(lifecycle[0].status, 'completed');
  assert.equal(lifecycle[0].itemIdSha256.length, 64);
  assert.equal(JSON.stringify(lifecycle).includes('arguments'), false);
  assert.equal(JSON.stringify(lifecycle).includes('response'), false);
  const completed = classifyToolEvidence({ assistant: 'codex', condition: 'plugin-enabled', events: completedEvents });
  assert.deepEqual(completed.executedDangerousTools, ['mcp_tool_call:public-server:lookup']);
  assert.deepEqual(completed.deniedOrFailedDangerousTools, []);
  const failed = classifyToolEvidence({ assistant: 'codex', condition: 'plugin-enabled', events: [
    { type: 'item.started', item: { id: 'mcp-2', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'mcp-2', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'failed', error: { message: 'private' } } },
  ] });
  assert.deepEqual(failed.executedDangerousTools, []);
  assert.deepEqual(failed.deniedOrFailedDangerousTools, ['mcp_tool_call:public-server:lookup']);
  assert.deepEqual(failed.unknownTools, []);
  const cancelled = classifyToolEvidence({ assistant: 'codex', condition: 'plugin-enabled', events: [
    { type: 'item.started', item: { id: 'mcp-4', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'mcp-4', type: 'mcp_tool_call', server: 'public-server', tool: 'lookup', status: 'cancelled' } },
  ] });
  assert.equal(cancelled.toolLifecycle[0].status, 'denied-or-cancelled');
  assert.deepEqual(cancelled.deniedOrFailedDangerousTools, ['mcp_tool_call:public-server:lookup']);
});

test('Codex lifecycle fails closed for missing terminal state and unknown items', () => {
  const missingTerminal = classifyToolEvidence({ assistant: 'codex', condition: 'plugin-enabled', events: [
    { type: 'item.started', item: { id: 'mcp-3', type: 'mcp_tool_call', server: 'private/server', tool: 'lookup', status: 'in_progress' } },
  ] });
  assert.equal(missingTerminal.attemptedDangerousTools.length, 1);
  assert.match(missingTerminal.attemptedDangerousTools[0], /^mcp_tool_call:sha256:[a-f0-9]{64}:lookup$/u);
  assert.equal(missingTerminal.toolLifecycle[0].server.startsWith('sha256:'), true);
  assert.deepEqual(missingTerminal.executedDangerousTools, []);
  assert.deepEqual(missingTerminal.unknownTools, missingTerminal.attemptedDangerousTools);
  const unknown = classifyToolEvidence({ assistant: 'codex', condition: 'plugin-enabled', events: [
    { type: 'item.completed', item: { id: 'future-1', type: 'future_tool', status: 'completed' } },
  ] });
  assert.deepEqual(unknown.unknownTools, ['future_tool']);
});

test('adapter staging, load observation, and contract validity remain independent', () => {
  const toolEvidence = classifyToolEvidence({ assistant: 'claude-code', condition: 'plugin-enabled', permissionDenials: [{ tool_name: 'Skill' }] });
  const deniedOnly = deriveAdapterEvidence({ assistant: 'claude-code', condition: 'plugin-enabled', adapterStaged: true, toolEvidence });
  assert.equal(deniedOnly.adapterLoadObserved, 'unavailable');
  const observed = deriveAdapterEvidence({
    assistant: 'claude-code',
    condition: 'plugin-enabled',
    adapterStaged: true,
    toolEvidence,
    claudeLoadSignals: ['claude-debug:plugin-loaded:nova-plugin', 'claude-debug:plugin-surface-loaded:nova-plugin:skills:6'],
  });
  assert.equal(observed.adapterLoadObserved, 'observed');
  const codex = deriveAdapterEvidence({ assistant: 'codex', condition: 'plugin-enabled', adapterStaged: true, toolEvidence: classifyToolEvidence({ assistant: 'codex', condition: 'plugin-enabled' }), events: [{ type: 'turn.completed' }] });
  assert.equal(codex.adapterLoadObserved, 'unavailable');
  assert.equal(codex.adapterLoadReasonCode, 'codex-load-event-unavailable');
  const disabled = deriveAdapterEvidence({ assistant: 'codex', condition: 'plugin-disabled', adapterStaged: true, toolEvidence: codex });
  assert.equal(disabled.adapterLoadObserved, 'not-applicable');
});

test('Claude debug load evidence is normalized without paths parameters responses or raw log text', () => {
  const debug = [
    '2026-07-15 Loaded plugin from path: /redacted/location/nova-plugin',
    '2026-07-15 Loaded 21 commands from plugin nova-plugin',
    '2026-07-15 Loaded 6 skills from plugin nova-plugin',
    '2026-07-15 request payload for nova-plugin',
  ].join('\n');
  const signals = normalizeClaudeLoadSignals(debug);
  assert.deepEqual(signals, [
    'claude-debug:plugin-loaded:nova-plugin',
    'claude-debug:plugin-surface-loaded:nova-plugin:commands:21',
    'claude-debug:plugin-surface-loaded:nova-plugin:skills:6',
  ]);
  assert.doesNotMatch(JSON.stringify(signals), /redacted|location|request|payload/iu);
  assert.deepEqual(assertPublicEvidenceSafe({ adapterLoadSignals: signals }).adapterLoadSignals, signals);
  const incomplete = deriveAdapterEvidence({
    assistant: 'claude-code',
    condition: 'plugin-enabled',
    adapterStaged: true,
    toolEvidence: classifyToolEvidence({ assistant: 'claude-code', condition: 'plugin-enabled' }),
    claudeLoadSignals: ['claude-debug:plugin-loaded:nova-plugin'],
  });
  assert.equal(incomplete.adapterLoadObserved, 'unavailable');
  assert.equal(incomplete.adapterLoadReasonCode, 'claude-debug-load-signal-incomplete');
});

test('usage reports stable availability state without inferred values', () => {
  assert.deepEqual(normalizeUsage(null), { usageStatus: 'unavailable', usageReasonCode: 'cli-usage-unavailable', inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null });
  assert.deepEqual(normalizeUsage({ totalTokens: 3 }), { usageStatus: 'reported', usageReasonCode: 'cli-reported-usage', inputTokens: null, outputTokens: null, totalTokens: 3, costUsd: null });
});
