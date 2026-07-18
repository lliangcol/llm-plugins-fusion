import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '@llm-plugins-fusion/compiler';
import {
  compileResolvedVariantContracts,
  compileResolvedVariantManifest,
  compileRuntimeContracts,
  RESOLVED_VARIANT_AUTHORITY_FIELDS,
  RESOLVED_VARIANT_SCHEMA_ID,
  resolveCompiledVariantContract,
} from '../../framework/compiler/compile-runtime-contracts.mjs';
import {
  extractVariantParameters,
  resolveVariantWorkflow,
  variantContractKey,
  variantSelectorSchema,
} from '../../framework/core/variant-contracts.mjs';
import {
  RUNTIME_EXECUTABLE_NAME_PATTERN_SOURCE,
  RUNTIME_NETWORK_PURPOSE_PATTERN_SOURCE,
} from '../../framework/core/capability-policy.mjs';
import {
  projectTypedInput,
  validateContractCoherence,
} from '../../framework/migrate/contract-coherence.mjs';
import { projectV5Compatibility } from '../../framework/compiler/project-v5-compatibility.mjs';
import {
  assertPortableRelativePath,
  assertPortableWorkflowContractPath,
  WORKFLOW_CONTRACT_PATH_PATTERN_SOURCE,
} from '../../framework/io/portable-path.mjs';
import { validateStandardSchema } from '../../scripts/lib/schema-engine.mjs';
import { buildPromptSurfaceReport, validatePromptSurfaceBudgets } from '../../scripts/generate-surface-inventory.mjs';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

test('v5 to v6 migration is deterministic and separates requirements authorization effects and evidence', () => {
  const v5 = read('workflow-specs/workflows.json'); const behaviors = read('workflow-specs/behaviors.json');
  const first = migrateWorkflowSpec(v5, behaviors); const second = migrateWorkflowSpec(v5, behaviors);
  assert.deepEqual(first, second);
  assert.equal(v5.schemaVersion, 5);
  assert.equal(first.$schema, v5.$schema);
  for (const workflow of first.workflows) {
    assert.ok(workflow.inputs.every((input) => ['string', 'enum', 'boolean', 'path', 'artifact-reference', 'review-reference', 'approval'].includes(input.type)));
    assert.equal(typeof workflow.authorizationProfile, 'string');
    assert.ok(Array.isArray(workflow.effects));
    assert.ok(workflow.effects.length > 0);
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
  assert.deepEqual(seniorExplore?.effects, ['artifact-write', 'workspace-read']);
  for (const workflowId of ['backend-plan', 'produce-plan', 'senior-explore']) {
    assert.deepEqual(first.workflows.find((workflow) => workflow.id === workflowId)?.effects, ['artifact-write', 'workspace-read']);
  }
  const migratedBehaviors = migrateBehaviorSpec(behaviors);
  assert.deepEqual(validateContractCoherence(first, migratedBehaviors), []);
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
  assert.equal(explicitPredicates, 27);
  assert.ok(migratedBehaviors.behaviors.every((behavior) => !Object.hasOwn(behavior.output, 'effects')));
});

test('behavior migration deeply isolates every nested source and projection object', () => {
  const source = read('workflow-specs/behaviors.json');
  const sourceSnapshot = structuredClone(source);
  const projected = migrateBehaviorSpec(source);

  projected.behaviors[0].inputs[0].aliases.push('PROJECTION_ONLY_ALIAS');
  projected.behaviors[0].output.fields[0].description = 'projection-only description';
  projected.behaviors[0].decisionTable[0].when.projectionOnly = true;
  assert.deepEqual(source, sourceSnapshot);

  const projectedSnapshot = structuredClone(projected);
  source.behaviors[0].inputs[0].aliases.push('SOURCE_ONLY_ALIAS');
  source.behaviors[0].output.fields[0].description = 'source-only description';
  source.behaviors[0].decisionTable[0].predicate.sourceOnly = true;
  assert.deepEqual(projected, projectedSnapshot);
});

test('workflow migration and reverse projection preserve the caller schema reference', () => {
  for (const [workflowPath, behaviorPath] of [
    ['workflow-specs/workflows.json', 'workflow-specs/behaviors.json'],
    ['fixtures/products/minimal-plugin/workflows.json', 'fixtures/products/minimal-plugin/behaviors.json'],
  ]) {
    const source = read(workflowPath);
    const projected = migrateWorkflowSpec(source, read(behaviorPath));
    assert.equal(projected.$schema, source.$schema);
    assert.equal(projectV5Compatibility(projected).$schema, source.$schema);
  }

  const source = read('workflow-specs/workflows.json');
  const customReference = 'https://example.invalid/contracts/workflow-spec.schema.json';
  const projected = migrateWorkflowSpec({ ...source, $schema: customReference }, read('workflow-specs/behaviors.json'));
  assert.equal(projected.$schema, customReference);
  assert.equal(projectV5Compatibility(projected).$schema, customReference);
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
  const duplicateWorkflows = structuredClone(workflows);
  duplicateWorkflows.workflows.push(structuredClone(duplicateWorkflows.workflows[0]));
  assert.throws(
    () => migrateWorkflowSpec(duplicateWorkflows, behaviors),
    /workflow ids must be unique/u,
  );
  const duplicateCanonicalInput = structuredClone(behaviors);
  const duplicateCanonicalBehavior = duplicateCanonicalInput.behaviors.find((behavior) => behavior.inputs.length > 1);
  duplicateCanonicalBehavior.inputs[1].name = duplicateCanonicalBehavior.inputs[0].name;
  assert.throws(
    () => migrateWorkflowSpec(workflows, duplicateCanonicalInput),
    /behavior input names must be unique/u,
  );
  assert.throws(
    () => migrateBehaviorSpec(duplicateCanonicalInput),
    /behavior input names must be unique/u,
  );
  const prototypeCanonicalInput = structuredClone(behaviors);
  prototypeCanonicalInput.behaviors[0].inputs[0].name = '__proto__';
  assert.throws(
    () => migrateBehaviorSpec(prototypeCanonicalInput),
    /UPPER_SNAKE_CASE identity/u,
  );
  const negativeZeroInput = structuredClone(behaviors);
  const enumInput = negativeZeroInput.behaviors.flatMap((behavior) => behavior.inputs)
    .find((input) => Array.isArray(input.exactValues));
  enumInput.exactValues = [-0];
  enumInput.default = -0;
  assert.throws(
    () => migrateBehaviorSpec(negativeZeroInput),
    /canonical finite JSON scalar values/u,
  );
  const canonicalAliasConflict = structuredClone(behaviors);
  const canonicalAliasBehavior = canonicalAliasConflict.behaviors.find((behavior) => behavior.inputs.length > 1);
  canonicalAliasBehavior.inputs[1].aliases.push(canonicalAliasBehavior.inputs[0].name);
  assert.throws(
    () => migrateWorkflowSpec(workflows, canonicalAliasConflict),
    /behavior input alias .* conflicts with a canonical input name/u,
  );
  assert.throws(
    () => migrateBehaviorSpec(canonicalAliasConflict),
    /behavior input alias .* conflicts with a canonical input name/u,
  );
  const sharedAliasConflict = structuredClone(behaviors);
  const sharedAliasBehavior = sharedAliasConflict.behaviors.find((behavior) => behavior.inputs.length > 1);
  sharedAliasBehavior.inputs[1].aliases.push(sharedAliasBehavior.inputs[0].aliases[0]);
  assert.throws(
    () => migrateWorkflowSpec(workflows, sharedAliasConflict),
    /behavior input alias .* is shared by/u,
  );
  assert.throws(
    () => migrateBehaviorSpec(sharedAliasConflict),
    /behavior input alias .* is shared by/u,
  );
  const prototypePermissionProfile = structuredClone(workflows);
  prototypePermissionProfile.workflows[0].permissionProfile = 'toString';
  assert.throws(
    () => migrateWorkflowSpec(prototypePermissionProfile, behaviors),
    /missing permission profile toString|unknown permission profile toString/u,
  );
  const missingPathPolicy = structuredClone(behaviors);
  delete missingPathPolicy.behaviors.find((behavior) => behavior.id === 'implement-plan').inputs[0].pathPolicy;
  assert.throws(() => migrateWorkflowSpec(workflows, missingPathPolicy), /typed path input requires pathPolicy/u);
  const unknownPredicateInput = structuredClone(behaviors);
  unknownPredicateInput.behaviors[0].decisionTable[0].predicate.args[0].input = 'UNKNOWN_INPUT';
  assert.throws(() => migrateBehaviorSpec(unknownPredicateInput), /predicate references unknown input UNKNOWN_INPUT/u);
  const nonPathPredicateInput = structuredClone(behaviors);
  const nonPathBehavior = nonPathPredicateInput.behaviors.find((behavior) => behavior.inputs.some((input) => !input.type && !input.pathPolicy));
  const nonPathInput = nonPathBehavior.inputs.find((input) => !input.type && !input.pathPolicy);
  nonPathBehavior.decisionTable[0].predicate = { op: 'path-readable', input: nonPathInput.name };
  assert.throws(() => migrateBehaviorSpec(nonPathPredicateInput), /path-readable input .* must be path-like/u);
  const unreadablePredicateInput = structuredClone(behaviors);
  const unreadableBehavior = unreadablePredicateInput.behaviors.find((behavior) => behavior.id === 'implement-plan');
  unreadableBehavior.inputs.find((input) => input.name === 'PLAN_INPUT_PATH').pathPolicy.readable = false;
  assert.throws(() => migrateBehaviorSpec(unreadablePredicateInput), /pathPolicy\.readable must be true/u);
  const unwritablePredicateInput = structuredClone(behaviors);
  const unwritableBehavior = unwritablePredicateInput.behaviors.find((behavior) => behavior.id === 'backend-plan');
  unwritableBehavior.inputs.find((input) => input.name === 'PLAN_OUTPUT_PATH').pathPolicy.writable = false;
  assert.throws(() => migrateBehaviorSpec(unwritablePredicateInput), /pathPolicy\.writable must be true/u);
});

test('migration binds readable and writable paths to authorization and exact effects', () => {
  const workflows = read('workflow-specs/workflows.json');
  const behaviors = read('workflow-specs/behaviors.json');
  const deniedRead = structuredClone(workflows);
  deniedRead.permissionProfiles['artifact-write'].permissionPolicy.workspaceRead = 'denied';
  assert.throws(
    () => migrateWorkflowSpec(deniedRead, behaviors),
    /readable path input requires workspaceRead authorization, got denied/u,
  );
  const denied = structuredClone(workflows);
  denied.permissionProfiles['artifact-write'].permissionPolicy.workspaceWrite = 'denied';
  assert.throws(
    () => migrateWorkflowSpec(denied, behaviors),
    /writable path input requires workspaceWrite authorization, got denied/u,
  );

  for (const authorization of ['prompt', 'preapproved', 'explicit']) {
    const allowed = structuredClone(workflows);
    allowed.permissionProfiles['artifact-write'].permissionPolicy.workspaceWrite = authorization;
    assert.doesNotThrow(() => migrateWorkflowSpec(allowed, behaviors), authorization);
  }

  const v6 = migrateWorkflowSpec(workflows, behaviors);
  const v2 = migrateBehaviorSpec(behaviors);
  const missingReadEffect = structuredClone(v6);
  const readableWorkflow = missingReadEffect.workflows.find((workflow) => workflow.id === 'plan-review');
  readableWorkflow.effects = readableWorkflow.effects.filter((effect) => effect !== 'workspace-read');
  assert.match(validateContractCoherence(missingReadEffect, v2).join('\n'), /readable path input requires workspace-read effect/u);
  assert.throws(() => compileRuntimeContracts(missingReadEffect, v2), /readable path input requires workspace-read effect/u);

  const missingArtifactEffect = structuredClone(v6);
  const artifactWorkflow = missingArtifactEffect.workflows.find((workflow) => workflow.id === 'senior-explore');
  artifactWorkflow.effects = artifactWorkflow.effects.filter((effect) => effect !== 'artifact-write');
  assert.match(validateContractCoherence(missingArtifactEffect, v2).join('\n'), /writable artifact-root path input requires artifact-write effect/u);
  assert.throws(() => compileRuntimeContracts(missingArtifactEffect, v2), /writable artifact-root path input requires artifact-write effect/u);

  const missingWorkspaceEffect = structuredClone(v6);
  const workspaceWorkflow = missingWorkspaceEffect.workflows.find((workflow) => workflow.id === 'implement-plan');
  const workspaceBehavior = structuredClone(v2);
  workspaceBehavior.behaviors
    .find((behavior) => behavior.id === 'implement-plan')
    .inputs.find((input) => input.name === 'PLAN_INPUT_PATH').pathPolicy.writable = true;
  workspaceWorkflow.effects = workspaceWorkflow.effects.filter((effect) => effect !== 'workspace-write');
  assert.match(validateContractCoherence(missingWorkspaceEffect, workspaceBehavior).join('\n'), /writable workspace path input requires workspace-write effect/u);
  assert.throws(() => compileRuntimeContracts(missingWorkspaceEffect, workspaceBehavior), /writable workspace path input requires workspace-write effect/u);

  const invalidBoolean = structuredClone(behaviors);
  invalidBoolean.behaviors
    .find((behavior) => behavior.id === 'codex-review-fix')
    .inputs.find((input) => input.name === 'INCLUDE_UNTRACKED_CONTENT').default = 'false';
  assert.throws(() => migrateBehaviorSpec(invalidBoolean), /default has (?:not-an-exact-value|wrong-type)/u);

  const invalidPredicate = structuredClone(behaviors);
  const booleanBehavior = invalidPredicate.behaviors.find((behavior) => behavior.id === 'codex-review-fix');
  const booleanPredicate = booleanBehavior.decisionTable
    .map((decision) => decision.predicate)
    .find((predicate) => JSON.stringify(predicate).includes('INCLUDE_UNTRACKED_CONTENT'));
  const equalsNode = booleanPredicate.args.find((predicate) => predicate.input === 'INCLUDE_UNTRACKED_CONTENT');
  equalsNode.value = 'true';
  assert.throws(() => migrateBehaviorSpec(invalidPredicate), /input-equals value for INCLUDE_UNTRACKED_CONTENT has not-an-exact-value/u);

  const invalidInputIn = structuredClone(behaviors);
  const reviewBehavior = invalidInputIn.behaviors.find((behavior) => behavior.id === 'review');
  reviewBehavior.decisionTable[0].predicate = { op: 'input-in', input: 'LEVEL', values: ['lite', 'invented'] };
  assert.throws(() => migrateBehaviorSpec(invalidInputIn), /input-in value for LEVEL has not-an-exact-value/u);
});

test('behavior migration and coherence reject implicit approvals and ambiguous structure', () => {
  const v5 = read('workflow-specs/workflows.json');
  const v1 = read('workflow-specs/behaviors.json');
  const v6 = read('workflow-specs/workflows.v6.json');
  const v2 = read('workflow-specs/behaviors.v2.json');

  const approvalWithDefault = structuredClone(v1);
  approvalWithDefault.behaviors
    .find((behavior) => behavior.id === 'implement-plan')
    .inputs.find((input) => input.type === 'approval').default = false;
  assert.throws(() => migrateWorkflowSpec(v5, approvalWithDefault), /approval behavior input must not declare a default/u);
  assert.throws(() => migrateBehaviorSpec(approvalWithDefault), /approval behavior input must not declare a default/u);
  assert.throws(
    () => projectTypedInput({ name: 'APPROVAL', required: true, type: 'approval', default: false }),
    /approval behavior input must not declare a default/u,
  );

  const v1Effects = structuredClone(v1);
  v1Effects.behaviors[0].effects = [];
  assert.throws(() => migrateWorkflowSpec(v5, v1Effects), /behavior schema v1 must not declare effects/u);
  assert.throws(() => migrateBehaviorSpec(v1Effects), /behavior schema v1 must not declare effects/u);
  assert.throws(() => compileRuntimeContracts(v5, v1Effects), /behavior schema v1 must not declare effects/u);

  const structuralMutations = [
    {
      pattern: /workflowSteps ids must be unique/u,
      mutate(behavior) { behavior.workflowSteps[1].id = behavior.workflowSteps[0].id; },
    },
    {
      pattern: /output field names must be unique/u,
      mutate(behavior) { behavior.output.fields[1].name = behavior.output.fields[0].name; },
    },
    {
      pattern: /output order must exactly match the output field inventory/u,
      mutate(behavior) { behavior.output.order[0] = 'invented output'; },
    },
    {
      pattern: /failureOutput fields must be unique/u,
      mutate(behavior) { behavior.failureOutput.fields[1] = behavior.failureOutput.fields[0]; },
    },
    {
      pattern: /failureOutput order must exactly match the failure field inventory/u,
      mutate(behavior) { behavior.failureOutput.order[0] = 'invented failure'; },
    },
  ];
  for (const { mutate, pattern } of structuralMutations) {
    const invalidV1 = structuredClone(v1);
    const sourceBehavior = invalidV1.behaviors.find((behavior) => behavior.workflowSteps.length > 1
      && behavior.output.fields.length > 1
      && behavior.failureOutput.fields.length > 1);
    mutate(sourceBehavior);
    assert.throws(() => migrateBehaviorSpec(invalidV1), pattern);

    const invalidV2 = structuredClone(v2);
    mutate(invalidV2.behaviors.find((behavior) => behavior.id === sourceBehavior.id));
    assert.match(validateContractCoherence(v6, invalidV2).join('\n'), pattern);
    assert.throws(() => compileRuntimeContracts(v6, invalidV2), pattern);
  }

  const sharedAlias = structuredClone(v2);
  const aliasedBehavior = sharedAlias.behaviors.find((behavior) => behavior.inputs.length > 1);
  aliasedBehavior.inputs[1].aliases.push(aliasedBehavior.inputs[0].aliases[0]);
  assert.match(validateContractCoherence(v6, sharedAlias).join('\n'), /behavior input alias .* is shared by/u);
  assert.throws(() => compileRuntimeContracts(v6, sharedAlias), /behavior input alias .* is shared by/u);
});

test('runtime contract compilation rejects duplicate missing and orphan identities globally', () => {
  const v6 = read('workflow-specs/workflows.v6.json');
  const v2 = read('workflow-specs/behaviors.v2.json');
  const cases = [
    {
      pattern: /workflow ids must be unique/u,
      mutate(spec) { spec.workflows.push(structuredClone(spec.workflows[0])); },
    },
    {
      pattern: /workflow at index .* must declare a non-empty id/u,
      mutate(spec) { delete spec.workflows[0].id; },
    },
    {
      pattern: /behavior ids must be unique/u,
      mutate(_spec, behaviors) { behaviors.behaviors.push(structuredClone(behaviors.behaviors[0])); },
    },
    {
      pattern: /behavior at index .* must declare a non-empty id/u,
      mutate(_spec, behaviors) { delete behaviors.behaviors[0].id; },
    },
    {
      pattern: /workflows without behaviors/u,
      mutate(_spec, behaviors) { behaviors.behaviors.pop(); },
    },
    {
      pattern: /behaviors without workflows: orphan/u,
      mutate(_spec, behaviors) {
        behaviors.behaviors.push({ ...structuredClone(behaviors.behaviors[0]), id: 'orphan' });
      },
    },
  ];
  for (const { mutate, pattern } of cases) {
    const spec = structuredClone(v6);
    const behaviors = structuredClone(v2);
    mutate(spec, behaviors);
    assert.throws(() => compileRuntimeContracts(spec, behaviors), pattern);
  }
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
  for (const [index, contract] of first.entries()) {
    const workflow = v6.workflows[index];
    const profile = v6.permissionProfiles[workflow.authorizationProfile];
    assert.deepEqual(contract.allowedTools, profile.allowedTools, `${workflow.id}: allowedTools projection drift`);
    assert.deepEqual(contract.disallowedTools, profile.disallowedTools, `${workflow.id}: disallowedTools projection drift`);
    assert.equal(contract.modelInvocable, workflow.modelInvocable, `${workflow.id}: modelInvocable projection drift`);
    assert.equal(contract.subagentSafe, workflow.subagentSafe, `${workflow.id}: subagentSafe projection drift`);
    assert.equal(contract.destructiveActions, workflow.risk, `${workflow.id}: destructiveActions projection drift`);
    assert.deepEqual(contract.commandEntrypoint, {
      directCommandId: workflow.id,
    }, `${workflow.id}: commandEntrypoint projection drift`);
  }

  const v5Contracts = compileRuntimeContracts(v5, read('workflow-specs/behaviors.json'));
  assert.ok(v5Contracts.every((contract) => contract.claimBoundary.includes('pre-v6 runtime contract')));
  assert.ok(v5Contracts.every((contract) => !contract.claimBoundary.includes('Workflow-level effects are authoritative')));
  assert.ok(first.every((contract) => contract.claimBoundary.includes('Workflow-level effects are authoritative')));
  assert.ok(first.every((contract) => contract.claimBoundary.includes('validated empty subset')));

  const behaviorEffects = structuredClone(behaviors);
  behaviorEffects.behaviors.find((behavior) => behavior.id === 'review').effects = ['workspace-read'];
  const reviewContract = compileRuntimeContracts(v6, behaviorEffects).find((contract) => contract.id === 'review');
  assert.deepEqual(reviewContract.behaviorContract.effects, ['workspace-read']);
  assert.match(reviewContract.claimBoundary, /validated subset \(workspace-read\)/u);
  assert.doesNotMatch(reviewContract.claimBoundary, /currently adds none/u);
});

test('compatibility alias behavior selectors stay fixed to their exact workflow preset', () => {
  const source = read('workflow-specs/workflows.json');
  const behaviorSource = read('workflow-specs/behaviors.json');
  const spec = migrateWorkflowSpec(source, behaviorSource);
  const behaviors = migrateBehaviorSpec(behaviorSource);
  const seniorDepth = behaviors.behaviors
    .find((behavior) => behavior.id === 'senior-explore')
    .inputs.find((input) => input.name === 'DEPTH');
  assert.deepEqual(seniorDepth.exactValues, ['deep']);
  assert.equal(seniorDepth.default, 'deep');
  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'explore', { DEPTH: 'deep' }).workflow.id, 'senior-explore');

  const broadAlias = structuredClone(behaviors);
  broadAlias.behaviors
    .find((behavior) => behavior.id === 'senior-explore')
    .inputs.find((input) => input.name === 'DEPTH').exactValues.push('normal');
  assert.throws(
    () => resolveVariantWorkflow(spec.workflows, broadAlias, 'explore', { DEPTH: 'deep' }),
    /compatibility alias selector DEPTH exactValues must equal its preset value/u,
  );

  const driftingDefault = structuredClone(behaviors);
  driftingDefault.behaviors
    .find((behavior) => behavior.id === 'senior-explore')
    .inputs.find((input) => input.name === 'DEPTH').default = 'normal';
  assert.throws(
    () => resolveVariantWorkflow(spec.workflows, driftingDefault, 'explore', { DEPTH: 'deep' }),
    /compatibility alias selector DEPTH default must equal its preset value/u,
  );
});

test('resolved variant manifests identify their stable canonical schema', () => {
  const workflowSource = read('workflow-specs/workflows.json');
  const behaviorSource = read('workflow-specs/behaviors.json');
  const spec = migrateWorkflowSpec(workflowSource, behaviorSource);
  const behaviors = migrateBehaviorSpec(behaviorSource);
  const manifest = compileResolvedVariantManifest(spec, behaviors);
  const schema = read('schemas/resolved-variant-contracts.schema.json');
  assert.equal(RESOLVED_VARIANT_SCHEMA_ID, schema.$id);
  assert.equal(manifest.$schema, schema.$id);
  assert.equal(schema.properties.$schema.const, schema.$id);
  assert.deepEqual(validateStandardSchema(schema, manifest), []);
});

test('validated canonical variants normalize defaults and resolve complete runtime contracts fail closed', () => {
  const spec = read('workflow-specs/workflows.v6.json');
  const behaviors = read('workflow-specs/behaviors.v2.json');
  const compiled = new Map(compileRuntimeContracts(spec, behaviors).map((contract) => [contract.id, contract]));
  const resolutions = compileResolvedVariantContracts(spec, behaviors);
  assert.equal(resolutions.length, 21);
  assert.equal(new Set(resolutions.map((entry) => `${entry.canonicalSurfaceId}:${JSON.stringify(entry.normalizedVariantParameters)}`)).size, 21);

  const planLite = resolveCompiledVariantContract(spec, behaviors, 'produce-plan', { PLAN_PROFILE: 'lite' });
  assert.equal(planLite.resolvedWorkflowId, 'plan-lite');
  assert.equal(planLite.compatibilityAlias, true);
  assert.deepEqual(planLite.contract, compiled.get('plan-lite'));
  assert.deepEqual(planLite.contract.requiredInputs, ['REQUEST']);
  assert.deepEqual(planLite.contract.effects, ['workspace-read']);
  assert.equal(planLite.contract.authorizationProfile, 'read-only');
  assert.equal(planLite.contract.outputContract, 'plan-lite-v2');
  assert.equal(planLite.contract.behaviorContract.output.mode, 'chat');
  const selectors = extractVariantParameters(spec.workflows, behaviors, 'produce-plan', {
    REQUEST: 'plan this',
    PLAN_OUTPUT_PATH: 'plan.md',
    PLAN_PROFILE: 'lite',
  });
  assert.deepEqual(selectors, { PLAN_PROFILE: 'lite' });
  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'produce-plan', selectors).workflow.id, 'plan-lite');

  const codexFix = resolveCompiledVariantContract(spec, behaviors, 'implement-plan', { EXECUTION_PROFILE: 'codex-review-fix' });
  assert.equal(codexFix.resolvedWorkflowId, 'codex-review-fix');
  assert.deepEqual(codexFix.contract.requiredInputs, ['REVIEW_SCOPE']);
  assert.equal(codexFix.contract.runtimeRequirements.network.need, 'required');
  assert.equal(codexFix.contract.permissionPolicy.credentials, 'explicit');
  assert.equal(codexFix.contract.commandEntrypoint.directCommandId, 'codex-review-fix');

  const canonicalReview = resolveCompiledVariantContract(spec, behaviors, 'review', {});
  const externalReview = resolveCompiledVariantContract(spec, behaviors, 'review', { REVIEW_PROFILE: 'codex-review-only' });
  assert.equal(canonicalReview.contract.modelInvocable, true);
  assert.equal(externalReview.contract.modelInvocable, false);
  assert.equal(canonicalReview.contract.disallowedTools.includes('Bash'), true);
  assert.equal(externalReview.contract.disallowedTools.includes('Bash'), false);
  assert.equal(canonicalReview.contract.destructiveActions, 'none');
  assert.equal(externalReview.contract.destructiveActions, 'low');
  assert.equal(externalReview.contract.commandEntrypoint.directCommandId, 'codex-review-only');

  const manifest = compileResolvedVariantManifest(spec, behaviors);
  assert.equal(manifest.resolutions.find((entry) => entry.resolvedWorkflowId === 'plan-lite')?.runtimeContract, 'contracts/plan-lite.json');
  assert.deepEqual(manifest.selectors['produce-plan'], {
    PLAN_PROFILE: { exactValues: ['general', 'lite', 'java-backend'], default: 'general' },
  });
  assert.deepEqual(variantSelectorSchema(spec.workflows, behaviors, 'implement-plan'), {
    EXECUTION_PROFILE: { exactValues: ['lite', 'standard', 'codex-review-fix'] },
  });
  assert.equal(manifest.resolutionRule, 'exact-normalized-overrides-then-conflict-stop-or-validated-canonical-fallback');
  assert.deepEqual(manifest.authority.fields, [
    'schemaVersion', 'sourceSchemaVersion', 'contractVersions', 'id', 'canonicalSurfaceId',
    'variantPreset', 'compatibilityAlias', 'stage', 'ownerAgents', 'recommendedPacks',
    'requiredInputs', 'inputs', 'effects', 'authorizationProfile', 'enforcementRequirements',
    'evidenceRequirements', 'outputContract', 'risk', 'allowedTools', 'disallowedTools',
    'modelInvocable', 'subagentSafe', 'destructiveActions', 'commandEntrypoint',
    'runtimeRequirements', 'permissionPolicy', 'enforcement', 'instructions',
    'behaviorContract', 'claimBoundary',
  ]);
  assert.deepEqual(manifest.authority.fields, [...RESOLVED_VARIANT_AUTHORITY_FIELDS]);
  assert.equal(manifest.authority.fields.length, 30);

  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'review', { MODE: 'findings-only' }).workflow.id, 'review-only');
  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'explore', { PERSPECTIVE: 'reviewer', DEPTH: 'standard' }).workflow.id, 'explore-review');
  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'produce-plan', { PLAN_PROFILE: 'general' }).workflow.id, 'produce-plan');
  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'implement-plan', {}).workflow.id, 'implement-plan');
  assert.equal(resolveVariantWorkflow(spec.workflows, behaviors, 'implement-plan', { EXECUTION_PROFILE: 'standard' }).workflow.id, 'implement-standard');

  const fallbackBehaviors = structuredClone(behaviors);
  fallbackBehaviors.behaviors.find((behavior) => behavior.id === 'review').inputs.find((input) => input.name === 'MODE').exactValues.push('summary');
  const fallback = resolveVariantWorkflow(spec.workflows, fallbackBehaviors, 'review', { MODE: 'summary' });
  assert.equal(fallback.workflow.id, 'review');
  assert.equal(fallback.resolutionKind, 'canonical-fallback');

  for (const conflicting of [
    ['review', { REVIEW_PROFILE: 'plan', LEVEL: 'strict' }],
    ['review', { REVIEW_PROFILE: 'codex-verify-only', MODE: 'findings-only' }],
    ['explore', { PERSPECTIVE: 'reviewer', DEPTH: 'deep' }],
    ['review', { LEVEL: 'lite', MODE: 'findings-only' }],
  ]) {
    assert.throws(
      () => resolveVariantWorkflow(spec.workflows, behaviors, conflicting[0], conflicting[1]),
      /conflicting variant selectors partially trigger/u,
    );
  }
  assert.throws(
    () => resolveVariantWorkflow(spec.workflows, behaviors, 'produce-plan', { PLAN_PROFILE: 'invented' }),
    /variant selector PLAN_PROFILE has unsupported value/u,
  );
  assert.throws(
    () => resolveVariantWorkflow(spec.workflows, behaviors, 'produce-plan', { PLAN_PROFILE: 'lite', REQUEST: 'ordinary input' }),
    /undeclared variant selector REQUEST/u,
  );
  assert.throws(
    () => resolveVariantWorkflow(spec.workflows, behaviors, 'produce-plan', { PLAN_PROFILE: 'lite', INVENTED_SELECTOR: true }),
    /undeclared variant selector INVENTED_SELECTOR/u,
  );
  assert.throws(() => variantContractKey('produce-plan', { PLAN_PROFILE: Number.NaN }), /finite number/u);
  assert.throws(() => variantContractKey('Produce Plan', {}), /kebab-case/u);
  const ambiguous = structuredClone(spec.workflows);
  ambiguous.find((workflow) => workflow.id === 'review-lite').variantPreset = { LEVEL: 'strict' };
  assert.throws(() => resolveVariantWorkflow(ambiguous, behaviors, 'review', { LEVEL: 'strict' }), /duplicate normalized variant contract/u);
});

test('Contract v6 coherence fails closed for every typed input projection field', () => {
  const source = read('workflow-specs/workflows.v6.json');
  const behaviors = read('workflow-specs/behaviors.v2.json');
  assert.deepEqual(validateContractCoherence(source, behaviors), []);

  const legacyBehaviors = read('workflow-specs/behaviors.json');
  assert.throws(
    () => compileRuntimeContracts(source, legacyBehaviors),
    /workflow schema v6 requires behavior schema v2/u,
  );

  const cases = [
    {
      label: 'input order',
      pattern: /typed input names or order differ/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').inputs.reverse(); },
    },
    {
      label: 'required flag',
      pattern: /typed input required differs/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').inputs[0].required = false; },
    },
    {
      label: 'input type',
      pattern: /typed input type differs/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').inputs[1].type = 'string'; },
    },
    {
      label: 'enum exactValues',
      pattern: /typed enum values differ from behavior exactValues/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').inputs[1].values = ['invented-level']; },
    },
    {
      label: 'path policy',
      pattern: /typed pathPolicy differs from behavior pathPolicy/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'implement-plan').inputs[0].pathPolicy.root = 'artifact-root'; },
    },
    {
      label: 'approval policy',
      pattern: /typed approvalPolicy differs from the explicit approval contract/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'implement-plan').inputs[1].approvalPolicy.oneShot = false; },
    },
    {
      label: 'unsupported typed field',
      pattern: /typed input contains unsupported keys: invented/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').inputs[0].invented = true; },
    },
    {
      label: 'compatibility required inputs',
      pattern: /behavior required inputs differ from workflow policy/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').compatibilityProjection.requiredInputs = []; },
    },
    {
      label: 'unknown authorization profile',
      pattern: /unknown (?:authorization|permission) profile invented/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').authorizationProfile = 'invented'; },
    },
    {
      label: 'authorization profile differs from permission profile',
      pattern: /authorizationProfile must equal permissionProfile/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').authorizationProfile = 'implementation'; },
    },
    {
      label: 'compatibility permission profile differs from permission profile',
      pattern: /compatibility permission profile must equal permissionProfile/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').compatibilityProjection.permissionProfile = 'implementation'; },
    },
    {
      label: 'compatibility projection source version differs from v5',
      pattern: /compatibility projection sourceVersion must be 5/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').compatibilityProjection.sourceVersion = 4; },
    },
    {
      label: 'authorization grants capability absent from effects',
      pattern: /authorized capability externalPublish:explicit is not declared by workflow effects/u,
      mutate(spec) { spec.permissionProfiles['read-only'].permissionPolicy.externalPublish = 'explicit'; },
    },
    {
      label: 'authorization state is invalid',
      pattern: /authorization workspaceRead has invalid state invented/u,
      mutate(spec) { spec.permissionProfiles['read-only'].permissionPolicy.workspaceRead = 'invented'; },
    },
    {
      label: 'effect denied by authorization profile',
      pattern: /effect external-publish requires unavailable authorization externalPublish:denied/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'review');
        workflow.effects.push('external-publish');
        workflow.enforcementRequirements.push('enforce:external-publish');
      },
    },
    {
      label: 'enforcement differs from effects',
      pattern: /enforcement requirements must exactly match declared effects/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').enforcementRequirements = ['enforce:network']; },
    },
    {
      label: 'evidence differs from baseline',
      pattern: /evidence requirements must exactly match the governed baseline/u,
      mutate(spec) { spec.workflows.find((workflow) => workflow.id === 'review').evidenceRequirements = ['invented-evidence']; },
    },
    {
      label: 'effects cannot be empty',
      pattern: /effects must declare at least one governed capability/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'review');
        workflow.effects = [];
        workflow.enforcementRequirements = [];
      },
    },
    {
      label: 'network runtime requirement needs network effect',
      pattern: /required network runtime requirements require the network effect/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'codex-review-only');
        workflow.effects = workflow.effects.filter((effect) => effect !== 'network');
        workflow.enforcementRequirements = workflow.enforcementRequirements.filter((entry) => entry !== 'enforce:network');
      },
    },
    {
      label: 'credential runtime requirement needs credential effect',
      pattern: /required credential runtime requirements require the credentials effect/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'codex-review-only');
        workflow.effects = workflow.effects.filter((effect) => effect !== 'credentials');
        workflow.enforcementRequirements = workflow.enforcementRequirements.filter((entry) => entry !== 'enforce:credentials');
      },
    },
    {
      label: 'executable runtime requirement needs shell effect',
      pattern: /executable runtime requirements require the shell effect/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'codex-review-only');
        workflow.effects = workflow.effects.filter((effect) => effect !== 'shell');
        workflow.enforcementRequirements = workflow.enforcementRequirements.filter((entry) => entry !== 'enforce:shell');
      },
    },
    {
      label: 'runtime executable names cannot be empty',
      pattern: /runtime executable entries are invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].name = '';
      },
    },
    {
      label: 'runtime executable names cannot be blank',
      pattern: /runtime executable entries are invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].name = '   ';
      },
    },
    {
      label: 'runtime executable names cannot contain control characters',
      pattern: /runtime executable entries are invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].name = '\u0000';
      },
    },
    {
      label: 'runtime executable identities cannot conflict',
      pattern: /runtime executable names must be unique/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables.push({
          name: 'node', required: false, versionEvidence: 'none',
        });
      },
    },
    {
      label: 'runtime executable entries are closed records',
      pattern: /runtime executable entries are invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].invented = true;
      },
    },
    {
      label: 'runtime requirements are closed records',
      pattern: /runtimeRequirements must be an object/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.invented = true;
      },
    },
    {
      label: 'network requirements are closed records',
      pattern: /runtime network requirement is invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.invented = true;
      },
    },
    {
      label: 'credential requirements are closed records',
      pattern: /runtime credentials requirement is invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.credentials.invented = true;
      },
    },
    ...['', '   ', '\u0000', '\u2028'].map((purpose) => ({
      label: `network purpose ${JSON.stringify(purpose)} is not auditable`,
      pattern: /runtime network requirement is invalid/u,
      mutate(spec) {
        spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = purpose;
      },
    })),
    {
      label: 'network none requires none purpose',
      pattern: /network need is none iff purpose is none/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'review');
        workflow.runtimeRequirements = { executables: [], network: { need: 'none', purpose: 'remote lookup' }, credentials: { need: 'none', source: 'none' } };
      },
    },
    {
      label: 'network non-none requires non-none purpose',
      pattern: /network need is none iff purpose is none/u,
      mutate(spec) { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = 'none'; },
    },
    {
      label: 'credential none requires none source',
      pattern: /credential need is none iff source is none/u,
      mutate(spec) {
        const workflow = spec.workflows.find((entry) => entry.id === 'review');
        workflow.runtimeRequirements = { executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'assistant-owned-authentication' } };
      },
    },
    {
      label: 'credential non-none requires non-none source',
      pattern: /credential need is none iff source is none/u,
      mutate(spec) { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.credentials.source = 'none'; },
    },
  ];

  for (const scenario of cases) {
    const mutated = structuredClone(source);
    scenario.mutate(mutated);
    assert.throws(() => compileRuntimeContracts(mutated, behaviors), scenario.pattern, scenario.label);
  }

  const inventedBehaviorEffect = structuredClone(behaviors);
  inventedBehaviorEffect.behaviors.find((behavior) => behavior.id === 'review').effects = ['invented-effect'];
  assert.throws(() => compileRuntimeContracts(source, inventedBehaviorEffect), /unknown behavior effect invented-effect/u);
  const undeclaredBehaviorEffect = structuredClone(behaviors);
  undeclaredBehaviorEffect.behaviors.find((behavior) => behavior.id === 'review').effects = ['network'];
  assert.throws(() => compileRuntimeContracts(source, undeclaredBehaviorEffect), /behavior effect network is not declared by the workflow contract/u);
});

test('Contract v6 runtime instructions derive effect scope from declarations and authorization', () => {
  const source = read('workflow-specs/workflows.v6.json');
  const behaviors = read('workflow-specs/behaviors.v2.json');
  const baseline = compileRuntimeContracts(source, behaviors).find((contract) => contract.id === 'review');
  assert.match(baseline.instructions.at(-1), /workspace-read:preapproved/u);
  assert.ok(baseline.instructions.includes('Stay within the project or an explicitly approved artifact root.'));

  const externalPublish = structuredClone(source);
  externalPublish.permissionProfiles['explicit-publisher'] = structuredClone(externalPublish.permissionProfiles['read-only']);
  externalPublish.permissionProfiles['explicit-publisher'].permissionPolicy.externalPublish = 'explicit';
  const workflow = externalPublish.workflows.find((entry) => entry.id === 'review');
  workflow.permissionProfile = 'explicit-publisher';
  workflow.authorizationProfile = 'explicit-publisher';
  workflow.compatibilityProjection.permissionProfile = 'explicit-publisher';
  workflow.effects.push('external-publish');
  workflow.enforcementRequirements.push('enforce:external-publish');

  const compiled = compileRuntimeContracts(externalPublish, behaviors).find((contract) => contract.id === 'review');
  assert.match(compiled.instructions.at(-1), /external-publish:explicit/u);
  assert.doesNotMatch(compiled.instructions.join('\n'), /Do not publish externally/u);

  const userScopeMutation = structuredClone(source);
  userScopeMutation.permissionProfiles['explicit-user-scope'] = structuredClone(userScopeMutation.permissionProfiles['read-only']);
  userScopeMutation.permissionProfiles['explicit-user-scope'].permissionPolicy.userScopeMutation = 'explicit';
  const userScopeWorkflow = userScopeMutation.workflows.find((entry) => entry.id === 'review');
  userScopeWorkflow.permissionProfile = 'explicit-user-scope';
  userScopeWorkflow.authorizationProfile = 'explicit-user-scope';
  userScopeWorkflow.compatibilityProjection.permissionProfile = 'explicit-user-scope';
  userScopeWorkflow.effects.push('user-scope-mutation');
  userScopeWorkflow.enforcementRequirements.push('enforce:user-scope-mutation');

  const userScopeContract = compileRuntimeContracts(userScopeMutation, behaviors).find((contract) => contract.id === 'review');
  assert.match(userScopeContract.instructions.join('\n'), /Mutate only the declared user-scope target that is explicitly approved/u);
  assert.match(userScopeContract.instructions.at(-1), /user-scope-mutation:explicit/u);
  assert.doesNotMatch(userScopeContract.instructions.join('\n'), /Stay within the project or an explicitly approved artifact root/u);

  const undeclaredUserScope = structuredClone(source);
  undeclaredUserScope.permissionProfiles['explicit-user-scope'] = structuredClone(undeclaredUserScope.permissionProfiles['read-only']);
  undeclaredUserScope.permissionProfiles['explicit-user-scope'].permissionPolicy.userScopeMutation = 'explicit';
  const undeclaredWorkflow = undeclaredUserScope.workflows.find((entry) => entry.id === 'review');
  undeclaredWorkflow.permissionProfile = 'explicit-user-scope';
  undeclaredWorkflow.authorizationProfile = 'explicit-user-scope';
  undeclaredWorkflow.compatibilityProjection.permissionProfile = 'explicit-user-scope';
  assert.throws(
    () => compileRuntimeContracts(undeclaredUserScope, behaviors),
    /authorized capability userScopeMutation:explicit is not declared by workflow effects/u,
  );

  const deniedUserScope = structuredClone(source);
  const deniedWorkflow = deniedUserScope.workflows.find((entry) => entry.id === 'review');
  deniedWorkflow.effects.push('user-scope-mutation');
  deniedWorkflow.enforcementRequirements.push('enforce:user-scope-mutation');
  assert.throws(
    () => compileRuntimeContracts(deniedUserScope, behaviors),
    /effect user-scope-mutation requires unavailable authorization userScopeMutation:denied/u,
  );
});

test('Contract v6 schemas reject inferred approval arbitrary predicates and output effects', () => {
  const v6 = migrateWorkflowSpec(read('workflow-specs/workflows.json'), read('workflow-specs/behaviors.json'));
  const workflowSchema = read('schemas/workflow-spec.schema.json');
  assert.equal(
    workflowSchema.properties.workflows.items.properties.runtimeRequirements.properties.executables.items.properties.name.pattern,
    RUNTIME_EXECUTABLE_NAME_PATTERN_SOURCE,
  );
  assert.equal(
    workflowSchema.properties.workflows.items.properties.runtimeRequirements.properties.network.properties.purpose.pattern,
    RUNTIME_NETWORK_PURPOSE_PATTERN_SOURCE,
  );
  const approval = v6.workflows.flatMap((workflow) => workflow.inputs).find((input) => input.type === 'approval');
  assert.ok(approval);
  approval.approvalPolicy.mayInfer = true;
  assert.notDeepEqual(validateStandardSchema(workflowSchema, v6), []);

  const invalidEnforcement = structuredClone(v6);
  invalidEnforcement.workflows[0].enforcementRequirements = ['invented-enforcement'];
  assert.notDeepEqual(validateStandardSchema(workflowSchema, invalidEnforcement), []);
  const invalidEvidence = structuredClone(v6);
  invalidEvidence.workflows[0].evidenceRequirements = ['invented-evidence'];
  assert.notDeepEqual(validateStandardSchema(workflowSchema, invalidEvidence), []);
  const incompleteProfile = structuredClone(v6);
  delete incompleteProfile.permissionProfiles['read-only'].permissionPolicy.externalPublish;
  assert.notDeepEqual(validateStandardSchema(workflowSchema, incompleteProfile), []);
  const emptyEffects = structuredClone(v6);
  emptyEffects.workflows[0].effects = [];
  emptyEffects.workflows[0].enforcementRequirements = [];
  assert.notDeepEqual(validateStandardSchema(workflowSchema, emptyEffects), []);

  const runtimeRequirementMutations = [
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].name = ''; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].name = '   '; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.executables[0].name = '\u0000'; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = ''; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = '   '; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = '\u0000'; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = '\u2028'; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'review').runtimeRequirements = { executables: [], network: { need: 'none', purpose: 'remote lookup' }, credentials: { need: 'none', source: 'none' } }; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.network.purpose = 'none'; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'review').runtimeRequirements = { executables: [], network: { need: 'none', purpose: 'none' }, credentials: { need: 'none', source: 'assistant-owned-authentication' } }; },
    (spec) => { spec.workflows.find((entry) => entry.id === 'codex-review-only').runtimeRequirements.credentials.source = 'none'; },
  ];
  for (const mutate of runtimeRequirementMutations) {
    const invalidRuntimeRequirements = structuredClone(v6);
    mutate(invalidRuntimeRequirements);
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalidRuntimeRequirements), []);
  }

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
  const inventedBehaviorEffect = migrateBehaviorSpec(read('workflow-specs/behaviors.json'));
  inventedBehaviorEffect.behaviors[0].effects = ['invented-effect'];
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, inventedBehaviorEffect), []);
  const defaultedApproval = migrateBehaviorSpec(read('workflow-specs/behaviors.json'));
  defaultedApproval.behaviors
    .find((behavior) => behavior.id === 'implement-plan')
    .inputs.find((input) => input.type === 'approval').default = true;
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, defaultedApproval), []);
});

test('contract protocol major versions are locked to the source schema in coherence and schema validation', () => {
  const workflowSchema = read('schemas/workflow-spec.schema.json');
  const v6 = read('workflow-specs/workflows.v6.json');
  const behaviorV2 = read('workflow-specs/behaviors.v2.json');
  for (const [field, wrongVersion, expectedMajor] of [
    ['workflow', '5.9.9', 6],
    ['runtime', '3.9.9', 4],
    ['adapter', '2.9.9', 3],
    ['framework', '4.9.9', 5],
    ['compatibilityProjection', '4.9.9', 5],
  ]) {
    const invalid = structuredClone(v6);
    invalid.contractVersions[field] = wrongVersion;
    assert.match(validateContractCoherence(invalid, behaviorV2).join('\n'), new RegExp(`contractVersions\\.${field} major ${expectedMajor}`));
    assert.throws(() => compileRuntimeContracts(invalid, behaviorV2), new RegExp(`contractVersions\\.${field} major ${expectedMajor}`));
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), []);
  }

  const v5 = read('workflow-specs/workflows.json');
  const behaviorV1 = read('workflow-specs/behaviors.json');
  for (const [field, wrongVersion, expectedMajor] of [
    ['workflow', '6.0.0', 5],
    ['runtime', '4.0.0', 3],
    ['adapter', '3.0.0', 2],
  ]) {
    const invalid = structuredClone(v5);
    invalid.contractVersions[field] = wrongVersion;
    assert.match(validateContractCoherence(invalid, behaviorV1).join('\n'), new RegExp(`contractVersions\\.${field} major ${expectedMajor}`));
    assert.throws(() => compileRuntimeContracts(invalid, behaviorV1), new RegExp(`contractVersions\\.${field} major ${expectedMajor}`));
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), []);
  }

  for (const malformed of ['5.not-semver', '05.0.0', '5.0', '5.0.0-01']) {
    const invalid = structuredClone(v5);
    invalid.contractVersions.workflow = malformed;
    assert.match(validateContractCoherence(invalid, behaviorV1).join('\n'), /contractVersions\.workflow major 5/u);
    assert.throws(() => migrateWorkflowSpec(invalid, behaviorV1), /contractVersions\.workflow major 5/u);
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), []);
  }
  const validPrerelease = structuredClone(v5);
  validPrerelease.contractVersions.workflow = '5.1.0-rc.1+build.7';
  assert.deepEqual(validateContractCoherence(validPrerelease, behaviorV1), []);
});

test('contract paths are portable at schema coherence and compiler boundaries', () => {
  const workflowSchema = read('schemas/workflow-spec.schema.json');
  const v5 = read('workflow-specs/workflows.json');
  const behaviorV1 = read('workflow-specs/behaviors.json');
  assert.equal(assertPortableRelativePath('contracts/review.md'), 'contracts/review.md');
  assert.equal(assertPortableWorkflowContractPath('contracts/review.md'), 'contracts/review.md');
  assert.equal(workflowSchema.$defs.workflowContractPath.pattern, WORKFLOW_CONTRACT_PATH_PATTERN_SOURCE);

  for (const contractPath of ['../outside.md', '/absolute.md', 'contracts\\review.md', 'CON/review.md', 'contracts/review.', 'contracts//review.md']) {
    const invalid = structuredClone(v5);
    invalid.workflows[0].contractPath = contractPath;
    assert.match(validateContractCoherence(invalid, behaviorV1).join('\n'), /contractPath/u, contractPath);
    assert.throws(() => compileRuntimeContracts(invalid, behaviorV1), /contractPath/u, contractPath);
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), [], contractPath);
    assert.throws(() => assertPortableRelativePath(contractPath), /portable|traversal|reserved|empty/u, contractPath);
    assert.throws(() => assertPortableWorkflowContractPath(contractPath), /ASCII portable workflow contract path/u, contractPath);
  }

  for (const contractPath of ['.hidden/review.md', 'contracts/review+extra.md', 'contracts/@review.md', '契约/review.md']) {
    assert.equal(assertPortableRelativePath(contractPath), contractPath, contractPath);
    assert.throws(() => assertPortableWorkflowContractPath(contractPath), /ASCII portable workflow contract path/u, contractPath);
    const invalid = structuredClone(v5);
    invalid.workflows[0].contractPath = contractPath;
    assert.match(validateContractCoherence(invalid, behaviorV1).join('\n'), /contractPath/u, contractPath);
    assert.throws(() => compileRuntimeContracts(invalid, behaviorV1), /contractPath/u, contractPath);
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), [], contractPath);
  }
});

test('historical schemas reject fields owned by Contract v6 and behavior v2', () => {
  const workflowSchema = read('schemas/workflow-spec.schema.json');
  const behaviorSchema = read('schemas/workflow-behaviors.schema.json');
  const v5 = read('workflow-specs/workflows.json');
  const v1 = read('workflow-specs/behaviors.json');
  const v6 = migrateWorkflowSpec(v5, v1);
  assert.deepEqual(validateStandardSchema(workflowSchema, v5), []);
  assert.deepEqual(validateStandardSchema(behaviorSchema, v1), []);

  for (const [field, value] of [
    ['framework', '5.0.0'],
    ['compatibilityProjection', '5.0.0'],
  ]) {
    const invalid = structuredClone(v5);
    invalid.contractVersions[field] = value;
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), [], `v5 accepted v6-only contractVersions.${field}`);
  }

  const v6Workflow = v6.workflows.find((workflow) => workflow.id === v5.workflows[0].id);
  for (const field of [
    'inputs',
    'effects',
    'authorizationProfile',
    'enforcementRequirements',
    'evidenceRequirements',
    'compatibilityProjection',
  ]) {
    const invalid = structuredClone(v5);
    invalid.workflows[0][field] = structuredClone(v6Workflow[field]);
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), [], `v5 accepted v6-only workflow field ${field}`);
  }

  const invalidV1 = structuredClone(v1);
  invalidV1.behaviors[0].effects = [];
  assert.notDeepEqual(validateStandardSchema(behaviorSchema, invalidV1), [], 'v1 accepted v2-only behavior effects');

  for (const [label, mutate] of [
    ['empty owner agent', (spec) => { spec.workflows[0].ownerAgents = ['']; }],
    ['file-like recommended pack', (spec) => { spec.workflows[0].recommendedPacks = ['.md']; }],
    ['empty required input', (spec) => { spec.workflows[0].requiredInputs = ['']; }],
    ['empty projected required input', (spec) => { spec.workflows[0].compatibilityProjection.requiredInputs = ['']; }],
  ]) {
    const invalid = structuredClone(v6);
    mutate(invalid);
    assert.notDeepEqual(validateStandardSchema(workflowSchema, invalid), [], `workflow schema accepted ${label}`);
  }
});

test('assistant manifest schema rejects incomplete alias gates and loose nested contracts', () => {
  const productSchema = read('schemas/workflow-product.schema.json');
  const product = read('workflow-specs/nova.product.json');
  const expectedAliasPolicy = {
    status: 'evidence-gated',
    removalRequires: [
      'real-benchmark-evidence',
      'native-permission-and-invocation-parity',
      'plugin-major-release',
      'governed-release-decision',
      'migration-documentation',
    ],
  };
  assert.deepEqual(product.compatibilityAliasPolicy, expectedAliasPolicy);
  const incompleteProductPolicy = structuredClone(product);
  incompleteProductPolicy.compatibilityAliasPolicy.removalRequires.pop();
  assert.notDeepEqual(validateStandardSchema(productSchema, incompleteProductPolicy), []);
  const productWithoutNativeParity = structuredClone(product);
  productWithoutNativeParity.compatibilityAliasPolicy.removalRequires = productWithoutNativeParity.compatibilityAliasPolicy.removalRequires
    .filter((gate) => gate !== 'native-permission-and-invocation-parity');
  assert.notDeepEqual(validateStandardSchema(productSchema, productWithoutNativeParity), []);
  for (const [label, field, value] of [
    ['empty agent identity', 'agents', ''],
    ['file-like pack identity', 'packs', '.md'],
    ['empty tool identity', 'tools', ''],
  ]) {
    const invalid = structuredClone(product);
    invalid[field].push(value);
    assert.notDeepEqual(validateStandardSchema(productSchema, invalid), [], `product schema accepted ${label}`);
  }

  const manifestSchema = read('schemas/assistant-manifest.schema.json');
  assert.equal(
    manifestSchema.$defs.runtimeRequirements.properties.executables.items.properties.name.pattern,
    RUNTIME_EXECUTABLE_NAME_PATTERN_SOURCE,
  );
  assert.equal(
    manifestSchema.$defs.runtimeRequirements.properties.network.properties.purpose.pattern,
    RUNTIME_NETWORK_PURPOSE_PATTERN_SOURCE,
  );
  assert.deepEqual(
    manifestSchema.$defs.runtimeRequirements,
    read('schemas/workflow-spec.schema.json').properties.workflows.items.properties.runtimeRequirements,
  );
  const manifest = read('adapters/generic-agent-skills/manifest.json');
  assert.deepEqual(manifest.aliasPolicy, expectedAliasPolicy);
  const claudeManifest = read('adapters/claude/manifest.json');
  assert.deepEqual(claudeManifest.commandEntrypoint.aliasRetirement, expectedAliasPolicy);
  const incompleteManifestPolicy = structuredClone(manifest);
  incompleteManifestPolicy.aliasPolicy.removalRequires.pop();
  assert.notDeepEqual(validateStandardSchema(manifestSchema, incompleteManifestPolicy), []);
  const manifestWithoutNativeParity = structuredClone(manifest);
  manifestWithoutNativeParity.aliasPolicy.removalRequires = manifestWithoutNativeParity.aliasPolicy.removalRequires
    .filter((gate) => gate !== 'native-permission-and-invocation-parity');
  assert.notDeepEqual(validateStandardSchema(manifestSchema, manifestWithoutNativeParity), []);

  const looseInput = structuredClone(manifest);
  looseInput.workflows[0].inputs[0].invented = true;
  assert.notDeepEqual(validateStandardSchema(manifestSchema, looseInput), []);

  const looseRuntime = structuredClone(manifest);
  looseRuntime.workflows[0].runtimeRequirements.network.invented = true;
  assert.notDeepEqual(validateStandardSchema(manifestSchema, looseRuntime), []);

  const executableWorkflowIndex = manifest.workflows.findIndex((workflow) => workflow.runtimeRequirements.executables.length > 0);
  assert.notEqual(executableWorkflowIndex, -1);
  for (const name of ['', '   ', '\u0000']) {
    const invalidExecutable = structuredClone(manifest);
    invalidExecutable.workflows[executableWorkflowIndex].runtimeRequirements.executables[0].name = name;
    assert.notDeepEqual(validateStandardSchema(manifestSchema, invalidExecutable), [], `assistant manifest schema accepted ${JSON.stringify(name)}`);
  }
  const networkWorkflowIndex = manifest.workflows.findIndex((workflow) => workflow.runtimeRequirements.network.need !== 'none');
  assert.notEqual(networkWorkflowIndex, -1);
  for (const purpose of ['', '   ', '\u0000', '\u2028']) {
    const invalidPurpose = structuredClone(manifest);
    invalidPurpose.workflows[networkWorkflowIndex].runtimeRequirements.network.purpose = purpose;
    assert.notDeepEqual(validateStandardSchema(manifestSchema, invalidPurpose), [], `assistant manifest schema accepted ${JSON.stringify(purpose)}`);
  }

  const looseEntrypoint = structuredClone(manifest);
  looseEntrypoint.workflows[0].commandEntrypoint.hostSpecificGate = 'must-live-in-adapter';
  assert.notDeepEqual(validateStandardSchema(manifestSchema, looseEntrypoint), []);
});

test('aggregate prompt load graph covers every workflow and budget regressions fail closed', () => {
  const report = buildPromptSurfaceReport();
  assert.equal(report.workflowCount, 21);
  assert.deepEqual(report.source, ['workflow-specs/workflows.v6.json', 'governance/complexity-budget.json#/promptSurface']);
  assert.ok(report.workflows.every((workflow) => workflow.graph.nodes.length === workflow.potentialReferenced.files));
  assert.ok(report.workflows.every((workflow) => workflow.potentialReferenced.files >= workflow.initialLoad.files));
  assert.ok(report.workflows.every((workflow) => Number.isFinite(workflow.potentialReferenced.duplicateRatio)));
  assert.deepEqual(validatePromptSurfaceBudgets(report), []);
  const oversized = structuredClone(report);
  oversized.workflows[0].initialLoad.tokens = oversized.budgets.maximumInitialLoadEstimatedTokens + 1;
  assert.match(validatePromptSurfaceBudgets(oversized)[0], /initial-load tokens/u);
});
