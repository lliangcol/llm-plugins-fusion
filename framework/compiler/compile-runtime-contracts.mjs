/** Compile generic workflow policy plus behavior-complete IR into runtime contracts. */
export function compileRuntimeContract(spec, workflow, behavior) {
  const profile = spec.permissionProfiles[workflow.permissionProfile];
  if (!profile) throw new Error(`${workflow.id}: unknown permission profile ${workflow.permissionProfile}`);
  if (!behavior || behavior.id !== workflow.id) throw new Error(`${workflow.id}: missing behavior IR`);
  const behaviorRequired = behavior.inputs.filter((input) => input.required).map((input) => input.name);
  if (JSON.stringify(behaviorRequired) !== JSON.stringify(workflow.requiredInputs)) {
    throw new Error(`${workflow.id}: behavior required inputs differ from workflow policy`);
  }
  return {
    schemaVersion: 3,
    sourceSchemaVersion: spec.schemaVersion,
    contractVersions: spec.contractVersions,
    id: workflow.id,
    canonicalSurfaceId: workflow.canonicalSurfaceId,
    variantPreset: workflow.variantPreset,
    compatibilityAlias: workflow.compatibilityAlias,
    stage: workflow.stage,
    ownerAgents: workflow.ownerAgents,
    recommendedPacks: workflow.recommendedPacks,
    requiredInputs: workflow.requiredInputs,
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
      schemaVersion: 1,
      source: 'workflow-specs/behaviors.json',
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
    },
    claimBoundary: 'Behavior-complete machine-readable contract generated from the canonical behavior IR; the Skill contains the same generated contract plus explanatory authored guidance.',
  };
}

export function compileRuntimeContracts(spec, behaviorSpec) {
  const behaviors = new Map((behaviorSpec?.behaviors ?? []).map((behavior) => [behavior.id, behavior]));
  return spec.workflows.map((workflow) => compileRuntimeContract(spec, workflow, behaviors.get(workflow.id)));
}
