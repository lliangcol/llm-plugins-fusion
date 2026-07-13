import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';
import { loadSpecBundle, validateAndLoadSpecBundle } from '@llm-plugins-fusion/spec';

export { compileProductBundle };
export { migrateBehaviorSpec, migrateWorkflowSpec } from './migrate.mjs';
export const compileDirectory = (root) => compileProductBundle(loadSpecBundle(root));
export const compileValidatedDirectory = (root, options) => compileProductBundle(validateAndLoadSpecBundle(root, options));
export function buildArtifact(compiled) {
  return { schemaVersion: 1, namespace: compiled.product.pluginNamespace, workflows: compiled.runtimeContracts, adapters: compiled.adapters.map((adapter) => ({ id: adapter.id, enforcement: adapter.enforcement })) };
}
