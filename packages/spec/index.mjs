import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProductBundle } from '../../framework/io/load-product-bundle.mjs';

export const defaultLayout = Object.freeze({ frameworkPath: 'framework.json', productPath: 'product.json', workflowsPath: 'workflows.json', behaviorsPath: 'behaviors.json' });
export const readJson = (root, path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
export const loadSpecBundle = (root, layout = defaultLayout) => loadProductBundle({ root, ...layout });

export function inspectSpecBundle(bundle) {
  return {
    namespace: bundle.product.pluginNamespace,
    workflowSchemaVersion: bundle.workflows.schemaVersion,
    behaviorSchemaVersion: bundle.behaviors.schemaVersion,
    workflowCount: bundle.workflows.workflows.length,
    adapterIds: bundle.adapters.map((adapter) => adapter.id).sort(),
    stages: [...new Set(bundle.workflows.workflows.map((workflow) => workflow.stage))],
  };
}
