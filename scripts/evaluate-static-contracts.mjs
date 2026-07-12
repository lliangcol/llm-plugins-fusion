#!/usr/bin/env node
/** Produce a named static-contract baseline without implying model accuracy. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const target = 'evals/baselines/static-contract.json';
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function buildResult() {
  const specPath = resolve(root, 'workflow-specs/workflows.json');
  const spec = readJson('workflow-specs/workflows.json');
  const dataset = readJson('evals/route/cases.json');
  const workflows = new Map(spec.workflows.map((entry) => [entry.id, entry]));
  const cases = dataset.cases.map((entry) => {
    const invented = entry.commands.filter((id) => !workflows.has(id));
    const mappingValid = entry.commands.every((id, index) => entry.skills[index] === `nova-${workflows.get(id)?.canonicalSurfaceId}`);
    const required = [...new Set(entry.commands.flatMap((id) => workflows.get(id)?.requiredInputs ?? []))];
    const inputsValid = JSON.stringify(required) === JSON.stringify(entry.requiredInputs);
    return { id: entry.id, inventedSurface: invented, mappingValid, inputsValid, passed: invented.length === 0 && mappingValid && inputsValid };
  });
  assert.equal(cases.every((entry) => entry.passed), true);
  return {
    $schema: '../../schemas/eval-result.schema.json',
    schemaVersion: 1,
    layer: 'static-contract',
    executionMode: 'deterministic-dataset-integrity',
    workflowSpecSha256: createHash('sha256').update(readFileSync(specPath)).digest('hex'),
    cases,
    summary: { total: cases.length, passed: cases.length, inventedSurfaceRate: 0, mappingValidity: 1, inputContractValidity: 1 },
    claimBoundary: 'Static dataset and specification integrity only; this is not routing accuracy, model quality, latency, cost, or runtime enforcement evidence.',
  };
}

export function checkOrWrite({ write = false } = {}) {
  const expected = `${JSON.stringify(buildResult(), null, 2)}\n`;
  const path = resolve(root, target);
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
  } else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) throw new Error(`${target} is stale; run node scripts/evaluate-static-contracts.mjs --write`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/evaluate-static-contracts.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? `Wrote ${target}` : 'OK static contract baseline');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
