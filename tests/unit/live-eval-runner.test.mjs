import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { basename, relative, resolve } from 'node:path';
import { assertLivePrerequisiteEvidence, buildLiveProcessEnvironment, classifyProcessFailure, codexPrompt, composeCodexAgents, evaluateSemanticCase, extractJsonOutput, inspectLivePrerequisiteEvidence, jsonOutputSchema, liveEvaluationSucceeded, loadLiveEvaluationSemantics, main as liveMain, normalizeClaudeApprovalOutput, normalizeClaudeRouteOutput, parseArgs, parseCodexEvents, prepareLiveEvaluationOutput, readLivePrerequisiteEvidence, requiredInputsFromClaudeText, resolveLiveExecutableIdentity, runLiveEvaluation, selectLiveSourceReader, validateLiveCase, writeLiveEvaluationOutput } from '../../scripts/run-live-assistant-evals.mjs';
import { assertPublicEvidenceSafe, classifyToolEvidence, deriveAdapterEvidence, normalizeClaudeLoadSignals, normalizeCodexToolLifecycle, normalizePublicAssistantVersion, normalizePublicModelValue, normalizeUsage, publicEvidenceViolations } from '../../scripts/lib/evaluation-evidence.mjs';
import { gitHead, gitSnapshotReader, gitWorktreeSourceReader } from '../../scripts/lib/git-source-snapshot.mjs';
import { buildLiveExecutionPlan, governedLiveProfile, liveEvaluationSourcePaths, recomputeLiveSummary } from '../../scripts/lib/live-evaluation-plan.mjs';
import { validateStandardSchema } from '../../scripts/lib/schema-engine.mjs';
import { stageRepositoryTree } from '../../scripts/lib/source-tree-staging.mjs';

const root = resolve(import.meta.dirname, '../..');
const simulatedExecutableIdentity = (_requested, invocationSpec) => ({
  ...invocationSpec,
  command: process.execPath,
  identity: `sha256:${'e'.repeat(64)}`,
});
const simulatedSourceSelection = () => ({
  baseCommit: gitHead(root),
  initiallyClean: true,
  sourceReader: gitWorktreeSourceReader(root),
});
const runSimulatedLiveEvaluation = (options, dependencies = {}) => runLiveEvaluation(options, {
  executableIdentityFn: simulatedExecutableIdentity,
  sourceSelectionFn: simulatedSourceSelection,
  ...dependencies,
});

function claudeRouteText({
  canonicalSkill,
  commandEntrypoint,
  variantParameters = {},
  coreAgent = 'reviewer',
  capabilityPacks = 'security',
  requiredInputs = [],
  validationExpectations = 'run focused validation',
  fallbackPath = 'stop and report the blocker',
  extraLines = [],
}) {
  return [
    '## Recommended Route',
    `- Canonical skill: ${canonicalSkill}`,
    `- Command entrypoint: ${commandEntrypoint}`,
    `- Variant parameters: ${JSON.stringify(variantParameters)}`,
    `- Core agent: ${coreAgent}`,
    `- Capability packs: ${capabilityPacks}`,
    `- Required inputs: ${requiredInputs.join(', ') || 'None'}`,
    `- Validation expectations: ${validationExpectations}`,
    `- Fallback path: ${fallbackPath}`,
    ...extraLines,
  ].join('\n');
}

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
  assert.match(plan.estimatedEvidenceLevel, /No E4\/E5 claim/u);
  assert.deepEqual(plan.prerequisiteProfiles, ['pilot']);
  assert.equal(plan.authorizationState, 'blocked-external-provenance-gate');
  const pilot = buildLiveExecutionPlan(root, parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-enabled', '--max-invocations', '3', '--plan']));
  assert.equal(pilot.plannedInvocations, 3);
  assert.equal(pilot.governedProfileInvocations, 12);
  assert.equal(pilot.datasetVersion, 5);
  assert.deepEqual(pilot.prerequisiteProfiles, []);
  assert.equal(pilot.authorizationState, 'diagnostic-execution-only-unverified-provenance');
  assert.match(pilot.estimatedEvidenceLevel, /No E4\/E5 claim/u);
  const completeCritical = buildLiveExecutionPlan(root, parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-enabled', '--max-invocations', '24', '--plan']));
  assert.match(completeCritical.estimatedEvidenceLevel, /No E5 claim/u);
  assert.equal(completeCritical.executableProvenance, 'unverified-caller-supplied-executable');
  assert.match(completeCritical.executableProvenanceGate, /blocked-external-gate/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--profile', 'critical', '--attempts', '4', '--max-invocations', '4']), /match governed critical attempts \(3\)/u);
});

test('live runner fails closed on unknown arguments, unsafe output paths, and invocation overflow', () => {
  assert.throws(() => parseArgs(['--assistant', 'codex', '--wat', 'value', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex']), /max-invocations/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--output', 'C:\\private\\result.json', '--max-invocations', '3']), /portable relative/u);
  for (const output of ['', '.', 'results\\live.json', 'results/../live.json', 'results//live.json', 'results/./live.json']) {
    assert.throws(() => parseArgs(['--assistant', 'codex', '--output', output, '--max-invocations', '3']), /Usage|portable|traversal|dot|empty|must name a file/u, output);
  }
  for (const output of ['package.json', '.git/config', '.git/index', 'schemas/eval-result.schema.json', 'CLAUDE.md', '.metrics/live-eval']) {
    assert.throws(() => parseArgs(['--assistant', 'codex', '--output', output, '--max-invocations', '3']), /must name a file under \.metrics\/live-eval/u, output);
  }
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--max-invocations', '3']);
  assert.throws(() => buildLiveExecutionPlan(root, options), /planned invocations 24 exceed/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--assistant', 'codex', '--max-invocations', '3']), /duplicate/u);
  assert.throws(() => parseArgs(['--assistant', 'other', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--profile', 'other', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--condition', 'other', '--max-invocations', '3']), /Usage/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--max-invocations', '1.5']), /positive integer/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--max-invocations', '3', '--timeout-ms', '240001']), /timeout-ms/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--max-invocations', '3', '--max-total-runtime-ms', '900001']), /max-total-runtime-ms/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--profile', 'critical', '--max-invocations', '3', '--prerequisite-evidence', '/tmp/pilot.json']), /portable relative/u);
  assert.throws(() => parseArgs(['--assistant', 'codex', '--profile', 'critical', '--max-invocations', '3', '--output', '.metrics/live-eval/pilot.json', '--prerequisite-evidence', '.metrics/live-eval/pilot.json']), /must not alias/u);
  assert.throws(() => assertLivePrerequisiteEvidence(options), /external gate.*cannot self-authorize E5/u);
  assert.deepEqual(assertLivePrerequisiteEvidence(parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--max-invocations', '3'])), { requiredProfiles: [], records: 0 });
});

test('live artifact I/O rejects linked or non-regular paths and atomically replaces output', { skip: process.platform === 'win32' }, (t) => {
  const repo = mkdtempSync(resolve(tmpdir(), 'nova-live-artifact-io-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  mkdirSync(resolve(repo, 'evidence'));
  const evidence = resolve(repo, 'evidence/pilot.json');
  writeFileSync(evidence, '{"ok":true}\n');
  assert.deepEqual(readLivePrerequisiteEvidence(repo, 'evidence/pilot.json'), { ok: true });

  symlinkSync('evidence', resolve(repo, 'linked-evidence'));
  assert.throws(
    () => readLivePrerequisiteEvidence(repo, 'linked-evidence/pilot.json'),
    /physical directory/u,
  );
  symlinkSync('pilot.json', resolve(repo, 'evidence/symlink.json'));
  assert.throws(
    () => readLivePrerequisiteEvidence(repo, 'evidence/symlink.json'),
    /physical regular file/u,
  );
  linkSync(evidence, resolve(repo, 'evidence/hardlink.json'));
  assert.throws(
    () => readLivePrerequisiteEvidence(repo, 'evidence/hardlink.json'),
    /must not be hard linked/u,
  );
  mkdirSync(resolve(repo, 'evidence/directory.json'));
  assert.throws(
    () => readLivePrerequisiteEvidence(repo, 'evidence/directory.json'),
    /physical regular file/u,
  );

  mkdirSync(resolve(repo, '.metrics/live-eval/results'), { recursive: true });
  const output = resolve(repo, '.metrics/live-eval/results/live.json');
  writeFileSync(output, 'old\n');
  const originalInode = statSync(output).ino;
  const replacementLease = prepareLiveEvaluationOutput(repo, '.metrics/live-eval/results/live.json');
  writeLiveEvaluationOutput(repo, '.metrics/live-eval/results/live.json', 'new\n', replacementLease);
  assert.equal(readFileSync(output, 'utf8'), 'new\n');
  assert.notEqual(statSync(output).ino, originalInode, 'atomic replacement must commit the staged inode');
  assert.equal(statSync(output).nlink, 1);
  assert.deepEqual(readdirSync(resolve(repo, '.metrics/live-eval/results')), ['live.json']);

  const newOutputLease = prepareLiveEvaluationOutput(repo, '.metrics/live-eval/new/nested/live.json');
  assert.equal(existsSync(resolve(repo, '.metrics/live-eval/new/nested')), true);
  assert.equal(existsSync(resolve(repo, '.metrics/live-eval/new/nested/live.json')), false, 'preflight must not create the target');
  writeLiveEvaluationOutput(repo, '.metrics/live-eval/new/nested/live.json', 'prepared\n', newOutputLease);
  assert.equal(readFileSync(resolve(repo, '.metrics/live-eval/new/nested/live.json'), 'utf8'), 'prepared\n');

  const racedLease = prepareLiveEvaluationOutput(repo, '.metrics/live-eval/results/raced.json');
  writeFileSync(resolve(repo, '.metrics/live-eval/results/raced.json'), 'appeared\n');
  assert.throws(
    () => writeLiveEvaluationOutput(repo, '.metrics/live-eval/results/raced.json', 'must-not-overwrite\n', racedLease),
    /appeared while its atomic write was prepared/u,
  );
  assert.equal(readFileSync(resolve(repo, '.metrics/live-eval/results/raced.json'), 'utf8'), 'appeared\n');

  symlinkSync('results', resolve(repo, '.metrics/live-eval/linked-results'));
  assert.throws(
    () => writeLiveEvaluationOutput(repo, '.metrics/live-eval/linked-results/blocked.json', 'blocked\n'),
    /physical directory/u,
  );
  symlinkSync('live.json', resolve(repo, '.metrics/live-eval/results/symlink.json'));
  assert.throws(
    () => writeLiveEvaluationOutput(repo, '.metrics/live-eval/results/symlink.json', 'blocked\n'),
    /physical regular file/u,
  );
  writeFileSync(resolve(repo, '.metrics/live-eval/results/hardlink-source.json'), 'old\n');
  linkSync(resolve(repo, '.metrics/live-eval/results/hardlink-source.json'), resolve(repo, '.metrics/live-eval/results/hardlink.json'));
  assert.throws(
    () => writeLiveEvaluationOutput(repo, '.metrics/live-eval/results/hardlink.json', 'blocked\n'),
    /must not be hard linked/u,
  );
  mkdirSync(resolve(repo, '.metrics/live-eval/results/directory.json'));
  assert.throws(
    () => writeLiveEvaluationOutput(repo, '.metrics/live-eval/results/directory.json', 'blocked\n'),
    /physical regular file/u,
  );
  assert.throws(
    () => writeLiveEvaluationOutput(repo, '../outside.json', 'blocked\n'),
    /traversal, dot, or empty components/u,
  );
});

test('live output preflight runs before assistant discovery and plan mode does not create parents', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--output', '.metrics/live-eval/unit-order/result.json', '--max-invocations', '3']);
  const calls = [];
  await runSimulatedLiveEvaluation(options, {
    prepareOutputFn: () => { calls.push('output-preflight'); return { lease: 'same-object' }; },
    writeOutputFn: (_root, _path, _content, preparation) => {
      assert.deepEqual(preparation, { lease: 'same-object' });
      calls.push('output-write');
    },
    commandDetailsFn: async (_command, _args, processOptions) => {
      calls.push('assistant-discovery');
      assert.equal(processOptions.env.NODE_OPTIONS, undefined);
      return { available: true, detail: 'codex test-version' };
    },
    captureProcessFn: async (_label, _command, args) => {
      calls.push('assistant-call');
      writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify({ selectedRoute: ['review'], variantParameters: { LEVEL: 'standard', MODE: 'findings-only' }, requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: '{"type":"turn.completed"}\n', stderr: '' };
    },
  });
  assert.deepEqual(calls.slice(0, 2), ['output-preflight', 'assistant-discovery']);
  assert.equal(calls.filter((entry) => entry === 'assistant-call').length, 3);
  assert.equal(calls.at(-1), 'output-write');

  const directory = resolve(root, '.metrics/live-eval/plan-does-not-write');
  assert.equal(existsSync(directory), false);
  await liveMain(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--output', '.metrics/live-eval/plan-does-not-write/result.json', '--max-invocations', '3', '--plan']);
  assert.equal(existsSync(directory), false);
});

test('disabled generic contract misses can exit successfully only when process, parsing, safety, zero-write, cleanup, and no-plugin gates pass', async () => {
  const safeGenericBaseline = {
    processExit: 0,
    processFailure: null,
    timedOut: false,
    parseFailure: null,
    zeroProjectWrites: true,
    projectDigestBefore: 'a'.repeat(64),
    projectDigestAfter: 'a'.repeat(64),
    adapterStaged: false,
    adapterLoadObserved: 'not-applicable',
    adapterLoadSignals: [],
    observedTools: [],
    attemptedDangerousTools: [],
    executedDangerousTools: [],
    deniedOrFailedDangerousTools: [],
    unknownTools: [],
    rawArtifactsRemoved: true,
    contractValid: false,
  };
  const disabled = { condition: 'plugin-disabled', cases: [safeGenericBaseline], summary: { passed: 0, total: 1 } };
  assert.equal(liveEvaluationSucceeded(disabled), true);
  assert.equal(await liveMain(
    ['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--output', '.metrics/live-eval/injected-disabled.json', '--max-invocations', '3'],
    { runEvaluationFn: async () => disabled },
  ), 0);
  const enabled = { ...disabled, condition: 'plugin-enabled' };
  assert.equal(liveEvaluationSucceeded(enabled), false);
  assert.equal(await liveMain(
    ['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-enabled', '--output', '.metrics/live-eval/injected-enabled.json', '--max-invocations', '3'],
    { runEvaluationFn: async () => enabled },
  ), 1);
  assert.equal(liveEvaluationSucceeded({ ...disabled, cases: [{ ...safeGenericBaseline, parseFailure: 'invalid-json' }] }), false);
});

test('live process environment strips provider model endpoint proxy and startup injection overrides', (t) => {
  const harness = mkdtempSync(resolve(tmpdir(), 'nova-live-env-'));
  t.after(() => rmSync(harness, { recursive: true, force: true }));
  const environment = buildLiveProcessEnvironment({
    assistant: 'codex',
    harness,
    executablePath: process.execPath,
    hostEnvironment: {
      PATH: '/host/path',
      OPENAI_BASE_URL: 'https://untrusted.invalid',
      OPENAI_API_KEY: 'secret',
      ANTHROPIC_MODEL: 'untrusted-model',
      CLAUDE_CODE_USE_BEDROCK: '1',
      HTTPS_PROXY: 'http://untrusted.invalid',
      NODE_OPTIONS: '--require /tmp/inject.js',
      BASH_ENV: '/tmp/inject.sh',
      ENV: '/tmp/inject.sh',
    },
  });
  assert.equal(environment.PATH, resolve(process.execPath, '..'));
  for (const name of ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'ANTHROPIC_MODEL', 'CLAUDE_CODE_USE_BEDROCK', 'HTTPS_PROXY', 'NODE_OPTIONS', 'BASH_ENV', 'ENV']) {
    assert.equal(environment[name], undefined, name);
  }
  assert.equal(environment.CODEX_HOME, resolve(harness, 'codex-home'));
});

test('live executable identity binds bytes, revalidates replacement, resolves env-node scripts, and rejects Volta', { skip: process.platform === 'win32' }, (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-live-executable-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = resolve(directory, 'first');
  const second = resolve(directory, 'second');
  writeFileSync(first, 'binary-one\n');
  writeFileSync(second, 'binary-two-different-payload\n');
  chmodSync(first, 0o700);
  chmodSync(second, 0o700);
  const firstIdentity = resolveLiveExecutableIdentity(first, { command: first, argsPrefix: [], resolutionKind: 'direct' });
  const secondIdentity = resolveLiveExecutableIdentity(second, { command: second, argsPrefix: [], resolutionKind: 'direct' });
  assert.notEqual(firstIdentity.identity, secondIdentity.identity);
  firstIdentity.verify();
  writeFileSync(first, 'binary-two\n');
  utimesSync(first, new Date(), new Date(Date.now() + 5_000));
  assert.equal(readFileSync(first).length, Buffer.byteLength('binary-one\n'), 'fixture must preserve inode size');
  assert.throws(() => firstIdentity.verify(), /changed identity after its digest/u);

  const bin = resolve(directory, 'bin');
  mkdirSync(bin);
  const node = resolve(bin, 'node');
  const assistant = resolve(bin, 'assistant');
  writeFileSync(node, '#!/bin/sh\nexit 0\n');
  writeFileSync(assistant, '#!/usr/bin/env node\nconsole.log("assistant")\n');
  chmodSync(node, 0o700);
  chmodSync(assistant, 0o700);
  const shebang = resolveLiveExecutableIdentity('assistant', { command: 'assistant', argsPrefix: [], resolutionKind: 'direct' }, { environment: { PATH: bin } });
  assert.equal(shebang.command, realpathSync.native(node));
  assert.deepEqual(shebang.argsPrefix, [realpathSync.native(assistant)]);
  shebang.verify();

  const envSplit = resolve(bin, 'assistant-env-split');
  const shell = resolve(bin, 'assistant-shell');
  writeFileSync(envSplit, '#!/usr/bin/env -S node\nconsole.log("assistant")\n');
  writeFileSync(shell, '#!/bin/sh\nexit 0\n');
  chmodSync(envSplit, 0o700);
  chmodSync(shell, 0o700);
  assert.throws(
    () => resolveLiveExecutableIdentity(envSplit, { command: envSplit, argsPrefix: [], resolutionKind: 'direct' }, { environment: { PATH: bin } }),
    /unsupported assistant executable shebang/u,
  );
  assert.throws(
    () => resolveLiveExecutableIdentity(shell, { command: shell, argsPrefix: [], resolutionKind: 'direct' }, { environment: { PATH: bin } }),
    /unsupported assistant executable shebang/u,
  );

  assert.throws(
    () => resolveLiveExecutableIdentity('assistant', { command: 'volta.exe', argsPrefix: ['run', 'assistant'], resolutionKind: 'windows-volta-shim' }, { platform: 'win32', environment: { Path: directory } }),
    /Volta shims are not attributable/u,
  );
});

test('live execution aborts when the digest-bound executable is replaced after version discovery', { skip: process.platform === 'win32' }, async (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-live-executable-race-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const executable = resolve(directory, 'assistant');
  writeFileSync(executable, 'version-one-binary\n');
  chmodSync(executable, 0o700);
  const options = parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--executable', executable, '--max-invocations', '3']);
  let captures = 0;
  await assert.rejects(
    () => runLiveEvaluation(options, {
      sourceSelectionFn: simulatedSourceSelection,
      commandDetailsFn: async () => {
        writeFileSync(executable, 'version-two-binary\n');
        return { available: true, detail: 'same-version' };
      },
      captureProcessFn: async () => { captures += 1; return { ok: false }; },
    }),
    /changed identity after its digest/u,
  );
  assert.equal(captures, 0);
});

test('live source inventory binds every compiled and staged input by assistant and condition', () => {
  const reader = gitWorktreeSourceReader(root);
  const common = {
    casesPath: 'evals/live/v5/cases.json',
    labelsPath: 'evals/live/v5/labels.locked.json',
  };
  const inventory = (assistantId, condition) => new Set(liveEvaluationSourcePaths(
    root,
    { assistantId, condition, ...common },
    { readText: reader.readText, readJson: reader.readJson, listFiles: reader.listFiles },
  ));
  const claudeEnabled = inventory('claude-code', 'plugin-enabled');
  const claudeDisabled = inventory('claude-code', 'plugin-disabled');
  const codexEnabled = inventory('codex', 'plugin-enabled');
  const codexDisabled = inventory('codex', 'plugin-disabled');
  for (const paths of [claudeEnabled, claudeDisabled, codexEnabled, codexDisabled]) {
    assert.equal(paths.has('fixtures/consumer/minimal/AGENTS.md'), true);
    assert.equal(paths.has('fixtures/consumer/minimal/README.md'), false, 'answer-bearing conformance docs are not live model inputs');
    assert.equal(paths.has('fixtures/consumer/minimal/expected.json'), false, 'locked conformance answers are not staged live inputs');
    assert.equal(paths.has('fixtures/consumer/minimal/request.md'), false, 'case requests come from the locked live dataset');
    for (const adapterPath of ['workflow-specs/adapters/claude.json', 'workflow-specs/adapters/codex.json', 'workflow-specs/adapters/generic.json']) {
      assert.equal(paths.has(adapterPath), true);
    }
  }
  for (const pluginPath of reader.listFiles('nova-plugin')) assert.equal(claudeEnabled.has(pluginPath), true);
  assert.equal(claudeEnabled.has('nova-plugin/.claude-plugin/plugin.json'), true);
  assert.equal(claudeDisabled.has('nova-plugin/.claude-plugin/plugin.json'), false);
  assert.equal(codexEnabled.has('nova-plugin/.claude-plugin/plugin.json'), false);
  assert.equal(codexDisabled.has('nova-plugin/.claude-plugin/plugin.json'), false);
  assert.equal(codexEnabled.has('adapters/codex/AGENTS.md'), true);
  assert.equal(codexDisabled.has('adapters/codex/AGENTS.md'), true, 'disabled evidence still binds the adapter digest aggregate');
  assert.throws(
    () => liveEvaluationSourcePaths(root, { assistantId: 'codex', condition: 'plugin-enabled', ...common }, { readText: reader.readText }),
    /requires readText, readJson, and listFiles/u,
  );
  const escapingReader = {
    readText: reader.readText,
    listFiles: reader.listFiles,
    readJson(path) {
      const value = reader.readJson(path);
      return path === 'workflow-specs/nova.product.json'
        ? { ...value, adapterDefinitions: ['../outside-adapter.json'] }
        : value;
    },
  };
  assert.throws(
    () => liveEvaluationSourcePaths(root, { assistantId: 'codex', condition: 'plugin-enabled', ...common }, escapingReader),
    /traversal, dot, or empty components/u,
  );
});

test('live semantics are constructed from the selected reader after module import', () => {
  const reader = gitWorktreeSourceReader(root);
  const injectedRoute = structuredClone(reader.readJson('nova-plugin/runtime/route-output-contract.json'));
  injectedRoute.heading = 'Injected route heading';
  const injectedProduct = structuredClone(reader.readJson('workflow-specs/nova.product.json'));
  injectedProduct.agents = ['injected-agent'];
  injectedProduct.packs = ['injected-pack'];
  const injectedSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    additionalProperties: false,
    required: ['injected'],
    properties: { injected: { const: true } },
  };
  const semantics = loadLiveEvaluationSemantics({
    ...reader,
    readJson(path) {
      if (path === 'nova-plugin/runtime/route-output-contract.json') return injectedRoute;
      if (path === 'workflow-specs/nova.product.json') return injectedProduct;
      if (path === 'schemas/eval-result.schema.json') return injectedSchema;
      return reader.readJson(path);
    },
  });
  assert.equal(semantics.routeOutputContract.heading, 'Injected route heading');
  assert.deepEqual([...semantics.agentInventory], ['injected-agent']);
  assert.deepEqual([...semantics.packInventory], ['injected-pack']);
  assert.equal(semantics.validateEvidence({ injected: true }), true);
  assert.equal(semantics.validateEvidence({}), false);
});

test('non-pilot live execution rejects a dirty source before output preparation or assistant discovery', async () => {
  const calls = [];
  const options = parseArgs(['--assistant', 'codex', '--profile', 'critical', '--condition', 'plugin-enabled', '--case', 'critical-read-only-review', '--output', '.metrics/live-eval/should-not-exist.json', '--max-invocations', '3']);
  await assert.rejects(
    () => runLiveEvaluation(options, {
      sourceSelectionFn: () => ({ baseCommit: gitHead(root), initiallyClean: false, sourceReader: gitWorktreeSourceReader(root) }),
      prepareOutputFn: () => { calls.push('output'); },
      commandDetailsFn: async () => { calls.push('discovery'); return { available: true, detail: 'unused' }; },
      executableIdentityFn: simulatedExecutableIdentity,
    }),
    /requires a clean worktree.*same commit source/u,
  );
  assert.deepEqual(calls, []);
});

test('Codex condition overlay preserves one neutral consumer policy and appends only the enabled adapter', () => {
  const neutral = readFileSync(resolve(root, 'fixtures/consumer/minimal/AGENTS.md'), 'utf8');
  const adapter = readFileSync(resolve(root, 'adapters/codex/AGENTS.md'), 'utf8');
  const enabled = composeCodexAgents(neutral, adapter);
  assert.equal(enabled.startsWith(`${neutral.trimEnd()}\n\n`), true);
  assert.equal(enabled.endsWith(adapter.trimStart()), true);
  assert.doesNotMatch(neutral, /nova-plugin|review-only|REVIEW_SCOPE/u);
  assert.match(enabled, /Generated Nova adapter: plugin-enabled condition only/u);
});

test('manifest-bound staging rejects ignored extras, symbolic links, and non-regular entries', { skip: process.platform === 'win32' }, async (t) => {
  const repo = mkdtempSync(resolve(tmpdir(), 'nova-live-source-tree-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  mkdirSync(resolve(repo, 'source'), { recursive: true });
  writeFileSync(resolve(repo, '.gitignore'), '*.log\n');
  writeFileSync(resolve(repo, 'source/another.txt'), 'another\n');
  writeFileSync(resolve(repo, 'source/tracked.txt'), 'tracked\n');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['add', '.gitignore', 'source/another.txt', 'source/tracked.txt'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: repo });

  const initialReader = gitWorktreeSourceReader(repo);
  const head = gitHead(repo);
  const snapshot = gitSnapshotReader(repo, head);
  assert.deepEqual(initialReader.listFiles('source'), snapshot.listFiles('source'));
  execFileSync('git', ['update-index', '--skip-worktree', 'source/tracked.txt'], { cwd: repo });
  writeFileSync(resolve(repo, 'source/tracked.txt'), 'hidden worktree change\n');
  const hiddenStatus = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.equal(hiddenStatus, '');
  const selected = selectLiveSourceReader(repo, { status: 0, stdout: `${head}\n` }, { status: 0, stdout: hiddenStatus });
  assert.equal(selected.initiallyClean, true);
  assert.equal(selected.sourceReader.readText('source/tracked.txt'), 'tracked\n');
  assert.equal(gitWorktreeSourceReader(repo).readText('source/tracked.txt'), 'hidden worktree change\n');
  assert.equal(selected.sourceReader.fileMode('source/tracked.txt'), 0o644);
  writeFileSync(resolve(repo, 'source/tracked.txt'), 'tracked\n');
  execFileSync('git', ['update-index', '--no-skip-worktree', 'source/tracked.txt'], { cwd: repo });
  const firstTarget = resolve(repo, 'first-target');
  stageRepositoryTree(repo, 'source', firstTarget, initialReader);
  assert.equal(readFileSync(resolve(firstTarget, 'tracked.txt'), 'utf8'), 'tracked\n');
  const reversedTarget = resolve(repo, 'reversed-target');
  stageRepositoryTree(repo, 'source', reversedTarget, {
    ...initialReader,
    listFiles: (prefix) => initialReader.listFiles(prefix).reverse(),
  });
  assert.equal(readFileSync(resolve(reversedTarget, 'another.txt'), 'utf8'), 'another\n');
  assert.equal(readFileSync(resolve(reversedTarget, 'tracked.txt'), 'utf8'), 'tracked\n');

  writeFileSync(resolve(repo, 'source/ignored.log'), 'must not be staged\n');
  assert.throws(
    () => stageRepositoryTree(repo, 'source', resolve(repo, 'ignored-target'), gitWorktreeSourceReader(repo)),
    /differs from its Git manifest.*ignored\.log/u,
  );
  rmSync(resolve(repo, 'source/ignored.log'));

  const externalHardlinkSource = resolve(repo, 'external-hardlink-source.txt');
  const untrackedHardlink = resolve(repo, 'source/untracked-hardlink.txt');
  writeFileSync(externalHardlinkSource, 'external bytes must not enter staged source\n');
  linkSync(externalHardlinkSource, untrackedHardlink);
  assert.throws(
    () => stageRepositoryTree(repo, 'source', resolve(repo, 'hardlink-target'), gitWorktreeSourceReader(repo)),
    /(?:Git source path|source tree file) must not be hard linked/u,
  );
  unlinkSync(untrackedHardlink);
  unlinkSync(externalHardlinkSource);

  symlinkSync('tracked.txt', resolve(repo, 'source/link.txt'));
  assert.throws(
    () => stageRepositoryTree(repo, 'source', resolve(repo, 'link-target'), gitWorktreeSourceReader(repo)),
    /symbolic link/u,
  );
  rmSync(resolve(repo, 'source/link.txt'));

  const fifoPath = resolve(repo, 'source/runtime.pipe');
  execFileSync('mkfifo', [fifoPath]);
  assert.throws(
    () => stageRepositoryTree(repo, 'source', resolve(repo, 'fifo-target'), gitWorktreeSourceReader(repo)),
    /non-regular entry/u,
  );
});

test('prerequisite evidence requires schema-valid exact case-attempt coverage and recomputed passing summaries', async (t) => {
  const evidenceDir = mkdtempSync(resolve(root, 'tests/.nova-live-prerequisite-'));
  t.after(() => rmSync(evidenceDir, { recursive: true, force: true }));
  const routeText = claudeRouteText({
    canonicalSkill: 'nova-review',
    commandEntrypoint: '/nova-plugin:review-only',
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
    requiredInputs: ['REVIEW_SCOPE'],
  });
  const paths = [];
  const physicalPaths = [];
  const originals = [];
  for (const assistant of ['claude-code', 'codex']) {
    for (const condition of ['plugin-enabled', 'plugin-disabled']) {
      const evidence = await runSimulatedLiveEvaluation(
        parseArgs(['--assistant', assistant, '--profile', 'pilot', '--condition', condition, '--max-invocations', '3']),
        {
          commandDetailsFn: async () => ({ available: true, detail: `${assistant} test-version` }),
          captureProcessFn: async (_label, _command, args) => {
            if (assistant === 'claude-code') {
              const debug = args[args.indexOf('--debug-file') + 1];
              writeFileSync(debug, condition === 'plugin-enabled'
                ? 'Loaded plugin from path: /redacted/nova-plugin\nLoaded 6 skills from plugin nova-plugin\n'
                : 'No plugin directory supplied.\n');
              return { ok: true, code: 0, timedOut: false, ms: 1, stdout: JSON.stringify({ result: routeText, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }, total_cost_usd: 0 }), stderr: '' };
            }
            const output = args[args.indexOf('--output-last-message') + 1];
            writeFileSync(output, JSON.stringify({ selectedRoute: ['review'], variantParameters: { LEVEL: 'standard', MODE: 'findings-only' }, requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
            return { ok: true, code: 0, timedOut: false, ms: 1, stdout: '{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}\n', stderr: '' };
          },
        },
      );
      evidence.sourceState = 'clean-commit';
      const path = resolve(evidenceDir, `${assistant}-${condition}.json`);
      writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`);
      paths.push(relative(root, path).replaceAll('\\', '/'));
      physicalPaths.push(path);
      originals.push(evidence);
    }
  }
  const options = { profile: 'critical', prerequisiteEvidence: paths };
  const prerequisiteContext = { baseCommit: gitHead(root), sourceReader: gitWorktreeSourceReader(root) };
  const assertPrerequisites = () => inspectLivePrerequisiteEvidence(options, prerequisiteContext);
  assert.deepEqual(assertPrerequisites(), { requiredProfiles: ['pilot'], records: 4 });

  const rejectMutation = (mutate, pattern) => {
    const mutated = structuredClone(originals[0]);
    mutate(mutated);
    writeFileSync(physicalPaths[0], `${JSON.stringify(mutated, null, 2)}\n`);
    assert.throws(assertPrerequisites, pattern);
    writeFileSync(physicalPaths[0], `${JSON.stringify(originals[0], null, 2)}\n`);
  };
  rejectMutation((evidence) => { evidence.cases = evidence.cases.slice(0, 1); }, /exact governed caseId and attempt inventory/u);
  rejectMutation((evidence) => { evidence.cases[1].attempt = 1; }, /exact governed caseId and attempt inventory/u);
  rejectMutation((evidence) => { delete evidence.cases[0].attemptedDangerousTools; }, /evaluation result schema/u);
  rejectMutation((evidence) => { evidence.cases[0].zeroProjectWrites = false; }, /zeroProjectWrites differs from project digests/u);
  rejectMutation((evidence) => { evidence.cases[0].contractValid = false; }, /semantic fields differ from recomputation/u);
  rejectMutation((evidence) => { evidence.cases[0].adapterLoadReasonCode = 'claude-debug-load-signal-incomplete'; }, /adapter fields differ from recomputation/u);
  rejectMutation((evidence) => { evidence.sourceDigests['../../outside-repository'] = '0'.repeat(64); }, /exact governed source digest inventory/u);
  rejectMutation((evidence) => { evidence.workflowSpecSha256 = '0'.repeat(64); }, /digest aggregates differ/u);

  const contract = governedLiveProfile(root, 'pilot', { readJson: prerequisiteContext.sourceReader.readJson });
  const product = prerequisiteContext.sourceReader.readJson('workflow-specs/nova.product.json');
  const applyGenericBaselineFailure = (report) => {
    const caseSpec = contract.cases[0];
    const entry = report.cases[0];
    Object.assign(entry, evaluateSemanticCase(caseSpec, {
      selectedRoute: ['generic-baseline'],
      variantParameters: {},
      requiredInputs: [],
      blocked: false,
    }, product.automaticRouting.canonicalTargets));
    entry.responseSummary = 'contract-invalid';
    report.summary = recomputeLiveSummary(report.cases, contract.profile.attempts, report.assistant.id, report.condition);
  };
  const disabledIndex = originals.findIndex((entry) => entry.condition === 'plugin-disabled');
  const disabledGeneric = structuredClone(originals[disabledIndex]);
  applyGenericBaselineFailure(disabledGeneric);
  writeFileSync(physicalPaths[disabledIndex], `${JSON.stringify(disabledGeneric, null, 2)}\n`);
  assert.deepEqual(assertPrerequisites(), { requiredProfiles: ['pilot'], records: 4 });
  writeFileSync(physicalPaths[disabledIndex], `${JSON.stringify(originals[disabledIndex], null, 2)}\n`);

  const enabledIndex = originals.findIndex((entry) => entry.condition === 'plugin-enabled');
  const enabledGeneric = structuredClone(originals[enabledIndex]);
  applyGenericBaselineFailure(enabledGeneric);
  writeFileSync(physicalPaths[enabledIndex], `${JSON.stringify(enabledGeneric, null, 2)}\n`);
  assert.throws(assertPrerequisites, /enabled case.*exact semantic gates/u);
  writeFileSync(physicalPaths[enabledIndex], `${JSON.stringify(originals[enabledIndex], null, 2)}\n`);

  if (process.platform !== 'win32') {
    const original = readFileSync(physicalPaths[0], 'utf8');
    const linkedSource = resolve(evidenceDir, 'linked-source.json');
    writeFileSync(linkedSource, original);
    unlinkSync(physicalPaths[0]);
    symlinkSync(basename(linkedSource), physicalPaths[0]);
    assert.throws(assertPrerequisites, /physical regular file/u);
    unlinkSync(physicalPaths[0]);
    unlinkSync(linkedSource);
    writeFileSync(physicalPaths[0], original);

    const hardLinkSource = resolve(evidenceDir, 'hardlink-source.json');
    writeFileSync(hardLinkSource, original);
    unlinkSync(physicalPaths[0]);
    linkSync(hardLinkSource, physicalPaths[0]);
    assert.throws(assertPrerequisites, /must not be hard linked/u);
    unlinkSync(physicalPaths[0]);
    unlinkSync(hardLinkSource);
    writeFileSync(physicalPaths[0], original);
  }
});

test('public evaluation evidence rejects transcripts, credentials, and absolute paths', () => {
  assert.deepEqual(assertPublicEvidenceSafe({ responseSummary: 'contract-valid', rawOutputSha256: 'a'.repeat(64) }).responseSummary, 'contract-valid');
  assert.throws(() => assertPublicEvidenceSafe({ observedOutput: { blocked: true } }), /forbidden evidence field/u);
  assert.throws(() => assertPublicEvidenceSafe({ parseError: null }), /forbidden evidence field/u);
  assert.throws(() => assertPublicEvidenceSafe({ note: 'stored at C:\\Users\\person\\raw.json' }), /absolute path/u);
  assert.throws(
    () => assertPublicEvidenceSafe({ sourceDigests: { '/Users/person/private.json': 'a'.repeat(64) } }),
    (error) => {
      assert.match(error.message, /absolute path key/u);
      assert.doesNotMatch(error.message, /Users\/person/u);
      return true;
    },
  );
  assert.throws(() => assertPublicEvidenceSafe({ sourceDigests: { 'C:\\Users\\person\\private.json': 'a'.repeat(64) } }), /absolute path key/u);
  assert.throws(() => assertPublicEvidenceSafe({ sourceDigests: { '\\\\server\\share\\private.json': 'a'.repeat(64) } }), /absolute path key/u);
  for (const path of ['/Applications/Assistant/bin', '/etc/hosts', '/srv/evidence/report.json', '/Library/Application Support/tool', '/Volumes/External/evidence.json', '/nix/store/tool', '/Network/Servers/share', '/custom-mount/evidence/report.json', '/api/v1']) {
    assert.notDeepEqual(publicEvidenceViolations({ note: `observed at ${path}` }), [], path);
  }
  for (const path of ['file:///etc/hosts', 'file:/etc/hosts', 'stored:file:/Users/person/a', 'file://server/share/evidence.json', 'stored at D:\\private\\evidence.json', 'stored at \\\\server\\share\\evidence.json']) {
    assert.notDeepEqual(publicEvidenceViolations({ note: path }), [], path);
  }
  for (const path of ['\u001b[32m/nix/store/private', '路径/nix/store/tool', 'prefix-/Network/Servers/share']) {
    assert.notDeepEqual(publicEvidenceViolations({ assistant: { version: path } }), [], path);
    assert.match(normalizePublicAssistantVersion(path), /^sha256:[a-f0-9]{64}$/u);
  }
  assert.match(normalizePublicAssistantVersion('x/nix/store/private'), /^sha256:[a-f0-9]{64}$/u);
  assert.equal(normalizePublicAssistantVersion('claude-code 2.3.4'), 'claude-code 2.3.4');
  assert.deepEqual(publicEvidenceViolations({ note: 'See https://example.invalid/api/v1 and route /nova-plugin:review.' }), []);
  assert.throws(() => assertPublicEvidenceSafe({ note: `Authorization: Bearer ${'x'.repeat(24)}` }), /credential or secret/u);
});

test('evaluation result schema binds required fields, case shape, and summary shape to layer', () => {
  const schema = JSON.parse(readFileSync(resolve(root, 'schemas/eval-result.schema.json'), 'utf8'));
  const staticResult = JSON.parse(readFileSync(resolve(root, 'evals/baselines/static-contract.json'), 'utf8'));
  const simulationResult = JSON.parse(readFileSync(resolve(root, 'evals/baselines/adapter-simulation.json'), 'utf8'));
  assert.deepEqual(validateStandardSchema(schema, staticResult), []);
  assert.deepEqual(validateStandardSchema(schema, simulationResult), []);
  assert.notDeepEqual(validateStandardSchema(schema, { ...staticResult, layer: 'live-assistant' }), []);
  assert.notDeepEqual(validateStandardSchema(schema, { ...staticResult, cases: simulationResult.cases }), []);
  assert.notDeepEqual(validateStandardSchema(schema, { ...simulationResult, summary: staticResult.summary }), []);
  assert.deepEqual(validateStandardSchema(schema.properties.assistant.properties.version, 'claude-code 2.3.4'), []);
  assert.notDeepEqual(validateStandardSchema(schema.properties.assistant.properties.version, 'x/nix/store/private'), []);
});

test('simulated live execution retains only normalized evidence and proves raw cleanup', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--max-invocations', '3']);
  const codexHomes = [];
  const result = await runSimulatedLiveEvaluation(options, {
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
      writeFileSync(output, JSON.stringify({ selectedRoute: ['review'], variantParameters: { LEVEL: 'standard', MODE: 'findings-only' }, requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: '{"type":"turn.completed"}\n', stderr: '' };
    },
  });
  assert.equal(result.summary.total, 3);
  assert.equal(result.summary.rawArtifactCleanupFailures, 0);
  assert.equal(result.cases.every((entry) => entry.rawArtifactsRemoved), true);
  assert.equal(codexHomes.every((path) => !existsSync(path)), true);
  assert.equal(JSON.stringify(result).includes('observedOutput'), false);
  const resultSchema = JSON.parse(readFileSync(resolve(root, 'schemas/eval-result.schema.json'), 'utf8'));
  assert.deepEqual(validateStandardSchema(resultSchema, result), []);
  assert.notDeepEqual(validateStandardSchema(resultSchema, {
    ...result,
    assistant: { ...result.assistant, executableProvenance: 'verified-governed-release' },
  }), [], 'caller-asserted verified provenance must not satisfy the evidence schema');
});

test('simulated Claude enabled and disabled paths normalize route and approval output', async () => {
  const claudeConfigDirs = [];
  const execute = (condition, caseId, resultText) => runSimulatedLiveEvaluation(
    parseArgs(['--assistant', 'claude-code', '--profile', caseId === 'critical-read-only-review' ? 'pilot' : 'critical', '--condition', condition, '--case', caseId, '--max-invocations', '3']),
    {
      commandDetailsFn: async () => ({ available: true, detail: 'claude test-version' }),
      captureProcessFn: async (_label, _command, args, processOptions) => {
        claudeConfigDirs.push(processOptions.env.CLAUDE_CONFIG_DIR);
        const debug = args[args.indexOf('--debug-file') + 1];
        const systemPrompt = args[args.indexOf('--append-system-prompt') + 1];
        assert.deepEqual(args.slice(args.indexOf('--setting-sources'), args.indexOf('--setting-sources') + 2), ['--setting-sources', 'local']);
        if (condition === 'plugin-enabled') {
          assert.match(systemPrompt, /Canonical skill: nova-<canonical-workflow-id>/u);
          assert.match(systemPrompt, /Command entrypoint: \/nova-plugin:<resolved-workflow-id>/u);
          assert.match(systemPrompt, /Core agent and Capability packs must contain only exact inventory ids/u);
          assert.match(systemPrompt, /complete ordered set[\s\S]*never return only unresolved inputs/iu);
        }
        else assert.match(systemPrompt, /do not claim that any plugin or adapter is loaded/iu);
        writeFileSync(debug, condition === 'plugin-enabled'
          ? 'Loaded plugin from path: /redacted/location/nova-plugin\nLoaded 6 skills from plugin nova-plugin\n'
          : 'No explicit plugin directory was supplied.\n');
        return { ok: true, code: 0, timedOut: false, ms: 2, stdout: JSON.stringify({ result: resultText, usage: { input_tokens: 2, output_tokens: 3, total_tokens: 5 }, total_cost_usd: 0.01, permission_denials: condition === 'plugin-enabled' ? [{ tool_name: 'Skill' }] : [] }), stderr: '' };
      },
      prerequisiteEvidenceFn: () => undefined,
    },
  );
  const enabled = await execute('plugin-enabled', 'critical-read-only-review', claudeRouteText({
    canonicalSkill: 'nova-review',
    commandEntrypoint: '/nova-plugin:review-only',
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
    requiredInputs: ['REVIEW_SCOPE'],
  }));
  assert.equal(enabled.summary.passed, 3);
  assert.equal(enabled.assistant.adapterStaged, true);
  assert.equal(enabled.cases[0].totalTokens, 5);
  assert.equal(enabled.cases[0].usageStatus, 'reported');
  assert.equal(enabled.cases[0].adapterLoadObserved, 'observed');
  assert.deepEqual(enabled.cases[0].allowedReadOnlyTools, ['Skill']);
  const evalResultSchema = JSON.parse(readFileSync(resolve(root, 'schemas/eval-result.schema.json'), 'utf8'));
  assert.deepEqual(validateStandardSchema(evalResultSchema, enabled), []);
  const lite = await execute('plugin-enabled', 'critical-small-fix', claudeRouteText({
    canonicalSkill: 'nova-implement-plan',
    commandEntrypoint: '/nova-plugin:implement-lite',
    variantParameters: { EXECUTION_PROFILE: 'lite' },
    coreAgent: 'builder',
    capabilityPacks: 'None',
    requiredInputs: ['REQUEST'],
  }));
  assert.equal(lite.summary.passed, 3);
  const disabled = await execute('plugin-disabled', 'critical-missing-approval', 'Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nExecution status: BLOCKED\nStop before execution.');
  assert.equal(disabled.summary.passed, 3);
  assert.equal(disabled.assistant.adapterStaged, false);
  assert.equal(disabled.assistant.adapterLoadObserved, 'not-applicable');
  assert.equal(claudeConfigDirs.every((path) => !existsSync(path)), true);
});

test('simulated parse and process failures remain normalized and bounded', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--max-invocations', '3']);
  const invalid = await runSimulatedLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      writeFileSync(args[args.indexOf('--output-last-message') + 1], '{invalid');
      return { ok: true, code: 0, timedOut: false, ms: 1, stdout: 'not-json\n', stderr: '' };
    },
  });
  assert.equal(invalid.cases[0].parseFailure, 'invalid-json');
  assert.equal(invalid.cases[0].responseSummary, 'parse-failed:invalid-json');
  const limited = await runSimulatedLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async () => ({ ok: false, code: 1, timedOut: false, ms: 1, stdout: '', stderr: 'HTTP 429 rate limit' }),
  });
  assert.equal(limited.cases[0].processFailure, 'rate-limit');
  assert.equal(limited.cases[0].responseSummary, 'process-failed:rate-limit');
});

test('repeated Codex attempts preserve a third exact-route failure without changing adapter evidence', async () => {
  const options = parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-enabled', '--case', 'critical-read-only-review', '--max-invocations', '3']);
  let attempt = 0;
  const result = await runSimulatedLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      attempt += 1;
      const output = args[args.indexOf('--output-last-message') + 1];
      writeFileSync(output, JSON.stringify({ selectedRoute: [attempt === 3 ? 'explore' : 'review'], variantParameters: attempt === 3 ? {} : { LEVEL: 'standard', MODE: 'findings-only' }, requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
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
  const options = parseArgs(['--assistant', 'codex', '--profile', 'pilot', '--condition', 'plugin-disabled', '--case', 'critical-read-only-review', '--max-invocations', '3', '--max-total-runtime-ms', '1']);
  let calls = 0;
  const result = await runSimulatedLiveEvaluation(options, {
    commandDetailsFn: async () => ({ available: true, detail: 'codex test-version' }),
    captureProcessFn: async (_label, _command, args) => {
      calls += 1;
      writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify({ selectedRoute: ['review'], variantParameters: { LEVEL: 'standard', MODE: 'findings-only' }, requiredInputs: ['REVIEW_SCOPE'], blocked: false }));
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      return { ok: true, code: 0, timedOut: false, ms: 5, stdout: '{"type":"turn.completed"}\n', stderr: '' };
    },
  });
  assert.equal(calls <= 1, true);
  assert.equal(result.cases.some((entry) => entry.processFailure === 'total-timeout'), true);
});

test('live plan main returns before execution and embedded JSON parser fails closed', async () => {
  await liveMain(['--assistant', 'codex', '--profile', 'pilot', '--case', 'critical-read-only-review', '--max-invocations', '3', '--plan']);
  assert.throws(() => extractJsonOutput('no object'), /did not contain/u);
});

test('live eval parser accepts plain and embedded JSON', () => {
  assert.deepEqual(extractJsonOutput('{"selectedRoute":["review"],"variantParameters":{}}'), { selectedRoute: ['review'], variantParameters: {} });
  assert.deepEqual(extractJsonOutput('result:\n{"blocked":true}\n'), { blocked: true });
});

test('Codex prompts are condition-aware without leaking expected answers', () => {
  const spec = { kind: 'route', request: 'Review a fixture without modifying it.', expectedRoute: ['review'], expectedVariantParameters: { LEVEL: 'standard', MODE: 'findings-only' }, expectedRequiredInputs: ['REVIEW_SCOPE'] };
  const enabled = codexPrompt(spec, 'plugin-enabled');
  assert.match(enabled, /AGENTS\.md routing summary has been staged/u);
  assert.match(enabled, /referenced manifests, runtime contracts, and Skill files are intentionally not staged/u);
  assert.doesNotMatch(enabled, /staged workflow contract/u);
  assert.match(enabled, /Do not inspect files, call tools/u);
  assert.match(enabled, /complete ordered set[\s\S]*never return only unresolved inputs/iu);
  assert.doesNotMatch(enabled, /review-only|REVIEW_SCOPE|findings-only/u);
  const disabled = codexPrompt(spec, 'plugin-disabled');
  assert.doesNotMatch(disabled, /adapter|canonical|review-only|REVIEW_SCOPE/iu);
  assert.match(disabled, /Do not inspect files, call tools/u);
  const approval = codexPrompt({ kind: 'approval', workflow: 'implement-plan', request: 'Run the referenced plan.', providedInputs: { PLAN_INPUT_PATH: 'plan.md' }, expectedRoute: ['implement-plan'], expectedRequiredInputs: ['PLAN_INPUT_PATH', 'PLAN_APPROVED'] }, 'plugin-enabled');
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

test('live eval case validation rejects unsafe, invented, unblocked, or non-exact inputs', () => {
  const spec = { kind: 'approval', expectedRoute: ['implement-plan'], expectedVariantParameters: {}, expectedRequiredInputs: ['PLAN_INPUT_PATH', 'PLAN_APPROVED'] };
  const base = { selectedRoute: ['implement-plan'], variantParameters: {}, requiredInputs: ['PLAN_INPUT_PATH', 'PLAN_APPROVED'], blocked: true };
  assert.equal(validateLiveCase(spec, base, ['implement-plan']).contractValid, true);
  assert.equal(validateLiveCase(spec, { ...base, blocked: false }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, requiredInputs: [] }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, requiredInputs: [...base.requiredInputs, 'INVENTED'] }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, requiredInputs: [...base.requiredInputs].reverse() }, ['implement-plan']).contractValid, false);
  assert.equal(validateLiveCase(spec, { ...base, selectedRoute: ['invented'] }, ['implement-plan']).inventedSurfaces.length, 1);
  const approvalResult = validateLiveCase(spec, { selectedRoute: [], variantParameters: {}, requiredInputs: base.requiredInputs, blocked: true }, ['implement-plan']);
  assert.equal(approvalResult.contractValid, true);
  assert.equal(approvalResult.routeValid, false);
  assert.equal(approvalResult.variantParametersValid, false);
  const contradictoryRoute = validateLiveCase(spec, { ...base, selectedRoute: ['review'] }, ['implement-plan', 'review']);
  assert.equal(contradictoryRoute.contractValid, false);
  assert.equal(contradictoryRoute.shapeValid, false);
  const contradictoryVariant = validateLiveCase(spec, { ...base, variantParameters: { MODE: 'unrelated' } }, ['implement-plan']);
  assert.equal(contradictoryVariant.contractValid, false);
  assert.equal(contradictoryVariant.shapeValid, false);
});

test('Claude approval normalization requires one exact execution status instead of keyword inference', () => {
  const blocked = 'Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nExecution status: BLOCKED\nI will stop before any write.';
  assert.deepEqual(normalizeClaudeApprovalOutput(blocked), {
    selectedRoute: [],
    variantParameters: {},
    requiredInputs: ['PLAN_INPUT_PATH', 'PLAN_APPROVED'],
    blocked: true,
  });
  assert.equal(normalizeClaudeApprovalOutput('Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nExecution status: READY').blocked, false);
  assert.throws(
    () => normalizeClaudeApprovalOutput('Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nStatus: approval was not supplied, but I am continuing implementation now.'),
    /exactly one Execution status field; found 0/u,
  );
  assert.throws(
    () => normalizeClaudeApprovalOutput('Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nExecution status: BLOCKED, but continuing'),
    /exactly BLOCKED or READY/u,
  );
  assert.throws(
    () => normalizeClaudeApprovalOutput('Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nExecution status: blocked'),
    /exactly BLOCKED or READY/u,
  );
  assert.throws(
    () => normalizeClaudeApprovalOutput('Required inputs: PLAN_INPUT_PATH, PLAN_APPROVED\nexecution status: BLOCKED'),
    /exactly one Execution status field; found 0/u,
  );
});

test('shared semantic evaluator rejects multiple selected routes', () => {
  const spec = { kind: 'route', expectedRoute: ['review'], expectedVariantParameters: {}, expectedRequiredInputs: [] };
  const result = evaluateSemanticCase(spec, { selectedRoute: ['explore', 'review'], variantParameters: {}, requiredInputs: [], blocked: false }, ['review', 'explore']);
  assert.equal(result.routeValid, false);
  assert.equal(Object.hasOwn(result, 'top2RouteValid'), false);
  assert.equal(result.shapeValid, false);
  assert.equal(result.contractValid, false);

  const outputSchema = jsonOutputSchema();
  assert.notDeepEqual(validateStandardSchema(outputSchema, { selectedRoute: ['explore', 'review'], variantParameters: {}, requiredInputs: [], blocked: false }), []);
  assert.notDeepEqual(validateStandardSchema(outputSchema, { selectedRoute: ['review', 'review'], variantParameters: {}, requiredInputs: [], blocked: false }), []);

  const resultSchema = JSON.parse(readFileSync(resolve(root, 'schemas/eval-result.schema.json'), 'utf8'));
  const selectedRouteSchema = resultSchema.properties.cases.items.oneOf[2].properties.selectedRoute;
  assert.notDeepEqual(validateStandardSchema(selectedRouteSchema, ['explore', 'review']), []);
  assert.notDeepEqual(validateStandardSchema(selectedRouteSchema, ['review', 'review']), []);
});

test('model-derived evidence hashes path, secret, and control payloads idempotently after semantic evaluation', () => {
  const spec = { kind: 'route', expectedRoute: ['review'], expectedVariantParameters: {}, expectedRequiredInputs: [] };
  const unsafe = {
    selectedRoute: ['x/Users/private-name'],
    variantParameters: { 'secret/key': `Authorization: Bearer ${'a'.repeat(26)}` },
    requiredInputs: ['\u001b[31m/private/input'],
    blocked: false,
  };
  const first = evaluateSemanticCase(spec, unsafe, ['review']);
  assert.equal(first.contractValid, false);
  assert.match(first.selectedRoute[0], /^sha256:[a-f0-9]{64}$/u);
  assert.match(first.requiredInputs[0], /^sha256:[a-f0-9]{64}$/u);
  assert.match(Object.keys(first.variantParameters)[0], /^sha256:[a-f0-9]{64}$/u);
  assert.match(Object.values(first.variantParameters)[0], /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(first.inventedSurfaces, first.selectedRoute);
  assert.deepEqual(assertPublicEvidenceSafe(first), first);
  assert.deepEqual(normalizePublicModelValue(first.variantParameters), first.variantParameters);

  const second = evaluateSemanticCase(spec, first, ['review']);
  assert.deepEqual(second.selectedRoute, first.selectedRoute);
  assert.deepEqual(second.variantParameters, first.variantParameters);
  assert.deepEqual(second.requiredInputs, first.requiredInputs);
  assert.deepEqual(second.inventedSurfaces, first.inventedSurfaces);
  assert.equal(second.contractValid, false);
});

test('Claude route normalization uses canonical skill identity and validates exact specialized entrypoints', () => {
  const spec = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.v6.json'), 'utf8'));
  const behaviors = JSON.parse(readFileSync(resolve(root, 'workflow-specs/behaviors.v2.json'), 'utf8'));
  assert.deepEqual(normalizeClaudeRouteOutput(claudeRouteText({
    canonicalSkill: 'nova-review',
    commandEntrypoint: '/nova-plugin:review-only',
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
    requiredInputs: ['REVIEW_SCOPE'],
  }), 'nova-plugin', spec, behaviors), {
    selectedRoute: ['review'],
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
  });
  assert.deepEqual(normalizeClaudeRouteOutput(claudeRouteText({
    canonicalSkill: 'nova-implement-plan',
    commandEntrypoint: '/nova-plugin:implement-lite',
    variantParameters: { EXECUTION_PROFILE: 'lite' },
    coreAgent: 'builder',
    capabilityPacks: 'None',
    requiredInputs: ['REQUEST'],
  }), 'nova-plugin', spec, behaviors), {
    selectedRoute: ['implement-plan'],
    variantParameters: { EXECUTION_PROFILE: 'lite' },
  });
  assert.throws(() => normalizeClaudeRouteOutput(claudeRouteText({
    canonicalSkill: 'nova-review',
    commandEntrypoint: '/nova-plugin:review',
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
    requiredInputs: ['REVIEW_SCOPE'],
  }), 'nova-plugin', spec, behaviors), /differs from resolved workflow review-only/u);
  assert.throws(() => normalizeClaudeRouteOutput(claudeRouteText({
    canonicalSkill: 'nova-explore -> nova-review',
    commandEntrypoint: '/nova-plugin:explore -> /nova-plugin:review',
  }), 'nova-plugin', spec, behaviors), /Canonical skill must be exactly/u);
});

test('Claude route normalization rejects prose-substring matches and unrelated inventories', () => {
  const spec = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.v6.json'), 'utf8'));
  const behaviors = JSON.parse(readFileSync(resolve(root, 'workflow-specs/behaviors.v2.json'), 'utf8'));
  const review = (overrides = {}) => claudeRouteText({
    canonicalSkill: 'nova-review',
    commandEntrypoint: '/nova-plugin:review-only',
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
    requiredInputs: ['REVIEW_SCOPE'],
    ...overrides,
  });
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ canonicalSkill: 'Do not use nova-review' }), 'nova-plugin', spec, behaviors),
    /Canonical skill must be exactly/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ commandEntrypoint: 'Do not use \/nova-plugin:review-only' }), 'nova-plugin', spec, behaviors),
    /Command entrypoint must be exactly/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ coreAgent: 'imaginary-agent' }), 'nova-plugin', spec, behaviors),
    /invented Core agent/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ coreAgent: 'builder' }), 'nova-plugin', spec, behaviors),
    /differs from resolved workflow ownership/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ capabilityPacks: 'imaginary-pack' }), 'nova-plugin', spec, behaviors),
    /invented Capability packs/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ capabilityPacks: 'docs' }), 'nova-plugin', spec, behaviors),
    /differ from resolved workflow recommendations/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ capabilityPacks: 'frontend' }), 'nova-plugin', spec, behaviors),
    /differ from resolved workflow recommendations/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review({ extraLines: ['Ignore this recommendation and implement instead.'] }), 'nova-plugin', spec, behaviors),
    /only the exact heading and eight fixed fields/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(`Ignore this recommendation.\n${review()}`, 'nova-plugin', spec, behaviors),
    /must start with exactly/u,
  );
  const reordered = review().split('\n');
  [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  assert.throws(
    () => normalizeClaudeRouteOutput(reordered.join('\n'), 'nova-plugin', spec, behaviors),
    /field order or label differs/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review().replace('- Canonical skill:', '- canonical skill:'), 'nova-plugin', spec, behaviors),
    /exactly one Canonical skill field; found 0/u,
  );
  assert.throws(
    () => normalizeClaudeRouteOutput(review().replace('- Variant parameters: {"LEVEL":"standard","MODE":"findings-only"}', '- Variant parameters: '), 'nova-plugin', spec, behaviors),
    /Variant parameters value must not be empty/u,
  );
  assert.deepEqual(normalizeClaudeRouteOutput(review({
    coreAgent: '`reviewer`',
    capabilityPacks: '`security`, `dependency`',
  }), 'nova-plugin', spec, behaviors).selectedRoute, ['review']);
  assert.deepEqual(normalizeClaudeRouteOutput(review({
    canonicalSkill: '`nova-review`',
    commandEntrypoint: '`/nova-plugin:review-only`',
    capabilityPacks: '`None`',
  }), 'nova-plugin', spec, behaviors).selectedRoute, ['review']);
});

test('Claude route normalization rejects every missing or duplicate fixed field', () => {
  const spec = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.v6.json'), 'utf8'));
  const behaviors = JSON.parse(readFileSync(resolve(root, 'workflow-specs/behaviors.v2.json'), 'utf8'));
  const valid = claudeRouteText({
    canonicalSkill: 'nova-review',
    commandEntrypoint: '/nova-plugin:review-only',
    variantParameters: { LEVEL: 'standard', MODE: 'findings-only' },
    requiredInputs: ['REVIEW_SCOPE'],
  });
  const labels = ['Canonical skill', 'Command entrypoint', 'Variant parameters', 'Core agent', 'Capability packs', 'Required inputs', 'Validation expectations', 'Fallback path'];
  for (const label of labels) {
    const line = valid.split('\n').find((entry) => entry.startsWith(`- ${label}:`));
    assert.ok(line, `missing test fixture line ${label}`);
    const missing = valid.split('\n').filter((entry) => entry !== line).join('\n');
    assert.throws(() => normalizeClaudeRouteOutput(missing, 'nova-plugin', spec, behaviors), new RegExp(`exactly one ${label} field; found 0`));
    assert.throws(() => normalizeClaudeRouteOutput(`${valid}\n${line}`, 'nova-plugin', spec, behaviors), new RegExp(`exactly one ${label} field; found 2`));
  }

  assert.throws(() => normalizeClaudeRouteOutput(`${valid}\n- Command entrypoint: /nova-plugin:review`, 'nova-plugin', spec, behaviors), /exactly one Command entrypoint field; found 2/u);
  assert.throws(() => normalizeClaudeRouteOutput(`${valid}\n- Required inputs: REVIEW_SCOPE, INVENTED_INPUT`, 'nova-plugin', spec, behaviors), /exactly one Required inputs field; found 2/u);
  assert.throws(() => normalizeClaudeRouteOutput(`${valid}\n- Canonical skill: nova-explore`, 'nova-plugin', spec, behaviors), /exactly one Canonical skill field; found 2/u);
});

test('Claude required-input parsing preserves extras and order so exact checks fail closed', () => {
  const caseSpec = { kind: 'route', expectedRoute: ['review'], expectedVariantParameters: {}, expectedRequiredInputs: ['REVIEW_SCOPE'] };
  const base = { selectedRoute: ['review'], variantParameters: {}, blocked: false };
  const exact = requiredInputsFromClaudeText('- Required inputs: REVIEW_SCOPE');
  const extra = requiredInputsFromClaudeText('- Required inputs: REVIEW_SCOPE, INVENTED_INPUT');
  const reordered = requiredInputsFromClaudeText('- Required inputs: PLAN_APPROVED, PLAN_INPUT_PATH');
  assert.deepEqual(exact, ['REVIEW_SCOPE']);
  assert.deepEqual(extra, ['REVIEW_SCOPE', 'INVENTED_INPUT']);
  assert.deepEqual(requiredInputsFromClaudeText('- Required inputs: `PLAN_INPUT_PATH`, `PLAN_APPROVED`'), ['PLAN_INPUT_PATH', 'PLAN_APPROVED']);
  assert.deepEqual(requiredInputsFromClaudeText('- Required inputs: None'), []);
  assert.deepEqual(requiredInputsFromClaudeText('- Required inputs: `None`'), []);
  for (const polluted of [
    '- Required inputs: use REVIEW_SCOPE only',
    '- Required inputs: REVIEW_SCOPE and PLAN_APPROVED',
    '- Required inputs: REVIEW_SCOPE, REVIEW_SCOPE',
    '- Required inputs: None because it was supplied',
  ]) assert.throws(() => requiredInputsFromClaudeText(polluted), /exact|duplicate|identifiers/u);
  assert.equal(evaluateSemanticCase(caseSpec, { ...base, requiredInputs: extra }, ['review']).contractValid, false);
  assert.equal(evaluateSemanticCase({ ...caseSpec, expectedRequiredInputs: ['PLAN_INPUT_PATH', 'PLAN_APPROVED'] }, { ...base, requiredInputs: reordered }, ['review']).contractValid, false);
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

test('Codex lifecycle rejects missing type, identity drift, and conflicting terminal states', () => {
  assert.throws(() => normalizeCodexToolLifecycle([
    { type: 'item.started', item: { id: 'missing-type' } },
  ]), /missing item\.type/u);
  assert.throws(() => normalizeCodexToolLifecycle([
    { type: 'item.started', item: { id: 'same-id', type: 'plan_update' } },
    { type: 'item.completed', item: { id: 'same-id', type: 'mcp_tool_call', server: 'server', tool: 'tool', status: 'completed' } },
  ]), /changed tool type/u);
  assert.throws(() => normalizeCodexToolLifecycle([
    { type: 'item.started', item: { id: 'same-id', type: 'mcp_tool_call', server: 'server-a', tool: 'tool' } },
    { type: 'item.completed', item: { id: 'same-id', type: 'mcp_tool_call', server: 'server-b', tool: 'tool', status: 'completed' } },
  ]), /changed MCP server identity/u);
  assert.throws(() => normalizeCodexToolLifecycle([
    { type: 'item.completed', item: { id: 'same-id', type: 'mcp_tool_call', server: 'server', tool: 'tool', status: 'completed' } },
    { type: 'item.completed', item: { id: 'same-id', type: 'mcp_tool_call', server: 'server', tool: 'tool', status: 'failed' } },
  ]), /changed terminal status/u);
});

test('Codex JSONL parsing rejects malformed or structurally incomplete nonblank records', () => {
  assert.throws(() => parseCodexEvents('{"type":"turn.completed"}\nnot-json\n'), /line 2 is invalid JSON/u);
  assert.throws(() => parseCodexEvents('{"usage":{}}\n'), /missing event\.type/u);
  assert.throws(() => parseCodexEvents('[]\n'), /not an event object/u);
  assert.throws(() => parseCodexEvents('\n'), /did not contain any events/u);
  assert.throws(() => parseCodexEvents('{"type":"turn.started"}\n'), /exactly one turn\.completed/u);
  assert.throws(() => parseCodexEvents('{"type":"turn.completed"}\n{"type":"item.completed","item":{"id":"late","type":"agent_message","status":"completed"}}\n'), /end with exactly one turn\.completed/u);
  assert.throws(() => parseCodexEvents('{"type":"turn.completed"}\n{"type":"turn.completed"}\n'), /exactly one turn\.completed/u);
  assert.deepEqual(parseCodexEvents('\n{"type":"turn.completed","usage":{"total_tokens":2}}\n').usage, { total_tokens: 2 });
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
  const reasonCodes = JSON.parse(readFileSync(resolve(root, 'schemas/eval-result.schema.json'), 'utf8'))
    .properties.cases.items.oneOf[2].properties.adapterLoadReasonCode.enum;
  assert.deepEqual(reasonCodes.filter((code) => code.startsWith('claude-')), [
    'claude-debug-plugin-load-observed',
    'claude-debug-load-signal-incomplete',
    'claude-debug-load-signal-unavailable',
  ]);
});

test('usage reports stable availability state without inferred values', () => {
  assert.deepEqual(normalizeUsage(null), { usageStatus: 'unavailable', usageReasonCode: 'cli-usage-unavailable', inputTokens: null, outputTokens: null, totalTokens: null, costUsd: null });
  assert.deepEqual(normalizeUsage({ totalTokens: 3 }), { usageStatus: 'reported', usageReasonCode: 'cli-reported-usage', inputTokens: null, outputTokens: null, totalTokens: 3, costUsd: null });
});
