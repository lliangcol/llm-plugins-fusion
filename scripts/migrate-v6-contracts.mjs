#!/usr/bin/env node
/** Deterministically project the current v5 workflow and behavior sources into Contract v6. */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '@llm-plugins-fusion/compiler';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
export { migrateBehaviorSpec, migrateWorkflowSpec };

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/migrate-v6-contracts.mjs [--write]');
  const v5 = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.json'), 'utf8'));
  const v1 = JSON.parse(readFileSync(resolve(root, 'workflow-specs/behaviors.json'), 'utf8'));
  const outputs = [['workflow-specs/workflows.v6.json', migrateWorkflowSpec(v5, v1)], ['workflow-specs/behaviors.v2.json', migrateBehaviorSpec(v1)]];
  for (const [path, value] of outputs) {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    if (args.includes('--write')) writeFileSync(resolve(root, path), content, 'utf8');
    else if (readFileSync(resolve(root, path), 'utf8') !== content) throw new Error(`${path} is stale; run with --write`);
  }
  console.log(`${args.includes('--write') ? 'Wrote' : 'OK'} Contract v6 projections`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    console.error(`ERROR ${failure.message}`);
    process.exitCode = 1;
  }
}
