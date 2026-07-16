#!/usr/bin/env node
/** Validate generated project truth and reject known stale active narratives. */

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkOrWriteProjectState, projectFactDocuments, syncDocFacts } from './generate-project-state.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);

export const staleNarrativeRules = Object.freeze([
  { id: 'missing-check-script', pattern: /(?:no|without|does not declare|仍不声明)\s+`?check`?\s*(?:\/|or|、)\s*`?build`?\s+(?:script|脚本|脚本名)/iu },
  { id: 'retired-command-invokes', pattern: /invokes\.skill|\binvokes:\s*\n\s+skill:/u },
  { id: 'retired-skill-metadata', pattern: /metadata\.novaPlugin|\bnovaPlugin:\s*\n/u },
  { id: 'version-lane-collision', pattern: /(?:v3\.0\.0.{0,100}(?:deferred|future|候选|未激活)|(?:deferred|future|候选|未激活).{0,100}v3\.0\.0)/isu },
  { id: 'retired-main-plugin-version', pattern: /Main plugin version:\s*`?3\.2\.0`?/iu },
  { id: 'released-baseline-still-prepared', pattern: /Prepared promotion baseline:\s*(?:exact release tag\s*)?`?v4\.0\.0`?/iu },
  { id: 'retired-3x-line-boundary', pattern: /(?:during|for)\s+the\s+3\.x\s+line/iu },
  { id: 'node-20-active-baseline', pattern: /Node(?:\.js)?\s+20(?:\+|-compatible|\s+CI\s+lane)/iu },
  { id: 'retired-audit-launcher', pattern: /Active launcher:\s*`nova-plugin\/hooks\/scripts\/post-audit-log\.sh`|`post-audit-log\.sh` writes to:/iu },
  { id: 'released-evidence-deferred', pattern: /(?:SBOM|signing|attestation)[^\n]{0,100}(?:remain|仍|keep)[^\n]{0,40}deferred/iu },
]);

export function staleNarrativeFindings(source, path = '<text>') {
  return staleNarrativeRules
    .filter((rule) => rule.pattern.test(source))
    .map((rule) => `${path}: stale narrative ${rule.id}`);
}

export function activeNarrativeDocuments(repoRoot = root) {
  return execFileSync('git', ['ls-files', '*.md'], { cwd: repoRoot, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => path !== 'CHANGELOG.md')
    .filter((path) => !path.startsWith('docs/migrations/'))
    .filter((path) => !/^docs\/releases\/\d/.test(path))
    .filter((path) => existsSync(resolve(repoRoot, path)));
}

export function validateProjectState({ repoRoot = root } = {}) {
  checkOrWriteProjectState({ repoRoot });
  syncDocFacts({ repoRoot });
  const errors = [];
  const activeDocuments = activeNarrativeDocuments(repoRoot);
  for (const path of activeDocuments) {
    errors.push(...staleNarrativeFindings(readFileSync(resolve(repoRoot, path), 'utf8'), path));
  }
  const surfaceMarkdown = readFileSync(resolve(repoRoot, 'docs/generated/surface-inventory.md'), 'utf8');
  if (/`undefined`/.test(surfaceMarkdown)) errors.push('docs/generated/surface-inventory.md: generated values contain undefined');
  if (errors.length) throw new Error(errors.join('\n'));
  return { factBlocks: projectFactDocuments.length, activeDocuments: activeDocuments.length, staleNarratives: 0 };
}

export function main() {
  try {
    const result = validateProjectState();
    console.log(`OK project state and active narratives (${result.factBlocks} generated fact blocks, ${result.activeDocuments} active docs)`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
