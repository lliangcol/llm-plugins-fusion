#!/usr/bin/env node
/** Generate a deterministic static comparison of direct and compatibility surfaces. */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(root, 'evals/surface-ab.json');

function report() {
  const spec = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.json'), 'utf8'));
  const cases = spec.workflows.map((workflow) => {
    const direct = readFileSync(resolve(root, `nova-plugin/commands/${workflow.id}.md`), 'utf8');
    const compatibility = readFileSync(resolve(root, `nova-plugin/skills/nova-${workflow.id}/SKILL.md`), 'utf8');
    if (!direct.includes('Execute this workflow directly')) throw new Error(`${workflow.id}: direct adapter marker missing`);
    if (/\bInvoke\b[\s\S]{0,80}\bnova-/.test(direct) || /Skill\(nova-plugin:nova-/.test(direct)) {
      throw new Error(`${workflow.id}: runtime delegation remains`);
    }
    if (!compatibility.includes('deprecated')) throw new Error(`${workflow.id}: compatibility deprecation notice missing`);
    return {
      id: workflow.id,
      direct: { bytes: Buffer.byteLength(direct), estimatedTokens: Math.ceil(direct.length / 4), delegatedSkillToolCalls: 0 },
      compatibilityContract: { bytes: Buffer.byteLength(compatibility), estimatedTokens: Math.ceil(compatibility.length / 4), historicalDelegatedSkillToolCalls: 1 },
    };
  });
  return {
    schemaVersion: 1,
    executionMode: 'static-contract',
    claimBoundary: 'No model execution, latency, output quality, or permission behavior is measured by this file.',
    cases,
  };
}

export function checkOrWrite({ write = false } = {}) {
  const content = `${JSON.stringify(report(), null, 2)}\n`;
  if (write) writeFileSync(outputPath, content, 'utf8');
  else if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== content) {
    throw new Error('evals/surface-ab.json is stale; run node scripts/evaluate-workflow-surfaces.mjs --write');
  }
  return JSON.parse(content);
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) return 1;
  try {
    const result = checkOrWrite({ write: args.includes('--write') });
    console.log(`OK workflow surface A/B contract (${result.cases.length} cases)`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
