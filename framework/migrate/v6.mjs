/** Pure Contract v5/v1 to v6/v2 migration helpers. */

import { projectTypedInput } from './contract-coherence.mjs';

const effectNames = {
  workspaceRead: 'workspace-read',
  workspaceWrite: 'workspace-write',
  shell: 'shell',
  network: 'network',
  credentials: 'credentials',
  userScopeMutation: 'user-scope-mutation',
  externalPublish: 'external-publish',
  gitHistoryMutation: 'git-history-mutation',
};

function validatePredicate(predicate, inputNames, label) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) throw new Error(`${label}: predicate must be an object`);
  if (['input-present', 'path-readable', 'path-writable', 'input-equals', 'input-in'].includes(predicate.op)) {
    if (!inputNames.has(predicate.input)) throw new Error(`${label}: predicate references unknown input ${predicate.input}`);
    return;
  }
  if (['all', 'any'].includes(predicate.op)) {
    if (!Array.isArray(predicate.args) || predicate.args.length === 0) throw new Error(`${label}: ${predicate.op} predicate requires args`);
    for (const child of predicate.args) validatePredicate(child, inputNames, label);
    return;
  }
  if (predicate.op === 'not') {
    validatePredicate(predicate.arg, inputNames, label);
    return;
  }
  if (predicate.op === 'semantic-condition' || predicate.op === 'capability-state') return;
  throw new Error(`${label}: unsupported predicate op ${predicate.op ?? 'missing'}`);
}

export function migrateWorkflowSpec(v5, behaviorSpec) {
  if (v5.schemaVersion !== 5) throw new Error('v5 workflow source is required');
  if (behaviorSpec.schemaVersion !== 1) throw new Error('v1 behavior source is required');
  const behaviors = new Map(behaviorSpec.behaviors.map((entry) => [entry.id, entry]));
  if (behaviors.size !== behaviorSpec.behaviors.length) throw new Error('behavior ids must be unique');
  const workflowIds = new Set(v5.workflows.map((workflow) => workflow.id));
  const extraBehaviors = [...behaviors.keys()].filter((id) => !workflowIds.has(id)).sort();
  if (extraBehaviors.length > 0) throw new Error(`behaviors without workflows: ${extraBehaviors.join(', ')}`);
  return {
    ...structuredClone(v5),
    $schema: '../schemas/workflow-spec.schema.json',
    schemaVersion: 6,
    contractVersions: {
      framework: '5.0.0',
      workflow: '6.0.0',
      runtime: '4.0.0',
      adapter: '3.0.0',
      compatibilityProjection: '5.0.0',
    },
    workflows: v5.workflows.map((workflow) => {
      const behavior = behaviors.get(workflow.id);
      if (!behavior) throw new Error(`missing behavior for ${workflow.id}`);
      const profile = v5.permissionProfiles[workflow.permissionProfile];
      if (!profile) throw new Error(`${workflow.id}: missing permission profile ${workflow.permissionProfile}`);
      const inputs = behavior.inputs.map(projectTypedInput);
      const policy = profile.permissionPolicy;
      const effects = Object.entries(effectNames)
        .filter(([key]) => policy[key] !== 'denied' && policy[key] !== 'unsupported')
        .map(([, value]) => value);
      if (inputs.some((input) => input.pathPolicy?.root === 'artifact-root' && input.pathPolicy.writable)) effects.push('artifact-write');
      return {
        ...structuredClone(workflow),
        inputs,
        effects: effects.sort(),
        authorizationProfile: workflow.permissionProfile,
        enforcementRequirements: effects.map((effect) => `enforce:${effect}`),
        evidenceRequirements: ['authorization-decision', 'effects-observed', 'validation-result'],
        compatibilityProjection: {
          sourceVersion: 5,
          permissionProfile: workflow.permissionProfile,
          requiredInputs: [...workflow.requiredInputs],
        },
      };
    }),
  };
}

export function migrateBehaviorSpec(v1) {
  if (v1.schemaVersion !== 1) throw new Error('v1 behavior source is required');
  if (!Array.isArray(v1.behaviors) || v1.behaviors.length === 0) throw new Error('v1 behaviors must be a non-empty array');
  const ids = v1.behaviors.map((behavior) => behavior?.id);
  if (new Set(ids).size !== ids.length) throw new Error('behavior ids must be unique');
  return {
    ...structuredClone(v1),
    schemaVersion: 2,
    behaviors: v1.behaviors.map((behavior) => {
      if (!Array.isArray(behavior.decisionTable) || behavior.decisionTable.length === 0) throw new Error(`${behavior.id}: decisionTable must be a non-empty array`);
      const inputNames = new Set((behavior.inputs ?? []).map((input) => input.name));
      return {
        ...behavior,
        decisionTable: behavior.decisionTable.map((decision) => {
          if (!decision || typeof decision !== 'object' || typeof decision.action !== 'string' || decision.action.length === 0) throw new Error(`${behavior.id}: invalid decision`);
          const { predicate, ...projected } = decision;
          if (!predicate && (typeof decision.when !== 'string' || decision.when.length === 0)) throw new Error(`${behavior.id}: decision.when must be a non-empty string when predicate is absent`);
          if (predicate) validatePredicate(predicate, inputNames, behavior.id);
          return {
            ...projected,
            when: predicate ? structuredClone(predicate) : {
              op: 'semantic-condition',
              condition: decision.when,
            },
          };
        }),
        effects: [],
      };
    }),
  };
}
