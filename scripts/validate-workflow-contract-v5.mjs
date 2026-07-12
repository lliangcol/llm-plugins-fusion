#!/usr/bin/env node
/** Semantic validation for capability contract v5 and skill-first layers. */
import { repoRoot } from './lib/repo-root.mjs';
import { validateWorkflowModel } from './lib/validate-workflow-model.mjs';
import { pathToFileURL } from 'node:url';

export function main() {
  const result = validateWorkflowModel(repoRoot(import.meta.url));
  console.log(`OK workflow capability contract v5 (${result.workflows} workflows, ${result.adapters} adapters, ${result.permissionProfiles} permission profiles, 6 canonical skills)`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
