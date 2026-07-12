import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildProjectState,
  projectStateContent,
} from '../../scripts/generate-project-state.mjs';
import {
  endMarker,
  renderProjectFactBlock,
  replaceProjectFactBlock,
  startMarker,
} from '../../scripts/sync-doc-facts.mjs';
import {
  activeNarrativeDocuments,
  staleNarrativeFindings,
  validateProjectState,
} from '../../scripts/validate-project-state.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('project state is generated from current repository domain sources', async () => {
  const state = buildProjectState(root);
  assert.equal(state.plugin.version, '4.0.0');
  assert.equal(state.runtime.node, '>=22');
  assert.equal(state.inventory.commands, 21);
  assert.equal(state.inventory.skills, 6);
  assert.ok(state.repositoryScripts.names.includes('check'));
  assert.equal(state.repositoryScripts.build, null);
  assert.equal(state.productLanes['production-multi-plugin-layout'].status, 'deferred');
  assert.equal(await readFile(resolve(root, 'governance/project-state.generated.json'), 'utf8'), projectStateContent(root));
});

test('project fact blocks are deterministic and replace only their generated range', () => {
  const block = renderProjectFactBlock(buildProjectState(root));
  const inserted = replaceProjectFactBlock('# Sample\n\nBody\n', block);
  assert.match(inserted, new RegExp(startMarker));
  assert.match(inserted, new RegExp(endMarker));
  assert.match(inserted, /Body/);
  const replaced = replaceProjectFactBlock(inserted, block.replace('Node.js', 'Node runtime'));
  assert.match(replaced, /Node runtime/);
  assert.doesNotMatch(replaced, /## Current Machine-Derived Project Facts[\s\S]*## Current Machine-Derived Project Facts/);
});

test('stale active narratives are rejected by semantic rule ids', () => {
  for (const source of [
    'package.json has no `check` / `build` script names',
    'invokes.skill is required',
    'metadata.novaPlugin is required',
    'v3.0.0 remains deferred',
    'Node 20-compatible discovery is required',
    'Active launcher: `nova-plugin/hooks/scripts/post-audit-log.sh`',
  ]) assert.equal(staleNarrativeFindings(source).length, 1, source);
  assert.deepEqual(staleNarrativeFindings('The public portal product lane remains deferred.'), []);
});

test('project state, fact blocks, and generated surface values are current', () => {
  assert.ok(activeNarrativeDocuments(root).includes('ROADMAP.md'));
  const result = validateProjectState({ repoRoot: root });
  assert.equal(result.factBlocks, 7);
  assert.ok(result.activeDocuments > 50);
  assert.equal(result.staleNarratives, 0);
});
