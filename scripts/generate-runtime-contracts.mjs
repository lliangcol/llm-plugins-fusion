#!/usr/bin/env node
/** Generate behavior-complete runtime contracts from canonical v4 sources. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileRuntimeContracts } from '../framework/compiler/compile-runtime-contracts.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
export function generatedRuntimeContracts() {
  const { spec, behaviorSpec } = loadNovaWorkflowModel(root);
  return compileRuntimeContracts(spec, behaviorSpec).map((contract) => ({ path: `nova-plugin/runtime/contracts/${contract.id}.json`, content: `${JSON.stringify(contract, null, 2)}\n` }));
}
export function checkOrWrite({ write = false } = {}) {
  const stale = [];
  for (const output of generatedRuntimeContracts()) {
    const path = resolve(root, output.path);
    if (write) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, output.content, 'utf8'); }
    else if (!existsSync(path) || readFileSync(path, 'utf8') !== output.content) stale.push(output.path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} stale; run node scripts/generate-runtime-contracts.mjs --write`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-runtime-contracts.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote behavior-complete runtime contracts' : 'OK behavior-complete runtime contracts');
  } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}
