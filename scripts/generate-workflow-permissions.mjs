#!/usr/bin/env node
/** Generate native Claude frontmatter and effective permission reports. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const sourcePath = 'workflow-specs/workflows.v6.json';
const runtimePath = 'nova-plugin/runtime/workflow-permissions.json';
const routeContractPath = 'nova-plugin/runtime/route-output-contract.json';
const generatedJson = 'docs/generated/effective-permissions.json';
const generatedMarkdown = 'docs/generated/effective-permissions.md';
const workflowCatalogJson = 'docs/generated/workflow-catalog.json';
const workflowCatalogMarkdown = 'docs/generated/workflow-catalog.md';
const managedFields = new Set([
  'description',
  'allowed-tools',
  'destructive-actions',
  'disallowed-tools',
  'user-invocable',
  'disable-model-invocation',
  'compatibility',
  'metadata',
  'invokes',
]);

function usage() {
  return 'Usage: node scripts/generate-workflow-permissions.mjs [--write]';
}

function loadSpec(root) {
  return loadNovaWorkflowModelV6(root).spec;
}

function loadProduct(root) {
  return loadNovaWorkflowModelV6(root).product;
}

function emptyRequirements() {
  return {
    executables: [],
    network: { need: 'none', purpose: 'none' },
    credentials: { need: 'none', source: 'none' },
  };
}

export function legacyCapabilities(permissionPolicy) {
  return Object.fromEntries(Object.entries(permissionPolicy).map(([name, state]) => {
    if (name === 'shell') return [name, state === 'preapproved' ? 'allowed' : state];
    return [name, state === 'preapproved'];
  }));
}

export function buildRuntimePermissionSpec(spec, product) {
  const knownGoodClaudeCli = product?.runtimeCompatibility?.['claude-code'];
  if (typeof knownGoodClaudeCli !== 'string' || !knownGoodClaudeCli) {
    throw new Error('Nova product runtimeCompatibility must declare claude-code');
  }
  const commandIds = spec.workflows.map((workflow) => workflow.id).sort();
  const canonicalSkillIds = spec.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => workflow.canonicalSurfaceId).sort();
  return {
    $schema: '../../schemas/workflow-permissions.schema.json',
    schemaVersion: 2,
    pluginNamespace: spec.pluginNamespace,
    knownGoodClaudeCli,
    primaryEntrypoints: spec.primaryEntrypoints,
    toolVocabulary: spec.toolVocabulary,
    expectedInventory: {
      combinedSkillCount: commandIds.length + canonicalSkillIds.length,
      commandIds,
      skillNames: canonicalSkillIds.map((id) => `nova-${id}`),
    },
    workflows: spec.workflows.map((workflow) => {
      const authorizationProfile = workflow.authorizationProfile ?? workflow.permissionProfile;
      const profile = spec.permissionProfiles[authorizationProfile];
      if (!profile) throw new Error(`unknown permission profile ${authorizationProfile} for ${workflow.id}`);
      return {
        id: workflow.id,
        canonicalSurfaceId: workflow.canonicalSurfaceId,
        variantPreset: workflow.variantPreset,
        compatibilityAlias: workflow.compatibilityAlias,
        destructiveActions: workflow.risk,
        modelInvocable: workflow.modelInvocable,
        subagentSafe: workflow.subagentSafe,
        allowedTools: profile.allowedTools,
        disallowedTools: profile.disallowedTools,
        runtimeRequirements: workflow.runtimeRequirements ?? emptyRequirements(),
        permissionPolicy: profile.permissionPolicy,
        enforcement: spec.assistantEnforcement,
        legacyCapabilities: legacyCapabilities(profile.permissionPolicy),
        ...(workflow.compatibility ? { compatibility: workflow.compatibility } : {}),
      };
    }),
  };
}

function splitFrontmatter(source, relPath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) throw new Error(`${relPath} missing frontmatter`);
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function removeManagedFields(frontmatter, kind) {
  const lines = frontmatter.split(/\r?\n/);
  const kept = [];
  for (let index = 0; index < lines.length;) {
    const match = /^([A-Za-z][\w-]*)\s*:/.exec(lines[index]);
    if (!match || !managedFields.has(match[1]) || (kind === 'skill' && match[1] === 'description')) {
      kept.push(lines[index]);
      index += 1;
      continue;
    }
    index += 1;
    while (index < lines.length && (/^\s/.test(lines[index]) || lines[index] === '')) index += 1;
  }
  return kept;
}

function insertAfter(lines, field, additions) {
  const index = lines.findIndex((line) => line.startsWith(`${field}:`));
  if (index === -1) return [...lines, ...additions];
  return [...lines.slice(0, index + 1), ...additions, ...lines.slice(index + 1)];
}

function managedLines(workflow, kind) {
  const lines = [
    ...(kind === 'command' ? [`description: ${JSON.stringify(workflow.description)}`] : []),
    ...(kind === 'command' ? [`destructive-actions: ${workflow.destructiveActions}`] : []),
    `allowed-tools: ${workflow.allowedTools.join(' ')}`,
    `disallowed-tools: ${workflow.disallowedTools.join(' ')}`,
    'user-invocable: true',
    `disable-model-invocation: ${workflow.modelInvocable ? 'false' : 'true'}`,
  ];
  if (kind === 'skill' && workflow.compatibility) {
    lines.push(`compatibility: ${JSON.stringify(workflow.compatibility)}`);
  }
  if (kind === 'skill') {
    lines.push(
      'metadata:',
      '  nova-user-invocable: "true"',
      `  nova-model-invocable: "${workflow.modelInvocable}"`,
      `  nova-subagent-safe: "${workflow.subagentSafe}"`,
      `  nova-destructive-actions: "${workflow.destructiveActions}"`,
    );
  }
  return lines;
}

function commandBody(spec, workflow) {
  const requiredInputs = workflow.requiredInputs.length ? workflow.requiredInputs.map((input) => `\`${input}\``).join(', ') : 'None';
  const preset = Object.keys(workflow.variantPreset).length ? JSON.stringify(workflow.variantPreset) : '{}';
  return `\n# /${spec.pluginNamespace}:${workflow.id}\n\n${workflow.compatibilityAlias ? '**Compatibility direct entrypoint:** Claude requires this wrapper while native permission and invocation metadata remain static.' : 'Canonical command wrapper.'}\n\nStart from declared wrapper contract \`\${CLAUDE_PLUGIN_ROOT}/runtime/contracts/${workflow.id}.json\` and merge variant preset \`${preset}\` beneath explicit non-conflicting \`$ARGUMENTS\`. From the merged inputs, extract only the selector keys declared for \`${workflow.canonicalSurfaceId}\` in \`\${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json\`; ordinary inputs such as requests, approvals, and paths must never enter the resolution key. Validate selector values and apply declared defaults before matching. Use an exact normalized override when present. A non-exact combination that triggers any alias specialization is conflicting and must stop; only a valid combination that triggers no alias specialization may use the canonical fallback. Load the resolved runtime contract and compare its \`id\` to the invoked command id \`${workflow.id}\`. Claude native frontmatter is static: if the resolved id differs, STOP before tools or side effects and invoke the exact direct command \`/${spec.pluginNamespace}:<resolved commandEntrypoint.directCommandId>\`; do not execute another workflow's contract under this wrapper. Continue only when the ids match, then load the canonical skill \`\${CLAUDE_PLUGIN_ROOT}/${workflow.contractPath}\`. The complete resolved runtime contract is authoritative, including allowedTools, disallowedTools, modelInvocable, subagentSafe, destructiveActions, and commandEntrypoint; no field falls back to canonical Skill prose. Generic and Codex adapters may instead execute the resolved contract directly under their adapter enforcement. If a selector is undeclared, unsupported, conflicting, or resolution is ambiguous, fail closed.\n\n- Stage: ${workflow.stage}\n- Owner agents: ${workflow.ownerAgents.join(', ')}\n- Required inputs: ${requiredInputs}\n- Output contract: \`${workflow.outputContract}\`\n- Risk: ${workflow.risk}\n- Recommended packs: ${workflow.recommendedPacks.join(', ') || 'None'}\n\nIf required input, approval, capability, or safety state is unresolved, stop before side effects.\n`;
}

function renderSurface(root, spec, workflow, kind) {
  const relPath = kind === 'command'
    ? `nova-plugin/commands/${workflow.id}.md`
    : `nova-plugin/skills/nova-${workflow.id}/SKILL.md`;
  const source = readFileSync(resolve(root, relPath), 'utf8');
  const { frontmatter, body } = splitFrontmatter(source, relPath);
  let lines = removeManagedFields(frontmatter, kind);
  lines = insertAfter(lines, kind === 'command' ? 'title' : 'license', managedLines(workflow, kind));
  return { relPath, content: `---\n${lines.join('\n')}\n---\n${kind === 'command' ? commandBody(spec, workflow) : body}` };
}

function invocation(namespace, workflow, kind) {
  return `/${namespace}:${kind === 'command' ? workflow.id : `nova-${workflow.id}`}`;
}

export function buildEffectivePermissions(spec) {
  const entries = [];
  for (const workflow of spec.workflows) {
    for (const kind of ['command', ...(!workflow.compatibilityAlias ? ['skill'] : [])]) {
      entries.push({
        surface: kind,
        id: kind === 'command' ? workflow.id : `nova-${workflow.id}`,
        invocation: invocation(spec.pluginNamespace, workflow, kind),
        visibility: kind === 'skill' ? 'canonical' : (workflow.compatibilityAlias ? 'deprecated-alias' : 'primary'),
        destructiveActions: workflow.destructiveActions,
        userInvocable: true,
        modelInvocable: workflow.modelInvocable,
        preapprovedTools: workflow.allowedTools,
        disallowedTools: workflow.disallowedTools,
        permissionPromptTools: spec.toolVocabulary.filter((tool) => (
          !workflow.allowedTools.includes(tool) && !workflow.disallowedTools.includes(tool)
        )),
        compatibility: workflow.compatibility ?? null,
      });
    }
  }
  return {
    schemaVersion: 1,
    source: sourcePath,
    pluginNamespace: spec.pluginNamespace,
    knownGoodClaudeCli: spec.knownGoodClaudeCli,
    expectedCombinedSkillCount: spec.expectedInventory.combinedSkillCount,
    entries,
  };
}

function renderMarkdown(report) {
  const rows = report.entries.map((entry) => `| \`${entry.invocation}\` | ${entry.visibility} | ${entry.destructiveActions} | ${entry.modelInvocable} | ${entry.preapprovedTools.join(', ') || 'None'} | ${entry.disallowedTools.join(', ') || 'None'} | ${entry.permissionPromptTools.join(', ') || 'None'} |`);
  return `# Effective Permissions\n\nStatus: generated\n\nGenerated from \`${sourcePath}\` by \`node scripts/generate-workflow-permissions.mjs --write\`. \`allowed-tools\` are pre-approvals, not a complete whitelist.\n\n- Known-good Claude CLI: \`${report.knownGoodClaudeCli}\`\n- Expected installed Skills: ${report.expectedCombinedSkillCount}\n\n| Invocation | Visibility | Risk | Model invocable | Pre-approved | Disallowed | Permission prompt |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`;
}

function buildRouteContract(spec) {
  return {
    schemaVersion: 4,
    id: spec.workflows.find((workflow) => workflow.id === 'route')?.outputContract ?? 'recommended-route-v2',
    heading: '## Recommended Route',
    resolutionContract: 'resolved-variant-contracts.json',
    resolutionRule: 'Extract only declared selector keys, validate values, apply selector defaults, select an exact normalized override when present, stop on any non-exact alias specialization, otherwise use the canonical fallback, and treat the complete resolved runtime contract as authority.',
    fields: [
      { id: 'canonicalSkill', label: 'Canonical skill:' },
      { id: 'commandEntrypoint', label: 'Command entrypoint:' },
      { id: 'variantParameters', label: 'Variant parameters:' },
      { id: 'coreAgent', label: 'Core agent:' },
      { id: 'capabilityPacks', label: 'Capability packs:' },
      { id: 'requiredInputs', label: 'Required inputs:' },
      { id: 'validationExpectations', label: 'Validation expectations:' },
      { id: 'fallbackPath', label: 'Fallback path:' },
    ],
    ownerAgents: Object.fromEntries(spec.workflows.map((workflow) => [workflow.id, workflow.ownerAgents])),
  };
}

function workflowCatalog(spec) {
  return {
    schemaVersion: 1,
    source: sourcePath,
    workflows: spec.workflows.map((workflow) => ({
      id: workflow.id,
      stage: workflow.stage,
      ownerAgents: workflow.ownerAgents,
      recommendedPacks: workflow.recommendedPacks,
      requiredInputs: workflow.requiredInputs,
      outputContract: workflow.outputContract,
      risk: workflow.risk,
      primary: spec.primaryEntrypoints.includes(workflow.id),
      legacyAlias: workflow.legacyAlias,
      canonicalSurfaceId: workflow.canonicalSurfaceId,
      variantPreset: workflow.variantPreset,
      compatibilityAlias: workflow.compatibilityAlias,
      runtimeDelegation: false,
    })),
  };
}

function renderWorkflowCatalog(report) {
  const rows = report.workflows.map((workflow) => `| \`${workflow.id}\` | ${workflow.stage} | ${workflow.ownerAgents.join(', ')} | ${workflow.risk} | ${workflow.primary} | \`${workflow.outputContract}\` | \`${workflow.legacyAlias}\` |`).join('\n');
  return `# Workflow Catalog\n\nStatus: generated\n\nGenerated from \`${sourcePath}\`. Runtime command adapters execute directly and do not delegate through the compatibility alias.\n\n| Workflow | Stage | Owner agents | Risk | Primary | Output contract | Legacy alias |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
}

export function generateWorkflowPermissionFiles(root = defaultRoot) {
  const canonicalSpec = loadSpec(root);
  const behaviorDescriptions = new Map(loadNovaWorkflowModelV6(root).behaviors.behaviors.map((entry) => [entry.id, entry.purpose]));
  const product = loadProduct(root);
  const spec = buildRuntimePermissionSpec(canonicalSpec, product);
  const workflowIds = spec.workflows.map((workflow) => workflow.id).sort();
  const commandIds = [...spec.expectedInventory.commandIds].sort();
  const skillNames = [...spec.expectedInventory.skillNames].sort();
  if (canonicalSpec.pluginNamespace !== product.pluginNamespace) {
    throw new Error('workflow spec namespace must match product instance');
  }
  if (workflowIds.length !== product.expectedWorkflowCount || JSON.stringify(workflowIds) !== JSON.stringify(commandIds)) {
    throw new Error(`workflow permissions must define the product instance's exact ${product.expectedWorkflowCount} command ids`);
  }
  const expectedCanonicalSkills = canonicalSpec.workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => `nova-${workflow.id}`).sort();
  if (JSON.stringify(skillNames) !== JSON.stringify(expectedCanonicalSkills)) {
    throw new Error('expected skill inventory must contain only canonical skill surfaces');
  }
  for (const workflow of canonicalSpec.workflows) {
    for (const agent of workflow.ownerAgents) {
      if (!product.agents.includes(agent)) throw new Error(`${workflow.id}: unknown product agent ${agent}`);
    }
    for (const pack of workflow.recommendedPacks) {
      if (!product.packs.includes(pack)) throw new Error(`${workflow.id}: unknown product pack ${pack}`);
    }
  }
  if (JSON.stringify([...canonicalSpec.toolVocabulary].sort()) !== JSON.stringify([...product.tools].sort())) {
    throw new Error('workflow tool vocabulary must match product instance tools');
  }
  const report = buildEffectivePermissions(spec);
  const catalog = workflowCatalog(canonicalSpec);
  if (report.entries.length !== spec.expectedInventory.combinedSkillCount) {
    throw new Error(`effective permission count ${report.entries.length} does not match expected ${spec.expectedInventory.combinedSkillCount}`);
  }
  return [
    { relPath: runtimePath, content: `${JSON.stringify(spec, null, 2)}\n` },
    ...canonicalSpec.workflows.flatMap((workflow) => {
      const runtimeWorkflow = spec.workflows.find((entry) => entry.id === workflow.id);
      if (!runtimeWorkflow) throw new Error(`missing runtime workflow ${workflow.id}`);
      const description = behaviorDescriptions.get(workflow.id);
      if (!description) throw new Error(`missing behavior purpose for ${workflow.id}`);
      const surfaceWorkflow = { ...workflow, ...runtimeWorkflow, description };
      return [renderSurface(root, canonicalSpec, surfaceWorkflow, 'command'), ...(!workflow.compatibilityAlias ? [renderSurface(root, canonicalSpec, surfaceWorkflow, 'skill')] : [])];
    }),
    { relPath: routeContractPath, content: `${JSON.stringify(buildRouteContract(canonicalSpec), null, 2)}\n` },
    { relPath: generatedJson, content: `${JSON.stringify(report, null, 2)}\n` },
    { relPath: generatedMarkdown, content: renderMarkdown(report) },
    { relPath: workflowCatalogJson, content: `${JSON.stringify(catalog, null, 2)}\n` },
    { relPath: workflowCatalogMarkdown, content: renderWorkflowCatalog(catalog) },
  ];
}

export function checkOrWriteWorkflowPermissions({ root = defaultRoot, write = false } = {}) {
  const errors = [];
  const files = generateWorkflowPermissionFiles(root);
  for (const file of files) {
    const absPath = resolve(root, file.relPath);
    if (write) {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, file.content, 'utf8');
      continue;
    }
    if (!existsSync(absPath) || readFileSync(absPath, 'utf8') !== file.content) {
      errors.push(`${file.relPath} is stale; run node scripts/generate-workflow-permissions.mjs --write`);
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return files;
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }
  if (args.some((arg) => arg !== '--write')) {
    console.error(usage());
    return 1;
  }
  try {
    const write = args.includes('--write');
    const files = checkOrWriteWorkflowPermissions({ write });
    console.log(write ? `Wrote ${files.length} workflow permission files` : 'OK workflow permissions are current');
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
