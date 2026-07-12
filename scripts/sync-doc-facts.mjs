#!/usr/bin/env node
/** Synchronize machine-derived project fact blocks in active governance docs. */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildProjectState } from './generate-project-state.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
export const startMarker = '<!-- generated:project-state:start -->';
export const endMarker = '<!-- generated:project-state:end -->';
export const projectFactDocuments = Object.freeze([
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'ROADMAP.md',
  'SECURITY.md',
  'docs/project-optimization-plan.md',
  'docs/llm-plugins-fusion-maintenance-status.md',
  'nova-plugin/docs/architecture/hooks-design.md',
]);

function laneIds(state, status) {
  return Object.entries(state.productLanes)
    .filter(([, lane]) => lane.status === status)
    .map(([id]) => `\`${id}\``)
    .join(', ') || 'None';
}

function launcherSummary(state, event) {
  return (state.hooks[event] ?? []).map((hook) => {
    const args = hook.args.length ? ` ${hook.args.join(' ')}` : '';
    return `\`${hook.command}${args}\``;
  }).join(', ') || 'None';
}

export function renderProjectFactBlock(state) {
  return `${startMarker}
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
\`node scripts/sync-doc-facts.mjs --write\` from repository domain sources and
\`governance/product-lanes.json\`.

- Plugin: \`${state.plugin.name}@${state.plugin.version}\`; production plugins: ${state.plugin.productionPluginCount}; public path: \`${state.plugin.publicPath}\`
- Runtime: Node.js \`${state.runtime.node}\`; distributed Bash helpers: \`${state.runtime.distributedBash}\`
- Inventory: ${state.inventory.commands} commands, ${state.inventory.skills} skills, ${state.inventory.activeAgents} active agents, ${state.inventory.capabilityPacks} capability packs
- Workflow contract: schema v${state.workflow.schemaVersion}, namespace \`${state.workflow.namespace}\`, ${state.workflow.count} workflows
- Package scripts: \`check\` is present; \`build\` is ${state.repositoryScripts.build ? 'present' : 'absent'}
- Active product lanes: ${laneIds(state, 'active')}
- Planned product lanes: ${laneIds(state, 'planned')}
- Deferred product lanes: ${laneIds(state, 'deferred')}
- Release model: \`${state.release.model}\`
- Active PreToolUse launcher: ${launcherSummary(state, 'PreToolUse')}
- Active PostToolUse launcher: ${launcherSummary(state, 'PostToolUse')}
${endMarker}`;
}

export function replaceProjectFactBlock(source, block) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if ((start === -1) !== (end === -1)) throw new Error('project-state generated block has only one marker');
  if (start !== -1) {
    if (end < start) throw new Error('project-state generated block markers are reversed');
    return `${source.slice(0, start)}${block}${source.slice(end + endMarker.length)}`;
  }
  const headingEnd = source.indexOf('\n');
  if (headingEnd === -1 || !source.startsWith('# ')) throw new Error('document must start with an H1 heading');
  return `${source.slice(0, headingEnd + 1)}\n${block}\n${source.slice(headingEnd + 1)}`;
}

export function syncDocFacts({ repoRoot = root, write = false } = {}) {
  const state = buildProjectState(repoRoot);
  const block = renderProjectFactBlock(state);
  const stale = [];
  for (const path of projectFactDocuments) {
    const target = resolve(repoRoot, path);
    const actual = readFileSync(target, 'utf8');
    const expected = replaceProjectFactBlock(actual, block);
    if (actual === expected) continue;
    if (write) writeFileSync(target, expected, 'utf8');
    else stale.push(path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} project fact blocks are stale; run node scripts/sync-doc-facts.mjs --write`);
  return projectFactDocuments;
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) {
    console.error('Usage: node scripts/sync-doc-facts.mjs [--write]');
    return 1;
  }
  try {
    const files = syncDocFacts({ write: args.includes('--write') });
    console.log(`${args.includes('--write') ? 'Wrote' : 'OK'} project fact blocks (${files.length} files)`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
