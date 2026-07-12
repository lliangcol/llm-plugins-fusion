import { loadProductBundle } from '../../framework/io/load-product-bundle.mjs';
import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';

export function loadWorkflowModel({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }) {
  const compiled = compileProductBundle(loadProductBundle({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }));
  const { framework, product, adapters, adapterById, workflows, behaviors, spec } = compiled;

  return {
    framework,
    product,
    adapters,
    adapterById,
    workflows,
    behaviors,
    spec,
    behaviorSpec: behaviors,
    // Compatibility projection for generators while v4 callers migrate to explicit layers.
    schemaVersion: workflows.schemaVersion,
    pluginNamespace: product.pluginNamespace,
    knownGoodClaudeCli: product.runtimeCompatibility['claude-code'] ?? null,
    primaryEntrypoints: product.primaryEntrypoints,
    toolVocabulary: product.tools,
    assistantEnforcement: spec.assistantEnforcement,
    permissionProfiles: workflows.permissionProfiles,
    workflowEntries: workflows.workflows,
  };
}

export function loadNovaWorkflowModel(root) {
  return loadWorkflowModel({
    root,
    frameworkPath: 'workflow-specs/framework.json',
    productPath: 'workflow-specs/nova.product.json',
    workflowsPath: 'workflow-specs/workflows.json',
    behaviorsPath: 'workflow-specs/behaviors.json',
  });
}
