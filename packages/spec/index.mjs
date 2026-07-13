import { loadProductBundle } from '../../framework/io/load-product-bundle.mjs';
import { defaultLayout, readJson, resolveContainedFile } from './internal.mjs';

export { defaultLayout, readJson, resolveContainedFile };
export const loadSpecBundle = (root, layout = defaultLayout) => loadProductBundle({ root, ...layout });
export { SPEC_ERROR, SpecBundleError, validateAndLoadSpecBundle } from './validated.mjs';

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
