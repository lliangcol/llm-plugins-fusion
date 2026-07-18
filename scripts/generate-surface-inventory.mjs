#!/usr/bin/env node
/**
 * Generate and validate the derived public surface inventory.
 *
 * Default mode checks that docs/generated/surface-inventory.{json,md} match
 * the repository file tree. Use --write to update those generated docs.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

assertNodeVersion({ label: 'surface inventory generation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const GENERATED_JSON = 'docs/generated/surface-inventory.json';
const GENERATED_MD = 'docs/generated/surface-inventory.md';

function usage() {
  return 'Usage: node scripts/generate-surface-inventory.mjs [--root <repo-root>] [--prompt-report] [--write]';
}

function parseArgs(args) {
  const options = {
    root: defaultRoot,
    promptReport: false,
    write: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--prompt-report') {
      options.promptReport = true;
      continue;
    }
    if (arg === '--root') {
      const value = requireOptionValue(args, index, '--root');
      options.root = resolve(value);
      index += 1;
      continue;
    }
    console.error(`ERROR unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }

  return options;
}

function parseScalar(raw) {
  let value = raw.trim();
  if (value === '') return '';
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function splitFrontmatter(src, file) {
  if (!src.startsWith('---')) {
    throw new Error(`${file} missing frontmatter`);
  }
  const rest = src.slice(3);
  const endIndex = rest.indexOf('\n---');
  if (endIndex === -1) {
    throw new Error(`${file} missing frontmatter terminator`);
  }
  return rest.slice(0, endIndex).replace(/^\r?\n/, '');
}

function parseFrontmatter(src, file) {
  const lines = splitFrontmatter(src.replace(/\r\n/g, '\n'), file).split('\n');
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(/^(\s*)([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2];
    const rawValue = match[3];
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;
    if (rawValue === '') {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = parseScalar(rawValue);
    }
  }

  return root;
}

function readJson(root, relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

function markdownFiles(root, relDir) {
  return readdirSync(resolve(root, relDir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
}

/** @param {string} root @param {string} relDir @param {(name: string) => boolean} [predicate] */
function directories(root, relDir, predicate = () => true) {
  return readdirSync(resolve(root, relDir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function commandInventory(root, workflowSpec) {
  const workflows = new Map(workflowSpec.workflows.map((workflow) => [workflow.id, workflow]));
  return markdownFiles(root, 'nova-plugin/commands').map((file) => {
    const relPath = `nova-plugin/commands/${file}`;
    const frontmatter = parseFrontmatter(readFileSync(resolve(root, relPath), 'utf8'), relPath);
    const workflow = workflows.get(frontmatter.id);
    if (!workflow) throw new Error(`${relPath} is missing from the canonical workflow spec`);
    return {
      id: frontmatter.id,
      stage: frontmatter.stage,
      destructiveActions: frontmatter['destructive-actions'],
      supportingContract: `nova-plugin/${workflow.contractPath}`,
      canonicalSkill: `nova-${workflow.canonicalSurfaceId}`,
      compatibilityAlias: workflow.compatibilityAlias,
      variantPreset: workflow.variantPreset,
      runtimeDelegation: false,
      path: relPath,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function skillInventory(root) {
  return directories(root, 'nova-plugin/skills', (name) => name.startsWith('nova-') && existsSync(resolve(root, 'nova-plugin/skills', name, 'SKILL.md'))).map((name) => {
    const relPath = `nova-plugin/skills/${name}/SKILL.md`;
    const frontmatter = parseFrontmatter(readFileSync(resolve(root, relPath), 'utf8'), relPath);
    return {
      name: frontmatter.name,
      commandId: name.slice('nova-'.length),
      userInvocable: frontmatter['user-invocable'],
      modelInvocable: !frontmatter['disable-model-invocation'],
      allowedTools: String(frontmatter['allowed-tools'] ?? '').split(/\s+/).filter(Boolean),
      disallowedTools: String(frontmatter['disallowed-tools'] ?? '').split(/\s+/).filter(Boolean),
      subagentSafe: frontmatter.metadata?.['nova-subagent-safe'] === 'true',
      destructiveActions: frontmatter.metadata?.['nova-destructive-actions'],
      path: relPath,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function agentInventory(root) {
  return markdownFiles(root, 'nova-plugin/agents').map((file) => ({
    id: file.replace(/\.md$/, ''),
    path: `nova-plugin/agents/${file}`,
  })).sort((a, b) => a.id.localeCompare(b.id));
}

function packInventory(root) {
  return directories(root, 'nova-plugin/packs').map((id) => ({
    id,
    path: `nova-plugin/packs/${id}/README.md`,
  })).sort((a, b) => a.id.localeCompare(b.id));
}

function marketplaceOutputs(root) {
  const marketplace = readJson(root, '.claude-plugin/marketplace.json');
  const canary = readJson(root, '.claude-plugin/marketplace.canary.json');
  const metadata = readJson(root, '.claude-plugin/marketplace.metadata.json');
  return [
    {
      path: '.claude-plugin/marketplace.json',
      generated: true,
      pluginCount: marketplace.plugins?.length ?? 0,
      pluginVersions: (marketplace.plugins ?? []).map((plugin) => `${plugin.name}@${plugin.version}`).sort(),
    },
    {
      path: '.claude-plugin/marketplace.canary.json',
      generated: true,
      pluginCount: canary.plugins?.length ?? 0,
      pluginVersions: (canary.plugins ?? []).map((plugin) => `${plugin.name}@${plugin.version}`).sort(),
    },
    {
      path: '.claude-plugin/marketplace.metadata.json',
      generated: true,
      pluginCount: metadata.plugins?.length ?? 0,
      pluginVersions: (metadata.plugins ?? []).map((plugin) => `${plugin.name}@${plugin.version}`).sort(),
    },
    {
      path: 'docs/marketplace/catalog.md',
      generated: true,
      pluginCount: marketplace.plugins?.length ?? 0,
      pluginVersions: (marketplace.plugins ?? []).map((plugin) => `${plugin.name}@${plugin.version}`).sort(),
    },
  ];
}

export function buildSurfaceInventory(root = defaultRoot) {
  const plugin = readJson(root, 'nova-plugin/.claude-plugin/plugin.json');
  const registry = readJson(root, '.claude-plugin/registry.source.json');
  const workflowSpec = readJson(root, 'workflow-specs/workflows.json');
  const commands = commandInventory(root, workflowSpec);
  const skills = skillInventory(root);
  const agents = agentInventory(root);
  const packs = packInventory(root);
  const permissionSpec = readJson(root, 'nova-plugin/runtime/workflow-permissions.json');

  return {
    schemaVersion: 1,
    source: {
      pluginName: plugin.name,
      pluginVersion: plugin.version,
      registrySource: '.claude-plugin/registry.source.json',
      registryPluginCount: registry.plugins?.length ?? 0,
    },
    counts: {
      commands: commands.length,
      skills: skills.length,
      activeAgents: agents.length,
      capabilityPacks: packs.length,
      generatedMarketplaceOutputs: 4,
      installedSkills: permissionSpec.expectedInventory.combinedSkillCount,
    },
    commands,
    skills,
    activeAgents: agents,
    capabilityPacks: packs,
    generatedMarketplaceOutputs: marketplaceOutputs(root),
    runtimeCompatibility: {
      pluginNamespace: permissionSpec.pluginNamespace,
      knownGoodClaudeCli: permissionSpec.knownGoodClaudeCli,
      primaryEntrypoints: permissionSpec.primaryEntrypoints.map((id) => `/${permissionSpec.pluginNamespace}:${id}`),
      expectedCommandIds: permissionSpec.expectedInventory.commandIds,
      expectedSkillNames: permissionSpec.expectedInventory.skillNames,
    },
  };
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  return [
    header,
    divider,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function renderMarkdown(inventory) {
  return `# Surface Inventory

Status: generated

This file is generated from repository sources by
\`node scripts/generate-surface-inventory.mjs --write\`. Do not edit it by hand.
The JSON form is [surface-inventory.json](surface-inventory.json).

## Summary

${markdownTable(
  ['Surface', 'Count'],
  [
    ['Commands', inventory.counts.commands],
    ['Skills', inventory.counts.skills],
    ['Active agents', inventory.counts.activeAgents],
    ['Capability packs', inventory.counts.capabilityPacks],
    ['Generated marketplace outputs', inventory.counts.generatedMarketplaceOutputs],
    ['Installed Claude Skills', inventory.counts.installedSkills],
  ],
)}

## Commands

${markdownTable(
  ['ID', 'Stage', 'Destructive actions', 'Canonical skill', 'Deprecated alias'],
  inventory.commands.map((command) => [
    `\`${command.id}\``,
    command.stage,
    command.destructiveActions,
    `\`${command.canonicalSkill}\``,
    String(command.compatibilityAlias),
  ]),
)}

## Skills

${markdownTable(
  ['Name', 'Command ID', 'Model invocable', 'Subagent safe', 'Destructive actions'],
  inventory.skills.map((skill) => [
    `\`${skill.name}\``,
    `\`${skill.commandId}\``,
    String(skill.modelInvocable),
    String(skill.subagentSafe),
    skill.destructiveActions,
  ]),
)}

## Runtime Compatibility

- Plugin namespace: \`${inventory.runtimeCompatibility.pluginNamespace}\`
- Known-good Claude CLI: \`${inventory.runtimeCompatibility.knownGoodClaudeCli}\`
- Primary entrypoints: ${inventory.runtimeCompatibility.primaryEntrypoints.map((entry) => `\`${entry}\``).join(', ')}

## Active Agents

${markdownTable(
  ['ID', 'Path'],
  inventory.activeAgents.map((agent) => [`\`${agent.id}\``, `\`${agent.path}\``]),
)}

## Capability Packs

${markdownTable(
  ['ID', 'Path'],
  inventory.capabilityPacks.map((pack) => [`\`${pack.id}\``, `\`${pack.path}\``]),
)}

## Generated Marketplace Outputs

${markdownTable(
  ['Path', 'Plugin versions'],
  inventory.generatedMarketplaceOutputs.map((output) => [
    `\`${output.path}\``,
    output.pluginVersions.map((version) => `\`${version}\``).join(', '),
  ]),
)}
`;
}

export function generateSurfaceInventoryFiles(root = defaultRoot) {
  const inventory = buildSurfaceInventory(root);
  return [
    {
      relPath: GENERATED_JSON,
      content: `${JSON.stringify(inventory, null, 2)}\n`,
    },
    {
      relPath: GENERATED_MD,
      content: renderMarkdown(inventory),
    },
  ];
}

function checkOrWriteGeneratedFiles(root, write) {
  const files = generateSurfaceInventoryFiles(root);
  const errors = [];

  for (const file of files) {
    const abs = resolve(root, file.relPath);
    if (write) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, file.content, 'utf8');
      continue;
    }

    if (!existsSync(abs)) {
      errors.push(`  - ${file.relPath}: missing generated file; run node scripts/generate-surface-inventory.mjs --write`);
      continue;
    }
    const actual = readFileSync(abs, 'utf8');
    if (actual !== file.content) {
      errors.push(`  - ${file.relPath}: generated inventory is stale; run node scripts/generate-surface-inventory.mjs --write`);
    }
  }

  if (errors.length) {
    console.error(`Surface inventory validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(error);
    process.exit(1);
  }

  if (write) {
    for (const file of files) console.log(`Wrote ${file.relPath}`);
  } else {
    console.log('OK surface inventory is current');
  }
}

const surfaceSha256 = (value) => createHash('sha256').update(value).digest('hex');

function promptPackPath(repoRoot, id) {
  const nested = `nova-plugin/packs/${id}/README.md`;
  return existsSync(resolve(repoRoot, nested)) ? nested : 'nova-plugin/packs/README.md';
}

function promptFileMetrics(repoRoot, path) {
  const content = readFileSync(resolve(repoRoot, path), 'utf8');
  return { path, bytes: Buffer.byteLength(content), tokens: Math.ceil(content.length / 4), sha256: surfaceSha256(content), content };
}

function promptDuplication(files) {
  const owners = new Map();
  for (const file of files) {
    const paragraphs = file.content.split(/\r?\n\s*\r?\n/u).map((value) => value.replace(/\s+/gu, ' ').trim()).filter((value) => value.length >= 40);
    for (const paragraph of new Set(paragraphs)) {
      const key = surfaceSha256(paragraph);
      const entry = owners.get(key) ?? { bytes: Buffer.byteLength(paragraph), paths: [] };
      entry.paths.push(file.path);
      owners.set(key, entry);
    }
  }
  const repeated = [...owners.values()].filter((entry) => entry.paths.length > 1);
  const duplicateBytes = repeated.reduce((sum, entry) => sum + entry.bytes * (entry.paths.length - 1), 0);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return { repeatedParagraphs: repeated.length, duplicateBytes, duplicateRatio: totalBytes ? duplicateBytes / totalBytes : 0 };
}

function promptAggregate(files) {
  return {
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    tokens: files.reduce((sum, file) => sum + file.tokens, 0),
    ...promptDuplication(files),
  };
}

export function buildPromptSurfaceReport(repoRoot = defaultRoot) {
  const { spec } = loadNovaWorkflowModelV6(repoRoot);
  const complexityBudget = readJson(repoRoot, 'governance/complexity-budget.json');
  const budgets = complexityBudget.promptSurface;
  if (!budgets) throw new Error('governance/complexity-budget.json is missing promptSurface budgets');
  const workflows = spec.workflows.map((workflow) => {
    const nodes = [
      { kind: 'command', path: `nova-plugin/commands/${workflow.id}.md` },
      { kind: 'runtime-contract', path: `nova-plugin/runtime/contracts/${workflow.id}.json` },
      { kind: 'canonical-skill', path: `nova-plugin/${workflow.contractPath}` },
      ...workflow.ownerAgents.map((id) => ({ kind: 'owner-agent', path: `nova-plugin/agents/${id}.md` })),
      ...workflow.recommendedPacks.map((id) => ({ kind: 'capability-pack', path: promptPackPath(repoRoot, id) })),
    ];
    const uniqueNodes = [...new Map(nodes.map((node) => [node.path, node])).values()];
    const files = uniqueNodes.map((node) => ({
      ...node,
      loadPhase: ['command', 'runtime-contract', 'canonical-skill'].includes(node.kind) ? 'initial' : 'potential',
      ...promptFileMetrics(repoRoot, node.path),
    }));
    const initialFiles = files.filter((file) => file.loadPhase === 'initial');
    return {
      id: workflow.id,
      canonicalSurfaceId: workflow.canonicalSurfaceId,
      graph: {
        entrypoint: `nova-plugin/commands/${workflow.id}.md`,
        nodes: files.map(({ content, ...file }) => file),
        edges: files.slice(1).map((file) => ({ from: `nova-plugin/commands/${workflow.id}.md`, to: file.path, relation: ['runtime-contract', 'canonical-skill'].includes(file.kind) ? `loads-${file.kind}` : `recommended-${file.kind}` })),
      },
      initialLoad: promptAggregate(initialFiles),
      potentialReferenced: promptAggregate(files),
    };
  });
  return {
    schemaVersion: 2,
    source: ['workflow-specs/workflows.v6.json', 'governance/complexity-budget.json#/promptSurface'],
    tokenEstimate: 'ceil(UTF-16 code units / 4) per file; deterministic bloat guard, not tokenizer evidence',
    claimBoundary: 'Initial load includes only the command wrapper, resolved runtime contract, and canonical Skill. Owner agents and recommended capability packs are potential references and are not claimed as loaded automatically.',
    budgets,
    workflowCount: workflows.length,
    workflows,
  };
}

export function validatePromptSurfaceBudgets(report) {
  const errors = [];
  if (report.workflowCount !== 21) errors.push(`aggregate prompt graph covers ${report.workflowCount}/21 workflows`);
  for (const workflow of report.workflows) {
    if (workflow.initialLoad.files > report.budgets.maximumInitialLoadFiles) errors.push(`${workflow.id}: initial-load files ${workflow.initialLoad.files} exceeds ${report.budgets.maximumInitialLoadFiles}`);
    if (workflow.initialLoad.tokens > report.budgets.maximumInitialLoadEstimatedTokens) errors.push(`${workflow.id}: initial-load tokens ${workflow.initialLoad.tokens} exceeds ${report.budgets.maximumInitialLoadEstimatedTokens}`);
    if (workflow.potentialReferenced.duplicateRatio > report.budgets.maximumPotentialCrossFileDuplicateRatio) errors.push(`${workflow.id}: potential-reference cross-file duplicate ratio ${workflow.potentialReferenced.duplicateRatio.toFixed(3)} exceeds ${report.budgets.maximumPotentialCrossFileDuplicateRatio}`);
  }
  return errors;
}

function renderPromptSurfaceReport(report) {
  const rows = report.workflows.map((workflow) => `| \`${workflow.id}\` | ${workflow.initialLoad.files} | ${workflow.initialLoad.tokens} | ${workflow.potentialReferenced.files} | ${workflow.potentialReferenced.tokens} | ${(workflow.potentialReferenced.duplicateRatio * 100).toFixed(2)}% |`).join('\n');
  return `# Aggregate Prompt Surface Report\n\nStatus: generated\n\nGenerated from \`${report.source[0]}\` with budgets owned by \`${report.source[1]}\`. Token values are deterministic size estimates, not assistant tokenizer measurements. ${report.claimBoundary}\n\nBudgets: initial load at most ${report.budgets.maximumInitialLoadFiles} files and ${report.budgets.maximumInitialLoadEstimatedTokens} estimated tokens; potential referenced surface at most ${(report.budgets.maximumPotentialCrossFileDuplicateRatio * 100).toFixed(0)}% cross-file exact-paragraph duplication per workflow.\n\n| Workflow | Initial files | Initial tokens | Potential files | Potential tokens | Potential duplication |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows}\n`;
}

export function checkOrWritePromptSurfaceReport({ repoRoot = defaultRoot, write = false } = {}) {
  const report = buildPromptSurfaceReport(repoRoot);
  const outputs = [
    { path: 'docs/generated/prompt-surface-report.json', content: `${JSON.stringify(report, null, 2)}\n` },
    { path: 'docs/generated/prompt-surface-report.md', content: renderPromptSurfaceReport(report) },
  ];
  const stale = [];
  for (const output of outputs) {
    const fullPath = resolve(repoRoot, output.path);
    if (write) {
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, output.content, 'utf8');
    } else if (!existsSync(fullPath) || readFileSync(fullPath, 'utf8') !== output.content) stale.push(output.path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} stale; run node scripts/generate-surface-inventory.mjs --prompt-report --write`);
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.promptReport) {
      const report = checkOrWritePromptSurfaceReport({ repoRoot: options.root, write: options.write });
      console.log(`${options.write ? 'Wrote' : 'OK'} aggregate prompt surface report (${report.workflowCount} workflows)`);
    } else checkOrWriteGeneratedFiles(options.root, options.write);
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    process.exitCode = 1;
  }
}
