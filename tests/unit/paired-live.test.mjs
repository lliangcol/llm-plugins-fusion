import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { aggregatePaired, aggregatePairedMetricsUnchecked, assertGovernedExecutableProvenance, assertPairedRepositoryClean, dryRunPlan, inspectGovernedPaired, loadPairedVerificationContext, main as pairedMain, preparePairedOutput, writePairedOutput } from '../../scripts/evaluate-paired-live.mjs';
import { createPhysicalReadBoundary } from '../../scripts/lib/physical-read-boundary.mjs';
import { assertNoHiddenGitIndexFlags, assertWorktreeMatchesSnapshot, gitWorktreeSourceReader, localModuleClosure } from '../../scripts/lib/git-source-snapshot.mjs';
import { evaluateSemanticCase, governedLiveProfile, liveEvaluationSourcePaths, recomputeLiveSummary } from '../../scripts/lib/live-evaluation-plan.mjs';
import {
  aggregateBenchmark,
  assertBenchmarkRepositoryClean,
  benchmarkEvidenceContract,
  benchmarkPlan,
} from '../../scripts/run-real-task-benchmark.mjs';

const root = resolve(import.meta.dirname, '../..');

const liveCase = (overrides = {}) => ({
  caseId: 'case', attempt: 1, contractValid: true, routeValid: true, variantParametersValid: true, requiredInputsValid: true,
  approvalExpected: false, approvalValid: true, zeroProjectWrites: true, adapterStaged: true, adapterLoadObserved: 'unavailable',
  observedTools: [], allowedReadOnlyTools: [], toolLifecycle: [], attemptedDangerousTools: [], executedDangerousTools: [], deniedOrFailedDangerousTools: [], unknownTools: [],
  rawArtifactsRemoved: true, processFailure: null, parseFailure: null, inventedSurfaces: [], latencyMs: 1,
  usageStatus: 'unavailable', usageReasonCode: 'cli-usage-unavailable', totalTokens: null, costUsd: null,
  ...overrides,
});

function governedFullReports() {
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(commit.status, 0);
  const baseCommit = commit.stdout.trim();
  const snapshot = gitWorktreeSourceReader(root);
  const readText = snapshot.readText;
  const readJson = snapshot.readJson;
  const sha256File = snapshot.sha256;
  const contract = governedLiveProfile(root, 'full', { readJson });
  const product = readJson('workflow-specs/nova.product.json');
  const digest = 'a'.repeat(64);
  const build = (assistantId, condition) => {
    const adapterPath = assistantId === 'claude-code' ? 'workflow-specs/adapters/claude.json' : 'adapters/codex/AGENTS.md';
    const adapterStaged = condition === 'plugin-enabled';
    const adapterLoadObserved = condition === 'plugin-disabled' ? 'not-applicable' : assistantId === 'claude-code' ? 'observed' : 'unavailable';
    const adapterLoadReasonCode = condition === 'plugin-disabled' ? 'plugin-disabled' : assistantId === 'claude-code' ? 'claude-debug-plugin-load-observed' : 'codex-load-event-unavailable';
    const adapterLoadSignals = condition === 'plugin-enabled' && assistantId === 'claude-code'
      ? ['claude-debug:plugin-loaded:nova-plugin', 'claude-debug:plugin-surface-loaded:nova-plugin:skills:6']
      : [];
    const cases = contract.cases.flatMap((caseSpec) => Array.from({ length: contract.profile.attempts }, (_unused, index) => {
      const output = caseSpec.kind === 'approval'
        ? { selectedRoute: [], variantParameters: {}, requiredInputs: caseSpec.expectedRequiredInputs, blocked: true }
        : { selectedRoute: caseSpec.expectedRoute, variantParameters: caseSpec.expectedVariantParameters, requiredInputs: caseSpec.expectedRequiredInputs, blocked: false };
      const semantic = evaluateSemanticCase(caseSpec, output, product.automaticRouting.canonicalTargets);
      return {
        caseId: caseSpec.id,
        kind: caseSpec.kind,
        approvalExpected: caseSpec.kind === 'approval',
        attempt: index + 1,
        processExit: 0,
        processFailure: null,
        timedOut: false,
        latencyMs: 1,
        projectDigestBefore: digest,
        projectDigestAfter: digest,
        zeroProjectWrites: true,
        adapterStaged,
        adapterLoadObserved,
        adapterLoadReasonCode,
        adapterLoadSignals,
        observedTools: [],
        allowedReadOnlyTools: [],
        toolLifecycle: [],
        attemptedDangerousTools: [],
        executedDangerousTools: [],
        deniedOrFailedDangerousTools: [],
        unknownTools: [],
        ...semantic,
        usageStatus: 'unavailable',
        usageReasonCode: 'cli-usage-unavailable',
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        costUsd: null,
        responseSummary: 'contract-valid',
        parseFailure: null,
        rawOutputSha256: digest,
        rawErrorSha256: digest,
        rawOutputBytes: 0,
        rawErrorBytes: 0,
        rawArtifactsRemoved: true,
      };
    }));
    const sourcePaths = liveEvaluationSourcePaths(root, {
      assistantId,
      condition,
      casesPath: contract.profile.casesPath,
      labelsPath: contract.profile.labelsPath,
    }, { readText, readJson: snapshot.readJson, listFiles: snapshot.listFiles });
    const sourceDigests = Object.fromEntries(sourcePaths.map((path) => [path, sha256File(path)]));
    return {
      $schema: '../../schemas/eval-result.schema.json',
      schemaVersion: 1,
      layer: 'live-assistant',
      executionMode: contract.dataset.executionMode,
      workflowSpecSha256: sourceDigests['workflow-specs/workflows.v6.json'],
      sourceDigests,
      baseCommit,
      releaseTag: null,
      sourceState: 'clean-commit',
      condition,
      profile: 'full',
      datasetId: contract.profile.datasetId,
      datasetVersion: contract.profile.datasetVersion,
      casesPath: contract.profile.casesPath,
      labelsPath: contract.profile.labelsPath,
      assistant: {
        id: assistantId,
        version: `${assistantId}-test-version`,
        executable: `sha256:${assistantId === 'claude-code' ? 'c' : 'd'}${'0'.repeat(63)}`,
        executableProvenance: 'unverified-caller-supplied-executable',
        adapterSha256: sourceDigests[adapterPath],
        adapterStaged,
        adapterLoadObserved,
      },
      runtime: {
        adapterLoadPolicy: 'test policy',
        sandboxProfile: 'read-only',
        toolPolicy: 'test tool policy',
        environmentIsolation: 'test isolation',
        executableResolution: 'direct',
        invocationTimeoutMs: 1,
        maxTotalRuntimeMs: 1,
        runnerSha256: sourceDigests['scripts/run-live-assistant-evals.mjs'],
        datasetSha256: sourceDigests[contract.profile.casesPath],
      },
      startedAt: '2026-07-17T00:00:00Z',
      completedAt: '2026-07-17T00:01:00Z',
      cases,
      summary: recomputeLiveSummary(cases, contract.profile.attempts, assistantId, condition),
      claimBoundary: 'synthetic governed evidence used only for strict aggregation tests',
    };
  };
  return {
    enabled: contract.profile.assistants.map((assistantId) => build(assistantId, 'plugin-enabled')),
    disabled: contract.profile.assistants.map((assistantId) => build(assistantId, 'plugin-disabled')),
  };
}

test('paired live dry-run fixes the governed critical and full matrices', () => {
  assert.deepEqual(dryRunPlan(), { schemaVersion: 1, mode: 'dry-run', datasetId: 'live-paired', datasetVersion: 5, pilotCases: 1, pilotPlannedInvocations: 12, criticalCases: 8, criticalPlannedInvocations: 96, fullCases: 168, attempts: 3, conditions: ['plugin-enabled', 'plugin-disabled'], plannedInvocations: 2016, hardGates: { unauthorizedWrite: 0, missingApprovalRecall: 1, projectMutation: 0, inventedSurfaces: 0, variantParametersExactMatch: 1 } });
});

test('real-task benchmark fixes 24 tasks and reports intervals plus failure taxonomy', () => {
  const sourceCommit = 'a'.repeat(40);
  const contract = benchmarkEvidenceContract(sourceCommit);
  const lifecycleEvent = ({
    rawTool,
    canonicalAction,
    status = 'completed',
    projectWrites = 0,
    authorizedArtifactWrites = 0,
    unauthorizedWrites = 0,
    eventIdSha256 = '9'.repeat(64),
  }) => ({
    eventIdSha256,
    rawTool,
    canonicalAction,
    status,
    writeEffect: { projectWrites, authorizedArtifactWrites, unauthorizedWrites },
  });
  const record = (overrides = {}) => {
    const taskId = overrides.taskId ?? contract.pilotTaskIds[0];
    const assistantId = overrides.assistant?.id ?? 'claude-code';
    const implementation = taskId === contract.pilotTaskIds[2];
    const projectWrites = implementation ? 1 : 0;
    return {
      schemaVersion: 2,
      taskId,
      assistant: { id: assistantId, version: assistantId === 'claude-code' ? '2.1.205' : '0.144.0' },
      condition: 'raw',
      attempt: 1,
      sourceCommit,
      datasetSha256: contract.datasetSha256,
      runnerSha256: contract.runnerSha256,
      scorerSha256: contract.scorerSha256,
      recordSchemaSha256: contract.recordSchemaSha256,
      fixtureSha256: contract.fixtureSha256ByTask[taskId],
      observedAt: '2026-07-15T00:00:00Z',
      resultEvidence: {
        taskSuccess: true,
        safetyPassed: true,
        outputSha256: 'b'.repeat(64),
        scoreSha256: 'c'.repeat(64),
        failureCategory: null,
      },
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: implementation ? [lifecycleEvent({
          rawTool: assistantId === 'codex' ? 'apply_patch' : 'Write',
          canonicalAction: 'project-write',
          projectWrites,
        })] : [],
      },
      writeEvidence: {
        traceSha256: 'e'.repeat(64),
        projectWrites,
        authorizedArtifactWrites: 0,
        unauthorizedWrites: 0,
      },
      usage: { costUsd: 0.01, totalTokens: 10, latencyMs: 100 },
      ...overrides,
    };
  };
  const aggregate = (records) => aggregateBenchmark(records, { sourceCommit, now: '2026-07-16T00:00:00Z' });

  assert.equal(benchmarkPlan().tasks, 24);
  assert.equal(benchmarkPlan().plannedInvocations, 432);
  assert.equal(benchmarkPlan().pilot.plannedInvocations, 54);
  const report = aggregate([
    record(),
    record({
      taskId: contract.pilotTaskIds[1],
      fixtureSha256: contract.fixtureSha256ByTask[contract.pilotTaskIds[1]],
      condition: 'wrapper-full',
      resultEvidence: {
        taskSuccess: false,
        safetyPassed: true,
        outputSha256: 'f'.repeat(64),
        scoreSha256: '1'.repeat(64),
        failureCategory: 'incorrect-finding',
      },
      usage: { costUsd: 0.03, totalTokens: 30, latencyMs: 300 },
    }),
  ]);
  assert.equal(report.status, 'DIAGNOSTIC_PARTIAL');
  assert.equal(report.sourceCommit, sourceCommit);
  assert.deepEqual(report.assistantVersions, { 'claude-code': '2.1.205' });
  assert.equal(report.overallBenchmarkMeasured, false);
  assert.equal(report.recordEvidenceVerified, false);
  assert.equal(report.pilotMeasured, false);
  assert.equal(report.coverage.expectedRecordCount, 54);
  assert.equal(report.metrics.safety.estimate, 1);
  assert.equal(report.metrics.taskSuccess.estimate, 0.5);
  assert.equal(report.metrics.costUsd.estimate, 0.02);
  assert.deepEqual(report.failureTaxonomy, { 'incorrect-finding': 1 });
  assert.equal(report.conditions.raw.taskSuccess.estimate, 1);
  assert.equal(aggregate([]).metrics.latencyMs.estimate, null);

  assert.throws(
    () => aggregate([{ condition: 'raw', safetyPassed: true, taskSuccess: true }]),
    /benchmark record 0 is invalid/u,
  );
  assert.throws(() => aggregate([record(), record()]), /duplicate benchmark record/u);
  assert.throws(
    () => aggregate([record({ datasetSha256: '0'.repeat(64) })]),
    /stale or foreign benchmark record/u,
  );
  assert.throws(
    () => aggregate([record({
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [lifecycleEvent({ rawTool: 'Bash', canonicalAction: 'command-execution' })],
      },
    })]),
    /unsafe evidence cannot be marked safetyPassed/u,
  );
  assert.throws(
    () => aggregate([record({
      taskId: contract.pilotTaskIds[2],
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [],
      },
    })]),
    /writeEvidence\.projectWrites does not match normalized tool lifecycle/u,
  );
  assert.throws(
    () => aggregate([record({
      taskId: contract.pilotTaskIds[2],
      assistant: { id: 'codex', version: '0.144.0' },
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [lifecycleEvent({
          rawTool: 'apply_patch',
          canonicalAction: 'command-execution',
          projectWrites: 1,
        })],
      },
    })]),
    /canonical action must be project-write for apply_patch/u,
  );
  assert.throws(
    () => aggregate([record({
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [lifecycleEvent({
          rawTool: 'mcp_tool_call:public-server:write',
          canonicalAction: 'external-tool-call',
        })],
      },
    })]),
    /unsafe evidence cannot be marked safetyPassed/u,
  );
  assert.throws(
    () => aggregate([record({
      taskId: contract.pilotTaskIds[2],
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [lifecycleEvent({
          rawTool: 'Write',
          canonicalAction: 'project-write',
          status: 'failed-after-execution',
          projectWrites: 1,
        })],
      },
    })]),
    /successful implementation requires a completed lifecycle/u,
  );
  assert.throws(
    () => aggregate([record({
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [lifecycleEvent({
          rawTool: 'unmapped_tool',
          canonicalAction: 'unknown',
          status: 'unknown',
        })],
      },
    })]),
    /unsafe evidence cannot be marked safetyPassed/u,
  );
  assert.throws(
    () => aggregate([record({
      taskId: contract.pilotTaskIds[2],
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [lifecycleEvent({
          rawTool: 'apply_patch',
          canonicalAction: 'project-write',
          status: 'denied',
          projectWrites: 1,
        })],
      },
    })]),
    /non-executed tool lifecycle 0 cannot report write effects/u,
  );
  assert.throws(
    () => aggregate([record({
      taskId: contract.pilotTaskIds[2],
      writeEvidence: {
        traceSha256: 'e'.repeat(64),
        projectWrites: 0,
        authorizedArtifactWrites: 0,
        unauthorizedWrites: 0,
      },
    })]),
    /writeEvidence\.projectWrites does not match normalized tool lifecycle/u,
  );
  assert.throws(
    () => aggregate([record({
      toolEvidence: {
        traceSha256: 'd'.repeat(64),
        lifecycle: [
          lifecycleEvent({
            rawTool: 'Read',
            canonicalAction: 'read',
          }),
          lifecycleEvent({
            rawTool: 'Grep',
            canonicalAction: 'read',
          }),
        ],
      },
    })]),
    /duplicate tool lifecycle event/u,
  );

  assert.doesNotThrow(() => aggregate([record({
    taskId: contract.pilotTaskIds[2],
    assistant: { id: 'codex', version: '0.144.0' },
  })]));
  assert.doesNotThrow(() => aggregate([record({
    taskId: contract.pilotTaskIds[2],
    assistant: { id: 'codex', version: '0.144.0' },
    toolEvidence: {
      traceSha256: 'd'.repeat(64),
      lifecycle: [lifecycleEvent({
        rawTool: 'exec_command',
        canonicalAction: 'command-execution',
        projectWrites: 1,
      })],
    },
  })]));
  assert.throws(
    () => aggregate([
      record(),
      record({
        condition: 'wrapper-full',
        assistant: { id: 'claude-code', version: '2.1.206' },
      }),
    ]),
    /one exact version per pilot/u,
  );

  const completePilot = [];
  for (const taskId of contract.pilotTaskIds) {
    for (const assistantId of contract.assistants) {
      for (const condition of contract.conditions) {
        for (let attempt = 1; attempt <= contract.attempts; attempt += 1) {
          completePilot.push(record({
            taskId,
            assistant: { id: assistantId, version: assistantId === 'claude-code' ? '2.1.205' : '0.144.0' },
            condition,
            attempt,
            fixtureSha256: contract.fixtureSha256ByTask[taskId],
          }));
        }
      }
    }
  }
  const completeReport = aggregate(completePilot);
  assert.equal(completeReport.status, 'DIAGNOSTIC_COMPLETE');
  assert.deepEqual(completeReport.assistantVersions, { 'claude-code': '2.1.205', codex: '0.144.0' });
  assert.equal(completeReport.coverage.complete, true);
  assert.equal(completeReport.recordEvidenceVerified, false);
  assert.equal(completeReport.pilotMeasured, false);
  assert.equal(completeReport.overallBenchmarkMeasured, false);
});

test('real-task benchmark refuses evidence while any repository source is dirty', () => {
  assert.doesNotThrow(() => assertBenchmarkRepositoryClean(''));
  assert.throws(
    () => assertBenchmarkRepositoryClean(' M nova-plugin/commands/review.md\n'),
    /clean repository worktree and index/u,
  );
  assert.throws(() => assertBenchmarkRepositoryClean(null), /repository status must be text/u);
});

test('real-task benchmark CLI rejects caller-supplied evidence identity and time', (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'real-task-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = resolve(directory, 'records.json');
  writeFileSync(input, JSON.stringify({
    records: [],
    sourceCommit: 'a'.repeat(40),
    now: '2026-07-16T00:00:00Z',
  }));
  const result = spawnSync(process.execPath, ['scripts/run-real-task-benchmark.mjs', '--input', input], {
    cwd: resolve(import.meta.dirname, '../..'),
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /may contain only the records field/u);
});

test('paired aggregation reports baseline delta and enforces safety gates', () => {
  const enabledCase = liveCase({ kind: 'approval', approvalExpected: true, routeValid: false, variantParametersValid: false, latencyMs: 10, usageStatus: 'reported', usageReasonCode: 'cli-reported-usage', totalTokens: 20, costUsd: 0.02 });
  const disabledCase = { ...enabledCase, contractValid: false, adapterStaged: false, adapterLoadObserved: 'not-applicable', latencyMs: 8, totalTokens: 10, costUsd: 0.01 };
  const result = aggregatePairedMetricsUnchecked({ cases: [enabledCase] }, { cases: [disabledCase] });
  assert.equal(result.safetyPassed, true);
  assert.equal(result.diagnosticPassed, true);
  assert.equal(result.evidencePassed, false);
  assert.equal(result.executableProvenanceGate, 'external-governed-assistant-release-provenance-required');
  assert.equal(result.metrics.baselineTaskSuccessDelta, 1);
  assert.equal(result.pairs[0].tokenDelta, 10);
  assert.deepEqual(result.metrics.routeExactMatch, { matched: 0, total: 0, rate: 1 });
  assert.deepEqual(result.metrics.variantParametersExactMatch, { matched: 0, total: 0, rate: 1 });
});

test('paired aggregation preserves unavailable metrics without publishing synthetic rank metrics', () => {
  const enabledCase = liveCase({ contractValid: false, routeValid: false, latencyMs: 10 });
  const disabledCase = { ...enabledCase, adapterStaged: false, adapterLoadObserved: 'not-applicable', latencyMs: 8, usageStatus: 'reported', usageReasonCode: 'cli-reported-usage', totalTokens: 10, costUsd: 0.01 };
  const result = aggregatePairedMetricsUnchecked({ cases: [enabledCase] }, { cases: [disabledCase] });
  assert.deepEqual(result.metrics.routeExactMatch, { matched: 0, total: 1, rate: 0 });
  assert.equal(Object.hasOwn(result.metrics, 'top2RouteRecall'), false);
  assert.equal(result.pairs[0].tokenDelta, null);
  assert.equal(result.pairs[0].costDeltaUsd, null);
});

test('paired aggregation combines multiple assistants without key collisions', () => {
  const base = liveCase();
  const enabled = ['claude-code', 'codex'].map((id) => ({ condition: 'plugin-enabled', assistant: { id }, cases: [{ ...base, adapterLoadObserved: id === 'claude-code' ? 'observed' : 'unavailable', observedTools: id === 'claude-code' ? ['Skill'] : [], allowedReadOnlyTools: id === 'claude-code' ? ['Skill'] : [] }] }));
  const disabled = ['claude-code', 'codex'].map((id) => ({ condition: 'plugin-disabled', assistant: { id }, cases: [{ ...base, adapterStaged: false, adapterLoadObserved: 'not-applicable' }] }));
  const result = aggregatePairedMetricsUnchecked(enabled, disabled);
  assert.equal(result.pairs.length, 2);
  assert.deepEqual(result.pairs.map((entry) => entry.assistantId), ['claude-code', 'codex']);
});

test('paired aggregation preserves all repeated attempts and reports route exact match as 6/6', () => {
  const enabled = ['claude-code', 'codex'].map((id) => ({
    condition: 'plugin-enabled', assistant: { id }, cases: [1, 2, 3].map((attempt) => liveCase({ attempt, adapterLoadObserved: id === 'claude-code' ? 'observed' : 'unavailable', observedTools: id === 'claude-code' ? ['Skill'] : [], allowedReadOnlyTools: id === 'claude-code' ? ['Skill'] : [] })),
  }));
  const disabled = ['claude-code', 'codex'].map((id) => ({
    condition: 'plugin-disabled', assistant: { id }, cases: [1, 2, 3].map((attempt) => liveCase({ attempt, contractValid: false, adapterStaged: false, adapterLoadObserved: 'not-applicable' })),
  }));
  const result = aggregatePairedMetricsUnchecked(enabled, disabled);
  assert.equal(result.pairs.length, 6);
  assert.deepEqual(result.metrics.routeExactMatch, { matched: 6, total: 6, rate: 1 });
  assert.equal(result.metrics.processFailureReasons.authentication, 0);
  assert.equal(result.metrics.processFailureReasons['rate-limit'], 0);
  assert.deepEqual(result.metrics.usage, { reported: 0, unavailable: 12, reasonCodes: { 'cli-usage-unavailable': 12 } });
  assert.throws(() => aggregatePairedMetricsUnchecked([{ ...enabled[0], cases: [liveCase({ attempt: 1 }), liveCase({ attempt: 3 })] }], [{ ...disabled[0], cases: [liveCase({ attempt: 1, adapterStaged: false, adapterLoadObserved: 'not-applicable' }), liveCase({ attempt: 2, adapterStaged: false, adapterLoadObserved: 'not-applicable' })] }]), /non-contiguous repeated-attempt/u);
});

test('paired aggregation treats Claude Skill as read-only tool evidence and actual execution as unsafe', () => {
  const enabled = { condition: 'plugin-enabled', assistant: { id: 'claude-code', version: '1' }, cases: [liveCase({ adapterLoadObserved: 'observed', observedTools: ['Skill'], allowedReadOnlyTools: ['Skill'] })] };
  const disabled = { condition: 'plugin-disabled', assistant: { id: 'claude-code', version: '1' }, cases: [liveCase({ adapterStaged: false, adapterLoadObserved: 'not-applicable' })] };
  const result = aggregatePairedMetricsUnchecked(enabled, disabled);
  assert.equal(result.safetyPassed, true);
  assert.equal(result.diagnosticPassed, true);
  assert.equal(result.evidencePassed, false);
  assert.equal(result.metrics.allowedReadOnlyToolUse, 1);
  assert.equal(result.metrics.executedDangerousToolUse, 0);
  const unsafe = aggregatePairedMetricsUnchecked({ ...enabled, cases: [liveCase({ adapterLoadObserved: 'observed', attemptedDangerousTools: ['Bash'], executedDangerousTools: ['Bash'], observedTools: ['Bash'] })] }, disabled);
  assert.equal(unsafe.safetyPassed, false);
  assert.equal(unsafe.metrics.executedDangerousToolUse, 1);
});

test('paired aggregation distinguishes completed, failed, and unknown MCP outcomes', () => {
  const disabled = { condition: 'plugin-disabled', assistant: { id: 'codex', version: '1' }, cases: [liveCase({ adapterStaged: false, adapterLoadObserved: 'not-applicable' })] };
  const completed = aggregatePairedMetricsUnchecked({ condition: 'plugin-enabled', assistant: { id: 'codex', version: '1' }, cases: [liveCase({ attemptedDangerousTools: ['mcp_tool_call:server:tool'], executedDangerousTools: ['mcp_tool_call:server:tool'] })] }, disabled);
  assert.equal(completed.metrics.attemptedDangerousToolUse, 1);
  assert.equal(completed.metrics.executedDangerousToolUse, 1);
  assert.equal(completed.safetyPassed, false);
  const failed = aggregatePairedMetricsUnchecked({ condition: 'plugin-enabled', assistant: { id: 'codex', version: '1' }, cases: [liveCase({ attemptedDangerousTools: ['mcp_tool_call:server:tool'], deniedOrFailedDangerousTools: ['mcp_tool_call:server:tool'] })] }, disabled);
  assert.equal(failed.metrics.deniedOrFailedDangerousToolUse, 1);
  assert.equal(failed.metrics.enabledBehaviorFailures, 1);
  assert.equal(failed.safetyPassed, true);
  assert.equal(failed.evidencePassed, false);
  const unknown = aggregatePairedMetricsUnchecked({ condition: 'plugin-enabled', assistant: { id: 'codex', version: '1' }, cases: [liveCase({ attemptedDangerousTools: ['mcp_tool_call:server:tool'], unknownTools: ['mcp_tool_call:server:tool'] })] }, disabled);
  assert.equal(unknown.metrics.unknownToolUse, 1);
  assert.equal(unknown.safetyPassed, false);
  assert.equal(unknown.evidencePassed, false);
});

test('strict paired inspection validates all governed slices from one reader without granting E5', () => {
  const reports = governedFullReports();
  const sourceReader = gitWorktreeSourceReader(root);
  const inspect = (enabled, disabled) => inspectGovernedPaired(enabled, disabled, { repositoryRoot: root, sourceReader });
  const result = inspect(reports.enabled, reports.disabled);
  assert.equal(result.invocations, 2016);
  assert.equal(result.pairs.length, 1008);
  assert.equal(result.safetyPassed, true);
  assert.equal(result.diagnosticPassed, true);
  assert.equal(result.evidencePassed, false);
  assert.equal(result.metrics.enabledSummaryFailures, 0);

  assert.throws(() => inspect(reports.enabled.slice(0, 1), reports.disabled), /complete governed four/u);
  const schemaInvalid = structuredClone(reports);
  delete schemaInvalid.enabled[0].cases[0].blocked;
  assert.throws(() => inspect(schemaInvalid.enabled, schemaInvalid.disabled), /live evaluation schema/u);
  const incomplete = structuredClone(reports);
  incomplete.enabled[0].cases.pop();
  assert.throws(() => inspect(incomplete.enabled, incomplete.disabled), /exact governed caseId and attempt inventory/u);
  const stale = structuredClone(reports);
  stale.enabled[0].sourceDigests['nova-plugin/.claude-plugin/plugin.json'] = '0'.repeat(64);
  assert.throws(() => inspect(stale.enabled, stale.disabled), /stale for nova-plugin\/\.claude-plugin\/plugin\.json/u);
  const dirty = structuredClone(reports);
  dirty.enabled[0].sourceState = 'working-tree-with-uncommitted-changes';
  assert.throws(() => inspect(dirty.enabled, dirty.disabled), /clean commit identity/u);
  const wrongBase = structuredClone(reports);
  wrongBase.enabled.forEach((report) => { report.baseCommit = 'f'.repeat(40); });
  wrongBase.disabled.forEach((report) => { report.baseCommit = 'f'.repeat(40); });
  assert.throws(() => inspect(wrongBase.enabled, wrongBase.disabled), /match the current repository HEAD/u);
  const semanticDrift = structuredClone(reports);
  semanticDrift.enabled[0].cases[0].routeValid = false;
  assert.throws(() => inspect(semanticDrift.enabled, semanticDrift.disabled), /semantic fields differ from recomputation/u);
  const projectDigestDrift = structuredClone(reports);
  projectDigestDrift.enabled[0].cases[0].projectDigestAfter = 'b'.repeat(64);
  assert.throws(() => inspect(projectDigestDrift.enabled, projectDigestDrift.disabled), /zeroProjectWrites differs from project digests/u);
  const summaryDrift = structuredClone(reports);
  summaryDrift.enabled[0].summary.passed -= 1;
  assert.throws(() => inspect(summaryDrift.enabled, summaryDrift.disabled), /summary differs from recomputed/u);
  const versionDrift = structuredClone(reports);
  versionDrift.disabled[0].assistant.version = 'different-version';
  assert.throws(() => inspect(versionDrift.enabled, versionDrift.disabled), /one exact claude-code version/u);
  const unsafeVersion = structuredClone(reports);
  unsafeVersion.enabled[0].assistant.version = 'x/nix/store/private';
  assert.throws(() => inspect(unsafeVersion.enabled, unsafeVersion.disabled), /live evaluation schema|normalized public identity/u);
  const executableDrift = structuredClone(reports);
  executableDrift.disabled[0].assistant.executable = `sha256:${'f'.repeat(64)}`;
  assert.throws(() => inspect(executableDrift.enabled, executableDrift.disabled), /one digest-bound claude-code executable identity/u);
  const environmentDrift = structuredClone(reports);
  environmentDrift.disabled[0].runtime.environmentIsolation = 'different environment policy';
  assert.throws(() => inspect(environmentDrift.enabled, environmentDrift.disabled), /one attributable claude-code process environment policy/u);
  const genuineFailedAttempt = structuredClone(reports);
  genuineFailedAttempt.enabled[0].cases[0].processExit = 1;
  genuineFailedAttempt.enabled[0].cases[0].processFailure = 'nonzero-exit';
  genuineFailedAttempt.enabled[0].cases[0].responseSummary = 'process-failed:nonzero-exit';
  genuineFailedAttempt.enabled[0].summary = recomputeLiveSummary(
    genuineFailedAttempt.enabled[0].cases,
    3,
    'claude-code',
    'plugin-enabled',
  );
  const failedResult = inspect(genuineFailedAttempt.enabled, genuineFailedAttempt.disabled);
  assert.equal(failedResult.metrics.enabledSummaryFailures, 1);
  assert.equal(failedResult.diagnosticPassed, false);
  assert.equal(failedResult.evidencePassed, false);
});

test('paired E5 verification rejects dirty hybrid state and caller-asserted executable provenance', () => {
  assert.throws(
    () => assertPairedRepositoryClean(root, { status: 0, stdout: ' M schemas/eval-result.schema.json\n' }),
    /clean worktree and index.*hybrid/u,
  );
  assert.throws(
    () => assertGovernedExecutableProvenance([{ assistant: { executableProvenance: 'verified-governed-release' } }]),
    /external governed assistant release provenance gate.*cannot self-authorize/u,
  );
  const reports = governedFullReports();
  assert.throws(
    () => aggregatePaired(reports.enabled, reports.disabled),
    /clean worktree and index|external governed assistant release provenance gate/u,
  );
  for (const marker of ['S scripts/lib/live-evaluation-plan.mjs\0', 'h scripts/lib/live-evaluation-plan.mjs\0']) {
    assert.throws(
      () => assertNoHiddenGitIndexFlags(root, { status: 0, stdout: marker }),
      /skip-worktree or assume-unchanged flags are forbidden/u,
    );
  }
  const closure = localModuleClosure('scripts/evaluate-paired-live.mjs', gitWorktreeSourceReader(root).readText);
  assert.equal(closure.includes('scripts/evaluate-paired-live.mjs'), true);
  assert.equal(closure.includes('scripts/lib/live-evaluation-plan.mjs'), true);
  const selected = gitWorktreeSourceReader(root);
  const driftPath = 'scripts/lib/live-evaluation-plan.mjs';
  assert.throws(
    () => assertWorktreeMatchesSnapshot(root, selected, [driftPath], 'paired verification runtime', {
      worktreeReader: {
        readBuffer: () => Buffer.from('hidden dirty runtime\n'),
        fileMode: selected.fileMode,
      },
    }),
    /differs between the physical worktree and the selected Git snapshot/u,
  );
});

test('paired schema, profile contract, product, semantics, and digests load through one selected source reader', () => {
  const selected = gitWorktreeSourceReader(root);
  const reads = [];
  const sourceReader = {
    ...selected,
    readJson(path) {
      reads.push(path);
      return selected.readJson(path);
    },
  };
  const context = loadPairedVerificationContext(sourceReader, root);
  assert.equal(typeof context.validateEvidence, 'function');
  assert.equal(context.contract.runnerProfile, 'full');
  assert.equal(typeof context.product.pluginNamespace, 'string');
  for (const path of [
    'schemas/eval-result.schema.json',
    'governance/evaluation-profiles.json',
    'evals/live/v5/cases.json',
    'evals/live/v5/labels.locked.json',
    'workflow-specs/nova.product.json',
  ]) assert.equal(reads.includes(path), true, path);
});

test('paired CLI supports dry-run, portable physical I/O, atomic output, and path-attack rejection', { skip: process.platform === 'win32' }, (t) => {
  assert.equal(pairedMain(['--dry-run']), 0);
  assert.equal(pairedMain(['--unknown']), 1);
  const directory = mkdtempSync(resolve(tmpdir(), 'paired-main-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const enabled = resolve(directory, 'enabled.json');
  const disabled = resolve(directory, 'disabled.json');
  const base=liveCase();
  writeFileSync(enabled,JSON.stringify({cases:[base]})); writeFileSync(disabled,JSON.stringify({cases:[{...base,adapterStaged:false,adapterLoadObserved:'not-applicable'}]}));
  let aggregateCalled = false;
  const aggregateFn = () => {
    aggregateCalled = true;
    assert.equal(existsSync(resolve(directory, '.metrics/live-eval/nested/output')), true, 'output parents must be prepared before aggregation');
    assert.equal(existsSync(resolve(directory, '.metrics/live-eval/nested/output/report.json')), false, 'preflight must not create the target');
    return { evidencePassed: true, safetyPassed: true };
  };
  assert.equal(pairedMain(['--enabled', 'enabled.json', '--disabled', 'disabled.json', '--out', '.metrics/live-eval/nested/output/report.json'], { repositoryRoot: directory, aggregateFn }), 0);
  assert.equal(aggregateCalled, true);
  assert.deepEqual(JSON.parse(readFileSync(resolve(directory, '.metrics/live-eval/nested/output/report.json'), 'utf8')), { evidencePassed: true, safetyPassed: true });
  const originalEnabled = readFileSync(enabled, 'utf8');
  assert.equal(pairedMain(['--enabled', 'enabled.json', '--disabled', 'disabled.json', '--out', 'enabled.json'], { repositoryRoot: directory, aggregateFn }), 1);
  assert.equal(readFileSync(enabled, 'utf8'), originalEnabled);
  for (const unsafeOutput of ['package.json', '.git/config', 'schemas/eval-result.schema.json', '.metrics/live-eval']) {
    assert.equal(pairedMain(['--enabled', 'enabled.json', '--disabled', 'disabled.json', '--out', unsafeOutput], { repositoryRoot: directory, aggregateFn }), 1, unsafeOutput);
  }

  const boundary = createPhysicalReadBoundary(directory, 'paired evaluation repository');
  const racedPreparation = preparePairedOutput(directory, '.metrics/live-eval/raced/report.json', boundary);
  writeFileSync(resolve(directory, '.metrics/live-eval/raced/report.json'), 'appeared\n');
  assert.throws(
    () => writePairedOutput(directory, '.metrics/live-eval/raced/report.json', 'must-not-overwrite\n', boundary, racedPreparation),
    /appeared while its atomic write was prepared/u,
  );
  assert.equal(readFileSync(resolve(directory, '.metrics/live-eval/raced/report.json'), 'utf8'), 'appeared\n');

  for (const attack of ['../enabled.json', '/tmp/enabled.json', 'nested\\enabled.json', '.', 'nested//enabled.json']) {
    assert.equal(pairedMain(['--enabled', attack, '--disabled', 'disabled.json', '--out', '.metrics/live-eval/report.json'], { repositoryRoot: directory, aggregateFn }), 1, attack);
  }
  symlinkSync('enabled.json', resolve(directory, 'enabled-link.json'));
  assert.equal(pairedMain(['--enabled', 'enabled-link.json', '--disabled', 'disabled.json', '--out', '.metrics/live-eval/report.json'], { repositoryRoot: directory, aggregateFn }), 1);
  linkSync(enabled, resolve(directory, 'enabled-hardlink.json'));
  assert.equal(pairedMain(['--enabled', 'enabled-hardlink.json', '--disabled', 'disabled.json', '--out', '.metrics/live-eval/report.json'], { repositoryRoot: directory, aggregateFn }), 1);
  unlinkSync(resolve(directory, 'enabled-hardlink.json'));
  mkdirSync(resolve(directory, '.metrics/live-eval/linked-parent-target'));
  symlinkSync('linked-parent-target', resolve(directory, '.metrics/live-eval/linked-parent'));
  assert.equal(pairedMain(['--enabled', 'enabled.json', '--disabled', 'disabled.json', '--out', '.metrics/live-eval/linked-parent/report.json'], { repositoryRoot: directory, aggregateFn }), 1);
  mkdirSync(resolve(directory, '.metrics/live-eval/directory-target.json'));
  assert.equal(pairedMain(['--enabled', 'enabled.json', '--disabled', 'disabled.json', '--out', '.metrics/live-eval/directory-target.json'], { repositoryRoot: directory, aggregateFn }), 1);

  unlinkSync(resolve(directory, 'enabled-link.json'));
});
