import {
  compileResolvedVariantContracts,
  compileResolvedVariantManifest,
  compileRuntimeContracts,
} from './compile-runtime-contracts.mjs';
import { assertProductProtocolCoherence } from '../core/protocol-coherence.mjs';

/** Pure compilation entrypoint: no filesystem, environment, clock, or process access. */
export function compileProductBundle(bundle) {
  const { framework, product, workflows, behaviors, adapters, provenance } = structuredClone(bundle);
  if (!framework || !product || !workflows || !behaviors || !Array.isArray(adapters)) throw new Error('incomplete product bundle');
  const adapterIds = adapters.map((adapter) => adapter?.id);
  if (adapterIds.some((id) => typeof id !== 'string' || !id) || new Set(adapterIds).size !== adapterIds.length) {
    throw new Error('adapter ids must be present and unique');
  }
  assertProductProtocolCoherence({ framework, workflows, behaviors, adapters });
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
    ...(provenance === undefined ? {} : { sourceProvenance: provenance }),
  };
  const canonicalSkills = workflows.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => workflow.canonicalSurfaceId);
  if (new Set(canonicalSkills).size !== canonicalSkills.length) throw new Error('canonical skill surfaces must be unique');
  const runtimeContracts = compileRuntimeContracts(spec, behaviors);
  const resolvedVariantContracts = workflows.schemaVersion === 6 ? compileResolvedVariantContracts(spec, behaviors) : [];
  const resolvedVariantManifest = workflows.schemaVersion === 6 ? compileResolvedVariantManifest(spec, behaviors) : null;
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
    runtimeContracts,
    resolvedVariantContracts,
    resolvedVariantManifest,
  };
}
