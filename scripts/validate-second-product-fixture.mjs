#!/usr/bin/env node
/** Prove the generic compiler with a differently named three-stage product. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileRuntimeContracts } from '../framework/compiler/compile-runtime-contracts.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const fixtureRoot = resolve(root, 'fixtures/products/minimal-plugin');
const outputPath = resolve(fixtureRoot, 'release-evidence.generated.json');
const sourceFiles = ['framework.json', 'product.json', 'workflows.json', 'behaviors.json', 'adapters/mock.json', 'contracts/triage.md', 'contracts/design.md', 'contracts/verify.md'];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function model() {
  return loadWorkflowModel({ root: fixtureRoot, frameworkPath: 'framework.json', productPath: 'product.json', workflowsPath: 'workflows.json', behaviorsPath: 'behaviors.json' });
}

export function buildSecondProductEvidence() {
  const loaded = model();
  assert.equal(loaded.framework.schemaVersion, 4);
  assert.equal(loaded.product.schemaVersion, 2);
  assert.equal(loaded.workflows.schemaVersion, 4);
  assert.equal(loaded.behaviors.schemaVersion, 1);
  assert.equal(loaded.product.expectedWorkflowCount, loaded.spec.workflows.length);
  assert.deepEqual([...new Set(loaded.spec.workflows.map((entry) => entry.stage))], loaded.product.stages);
  assert.deepEqual(loaded.adapters.map((entry) => entry.id), ['mock']);
  const contracts = compileRuntimeContracts(loaded.spec, loaded.behaviorSpec);
  const contractsAgain = compileRuntimeContracts(loaded.spec, loaded.behaviorSpec);
  assert.deepEqual(contractsAgain, contracts, 'compiler output must be deterministic');
  const compiledText = JSON.stringify(contracts);
  assert.doesNotMatch(compiledText, /nova|claude|codex/iu);
  assert.doesNotMatch(readFileSync(resolve(root, 'framework/compiler/compile-runtime-contracts.mjs'), 'utf8'), /nova|claude|codex|\b21\b/iu);
  const adapterManifest = {
    schemaVersion: 1,
    namespace: loaded.product.pluginNamespace,
    adapter: loaded.adapters[0].id,
    declaredLevel: loaded.adapters[0].declaredLevel,
    workflows: contracts.map((contract) => ({ id: contract.id, stage: contract.stage, requiredInputs: contract.requiredInputs, output: contract.behaviorContract.output })),
  };
  const artifact = `${JSON.stringify({ contracts, adapterManifest }, null, 2)}\n`;
  return {
    schemaVersion: 1,
    executionMode: 'deterministic-second-product-full-chain',
    namespace: loaded.product.pluginNamespace,
    stages: loaded.product.stages,
    workflowCount: contracts.length,
    adapter: { id: loaded.adapters[0].id, declaredLevel: loaded.adapters[0].declaredLevel },
    sourceDigests: Object.fromEntries(sourceFiles.map((path) => [path, sha256(readFileSync(resolve(fixtureRoot, path)))])),
    compiledArtifactSha256: sha256(artifact),
    gates: {
      frameworkLoaded: true,
      productLoaded: true,
      adapterLoaded: true,
      behaviorCompiled: true,
      stagesValidated: true,
      deterministicRebuild: true,
      forbiddenProductConstants: 0,
      releaseEvidenceBound: true
    },
    claimBoundary: 'Deterministic fixture evidence only; it proves framework/product/adapter/compiler generality, not publication or a live assistant integration.'
  };
}

export function checkOrWrite({ write = false } = {}) {
  const content = `${JSON.stringify(buildSecondProductEvidence(), null, 2)}\n`;
  if (write) writeFileSync(outputPath, content, 'utf8');
  else if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== content) throw new Error('second-product release evidence is stale; run node scripts/validate-second-product-fixture.mjs --write');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/validate-second-product-fixture.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote second-product release evidence' : 'OK second-product full chain (3 workflows, 3 non-Nova stages, 1 mock adapter)');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
