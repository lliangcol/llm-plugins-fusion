#!/usr/bin/env node
/** Keep the authoritative generated behavior block in every Skill aligned with behavior IR. */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const start = '<!-- BEGIN GENERATED BEHAVIOR CONTRACT -->';
const end = '<!-- END GENERATED BEHAVIOR CONTRACT -->';

function renderBehavior(behavior) {
  const inputSummary = behavior.inputs.map((input) => {
    const aliases = input.aliases.length ? ` aliases=${input.aliases.join(',')}` : '';
    const fallback = input.default === undefined ? '' : ` default=${JSON.stringify(input.default)}`;
    const exact = input.exactValues ? ` exact=${input.exactValues.map((value) => JSON.stringify(value)).join(',')}` : '';
    return `\`${input.name}\`(${input.required ? 'required' : 'optional'}${aliases}${fallback}${exact})`;
  }).join('; ');
  const routes = [...new Set(behavior.decisionTable.map((entry) => entry.route).filter(Boolean))];
  const lines = [
    start,
    '> Generated from `workflow-specs/behaviors.v2.json`. This block is authoritative. Run `node scripts/generate-behavior-surfaces.mjs --write` after changing the IR; if explanatory text below conflicts, fail closed.',
    '',
    '### Generated Behavior Index',
    '',
    `- **Purpose:** ${behavior.purpose}`,
    `- **Canonical inputs:** ${inputSummary}`,
    `- **Decision entries:** ${behavior.decisionTable.length}${routes.length ? `; exact routes: ${routes.map((route) => `\`${route}\``).join(', ')}` : ''}.`,
    `- **Workflow steps:** ${behavior.workflowSteps.map((entry) => `\`${entry.id}\``).join(' → ')}`,
    `- **Output:** mode=\`${behavior.output.mode}\`; order=${behavior.output.order.map((field) => `\`${field}\``).join(' → ')}; severity=${behavior.output.severityLevels.length ? behavior.output.severityLevels.map((value) => `\`${value}\``).join(', ') : 'none'}.`,
    `- **Deviation/failure:** mode=\`${behavior.deviationPolicy.mode}\`; failure order=${behavior.failureOutput.order.map((field) => `\`${field}\``).join(' → ')}.`,
    `- **Full IR:** \`runtime/contracts/${behavior.id}.json#behaviorContract\` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.`,
    end,
  ];
  return lines.join('\n');
}

export function generatedBehaviorSurfaces() {
  const { spec, behaviorSpec } = loadNovaWorkflowModelV6(root);
  const behaviors = new Map(behaviorSpec.behaviors.map((behavior) => [behavior.id, behavior]));
  return spec.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => {
    const path = resolve(root, 'nova-plugin', workflow.contractPath);
    const current = readFileSync(path, 'utf8');
    const behavior = behaviors.get(workflow.id);
    if (!behavior) throw new Error(`${workflow.id}: missing behavior IR`);
    const block = renderBehavior(behavior);
    let content;
    if (current.includes(start) || current.includes(end)) {
      if (!(current.includes(start) && current.includes(end))) throw new Error(`${workflow.id}: incomplete generated behavior markers`);
      content = `${current.slice(0, current.indexOf(start))}${block}${current.slice(current.indexOf(end) + end.length)}`;
    } else {
      const anchor = '## Workflow Contract\n';
      if (!current.includes(anchor)) throw new Error(`${workflow.id}: missing Workflow Contract anchor`);
      content = current.replace(anchor, `${anchor}\n${block}\n`);
    }
    return { id: workflow.id, path, content };
  });
}

export function checkOrWrite({ write = false } = {}) {
  const stale = [];
  for (const output of generatedBehaviorSurfaces()) {
    const current = readFileSync(output.path, 'utf8');
    if (current === output.content) continue;
    if (write) writeFileSync(output.path, output.content, 'utf8');
    else stale.push(output.id);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} behavior surfaces stale; run node scripts/generate-behavior-surfaces.mjs --write`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-behavior-surfaces.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote behavior surfaces' : 'OK behavior surfaces');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
