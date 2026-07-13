#!/usr/bin/env node
/** Generate digest-bound current facts for docs and release channel projections. */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, 'governance/facts.generated.json');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function source(path) {
  const text = readFileSync(resolve(root, path), 'utf8');
  return { data: JSON.parse(text), sha256: sha256(text) };
}

function fact(value, path, pointer, digest) {
  return { value, source: `${path}#${pointer}`, sourceSha256: digest };
}

export function buildFactGraph() {
  const plugin = source('nova-plugin/.claude-plugin/plugin.json');
  const channels = source('governance/release-channels.json');
  const corrections = source('governance/release-corrections.json');
  const compatibility = source('governance/compatibility-evidence.generated.json');
  const project = source('governance/project-state.generated.json');
  const adoption = source('governance/adoption-evidence.json');
  const evidenceGovernance = source('governance/evidence-governance.json');
  const support = Object.fromEntries(compatibility.data.currentClaims.map((claim) => [claim.assistant, claim.effectiveLevel]));
  return {
    schemaVersion: 1,
    facts: {
      'development.version': fact(plugin.data.version, 'nova-plugin/.claude-plugin/plugin.json', '/version', plugin.sha256),
      'release.stable.version': fact(channels.data.stable.version, 'governance/release-channels.json', '/stable/version', channels.sha256),
      'release.stable.tag': fact(channels.data.stable.tag, 'governance/release-channels.json', '/stable/tag', channels.sha256),
      'release.stable.commit': fact(channels.data.stable.commit, 'governance/release-channels.json', '/stable/commit', channels.sha256),
      'release.stable.state': fact(channels.data.stable.state, 'governance/release-channels.json', '/stable/state', channels.sha256),
      'release.corrections.activeHolds': fact(corrections.data.corrections.filter((entry) => entry.status === 'active-release-hold').map((entry) => entry.id), 'governance/release-corrections.json', '/corrections', corrections.sha256),
      'release.corrections.lifecycle': fact(Object.fromEntries(corrections.data.corrections.map((entry) => [entry.id, entry.status])), 'governance/release-corrections.json', '/corrections', corrections.sha256),
      'release.canary.ref': fact(channels.data.canary.ref, 'governance/release-channels.json', '/canary/ref', channels.sha256),
      'compatibility.effectiveLevels': fact(support, 'governance/compatibility-evidence.generated.json', '/currentClaims', compatibility.sha256),
      'adoption.status': fact(adoption.data.status, 'governance/adoption-evidence.json', '/status', adoption.sha256),
      'governance.evidence.statuses': fact(Object.fromEntries(evidenceGovernance.data.facts.map((entry) => [entry.id, entry.status])), 'governance/evidence-governance.json', '/facts', evidenceGovernance.sha256),
      'inventory.commands': fact(project.data.inventory.commands, 'governance/project-state.generated.json', '/inventory/commands', project.sha256),
      'inventory.skills': fact(project.data.inventory.skills, 'governance/project-state.generated.json', '/inventory/skills', project.sha256),
      'runtime.node': fact(project.data.runtime.node, 'governance/project-state.generated.json', '/runtime/node', project.sha256),
      'runtime.bash': fact(project.data.runtime.distributedBash, 'governance/project-state.generated.json', '/runtime/distributedBash', project.sha256),
    },
  };
}

export function generateFactGraph({ write = false } = {}) {
  const content = `${JSON.stringify(buildFactGraph(), null, 2)}\n`;
  if (write) writeFileSync(outPath, content, 'utf8');
  else if (readFileSync(outPath, 'utf8').replaceAll('\r\n', '\n') !== content) throw new Error('governance/facts.generated.json is out of date');
  return { outPath, content };
}

export function main(args = process.argv.slice(2)) {
  try {
    const unknown = args.filter((arg) => arg !== '--write');
    if (unknown.length) throw new Error(`unknown argument: ${unknown.join(', ')}`);
    generateFactGraph({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote governance/facts.generated.json' : 'OK fact graph is current');
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
