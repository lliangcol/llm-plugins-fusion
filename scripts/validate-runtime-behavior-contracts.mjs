#!/usr/bin/env node
/** Verify that every direct command loads both policy summary and authored behavior. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';
import { checkOrWrite as checkBehaviorSurfaces } from './generate-behavior-surfaces.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';
import { variantContractKey } from '../framework/core/variant-contracts.mjs';
import { compileResolvedVariantManifest } from '../framework/compiler/compile-runtime-contracts.mjs';

const root = repoRoot(import.meta.url);
const { spec, behaviorSpec } = loadNovaWorkflowModelV6(root);
const behaviors = new Map(behaviorSpec.behaviors.map((behavior) => [behavior.id, behavior]));
const resolutionManifest = JSON.parse(readFileSync(resolve(root, 'nova-plugin/runtime/resolved-variant-contracts.json'), 'utf8'));
const resolutions = new Map(resolutionManifest.resolutions.map((entry) => [variantContractKey(entry.canonicalSurfaceId, entry.variantParameters), entry]));

checkBehaviorSurfaces();

assert.equal(behaviors.size, spec.workflows.length, 'behavior IR count differs from workflow count');
assert.equal(resolutions.size, spec.workflows.length, 'resolved variant contract count differs from workflow count');
assert.deepEqual(resolutionManifest, compileResolvedVariantManifest(spec, behaviorSpec), 'resolved variant manifest differs from compiled source');

for (const workflow of spec.workflows) {
  const commandPath = resolve(root, 'nova-plugin/commands', `${workflow.id}.md`);
  const skillPath = resolve(root, 'nova-plugin', workflow.contractPath);
  const runtimePath = resolve(root, 'nova-plugin/runtime/contracts', `${workflow.id}.json`);
  const command = readFileSync(commandPath, 'utf8');
  const skill = readFileSync(skillPath, 'utf8');
  const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
  const behavior = behaviors.get(workflow.id);
  const runtimeReference = `\${CLAUDE_PLUGIN_ROOT}/runtime/contracts/${workflow.id}.json`;
  const resolutionReference = '\${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json';
  const skillReference = `\${CLAUDE_PLUGIN_ROOT}/${workflow.contractPath}`;

  assert.ok(behavior, `${workflow.id}: behavior IR missing`);
  assert.equal(runtime.schemaVersion, 4, `${workflow.id}: runtime contract schema must be v4`);
  assert.equal(runtime.id, workflow.id, `${workflow.id}: runtime id drift`);
  assert.deepEqual(runtime.requiredInputs, workflow.compatibilityProjection.requiredInputs, `${workflow.id}: required input drift`);
  assert.equal(runtime.outputContract, workflow.outputContract, `${workflow.id}: output contract drift`);
  const profile = spec.permissionProfiles[workflow.authorizationProfile];
  assert.deepEqual(runtime.allowedTools, profile.allowedTools, `${workflow.id}: allowedTools drift`);
  assert.deepEqual(runtime.disallowedTools, profile.disallowedTools, `${workflow.id}: disallowedTools drift`);
  assert.equal(runtime.modelInvocable, workflow.modelInvocable, `${workflow.id}: modelInvocable drift`);
  assert.equal(runtime.subagentSafe, workflow.subagentSafe, `${workflow.id}: subagentSafe drift`);
  assert.equal(runtime.destructiveActions, workflow.risk, `${workflow.id}: destructiveActions drift`);
  assert.equal(runtime.commandEntrypoint?.directCommandId, workflow.id, `${workflow.id}: direct command id drift`);
  assert.deepEqual(Object.keys(runtime.commandEntrypoint), ['directCommandId'], `${workflow.id}: runtime entrypoint must remain product-neutral`);
  const behaviorRequired = behavior.inputs.filter((input) => input.required).map((input) => input.name);
  assert.deepEqual(behaviorRequired, workflow.compatibilityProjection.requiredInputs, `${workflow.id}: behavior required input drift`);
  const inputNames = behavior.inputs.flatMap((input) => [input.name, ...input.aliases]);
  assert.equal(new Set(inputNames).size, inputNames.length, `${workflow.id}: canonical inputs and aliases must be unique`);
  const outputFieldNames = behavior.output.fields.map((field) => field.name);
  assert.equal(behavior.output.order.every((field) => outputFieldNames.includes(field)), true, `${workflow.id}: output order references unknown field`);
  assert.deepEqual(behavior.failureOutput.order, behavior.failureOutput.fields, `${workflow.id}: failure fields and order must be exact`);
  assert.equal(runtime.behaviorContract?.source, 'workflow-specs/behaviors.v2.json', `${workflow.id}: behavior source drift`);
  assert.equal(runtime.behaviorContract?.guidanceReference, `../../${workflow.contractPath}`, `${workflow.id}: guidance reference drift`);
  assert.equal(runtime.behaviorContract?.conflictPolicy, 'fail-closed', `${workflow.id}: conflict policy must fail closed`);
  const { schemaVersion, source, guidanceReference, conflictPolicy, ...compiledBehavior } = runtime.behaviorContract;
  assert.equal(schemaVersion, behaviorSpec.schemaVersion, `${workflow.id}: behavior schema version drift`);
  assert.equal(source, 'workflow-specs/behaviors.v2.json', `${workflow.id}: behavior source missing`);
  assert.equal(guidanceReference, `../../${workflow.contractPath}`, `${workflow.id}: guidance path drift`);
  assert.equal(conflictPolicy, 'fail-closed', `${workflow.id}: behavior conflict policy drift`);
  assert.deepEqual(compiledBehavior, Object.fromEntries(Object.entries(behavior).filter(([key]) => key !== 'id')), `${workflow.id}: compiled behavior differs from IR`);
  const resolution = resolutions.get(variantContractKey(workflow.canonicalSurfaceId, workflow.variantPreset));
  assert.ok(resolution, `${workflow.id}: resolved variant mapping missing`);
  assert.equal(resolution.resolvedWorkflowId, workflow.id, `${workflow.id}: resolved variant target drift`);
  assert.equal(resolution.runtimeContract, `contracts/${workflow.id}.json`, `${workflow.id}: resolved runtime path drift`);
  assert.equal(command.includes(runtimeReference), true, `${workflow.id}: command does not load runtime summary`);
  assert.equal(command.includes(resolutionReference), true, `${workflow.id}: command does not load resolved variant index`);
  assert.equal(command.includes(skillReference), true, `${workflow.id}: command does not load authored behavior`);
  assert.match(command, /complete resolved runtime contract is authoritative/iu, `${workflow.id}: resolved contract authority is unclear`);
  assert.match(command, /no field falls back to canonical Skill prose/iu, `${workflow.id}: canonical prose precedence is unclear`);
  assert.match(command, /extract only the selector keys declared/iu, `${workflow.id}: selector extraction boundary is unclear`);
  assert.match(command, /non-exact combination that triggers any alias specialization is conflicting and must stop/iu, `${workflow.id}: conflicting specialization stop is unclear`);
  assert.match(command, /fail closed/iu, `${workflow.id}: conflict handling is not fail closed`);
  assert.match(skill, /## Workflow Contract/iu, `${workflow.id}: authored behavior has no workflow contract`);
  assert.match(skill, /BEGIN GENERATED BEHAVIOR CONTRACT/u, `${workflow.id}: generated behavior surface missing`);
  assert.match(skill, /This block is authoritative/iu, `${workflow.id}: behavior authority missing`);
  if (!workflow.compatibilityAlias) {
    assert.equal(skill.includes(`must \`resolvedWorkflowId\` equal \`${workflow.id}\``), true, `${workflow.id}: Claude Skill entrypoint identity gate missing`);
    assert.match(skill, /matching command wrapper may continue[\s\S]*must not re-resolve or reject that validated wrapper/iu, `${workflow.id}: alias wrapper must survive canonical Skill loading`);
    assert.match(skill, /Otherwise STOP before tools or side effects and invoke the exact direct command/iu, `${workflow.id}: Claude Skill mismatch stop missing`);
    assert.match(skill, /Generic and Codex adapters may execute the resolved contract directly/iu, `${workflow.id}: non-Claude Skill execution boundary missing`);
  }

  if (!workflow.compatibilityAlias) {
    const authored = skill.replace(/<!-- BEGIN GENERATED BEHAVIOR CONTRACT -->[\s\S]*?<!-- END GENERATED BEHAVIOR CONTRACT -->/u, '');
    for (const input of behavior.inputs) {
      assert.equal(authored.includes(`\`${input.name}\``), true, `${workflow.id}: authored guidance omits canonical input ${input.name}`);
    }
    if (workflow.id === 'explore') {
      assert.match(authored, /DEPTH=deep[\s\S]*artifact/iu, 'explore: authored guidance omits deep artifact behavior');
      assert.doesNotMatch(authored, /observer`?\s*->\s*`?nova-explore-lite/iu, 'explore: default observer must not resolve to lite');
      for (const row of [
        '| Standard observer | `{}` | `INPUT` |',
        '| Lite observer | `{"PERSPECTIVE":"observer","DEPTH":"lite"}` | `INPUT` |',
        '| Reviewer | `{"PERSPECTIVE":"reviewer"}` | `INPUT` |',
        '| Deep exploration | `{"DEPTH":"deep"}` | `INTENT`, `CONTEXT` |',
      ]) assert.equal(authored.includes(row), true, `explore: resolved input matrix omits ${row}`);
      assert.doesNotMatch(authored, /non-exact combination that triggers more than one specialization/iu, 'explore: authored prose duplicates generalized conflict policy');
    }
    if (workflow.id === 'produce-plan') {
      assert.match(authored, /PLAN_PROFILE=lite[\s\S]*chat-only/iu, 'produce-plan: authored guidance omits lite chat-only behavior');
    }
    if (workflow.id === 'review') {
      assert.match(authored, /Canonical read-only Skill frontmatter does[\s\S]*not authorize that external runtime/iu, 'review: external runtime boundary is unclear');
      for (const row of [
        '| General review | `{}` | `REVIEW_SCOPE` |',
        '| Plan review | `{"REVIEW_PROFILE":"plan"}` | `PLAN_INPUT_PATH` |',
        '| Codex review-only | `{"REVIEW_PROFILE":"codex-review-only"}` | `REVIEW_SCOPE` |',
        '| Codex verify-only | `{"REVIEW_PROFILE":"codex-verify-only"}` | `REVIEW_FILE` |',
      ]) assert.equal(authored.includes(row), true, `review: resolved input matrix omits ${row}`);
    }
    if (workflow.id === 'implement-plan') {
      for (const row of [
        '| Approved-plan default | `{}` | `PLAN_INPUT_PATH`, `PLAN_APPROVED` |',
        '| Lightweight implementation | `{"EXECUTION_PROFILE":"lite"}` | `REQUEST` |',
        '| Standard implementation | `{"EXECUTION_PROFILE":"standard"}` | `REQUEST` |',
        '| Codex review/fix loop | `{"EXECUTION_PROFILE":"codex-review-fix"}` | `REVIEW_SCOPE` |',
      ]) assert.equal(authored.includes(row), true, `implement-plan: resolved input matrix omits ${row}`);
    }
    if (workflow.id === 'finalize-work') {
      assert.doesNotMatch(authored, /WORK_SCOPE`?\s*\(implicit\)/iu, 'finalize-work: required work summary must not be implicit');
    }
    if (workflow.id === 'route') {
      assert.doesNotMatch(authored, /compatibility commands are still valid routes/iu, 'route: compatibility aliases must not be automatic route identities');
      assert.match(authored, /Automatic routing selects only one of the six canonical workflow targets/iu, 'route: canonical automatic route boundary is unclear');
      assert.match(authored, /Command entrypoint:/u, 'route: exact command entrypoint field missing');
      assert.doesNotMatch(authored, /Command alias \(optional\)/u, 'route: command alias must not be described as optional');
      assert.match(authored, /exactly one immediate next step/iu, 'route: exactly-one immediate route boundary missing');
      assert.doesNotMatch(authored, /shortest safe sequence|Canonical skill:[^\n]*->|Command entrypoint:[^\n]*->/iu, 'route: multi-route sequence remains in authored guidance');
      assert.equal(behavior.workflowSteps.find((step) => step.id === 'select')?.action, 'Select exactly one immediate next canonical route and its matching command entrypoint.', 'route: select step must require exactly one immediate route');
      assert.equal(behavior.invariants.some((entry) => /Emit exactly one immediate next canonical route/u.test(entry)), true, 'route: exactly-one invariant missing');
    }
  }
}

console.log(`OK behavior-complete direct command contracts (${spec.workflows.length}/${spec.workflows.length})`);
