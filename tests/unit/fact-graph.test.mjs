import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFactGraph } from '../../scripts/generate-fact-graph.mjs';

test('fact graph keeps development and stable release clocks separate with source pointers', () => {
  const graph = buildFactGraph();
  assert.equal(graph.facts['release.stable.version'].value, '3.2.0');
  assert.match(graph.facts['release.stable.version'].source, /release-channels\.json#\/stable\/version/u);
  assert.equal(graph.facts['compatibility.effectiveLevels'].value.codex, 'L2');
  assert.match(graph.facts['development.version'].sourceSha256, /^[a-f0-9]{64}$/u);
});
