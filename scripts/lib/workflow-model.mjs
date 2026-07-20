import { posix } from 'node:path';
import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';
import { loadProductBundle } from '../../framework/io/load-product-bundle.mjs';
import { assertPortableRelativePath } from '../../framework/io/portable-path.mjs';

function projectCompiledModel(compiled) {
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

export function loadWorkflowModel({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }) {
  const compiled = compileProductBundle(loadProductBundle({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }));
  return projectCompiledModel(compiled);
}

/** Resolve product-owned adapter declarations without allowing them to escape the product directory. */
export function resolveProductAdapterPaths(productPath, adapterDefinitions) {
  assertPortableRelativePath(productPath, 'productPath');
  if (!Array.isArray(adapterDefinitions)) throw new TypeError('product.adapterDefinitions must be an array');
  const productDirectory = posix.dirname(productPath);
  return adapterDefinitions.map((path, index) => {
    const label = `product.adapterDefinitions[${index}]`;
    const declaration = assertPortableRelativePath(path, label);
    const resolved = posix.normalize(posix.join(productDirectory, declaration));
    const relative = posix.relative(productDirectory, resolved);
    if (!relative || relative === '..' || relative.startsWith('../') || posix.isAbsolute(relative)) {
      throw new Error(`${label} escapes the product directory: ${path}`);
    }
    return resolved;
  });
}

/** Load and compile one product entirely from a caller-owned immutable reader. */
export function loadWorkflowModelFromReader({ reader, frameworkPath, productPath, workflowsPath, behaviorsPath }) {
  if (!reader || typeof reader.readJson !== 'function') throw new TypeError('workflow model reader must provide readJson');
  const product = reader.readJson(productPath);
  const adapterPaths = resolveProductAdapterPaths(productPath, product.adapterDefinitions);
  const compiled = compileProductBundle({
    framework: reader.readJson(frameworkPath),
    product,
    workflows: reader.readJson(workflowsPath),
    behaviors: reader.readJson(behaviorsPath),
    adapters: adapterPaths.map((path) => reader.readJson(path)),
    provenance: {
      workflowSource: workflowsPath,
      behaviorSource: behaviorsPath,
    },
  });
  return projectCompiledModel(compiled);
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

export function loadNovaWorkflowModelV6(root) {
  return loadWorkflowModel({
    root,
    frameworkPath: 'workflow-specs/framework.json',
    productPath: 'workflow-specs/nova.product.json',
    workflowsPath: 'workflow-specs/workflows.v6.json',
    behaviorsPath: 'workflow-specs/behaviors.v2.json',
  });
}

export function loadNovaWorkflowModelV6FromReader(reader) {
  return loadWorkflowModelFromReader({
    reader,
    frameworkPath: 'workflow-specs/framework.json',
    productPath: 'workflow-specs/nova.product.json',
    workflowsPath: 'workflow-specs/workflows.v6.json',
    behaviorsPath: 'workflow-specs/behaviors.v2.json',
  });
}
