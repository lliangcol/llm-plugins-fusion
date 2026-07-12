import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function loadWorkflowModel({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }) {
  const framework = readJson(resolve(root, frameworkPath));
  const productFullPath = resolve(root, productPath);
  const product = readJson(productFullPath);
  const workflows = readJson(resolve(root, workflowsPath));
  const behaviors = readJson(resolve(root, behaviorsPath));
  const adapterBase = dirname(productFullPath);
  const adapters = product.adapterDefinitions.map((path) => readJson(resolve(adapterBase, path)));
  const adapterById = Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter]));
  const assistantEnforcement = Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter.enforcement]));
  const spec = {
    ...workflows,
    pluginNamespace: product.pluginNamespace,
    knownGoodClaudeCli: product.runtimeCompatibility['claude-code'] ?? null,
    primaryEntrypoints: product.primaryEntrypoints,
    toolVocabulary: product.tools,
    assistantEnforcement,
  };

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
    assistantEnforcement,
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
