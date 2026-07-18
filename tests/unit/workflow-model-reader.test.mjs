import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';
import { loadWorkflowModelFromReader } from '../../scripts/lib/workflow-model.mjs';

const fixtureRoot = resolve(import.meta.dirname, '../../fixtures/products/minimal-plugin');

test('workflow model compilation consumes only caller-frozen reader bytes', () => {
  const paths = [
    'framework.json',
    'product.json',
    'workflows.json',
    'behaviors.json',
    'adapters/mock.json',
  ];
  const frozen = new Map(paths.map((path) => [path, readFileSync(resolve(fixtureRoot, path), 'utf8')]));
  const observed = [];
  const reader = {
    readJson(path) {
      observed.push(path);
      const source = frozen.get(path);
      if (source === undefined) throw new Error(`unexpected reader path ${path}`);
      return JSON.parse(source);
    },
  };
  const model = loadWorkflowModelFromReader({
    reader,
    frameworkPath: 'framework.json',
    productPath: 'product.json',
    workflowsPath: 'workflows.json',
    behaviorsPath: 'behaviors.json',
  });
  assert.deepEqual(observed, ['product.json', 'framework.json', 'workflows.json', 'behaviors.json', 'adapters/mock.json']);
  assert.equal(model.spec.workflows.length, 3);
  assert.deepEqual(model.spec.sourceProvenance, {
    workflowSource: 'workflows.json',
    behaviorSource: 'behaviors.json',
  });

  const changed = JSON.parse(frozen.get('product.json'));
  changed.runtimeCompatibility['claude-code'] = 'transient-unfrozen-value';
  frozen.set('product.json', JSON.stringify(changed));
  assert.notEqual(model.knownGoodClaudeCli, 'transient-unfrozen-value');
});

test('workflow model reader contains adapter declarations to the product directory', () => {
  const paths = ['framework.json', 'product.json', 'workflows.json', 'behaviors.json', 'adapters/mock.json'];
  const baseline = new Map(paths.map((path) => [path, readFileSync(resolve(fixtureRoot, path), 'utf8')]));
  for (const adapterPath of ['../outside-adapter.json', '/outside-adapter.json', 'adapters\\mock.json', './adapters/mock.json']) {
    const frozen = new Map(baseline);
    const product = JSON.parse(frozen.get('product.json'));
    product.adapterDefinitions = [adapterPath];
    frozen.set('product.json', JSON.stringify(product));
    frozen.set('outside-adapter.json', frozen.get('adapters/mock.json'));
    const observed = [];
    const reader = {
      readJson(path) {
        observed.push(path);
        const source = frozen.get(path);
        if (source === undefined) throw new Error(`unexpected reader path ${path}`);
        return JSON.parse(source);
      },
    };
    assert.throws(
      () => loadWorkflowModelFromReader({ reader, frameworkPath: 'framework.json', productPath: 'product.json', workflowsPath: 'workflows.json', behaviorsPath: 'behaviors.json' }),
      /portable relative path|traversal, dot, or empty components/u,
      adapterPath,
    );
    assert.deepEqual(observed, ['product.json'], `${adapterPath} must fail before an adapter read`);
  }
});
