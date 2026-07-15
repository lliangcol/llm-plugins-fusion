import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFactGraph } from '../../scripts/generate-fact-graph.mjs';

test('fact graph keeps development and stable release clocks separate with source pointers', () => {
  const graph = buildFactGraph();
  assert.equal(graph.facts['release.stable.version'].value, '4.0.0');
  assert.match(graph.facts['release.stable.version'].source, /release-channels\.json#\/stable\/version/u);
  assert.deepEqual(graph.facts['release.corrections.activeHolds'].value, []);
  assert.match(graph.facts['release.corrections.activeHolds'].source, /release-corrections\.json#\/corrections/u);
  assert.deepEqual(graph.facts['release.corrections.authorizedCandidates'].value, [{
    id: 'LPF-AUTO-2026-07-RC-001', stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1',
  }]);
  assert.equal(graph.facts['compatibility.effectiveLevels'].value.codex, 'L2');
  assert.match(graph.facts['development.version'].sourceSha256, /^[a-f0-9]{64}$/u);
  assert.equal(graph.facts['evaluation.live.caseCount'].value, 168);
  assert.equal(graph.facts['evaluation.live.plannedInvocations'].value, 2016);
  assert.equal(graph.facts['evaluation.realTask.taskCount'].value, 24);
  assert.equal(graph.facts['evaluation.realTask.plannedInvocations'].value, 432);
  assert.notEqual(graph.facts['evaluation.live.datasetId'].value, graph.facts['evaluation.realTask.datasetId'].value);
});
