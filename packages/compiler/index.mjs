import { compileProductBundle } from '../../framework/compiler/compile-product-bundle.mjs';
import { loadSpecBundle } from '@llm-plugins-fusion/spec';

export { compileProductBundle };
export const compileDirectory = (root) => compileProductBundle(loadSpecBundle(root));
export function buildArtifact(compiled) {
  return { schemaVersion: 1, namespace: compiled.product.pluginNamespace, workflows: compiled.runtimeContracts, adapters: compiled.adapters.map((adapter) => ({ id: adapter.id, enforcement: adapter.enforcement })) };
}
