import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDemoFixtureContract, parseDemoCommandInvocation } from '../../scripts/lib/demo-fixture-contract.mjs';

const model = {
  namespace: 'nova-plugin',
  workflowsById: new Map([
    ['explore', { id: 'explore', stage: 'explore' }],
    ['review', { id: 'review', stage: 'review' }],
    ['finalize-work', { id: 'finalize-work', stage: 'finalize' }],
  ]),
  packIds: new Set(['dependency', 'docs', 'security']),
};

const routeFixture = () => ({
  id: 'route-fixture',
  mode: 'route',
  title: 'Route fixture',
  request: 'Route a public-safe request.',
  expected: {
    nextCommand: '/nova-plugin:explore',
    stage: 'explore',
    packs: ['docs'],
    requiredInputs: ['request'],
    outputSignals: ['one good signal'],
    failureSignals: ['one failure signal'],
  },
  boundaries: ['fictional public-safe fixture'],
});

test('demo fixture contract accepts canonical route semantics', () => {
  assert.equal(assertDemoFixtureContract(routeFixture(), model), true);
  assert.deepEqual(parseDemoCommandInvocation('/nova-plugin:review LEVEL=standard', 'nova-plugin'), {
    id: 'review', selectors: ['LEVEL=standard'],
  });
});

test('demo fixture contract rejects invented namespace, workflow, stage, and pack values', () => {
  for (const mutate of [
    (fixture) => { fixture.expected.nextCommand = '/review'; },
    (fixture) => { fixture.expected.nextCommand = '/nova-plugin:invented'; },
    (fixture) => { fixture.expected.stage = 'Review'; },
    (fixture) => { fixture.expected.stage = 'review'; },
    (fixture) => { fixture.expected.packs = ['dependencies']; },
  ]) {
    const fixture = routeFixture();
    mutate(fixture);
    assert.throws(() => assertDemoFixtureContract(fixture, model));
  }
});
