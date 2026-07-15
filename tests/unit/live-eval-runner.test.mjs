import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { classifyProcessFailure, codexPrompt, deriveAdapterLoadEvidence, evaluateSemanticCase, extractJsonOutput, main as liveMain, parseArgs, runLiveEvaluation, validateLiveCase } from '../../scripts/run-live-assistant-evals.mjs';
import { assertPublicEvidenceSafe } from '../../scripts/lib/evaluation-evidence.mjs';
import { buildLiveExecutionPlan } from '../../scripts/lib/live-evaluation-plan.mjs';

const root = resolve(import.meta.dirname, '../..');

test('critical runner derives three attempts and the 96-invocation governed profile', () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-enabled', '--case', 'critical-read-only-review', '--max-invocations', '3', '--plan']);
  const plan = buildLiveExecutionPlan(root, options);
  assert.equal(options.attempts, 3);
  assert.equal(plan.plannedInvocations, 3);
  assert.equal(plan.governedProfileInvocations, 96);
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
  const result = await runLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex-cli test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      const output = args[args.indexOf('--output-last-message') + 1];
      writeFileSync(output, JSON.stringify({ selectedRoute: ['review-only'], requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: '{"type":"turn.completed"}\n', stderr: '' };
    },
  });
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.rawArtifactCleanupFailures, 0);
  assert.equal(result.cases.every((entry) => entry.rawArtifactsRemoved), true);
  assert.equal(JSON.stringify(result).includes('observedOutput'), false);
});

test('simulated Claude enabled and disabled paths normalize route and approval output', async () => {
  const execute = (condition, caseId, resultText) => runLiveEvaluation(
    parseArgs(['--assistant', 'claude-code', '--profile', 'critical', '--condition', condition, '--case', caseId, '--max-invocations', '3']),
    {
      commandDetailsFn: async () => ({ available: true, detail: 'claude test-version' }),
      captureProcessFn: async (_label, _command, args) => {
        const debug = args[args.indexOf('--debug-file') + 1];
        writeFileSync(debug, 'nova-plugin loaded');
        return { ok: true, code: 0, timedOut: false, ms: 2, stdout: JSON.stringify({ result: resultText, usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 }, total_cost_usd: 0.01, permission_denials: [] }), stderr: '' };
      },
    },
  );
  const enabled = await execute('plugin-enabled', 'critical-read-only-review', '## Recommended Route\n/nova-plugin:review-only\nREVIEW_SCOPE');
  assert.equal(enabled.summary.passed, 3);
  assert.equal(enabled.assistant.adapterLoaded, true);
  assert.equal(enabled.cases[0].totalTokens, 5);
  const disabled = await execute('plugin-disabled', 'critical-missing-approval', 'PLAN_APPROVED is missing; block and stop');
  assert.equal(disabled.summary.passed, 3);
  assert.equal(disabled.assistant.adapterLoaded, false);
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

test('live plan main returns before execution and embedded JSON parser fails closed', async () => {
  await liveMain(['--assistant', 'codex', '--profile', 'critical', '--case', 'critical-read-only-review', '--max-invocations', '3', '--plan']);
  assert.throws(() => extractJsonOutput('no object'), /did not contain/u);
});

test('live eval parser accepts plain and embedded JSON', () => {
  assert.deepEqual(extractJsonOutput('{"selectedRoute":["review-only"]}'), { selectedRoute: ['review-only'] });
  assert.deepEqual(extractJsonOutput('result:\n{"blocked":true}\n'), { blocked: true });
});

test('live eval prompts distinguish route inventory from direct blocked workflows', () => {
  const route = codexPrompt({ kind: 'route', request: 'Route a review request.' });
  assert.match(route, /every canonical required input/u);
  assert.doesNotMatch(route, /list only unresolved/u);
  assert.doesNotMatch(route, /adapterProof|proof token/iu);
  const approval = codexPrompt({ kind: 'approval', workflow: 'implement-plan', request: 'Run it.', providedInputs: { PLAN_INPUT_PATH: 'plan.md' } });
  assert.match(approval, /selectedRoute to exactly \["implement-plan"\]/u);
  assert.match(approval, /PLAN_INPUT_PATH/u);
  assert.match(approval, /blocked=true/u);
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

test('adapter load evidence cannot validate a disabled baseline', () => {
  const enabled = deriveAdapterLoadEvidence({ condition: 'plugin-enabled', stagedAdapterSha256: 'a'.repeat(64), expectedAdapterSha256: 'a'.repeat(64), contractValid: true });
  assert.equal(enabled.loaded, true);
  assert.match(enabled.proof, /staged-adapter-sha256/u);
  const disabled = deriveAdapterLoadEvidence({ condition: 'plugin-disabled', stagedAdapterSha256: 'a'.repeat(64), expectedAdapterSha256: 'a'.repeat(64), contractValid: true });
  assert.deepEqual(disabled, { loaded: false, proof: 'plugin-disabled baseline' });
});
