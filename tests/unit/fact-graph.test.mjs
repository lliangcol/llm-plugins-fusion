import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFactGraph } from '../../scripts/generate-fact-graph.mjs';

test('fact graph keeps development and stable release clocks separate with source pointers', () => {
  const graph = buildFactGraph();
  assert.equal(graph.facts['release.stable.version'].value, '4.0.0');
  assert.match(graph.facts['release.stable.version'].source, /release-channels\.json#\/stable\/version/u);
  assert.deepEqual(graph.facts['release.corrections.activeHolds'].value, ['LPF-AUTO-2026-07-RC-001']);
  assert.match(graph.facts['release.corrections.activeHolds'].source, /release-corrections\.json#\/corrections/u);
  assert.equal(graph.facts['compatibility.effectiveLevels'].value.codex, 'L2');
  assert.match(graph.facts['development.version'].sourceSha256, /^[a-f0-9]{64}$/u);
});
