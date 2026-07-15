#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const target = resolve(root, 'docs/generated/evidence-levels.md');
export function render(source) {
  return `# Engineering evidence levels\n\nGenerated from \`governance/evidence-levels.json\`.\n\n| Level | Name | Proves | Does not prove |\n| --- | --- | --- | --- |\n${source.levels.map((item) => `| ${item.id} | ${item.name} | ${item.proves} | ${item.doesNotProve} |`).join('\n')}\n\nThe highest accepted source-controlled stable proof is **${source.sourceControlledStableProof.highestAcceptedLevel}** from \`${source.sourceControlledStableProof.source}\`. Dynamic E3-E5 records remain in ${source.dynamicEvidenceStorage.join(', ')} unless a governed promotion process accepts a public-safe summary. Credentials, raw prompts, raw model responses, and local absolute paths are forbidden.\n`;
}
export function main(args = process.argv.slice(2)) {
  try {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) throw new Error('Usage: node scripts/generate-evidence-levels.mjs [--write]');
    const source = JSON.parse(readFileSync(resolve(root, 'governance/evidence-levels.json'), 'utf8'));
    const expectedIds = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5'];
    if (JSON.stringify(source.levels.map((item) => item.id)) !== JSON.stringify(expectedIds)) throw new Error('evidence levels must remain ordered E0 through E5');
    const content = render(source);
    if (args[0] === '--write') writeFileSync(target, content, 'utf8');
    else if (!existsSync(target) || readFileSync(target, 'utf8') !== content) throw new Error('evidence level documentation is stale; run with --write');
    console.log(`OK evidence taxonomy (highest stable=${source.sourceControlledStableProof.highestAcceptedLevel})`);
    return 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
