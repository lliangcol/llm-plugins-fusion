import { validateContractCoherence } from '../migrate/contract-coherence.mjs';

/** Compile generic workflow policy plus behavior-complete IR into runtime contracts. */
export function compileRuntimeContract(spec, workflow, behavior) {
  const authorizationProfile = workflow.authorizationProfile ?? workflow.permissionProfile;
  const profile = spec.permissionProfiles[authorizationProfile];
  if (!profile) throw new Error(`${workflow.id}: unknown permission profile ${authorizationProfile}`);
  if (!behavior || behavior.id !== workflow.id) throw new Error(`${workflow.id}: missing behavior IR`);
  const coherenceFailures = validateContractCoherence(
    { schemaVersion: spec.schemaVersion, workflows: [workflow] },
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
    runtimeRequirements: workflow.runtimeRequirements ?? { executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'none' } },
    permissionPolicy: profile.permissionPolicy,
    enforcement: spec.assistantEnforcement,
    instructions: [
      'Resolve every required input before side effects.',
      'Stop when a required capability is denied, unsupported, or awaiting approval.',
      'Stay within the project or an explicitly approved artifact root.',
      'Preserve the named output contract and report skipped validation honestly.',
      'Do not publish externally, mutate user scope, or rewrite Git history.',
    ],
    behaviorContract: {
      schemaVersion: behavior.schemaVersion ?? (spec.schemaVersion === 6 ? 2 : 1),
      source: spec.schemaVersion === 6 ? 'workflow-specs/behaviors.v2.json' : 'workflow-specs/behaviors.json',
      guidanceReference: `../../${workflow.contractPath}`,
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
    claimBoundary: 'Behavior-complete machine-readable contract generated from the canonical behavior IR; the Skill contains the same generated contract plus explanatory authored guidance.',
  };
}

export function compileRuntimeContracts(spec, behaviorSpec) {
  const behaviorSchemaVersion = behaviorSpec?.schemaVersion ?? (spec.schemaVersion === 6 ? 2 : 1);
  const behaviors = new Map((behaviorSpec?.behaviors ?? []).map((behavior) => [behavior.id, { ...behavior, schemaVersion: behaviorSchemaVersion }]));
  return spec.workflows.map((workflow) => compileRuntimeContract(spec, workflow, behaviors.get(workflow.id)));
}
