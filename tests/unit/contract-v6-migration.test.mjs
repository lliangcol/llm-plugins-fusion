import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '@llm-plugins-fusion/compiler';
import { compileRuntimeContracts } from '../../framework/compiler/compile-runtime-contracts.mjs';
import { projectV5Compatibility } from '../../framework/compiler/project-v5-compatibility.mjs';
import { validateStandardSchema } from '../../scripts/lib/schema-engine.mjs';
import { buildPromptSurfaceReport, validatePromptSurfaceBudgets } from '../../scripts/generate-surface-inventory.mjs';

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
  const booleanInput = first.workflows
    .flatMap((workflow) => workflow.inputs)
    .find((input) => input.name === 'INCLUDE_UNTRACKED_CONTENT');
  assert.equal(booleanInput?.type, 'boolean');
  assert.equal(Object.hasOwn(booleanInput, 'values'), false);
  assert.equal(first.workflows.flatMap((workflow) => workflow.inputs).find((input) => input.name === 'PLAN_APPROVED')?.type, 'approval');
  const reviewFile = first.workflows.flatMap((workflow) => workflow.inputs).find((input) => input.name === 'REVIEW_FILE');
  assert.deepEqual(reviewFile?.pathPolicy, {
    root: 'workspace',
    mustExist: true,
    kind: 'file',
    readable: true,
    writable: false,
    outsideRoot: 'deny',
  });
  const seniorExplore = first.workflows.find((workflow) => workflow.id === 'senior-explore');
  assert.equal(seniorExplore?.inputs.find((input) => input.name === 'EXPORT_PATH')?.pathPolicy?.root, 'artifact-root');
  assert.equal(seniorExplore?.effects.includes('artifact-write'), true);
  const migratedBehaviors = migrateBehaviorSpec(behaviors);
  assert.ok(migratedBehaviors.behaviors.every((behavior) => behavior.decisionTable.every((decision) => typeof decision.when === 'object')));
  let explicitPredicates = 0;
  for (const [behaviorIndex, behavior] of migratedBehaviors.behaviors.entries()) {
    for (const [decisionIndex, decision] of behavior.decisionTable.entries()) {
      const sourceDecision = behaviors.behaviors[behaviorIndex].decisionTable[decisionIndex];
      if (sourceDecision.predicate) {
        explicitPredicates += 1;
        assert.deepEqual(decision.when, sourceDecision.predicate);
        assert.equal(Object.hasOwn(decision, 'predicate'), false);
      } else {
        assert.deepEqual(decision.when, {
          op: 'semantic-condition',
          condition: sourceDecision.when,
        });
      }
    }
  }
  assert.equal(explicitPredicates, 29);
  assert.ok(migratedBehaviors.behaviors.every((behavior) => !Object.hasOwn(behavior.output, 'effects')));
});

test('migration rejects incompatible or ambiguous source bundles', () => {
  const workflows = read('workflow-specs/workflows.json');
  const behaviors = read('workflow-specs/behaviors.json');
  assert.throws(
    () => migrateWorkflowSpec(workflows, { ...behaviors, schemaVersion: 2 }),
    /v1 behavior source is required/u,
  );
  assert.throws(
    () => migrateWorkflowSpec(workflows, { ...behaviors, behaviors: [...behaviors.behaviors, behaviors.behaviors[0]] }),
    /behavior ids must be unique/u,
  );
  assert.throws(
    () => migrateWorkflowSpec(workflows, { ...behaviors, behaviors: [...behaviors.behaviors, { ...behaviors.behaviors[0], id: 'orphan' }] }),
    /behaviors without workflows: orphan/u,
  );
  assert.throws(
    () => migrateBehaviorSpec({ ...behaviors, behaviors: [...behaviors.behaviors, behaviors.behaviors[0]] }),
    /behavior ids must be unique/u,
  );
  const missingPathPolicy = structuredClone(behaviors);
  delete missingPathPolicy.behaviors.find((behavior) => behavior.id === 'implement-plan').inputs[0].pathPolicy;
  assert.throws(() => migrateWorkflowSpec(workflows, missingPathPolicy), /typed path input requires pathPolicy/u);
  const unknownPredicateInput = structuredClone(behaviors);
  unknownPredicateInput.behaviors[0].decisionTable[0].predicate.args[0].input = 'UNKNOWN_INPUT';
  assert.throws(() => migrateBehaviorSpec(unknownPredicateInput), /predicate references unknown input UNKNOWN_INPUT/u);
});

test('all workflows compile from v6 and the compatibility projection exactly matches v5', () => {
  const v5 = read('workflow-specs/workflows.json');
  const v6 = read('workflow-specs/workflows.v6.json');
  const behaviors = read('workflow-specs/behaviors.v2.json');
  assert.deepEqual(projectV5Compatibility(v6), v5);
  const first = compileRuntimeContracts(v6, behaviors);
  const second = compileRuntimeContracts(v6, behaviors);
  assert.equal(first.length, 21);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.ok(first.every((contract) => contract.schemaVersion === 4 && contract.sourceSchemaVersion === 6));
  assert.ok(first.every((contract) => contract.inputs && contract.effects && contract.authorizationProfile));
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
  const proseCondition = migrateBehaviorSpec(read('workflow-specs/behaviors.json'));
  proseCondition.behaviors[0].decisionTable[0].when = 'unstructured prose';
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, proseCondition), []);
  behaviorV2.behaviors[0].decisionTable[0].when = { op: 'execute-javascript', source: 'return true' };
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, behaviorV2), []);
  const outputEffects = migrateBehaviorSpec(read('workflow-specs/behaviors.json'));
  outputEffects.behaviors[0].output.effects = ['workspace-write'];
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, outputEffects), []);
});

test('assistant manifest schema rejects incomplete alias gates and loose nested contracts', () => {
  const productSchema = read('schemas/workflow-product.schema.json');
  const product = read('workflow-specs/nova.product.json');
  const incompleteProductPolicy = structuredClone(product);
  incompleteProductPolicy.compatibilityAliasPolicy.removalRequires.pop();
  assert.notDeepEqual(validateStandardSchema(productSchema, incompleteProductPolicy), []);

  const manifestSchema = read('schemas/assistant-manifest.schema.json');
  const manifest = read('adapters/generic-agent-skills/manifest.json');
  const incompleteManifestPolicy = structuredClone(manifest);
  incompleteManifestPolicy.aliasPolicy.removalRequires.pop();
  assert.notDeepEqual(validateStandardSchema(manifestSchema, incompleteManifestPolicy), []);

  const looseInput = structuredClone(manifest);
  looseInput.workflows[0].inputs[0].invented = true;
  assert.notDeepEqual(validateStandardSchema(manifestSchema, looseInput), []);

  const looseRuntime = structuredClone(manifest);
  looseRuntime.workflows[0].runtimeRequirements.network.invented = true;
  assert.notDeepEqual(validateStandardSchema(manifestSchema, looseRuntime), []);
});

test('aggregate prompt load graph covers every workflow and budget regressions fail closed', () => {
  const report = buildPromptSurfaceReport();
  assert.equal(report.workflowCount, 21);
  assert.ok(report.workflows.every((workflow) => workflow.graph.nodes.length === workflow.aggregate.files));
  assert.ok(report.workflows.every((workflow) => Number.isFinite(workflow.aggregate.duplicateRatio)));
  assert.deepEqual(validatePromptSurfaceBudgets(report), []);
  const oversized = structuredClone(report);
  oversized.workflows[0].aggregate.tokens = oversized.budgets.maximumAggregateTokens + 1;
  assert.match(validatePromptSurfaceBudgets(oversized)[0], /aggregate tokens/u);
});
