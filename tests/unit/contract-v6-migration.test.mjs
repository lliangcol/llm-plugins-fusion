import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '../../scripts/migrate-v6-contracts.mjs';
import { validateStandardSchema } from '../../scripts/lib/schema-engine.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

test('v5 to v6 migration is deterministic and separates requirements authorization effects and evidence', () => {
  const v5 = read('workflow-specs/workflows.json'); const behaviors = read('workflow-specs/behaviors.json');
  const first = migrateWorkflowSpec(v5, behaviors); const second = migrateWorkflowSpec(v5, behaviors);
  assert.deepEqual(first, second);
  assert.equal(v5.schemaVersion, 5);
  for (const workflow of first.workflows) {
    assert.ok(workflow.inputs.every((input) => ['string', 'enum', 'boolean', 'path', 'artifact-reference', 'review-reference', 'approval'].includes(input.type)));
    assert.equal(typeof workflow.authorizationProfile, 'string');
    assert.ok(Array.isArray(workflow.effects));
    assert.ok(workflow.enforcementRequirements.length > 0);
    assert.ok(workflow.evidenceRequirements.length > 0);
  }
  const migratedBehaviors = migrateBehaviorSpec(behaviors);
  assert.ok(migratedBehaviors.behaviors.every((behavior) => behavior.decisionTable.every((decision) => typeof decision.when === 'object')));
  assert.ok(migratedBehaviors.behaviors.every((behavior) => !Object.hasOwn(behavior.output, 'effects')));
});

test('Contract v6 schemas reject inferred approval arbitrary predicates and output effects', () => {
  const v6 = migrateWorkflowSpec(read('workflow-specs/workflows.json'), read('workflow-specs/behaviors.json'));
  const workflowSchema = read('schemas/workflow-spec.schema.json');
  const approval = v6.workflows.flatMap((workflow) => workflow.inputs).find((input) => input.type === 'approval');
  assert.ok(approval);
  approval.approvalPolicy.mayInfer = true;
  assert.notDeepEqual(validateStandardSchema(workflowSchema, v6), []);

  const behaviorV2 = migrateBehaviorSpec(read('workflow-specs/behaviors.json'));
  const behaviorSchema = read('schemas/workflow-behaviors.schema.json');
  behaviorV2.behaviors[0].decisionTable[0].when = { op: 'execute-javascript', source: 'return true' };
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, behaviorV2), []);
  const outputEffects = migrateBehaviorSpec(read('workflow-specs/behaviors.json'));
  outputEffects.behaviors[0].output.effects = ['workspace-write'];
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, outputEffects), []);
});
