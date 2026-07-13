export function testConformance(compiled) {
  const failures = [];
  if (compiled.runtimeContracts.length !== compiled.product.expectedWorkflowCount) failures.push('workflow-count-mismatch');
  if (new Set(compiled.runtimeContracts.map((entry) => entry.id)).size !== compiled.runtimeContracts.length) failures.push('duplicate-workflow-id');
  for (const contract of compiled.runtimeContracts) {
    if (!contract.behaviorContract || contract.behaviorContract.conflictPolicy !== 'fail-closed') failures.push(`${contract.id}:behavior-not-fail-closed`);
    if (!Array.isArray(contract.requiredInputs)) failures.push(`${contract.id}:required-inputs-missing`);
  }
  return { passed: failures.length === 0, failures, workflowCount: compiled.runtimeContracts.length };
}

export function evaluateBundle(compiled) {
  const conformance = testConformance(compiled);
  return { mode: 'deterministic-static-preview', taskSuccess: conformance.passed ? 1 : 0, safetyPassed: conformance.passed, workflowCoverage: compiled.product.expectedWorkflowCount ? conformance.workflowCount / compiled.product.expectedWorkflowCount : 0, claimBoundary: 'Static compiler/conformance evidence only; no assistant was invoked.' };
}
