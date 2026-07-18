/** Pure Contract v5/v1 to v6/v2 migration helpers. */

import {
  CONTRACT_EVIDENCE_REQUIREMENTS,
  expectedEnforcementRequirements,
  projectTypedInput,
  validateBehaviorContractStructure,
  validateContractCoherence,
} from './contract-coherence.mjs';
import { validateBehaviorPredicateInputs } from '../core/behavior-input-contract.mjs';
import { ownRecordValue } from '../core/own-record.mjs';

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

export function migrateWorkflowSpec(v5, behaviorSpec) {
  if (v5.schemaVersion !== 5) throw new Error('v5 workflow source is required');
  if (behaviorSpec.schemaVersion !== 1) throw new Error('v1 behavior source is required');
  if (!Array.isArray(v5.workflows) || v5.workflows.length === 0) throw new Error('v5 workflows must be a non-empty array');
  if (!Array.isArray(behaviorSpec.behaviors) || behaviorSpec.behaviors.length === 0) throw new Error('v1 behaviors must be a non-empty array');
  const sourceFailures = validateContractCoherence(v5, behaviorSpec);
  if (sourceFailures.length > 0) throw new Error(`source Contract v5/v1 is incoherent: ${sourceFailures.join('; ')}`);
  for (const behavior of behaviorSpec.behaviors) validateBehaviorContractStructure(behavior, 1);
  const behaviors = new Map(behaviorSpec.behaviors.map((entry) => [entry.id, entry]));
  if (behaviors.size !== behaviorSpec.behaviors.length) throw new Error('behavior ids must be unique');
  const workflowIdList = v5.workflows.map((workflow) => workflow.id);
  if (workflowIdList.some((id) => typeof id !== 'string' || id.length === 0)) throw new Error('workflow ids must be non-empty strings');
  const workflowIds = new Set(workflowIdList);
  if (workflowIds.size !== workflowIdList.length) throw new Error('workflow ids must be unique');
  const extraBehaviors = [...behaviors.keys()].filter((id) => !workflowIds.has(id)).sort();
  if (extraBehaviors.length > 0) throw new Error(`behaviors without workflows: ${extraBehaviors.join(', ')}`);
  const projected = {
    ...structuredClone(v5),
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
      const profile = ownRecordValue(v5.permissionProfiles, workflow.permissionProfile);
      if (!profile) throw new Error(`${workflow.id}: missing permission profile ${workflow.permissionProfile}`);
      const inputs = behavior.inputs.map(projectTypedInput);
      const policy = profile.permissionPolicy;
      const artifactPathWrite = inputs.some((input) => input.pathPolicy?.root === 'artifact-root' && input.pathPolicy.writable);
      const workspacePathWrite = inputs.some((input) => input.pathPolicy?.root === 'workspace' && input.pathPolicy.writable);
      const effects = new Set(Object.entries(effectNames)
        .filter(([key]) => policy[key] !== 'denied' && policy[key] !== 'unsupported')
        .filter(([key]) => key !== 'workspaceWrite' || !artifactPathWrite || workspacePathWrite)
        .map(([, value]) => value));
      if (artifactPathWrite) effects.add('artifact-write');
      const sortedEffects = [...effects].sort();
      return {
        ...structuredClone(workflow),
        inputs,
        effects: sortedEffects,
        authorizationProfile: workflow.permissionProfile,
        enforcementRequirements: expectedEnforcementRequirements(sortedEffects),
        evidenceRequirements: [...CONTRACT_EVIDENCE_REQUIREMENTS],
        compatibilityProjection: {
          sourceVersion: 5,
          permissionProfile: workflow.permissionProfile,
          requiredInputs: [...workflow.requiredInputs],
        },
      };
    }),
  };
  const projectedBehaviors = migrateBehaviorSpec(behaviorSpec);
  const projectedFailures = validateContractCoherence(projected, projectedBehaviors);
  if (projectedFailures.length > 0) {
    throw new Error(`projected Contract v6/v2 is incoherent: ${projectedFailures.join('; ')}`);
  }
  return projected;
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
      validateBehaviorContractStructure(behavior, 1);
      if (!Array.isArray(behavior.decisionTable) || behavior.decisionTable.length === 0) throw new Error(`${behavior.id}: decisionTable must be a non-empty array`);
      const projectedBehavior = structuredClone(behavior);
      const inputsByName = new Map((projectedBehavior.inputs ?? []).map((input) => [input.name, input]));
      return {
        ...projectedBehavior,
        decisionTable: projectedBehavior.decisionTable.map((decision) => {
          if (!decision || typeof decision !== 'object' || typeof decision.action !== 'string' || decision.action.length === 0) throw new Error(`${behavior.id}: invalid decision`);
          const { predicate, ...projected } = decision;
          if (!predicate && (typeof decision.when !== 'string' || decision.when.length === 0)) throw new Error(`${behavior.id}: decision.when must be a non-empty string when predicate is absent`);
          if (predicate) validateBehaviorPredicateInputs(predicate, inputsByName, behavior.id);
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
