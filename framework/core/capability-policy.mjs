/** Generic capability-policy evaluation with requirements separate from authorization. */
export const permissionStates = Object.freeze(['denied', 'prompt', 'preapproved', 'unsupported', 'explicit']);

export function requiredCapabilities(workflow, permissionPolicy) {
  const required = [];
  if (permissionPolicy.workspaceWrite === 'preapproved') required.push('workspaceWrite');
  if (workflow.runtimeRequirements?.executables?.some((entry) => entry.required)) required.push('shell');
  if (workflow.runtimeRequirements?.network?.need === 'required') required.push('network');
  if (workflow.runtimeRequirements?.credentials?.need === 'required') required.push('credentials');
  return required;
}

export function evaluateCapabilityPolicy({ workflow, permissionPolicy, available = {}, approved = [] }) {
  for (const capability of requiredCapabilities(workflow, permissionPolicy)) {
    const state = available[capability] ?? 'unsupported';
    if (state === 'unsupported' || state === 'denied') return { decision: 'fallback-unsupported-capability', reasons: [capability] };
    if ((state === 'prompt' || state === 'explicit') && !approved.includes(capability)) return { decision: 'blocked-approval', reasons: [capability] };
  }
  return { decision: 'ready', reasons: [] };
}
