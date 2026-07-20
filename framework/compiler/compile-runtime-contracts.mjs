import {
  CONTRACT_EFFECT_CAPABILITIES,
  validateContractCoherence,
} from '../migrate/contract-coherence.mjs';
import {
  listVariantResolutions,
  resolveVariantWorkflow,
  variantSelectorSchema,
} from '../core/variant-contracts.mjs';
import { assertPortableWorkflowContractPath } from '../io/portable-path.mjs';
import { ownRecordValue } from '../core/own-record.mjs';

export const RESOLVED_VARIANT_SCHEMA_ID = 'https://raw.githubusercontent.com/lliangcol/llm-plugins-fusion/main/schemas/resolved-variant-contracts.schema.json';

export const RESOLVED_VARIANT_AUTHORITY_FIELDS = Object.freeze([
  'schemaVersion',
  'sourceSchemaVersion',
  'contractVersions',
  'id',
  'canonicalSurfaceId',
  'variantPreset',
  'compatibilityAlias',
  'stage',
  'ownerAgents',
  'recommendedPacks',
  'requiredInputs',
  'inputs',
  'effects',
  'authorizationProfile',
  'enforcementRequirements',
  'evidenceRequirements',
  'outputContract',
  'risk',
  'allowedTools',
  'disallowedTools',
  'modelInvocable',
  'subagentSafe',
  'destructiveActions',
  'commandEntrypoint',
  'runtimeRequirements',
  'permissionPolicy',
  'enforcement',
  'instructions',
  'behaviorContract',
  'claimBoundary',
]);

function sourceProvenance(spec, key, fallback) {
  const value = spec?.sourceProvenance?.[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`invalid ${key} provenance`);
  return value;
}

function guidanceReference(contractPath) {
  assertPortableWorkflowContractPath(contractPath, 'workflow contractPath');
  return `../../${contractPath}`;
}

function capabilityScopeInstruction(workflow, permissionPolicy) {
  if (!Array.isArray(workflow.effects)) {
    return 'Exercise only capabilities required by the workflow after satisfying their authorization states; authorization alone never expands workflow scope.';
  }
  const effectAuthorizations = workflow.effects.map((effect) => {
    const capability = CONTRACT_EFFECT_CAPABILITIES[effect];
    return `${effect}:${permissionPolicy?.[capability] ?? 'missing'}`;
  });
  return `Execute only declared workflow effects after satisfying their authorization states (${effectAuthorizations.join(', ')}); authorization alone never expands effect scope.`;
}

function mutationTargetScopeInstruction(workflow, permissionPolicy) {
  const userScopeAuthorization = permissionPolicy?.userScopeMutation;
  const userScopeMutationDeclared = Array.isArray(workflow.effects)
    && workflow.effects.includes('user-scope-mutation');
  if (!userScopeMutationDeclared || !['prompt', 'preapproved', 'explicit'].includes(userScopeAuthorization)) {
    return 'Stay within the project or an explicitly approved artifact root.';
  }
  const authorizationBoundary = userScopeAuthorization === 'explicit'
    ? 'explicitly approved'
    : userScopeAuthorization === 'prompt'
      ? 'approved at the required prompt'
      : 'preapproved by the declared authorization profile';
  return `Mutate only the declared user-scope target that is ${authorizationBoundary}; do not extend that authorization to any other user-scope target.`;
}

function behaviorEffectsClaim(spec, behavior) {
  if (spec.schemaVersion !== 6) {
    return 'This pre-v6 runtime contract does not claim authoritative workflow effects.';
  }
  if (behavior.effects.length === 0) {
    return 'Workflow-level effects are authoritative; behaviorContract.effects declares the validated empty subset and cannot expand workflow capability scope.';
  }
  return `Workflow-level effects are authoritative; behaviorContract.effects declares the validated subset (${behavior.effects.join(', ')}) and cannot expand workflow capability scope.`;
}

/** Compile generic workflow policy plus behavior-complete IR into runtime contracts. */
export function compileRuntimeContract(spec, workflow, behavior) {
  const authorizationProfile = workflow.authorizationProfile ?? workflow.permissionProfile;
  const profile = ownRecordValue(spec.permissionProfiles, authorizationProfile);
  if (!profile) throw new Error(`${workflow.id}: unknown permission profile ${authorizationProfile}`);
  if (!behavior || behavior.id !== workflow.id) throw new Error(`${workflow.id}: missing behavior IR`);
  const coherenceFailures = validateContractCoherence(
    {
      schemaVersion: spec.schemaVersion,
      contractVersions: spec.contractVersions,
      permissionProfiles: spec.permissionProfiles,
      workflows: [workflow],
    },
    { schemaVersion: behavior.schemaVersion, behaviors: [behavior] },
  );
  if (coherenceFailures.length > 0) throw new Error(coherenceFailures.join('; '));
  const requiredInputs = workflow.compatibilityProjection?.requiredInputs ?? workflow.requiredInputs;
  return {
    schemaVersion: spec.schemaVersion === 6 ? 4 : 3,
    sourceSchemaVersion: spec.schemaVersion,
    contractVersions: spec.contractVersions,
    id: workflow.id,
    canonicalSurfaceId: workflow.canonicalSurfaceId,
    variantPreset: workflow.variantPreset,
    compatibilityAlias: workflow.compatibilityAlias,
    stage: workflow.stage,
    ownerAgents: workflow.ownerAgents,
    recommendedPacks: workflow.recommendedPacks,
    requiredInputs,
    ...(spec.schemaVersion === 6 ? {
      inputs: workflow.inputs,
      effects: workflow.effects,
      authorizationProfile,
      enforcementRequirements: workflow.enforcementRequirements,
      evidenceRequirements: workflow.evidenceRequirements,
    } : {}),
    outputContract: workflow.outputContract,
    risk: workflow.risk,
    allowedTools: profile.allowedTools,
    disallowedTools: profile.disallowedTools,
    modelInvocable: workflow.modelInvocable,
    subagentSafe: workflow.subagentSafe,
    destructiveActions: workflow.risk,
    commandEntrypoint: {
      directCommandId: workflow.id,
    },
    runtimeRequirements: workflow.runtimeRequirements ?? { executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'none' } },
    permissionPolicy: profile.permissionPolicy,
    enforcement: spec.assistantEnforcement,
    instructions: [
      'Resolve every required input before side effects.',
      'Stop when a required capability is denied, unsupported, or awaiting approval.',
      mutationTargetScopeInstruction(workflow, profile.permissionPolicy),
      'Preserve the named output contract and report skipped validation honestly.',
      capabilityScopeInstruction(workflow, profile.permissionPolicy),
    ],
    behaviorContract: {
      schemaVersion: behavior.schemaVersion ?? (spec.schemaVersion === 6 ? 2 : 1),
      source: sourceProvenance(spec, 'behaviorSource', 'caller-provided-behavior-spec'),
      guidanceReference: guidanceReference(workflow.contractPath),
      conflictPolicy: 'fail-closed',
      purpose: behavior.purpose,
      inputs: behavior.inputs,
      decisionTable: behavior.decisionTable,
      invariants: behavior.invariants,
      stopConditions: behavior.stopConditions,
      workflowSteps: behavior.workflowSteps,
      deviationPolicy: behavior.deviationPolicy,
      output: behavior.output,
      validation: behavior.validation,
      failureOutput: behavior.failureOutput,
      ...(spec.schemaVersion === 6 ? { effects: behavior.effects } : {}),
    },
    claimBoundary: `Behavior-complete machine-readable contract generated from the canonical behavior IR. ${behaviorEffectsClaim(spec, behavior)} The referenced authored guidance surface may add explanatory context but cannot override this contract.`,
  };
}

export function compileRuntimeContracts(spec, behaviorSpec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('workflow spec must be an object');
  if (!behaviorSpec || typeof behaviorSpec !== 'object' || Array.isArray(behaviorSpec)) throw new Error('behavior spec must be an object');
  const coherenceFailures = validateContractCoherence(spec, behaviorSpec);
  if (coherenceFailures.length > 0) throw new Error(coherenceFailures.join('; '));
  const behaviorSchemaVersion = behaviorSpec?.schemaVersion ?? (spec.schemaVersion === 6 ? 2 : 1);
  const behaviors = new Map(behaviorSpec.behaviors.map((behavior) => [
    behavior.id,
    { ...behavior, schemaVersion: behaviorSchemaVersion },
  ]));
  return spec.workflows.map((workflow) => compileRuntimeContract(spec, workflow, behaviors.get(workflow.id)));
}

export function compileResolvedVariantContracts(spec, behaviorSpec) {
  const contracts = compileRuntimeContracts(spec, behaviorSpec);
  const contractById = new Map(contracts.map((contract) => [contract.id, contract]));
  return listVariantResolutions(spec.workflows, behaviorSpec).map(({
    workflow,
    variantParameters,
    normalizedVariantParameters,
    resolutionKind,
  }) => {
    const contract = contractById.get(workflow.id);
    if (!contract) throw new Error(`${workflow.id}: compiled runtime contract is missing`);
    return {
      canonicalSurfaceId: workflow.canonicalSurfaceId,
      variantParameters,
      normalizedVariantParameters,
      resolutionKind,
      resolvedWorkflowId: workflow.id,
      compatibilityAlias: workflow.compatibilityAlias,
      contract,
    };
  });
}

export function resolveCompiledVariantContract(spec, behaviorSpec, canonicalSurfaceId, variantParameters = {}) {
  const resolved = resolveVariantWorkflow(spec.workflows, behaviorSpec, canonicalSurfaceId, variantParameters);
  const { workflow } = resolved;
  const contract = compileRuntimeContracts(spec, behaviorSpec).find((entry) => entry.id === workflow.id);
  if (!contract) throw new Error(`${workflow.id}: compiled runtime contract is missing`);
  return {
    canonicalSurfaceId,
    variantParameters: resolved.variantParameters,
    normalizedVariantParameters: resolved.normalizedVariantParameters,
    resolutionKind: resolved.resolutionKind,
    resolvedWorkflowId: workflow.id,
    compatibilityAlias: workflow.compatibilityAlias,
    contract,
  };
}

export function compileResolvedVariantManifest(spec, behaviorSpec) {
  return {
    $schema: RESOLVED_VARIANT_SCHEMA_ID,
    schemaVersion: 1,
    identity: 'canonical-surface-plus-validated-variant-parameters',
    resolutionRule: 'exact-normalized-overrides-then-conflict-stop-or-validated-canonical-fallback',
    source: sourceProvenance(spec, 'workflowSource', 'caller-provided-workflow-spec'),
    behaviorSource: sourceProvenance(spec, 'behaviorSource', 'caller-provided-behavior-spec'),
    selectors: Object.fromEntries(spec.workflows
      .filter((workflow) => workflow.compatibilityAlias === false)
      .map((workflow) => [workflow.id, variantSelectorSchema(spec.workflows, behaviorSpec, workflow.id)])),
    authority: {
      rule: 'After exact resolution, the complete resolved runtime contract is authoritative; no field falls back to canonical authored guidance.',
      fields: [...RESOLVED_VARIANT_AUTHORITY_FIELDS],
    },
    resolutions: compileResolvedVariantContracts(spec, behaviorSpec).map((resolved) => ({
      canonicalSurfaceId: resolved.canonicalSurfaceId,
      variantParameters: resolved.variantParameters,
      normalizedVariantParameters: resolved.normalizedVariantParameters,
      resolutionKind: resolved.resolutionKind,
      resolvedWorkflowId: resolved.resolvedWorkflowId,
      compatibilityAlias: resolved.compatibilityAlias,
      runtimeContract: `contracts/${resolved.resolvedWorkflowId}.json`,
    })),
  };
}
