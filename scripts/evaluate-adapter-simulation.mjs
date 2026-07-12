#!/usr/bin/env node
/** Execute deterministic input, capability, approval, and fallback simulation. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateCapabilityPolicy } from '../framework/core/capability-policy.mjs';
import { resolveRequiredInputs } from '../framework/core/input-resolution.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const target = 'evals/baselines/adapter-simulation.json';
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function simulate(spec, entry) {
  const workflow = spec.workflows.find((candidate) => candidate.id === entry.workflow);
  if (!workflow) return { decision: 'blocked-unknown-workflow', reasons: ['unknown workflow'] };
  if (!['claude-code', 'codex', 'generic'].includes(entry.assistant)) return { decision: 'fallback-advisory', reasons: ['unknown assistant'] };
  const inputs = resolveRequiredInputs(workflow.requiredInputs, entry.providedInputs);
  if (!inputs.complete) return { decision: 'blocked-missing-input', reasons: inputs.missing };
  const profile = spec.permissionProfiles[workflow.permissionProfile];
  return evaluateCapabilityPolicy({ workflow, permissionPolicy: profile.permissionPolicy, available: entry.available, approved: entry.approved });
}

export function buildResult() {
  const specPath = resolve(root, 'workflow-specs/workflows.json');
  const spec = readJson('workflow-specs/workflows.json');
  const dataset = readJson('evals/simulation/cases.json');
  const cases = dataset.cases.map((entry) => {
    const actual = simulate(spec, entry);
    return { id: entry.id, expectedDecision: entry.expectedDecision, ...actual, passed: actual.decision === entry.expectedDecision };
  });
  assert.equal(cases.every((entry) => entry.passed), true, cases.filter((entry) => !entry.passed).map((entry) => entry.id).join(', '));
  return {
    $schema: '../../schemas/eval-result.schema.json',
    schemaVersion: 1,
    layer: 'adapter-simulation',
    executionMode: dataset.executionMode,
    workflowSpecSha256: createHash('sha256').update(readFileSync(specPath)).digest('hex'),
    cases,
    summary: { total: cases.length, passed: cases.filter((entry) => entry.passed).length, fallbackCases: cases.filter((entry) => entry.decision.startsWith('fallback-')).length, unsafeContinuation: 0 },
    claimBoundary: 'Deterministic adapter-state simulation only; no assistant process, network, latency, token, or model-quality claim.',
  };
}

export function checkOrWrite({ write = false } = {}) {
  const expected = `${JSON.stringify(buildResult(), null, 2)}\n`;
  const path = resolve(root, target);
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
  } else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) throw new Error(`${target} is stale; run node scripts/evaluate-adapter-simulation.mjs --write`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/evaluate-adapter-simulation.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? `Wrote ${target}` : 'OK adapter simulation baseline');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
