import { compileRuntimeContracts } from './compile-runtime-contracts.mjs';

/** Pure compilation entrypoint: no filesystem, environment, clock, or process access. */
export function compileProductBundle(bundle) {
  const { framework, product, workflows, behaviors, adapters } = structuredClone(bundle);
  if (!framework || !product || !workflows || !behaviors || !Array.isArray(adapters)) throw new Error('incomplete product bundle');
  const adapterIds = adapters.map((adapter) => adapter?.id);
  if (adapterIds.some((id) => typeof id !== 'string' || !id) || new Set(adapterIds).size !== adapterIds.length) {
    throw new Error('adapter ids must be present and unique');
  }
  const adapterById = Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter]));
  const assistantEnforcement = Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter.enforcement]));
  const spec = {
    ...workflows,
    pluginNamespace: product.pluginNamespace,
    runtimeCompatibility: product.runtimeCompatibility,
    primaryEntrypoints: product.primaryEntrypoints,
    automaticRouting: product.automaticRouting,
    toolVocabulary: product.tools,
    assistantEnforcement,
  };
  const canonicalSkills = workflows.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => workflow.canonicalSurfaceId);
  if (new Set(canonicalSkills).size !== canonicalSkills.length) throw new Error('canonical skill surfaces must be unique');
  return {
    framework,
    product,
    workflows,
    behaviors,
    adapters,
    adapterById,
    spec,
    canonicalSkills,
    commandWrappers: workflows.workflows.map((workflow) => ({ id: workflow.id, canonicalSurfaceId: workflow.canonicalSurfaceId, variantPreset: workflow.variantPreset, deprecated: workflow.compatibilityAlias })),
    runtimeContracts: compileRuntimeContracts(spec, behaviors),
  };
}
