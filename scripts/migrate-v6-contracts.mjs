#!/usr/bin/env node
/** Deterministically project the current v5 workflow and behavior sources into Contract v6. */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const effectNames = { workspaceRead: 'workspace-read', workspaceWrite: 'workspace-write', shell: 'shell', network: 'network', credentials: 'credentials', userScopeMutation: 'user-scope-mutation', externalPublish: 'external-publish', gitHistoryMutation: 'git-history-mutation' };

function inputType(input) {
  if (/APPROV(?:AL|ED)/u.test(input.name)) return 'approval';
  if (input.exactValues) return 'enum';
  if (/REVIEW_FILE|REVIEW_REFERENCE/u.test(input.name)) return 'review-reference';
  if (/PATH|FILE/u.test(input.name)) return input.required ? 'path' : 'artifact-reference';
  return 'string';
}

function typedInput(input) {
  const type = inputType(input);
  const result = { name: input.name, type, required: input.required };
  if (type === 'enum') result.values = input.exactValues;
  if (type === 'path') result.pathPolicy = { root: /OUTPUT/u.test(input.name) ? 'artifact-root' : 'workspace', mustExist: !/OUTPUT/u.test(input.name), kind: 'either', readable: true, writable: /OUTPUT/u.test(input.name), outsideRoot: 'deny' };
  if (type === 'approval') result.approvalPolicy = { mustBeExplicit: true, mayInfer: false, scope: input.name, oneShot: true, expires: null };
  return result;
}

export function migrateWorkflowSpec(v5, behaviorSpec) {
  if (v5.schemaVersion !== 5) throw new Error('v5 workflow source is required');
  const behaviors = new Map(behaviorSpec.behaviors.map((entry) => [entry.id, entry]));
  return {
    ...structuredClone(v5),
    $schema: '../schemas/workflow-spec.schema.json',
    schemaVersion: 6,
    contractVersions: { framework: '5.0.0', workflow: '6.0.0', runtime: '4.0.0', adapter: '3.0.0', compatibilityProjection: '5.0.0' },
    workflows: v5.workflows.map((workflow) => {
      const behavior = behaviors.get(workflow.id);
      if (!behavior) throw new Error(`missing behavior for ${workflow.id}`);
      const policy = v5.permissionProfiles[workflow.permissionProfile].permissionPolicy;
      const effects = Object.entries(effectNames).filter(([key]) => policy[key] !== 'denied' && policy[key] !== 'unsupported').map(([, value]) => value);
      if (workflow.permissionProfile === 'artifact-write' && !effects.includes('artifact-write')) effects.push('artifact-write');
      return { ...structuredClone(workflow), inputs: behavior.inputs.map(typedInput), effects: effects.sort(), authorizationProfile: workflow.permissionProfile, enforcementRequirements: effects.map((effect) => `enforce:${effect}`), evidenceRequirements: ['authorization-decision', 'effects-observed', 'validation-result'], compatibilityProjection: { sourceVersion: 5, permissionProfile: workflow.permissionProfile, requiredInputs: [...workflow.requiredInputs] } };
    }),
  };
}

export function migrateBehaviorSpec(v1) {
  if (v1.schemaVersion !== 1) throw new Error('v1 behavior source is required');
  return { ...structuredClone(v1), schemaVersion: 2, behaviors: v1.behaviors.map((behavior) => ({ ...behavior, decisionTable: behavior.decisionTable.map((decision) => ({ ...decision, when: { op: 'all', args: behavior.inputs.filter((input) => input.required).map((input) => ({ op: 'input-present', input: input.name })) } })), effects: [] })) };
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/migrate-v6-contracts.mjs [--write]');
  const v5 = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.json'), 'utf8'));
  const v1 = JSON.parse(readFileSync(resolve(root, 'workflow-specs/behaviors.json'), 'utf8'));
  const outputs = [['workflow-specs/workflows.v6.json', migrateWorkflowSpec(v5, v1)], ['workflow-specs/behaviors.v2.json', migrateBehaviorSpec(v1)]];
  for (const [path, value] of outputs) {
    const content = `${JSON.stringify(value, null, 2)}\n`;
    if (args.includes('--write')) writeFileSync(resolve(root, path), content, 'utf8');
    else if (readFileSync(resolve(root, path), 'utf8') !== content) throw new Error(`${path} is stale; run with --write`);
  }
  console.log(`${args.includes('--write') ? 'Wrote' : 'OK'} Contract v6 projections`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}
