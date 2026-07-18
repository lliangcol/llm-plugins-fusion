#!/usr/bin/env node
/** Generate cross-assistant adapter inventories from the canonical workflow spec. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';
import { compileResolvedVariantManifest } from '../framework/compiler/compile-runtime-contracts.mjs';
import { resolveVariantWorkflow } from '../framework/core/variant-contracts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = 'workflow-specs/workflows.v6.json';

function loadSpec() {
  return loadNovaWorkflowModelV6(root);
}

function genericManifest(model) {
  const { spec, product, adapterById, behaviorSpec } = model;
  const adapter = adapterById.generic;
  const aliasPolicy = product.compatibilityAliasPolicy;
  if (!aliasPolicy) throw new Error('product compatibilityAliasPolicy missing');
  return {
    $schema: '../../schemas/assistant-manifest.schema.json',
    schemaVersion: 3,
    source: 'workflow-specs/adapters/generic.json',
    product: {
      namespace: product.pluginNamespace,
      expectedWorkflowCount: product.expectedWorkflowCount,
      canonicalEntrypoints: product.primaryEntrypoints,
      automaticRouting: product.automaticRouting,
      agents: product.agents,
      packs: product.packs,
    },
    aliasPolicy,
    maximumSupportedLevel: adapter.maximumSupportedLevel,
    declaredLevel: adapter.declaredLevel,
    evidenceRequiredFor: adapter.evidenceRequiredFor,
    protocolVersions: adapter.protocolVersions,
    contractEnforcement: adapter.contractEnforcement,
    claimBoundary: 'Invocation and enforcement require an assistant-specific adapter and conformance evidence.',
    resolvedVariants: compileResolvedVariantManifest(spec, behaviorSpec).resolutions.map((entry) => ({
      ...entry,
      runtimeContract: `../../nova-plugin/runtime/${entry.runtimeContract}`,
    })),
    workflows: spec.workflows.map((workflow) => {
      const canonicalSkill = `nova-${workflow.canonicalSurfaceId}`;
      const profile = spec.permissionProfiles[workflow.authorizationProfile];
      return {
        id: workflow.id,
        canonicalSurfaceId: workflow.canonicalSurfaceId,
        canonicalSkill,
        variantPreset: workflow.variantPreset,
        compatibilityAlias: workflow.compatibilityAlias,
        replacement: workflow.compatibilityAlias ? canonicalSkill : null,
        contract: `../../nova-plugin/${workflow.contractPath}`,
        runtimeContract: `../../nova-plugin/runtime/contracts/${workflow.id}.json`,
        stage: workflow.stage,
        risk: workflow.risk,
        ownerAgents: workflow.ownerAgents,
        recommendedPacks: workflow.recommendedPacks,
        requiredInputs: workflow.compatibilityProjection.requiredInputs,
        inputs: workflow.inputs,
        effects: workflow.effects,
        authorizationProfile: workflow.authorizationProfile,
        enforcementRequirements: workflow.enforcementRequirements,
        evidenceRequirements: workflow.evidenceRequirements,
        outputContract: workflow.outputContract,
        allowedTools: profile.allowedTools,
        disallowedTools: profile.disallowedTools,
        modelInvocable: workflow.modelInvocable,
        subagentSafe: workflow.subagentSafe,
        destructiveActions: workflow.risk,
        commandEntrypoint: {
          directCommandId: workflow.id,
        },
        runtimeRequirements: workflow.runtimeRequirements ?? {
          executables: [],
          network: { need: 'none', purpose: 'none' },
          credentials: { need: 'none', source: 'none' },
        },
        permissionPolicy: spec.permissionProfiles[workflow.authorizationProfile].permissionPolicy,
        enforcement: spec.assistantEnforcement,
      };
    }),
  };
}

function codexAgents(model) {
  const { spec, adapterById, behaviorSpec } = model;
  const adapter = adapterById.codex;
  const rows = spec.workflows.map((workflow) => `| ${workflow.id} | nova-${workflow.canonicalSurfaceId} | ${workflow.stage} | ${workflow.ownerAgents.join(', ')} | ${workflow.recommendedPacks.join(', ') || 'None'} | ${workflow.risk} | ${workflow.compatibilityProjection.requiredInputs.join(', ') || 'None'} | ${workflow.outputContract} |`).join('\n');
  const routeBehavior = behaviorSpec.behaviors.find((behavior) => behavior.id === 'route');
  if (!routeBehavior) throw new Error('route behavior IR missing');
  const routeRows = routeBehavior.decisionTable.map((entry) => {
    const resolved = resolveVariantWorkflow(spec.workflows, behaviorSpec, entry.route, entry.variantParameters);
    return `| \`${JSON.stringify(entry.when)}\` | ${entry.route} | \`${JSON.stringify(entry.variantParameters)}\` | ${resolved.workflow.id} | ${entry.action} |`;
  }).join('\n');
  return `# Generated Codex Workflow Adapter

Status: generated from \`${sourcePath}\` and \`workflow-specs/adapters/${adapter.id}.json\`. Do not edit this file by hand.

Protocol: workflow \`${adapter.protocolVersions.workflow}\`, runtime \`${adapter.protocolVersions.runtime}\`, adapter \`${adapter.protocolVersions.adapter}\`. Enforcement: inputs \`${adapter.contractEnforcement.inputs}\`, approval \`${adapter.contractEnforcement.approval}\`, output \`${adapter.contractEnforcement.output}\`, effects \`${adapter.contractEnforcement.effects}\`; fallback \`${adapter.contractEnforcement.fallback}\`.

Codex should treat the referenced \`nova-plugin/skills/nova-*/SKILL.md\` files as behavioral contracts, not as Claude slash-command runtime instructions. Parse the request, select one workflow, enforce the capability boundary in \`adapters/generic-agent-skills/manifest.json\`, then load only that workflow contract. Never claim Claude hooks or permissions are active in Codex.

For write-capable workflows, require explicit approval and remain inside the user-provided workspace. Runtime requirements describe what execution needs; permission policy separately describes what may be preapproved, prompted, explicitly authorized, denied, or unsupported. Never interpret a prompted network or credential requirement as implicit authorization. User-scope mutation, external publish, and Git history mutation remain denied unless a consumer repository separately authorizes them.

When routing, prefer the first exact specialized condition below over a broader hub. Select only a canonical workflow from the product automatic-routing inventory and express specialization through structured variant parameters. Extract only selectors declared in \`nova-plugin/runtime/resolved-variant-contracts.json\`, validate their values, and fill declared selector defaults. Use an exact normalized override when present. A non-exact combination that triggers any alias specialization is conflicting and must stop; only a valid combination that triggers no alias specialization may use the canonical fallback. The complete resolved runtime contract, including an alias contract when selected, is authoritative and no field falls back to canonical prose. Codex and generic adapters may execute that resolved contract directly under their adapter enforcement; the Claude static-frontmatter direct-command gate does not apply. Return the complete ordered set of required inputs exactly as UPPER_SNAKE_CASE even when values are present, inferred, or resolved; never return only unresolved inputs or substitute the canonical route workflow's inputs.

| Routing condition | Canonical workflow | Variant parameters | Resolved contract | Action |
| --- | --- | --- | --- | --- |
${routeRows}

| Workflow | Canonical skill | Stage | Owner agents | Recommended packs | Risk | Required inputs | Output contract |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`;
}

function claudeManifest(model) {
  const { spec, product, adapterById } = model;
  const adapter = adapterById.claude;
  const aliasPolicy = product.compatibilityAliasPolicy;
  if (!aliasPolicy) throw new Error('product compatibilityAliasPolicy missing');
  return {
    schemaVersion: 2,
    source: 'workflow-specs/adapters/claude.json',
    maximumSupportedLevel: adapter.maximumSupportedLevel,
    declaredLevel: adapter.declaredLevel,
    evidenceRequiredFor: adapter.evidenceRequiredFor,
    protocolVersions: adapter.protocolVersions,
    contractEnforcement: adapter.contractEnforcement,
    automaticRouting: product.automaticRouting,
    resolvedVariantContract: '../../nova-plugin/runtime/resolved-variant-contracts.json',
    commandEntrypoint: {
      executionGate: 'resolved-workflow-id-must-equal-invoked-command-id',
      mismatchAction: 'stop-and-invoke-exact-direct-command',
      directCommandTemplate: `/${product.pluginNamespace}:<directCommandId>`,
      aliasRetirement: aliasPolicy,
    },
    verificationEntrypoints: [
      '../../scripts/validate-plugin-install.mjs',
      '../../scripts/validate-plugin-route-live.mjs',
      '../../.github/workflows/release.yml',
    ],
    commands: spec.workflows.map((workflow) => `/${product.pluginNamespace}:${workflow.id}`),
    canonicalSkills: spec.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => `/${product.pluginNamespace}:nova-${workflow.id}`),
    compatibilityCommandAliases: spec.workflows.filter((workflow) => workflow.compatibilityAlias).map((workflow) => `/${product.pluginNamespace}:${workflow.id}`),
  };
}

export function generatedFiles() {
  const model = loadSpec();
  return [
    { path: 'adapters/generic-agent-skills/manifest.json', content: `${JSON.stringify(genericManifest(model), null, 2)}\n` },
    { path: 'adapters/codex/AGENTS.md', content: codexAgents(model) },
    { path: 'adapters/claude/manifest.json', content: `${JSON.stringify(claudeManifest(model), null, 2)}\n` },
  ];
}

export function checkOrWrite({ write = false } = {}) {
  const stale = [];
  for (const file of generatedFiles()) {
    const path = resolve(root, file.path);
    if (write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content, 'utf8');
    } else if (!existsSync(path) || readFileSync(path, 'utf8') !== file.content) stale.push(file.path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} stale; run node scripts/generate-adapters.mjs --write`);
  return generatedFiles().length;
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) return 1;
  try {
    const count = checkOrWrite({ write: args.includes('--write') });
    console.log(`OK assistant adapters (${count} generated files)`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
