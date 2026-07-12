/** Compile authored workflow specs into concise runtime contracts. */
export function compileRuntimeContract(spec, workflow) {
  const profile = spec.permissionProfiles[workflow.permissionProfile];
  if (!profile) throw new Error(`${workflow.id}: unknown permission profile ${workflow.permissionProfile}`);
  return {
    schemaVersion: 1,
    sourceSchemaVersion: spec.schemaVersion,
    id: workflow.id,
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
    authoredBehaviorReference: `../../skills/nova-${workflow.id}/SKILL.md`,
    claimBoundary: 'Compiled minimum runtime contract; the authored skill remains the compatibility and maintainer reference.',
  };
}

export function compileRuntimeContracts(spec) {
  return spec.workflows.map((workflow) => compileRuntimeContract(spec, workflow));
}
