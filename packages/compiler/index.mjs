import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';
import { loadSpecBundle, loadSpecBundleUnchecked } from '@llm-plugins-fusion/spec';

export { compileProductBundle };
export {
  compileResolvedVariantContracts,
  compileResolvedVariantManifest,
  resolveCompiledVariantContract,
} from '../../framework/compiler/compile-runtime-contracts.mjs';
export {
  extractVariantParameters,
  normalizeVariantParameters,
  resolveVariantWorkflow,
  variantContractKey,
  variantSelectorKeys,
  variantSelectorSchema,
} from '../../framework/core/variant-contracts.mjs';
export { migrateBehaviorSpec, migrateWorkflowSpec } from './migrate.mjs';
export const compileDirectoryUnchecked = (root) => compileProductBundle(loadSpecBundleUnchecked(root));
export const compileDirectory = (root, options) => compileProductBundle(loadSpecBundle(root, options));
/** @deprecated Use compileDirectory(). Removal milestone: 5.0.0. */
export const compileValidatedDirectory = compileDirectory;
export function buildArtifact(compiled) {
  return { schemaVersion: 1, namespace: compiled.product.pluginNamespace, workflows: compiled.runtimeContracts, adapters: compiled.adapters.map((adapter) => ({ id: adapter.id, enforcement: adapter.enforcement })) };
}
