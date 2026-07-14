#!/usr/bin/env node
/** Synchronize generated command-contract blocks and workflow navigation. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const start = '<!-- generated:command-contract:start -->';
const end = '<!-- generated:command-contract:end -->';
const codexIds = new Set(['codex-review-fix', 'codex-review-only', 'codex-verify-only']);
const metadata = JSON.parse(readFileSync(resolve(root, 'governance/workflow-docs.json'), 'utf8'));
const metadataById = new Map(metadata.workflows.map((entry) => [entry.id, entry]));

function docDir(workflow) { return codexIds.has(workflow.id) ? 'codex' : workflow.id === 'plan-review' ? 'plan' : workflow.stage; }
function renderBlock(workflow, behavior, meta) {
  const inputs = workflow.inputs.map((entry) => `\`${entry.name}\`${entry.required ? ' (required)' : ''}`).join(', ') || 'None';
  const effects = workflow.effects.map((entry) => `\`${entry}\``).join(', ') || 'None';
  const related = meta.relatedWorkflows.map((entry) => `\`${entry}\``).join(', ') || 'None';
  return `${start}\n> Generated from \`workflow-specs/workflows.v6.json\`, \`workflow-specs/behaviors.v2.json\`, and \`governance/workflow-docs.json\` by \`node scripts/generate-command-docs.mjs --write\`. Do not edit this block.\n\n- Workflow: \`${workflow.id}\`; stage: \`${workflow.stage}\`; canonical skill: \`nova-${workflow.canonicalSurfaceId}\`\n- Purpose: ${behavior.purpose}\n- Audience: \`${meta.audience}\`; support risk: \`${workflow.risk}\`\n- Inputs: ${inputs}\n- Output contract: \`${workflow.outputContract}\`; authorization: \`${workflow.authorizationProfile}\`\n- Effects: ${effects}\n- Related workflows: ${related}\n${end}`;
}
function replaceBlock(source, block) {
  const from = source.indexOf(start); const to = source.indexOf(end);
  if ((from === -1) !== (to === -1)) throw new Error('command doc has only one generated marker');
  if (from !== -1) return `${source.slice(0, from)}${block}${source.slice(to + end.length)}`;
  const firstLine = source.indexOf('\n');
  if (firstLine === -1) throw new Error('command doc must have an H1');
  return `${source.slice(0, firstLine + 1)}\n${block}\n${source.slice(firstLine + 1)}`;
}
function navigation(workflows) {
  const rows = workflows.map((entry) => `| \`${entry.id}\` | ${entry.stage} | \`nova-${entry.canonicalSurfaceId}\` | ${entry.requiredInputs.map((value) => `\`${value}\``).join(', ')} | \`${entry.outputContract}\` |`).join('\n');
  return `# Generated Command Matrix\n\nGenerated from workflow and documentation metadata by \`node scripts/generate-command-docs.mjs --write\`. Do not edit.\n\n| Workflow | Stage | Canonical skill | Required inputs | Output |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
}
export function checkOrWrite({ write = false } = {}) {
  const model = loadNovaWorkflowModelV6(root); const workflows = model.workflows.workflows; const behaviors = new Map(model.behaviors.behaviors.map((entry) => [entry.id, entry]));
  if (metadataById.size !== workflows.length || workflows.some((entry) => !metadataById.has(entry.id))) throw new Error('workflow documentation metadata inventory differs from workflow v6');
  const stale = [];
  for (const workflow of workflows) {
    const behavior = behaviors.get(workflow.id); const meta = metadataById.get(workflow.id); const block = renderBlock(workflow, behavior, meta);
    for (const suffix of ['.md', '.README.md', '.README.en.md']) {
      const path = `nova-plugin/docs/commands/${docDir(workflow)}/${workflow.id}${suffix}`; const target = resolve(root, path); const actual = readFileSync(target, 'utf8'); const expected = replaceBlock(actual, block);
      if (actual !== expected) { if (write) writeFileSync(target, expected, 'utf8'); else stale.push(path); }
    }
  }
  const navOutputs = ['docs/generated/command-matrix.md', 'nova-plugin/docs/commands/README.generated.md']; const nav = navigation(workflows);
  for (const path of navOutputs) { const target = resolve(root, path); if (!existsSync(target) || readFileSync(target, 'utf8') !== nav) { if (write) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, nav, 'utf8'); } else stale.push(path); } }
  if (stale.length) throw new Error(`${stale.join(', ')} command docs are stale`);
  return { documents: workflows.length * 3, navigation: navOutputs.length };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const args = process.argv.slice(2); if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-command-docs.mjs [--write]'); const result = checkOrWrite({ write: args.includes('--write') }); console.log(`${args.includes('--write') ? 'Wrote' : 'OK'} ${result.documents} command docs and ${result.navigation} navigation outputs`); }
  catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}
