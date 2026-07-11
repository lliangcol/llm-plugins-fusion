#!/usr/bin/env node
/**
 * Generate and validate the derived public surface inventory.
 *
 * Default mode checks that docs/generated/surface-inventory.{json,md} match
 * the repository file tree. Use --write to update those generated docs.
 */

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

assertNodeVersion({ label: 'surface inventory generation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const GENERATED_JSON = 'docs/generated/surface-inventory.json';
const GENERATED_MD = 'docs/generated/surface-inventory.md';

function usage() {
  return 'Usage: node scripts/generate-surface-inventory.mjs [--root <repo-root>] [--write]';
}

function parseArgs(args) {
  const options = {
    root: defaultRoot,
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

function directories(root, relDir, predicate = () => true) {
  return readdirSync(resolve(root, relDir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function commandInventory(root) {
  return markdownFiles(root, 'nova-plugin/commands').map((file) => {
    const relPath = `nova-plugin/commands/${file}`;
    const frontmatter = parseFrontmatter(readFileSync(resolve(root, relPath), 'utf8'), relPath);
    return {
      id: frontmatter.id,
      stage: frontmatter.stage,
      destructiveActions: frontmatter['destructive-actions'],
      invokesSkill: frontmatter.invokes?.skill,
      path: relPath,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function skillInventory(root) {
  return directories(root, 'nova-plugin/skills', (name) => name.startsWith('nova-')).map((name) => {
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
  const metadata = readJson(root, '.claude-plugin/marketplace.metadata.json');
  return [
    {
      path: '.claude-plugin/marketplace.json',
      generated: true,
      pluginCount: marketplace.plugins?.length ?? 0,
      pluginVersions: (marketplace.plugins ?? []).map((plugin) => `${plugin.name}@${plugin.version}`).sort(),
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
  const commands = commandInventory(root);
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
      generatedMarketplaceOutputs: 3,
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
  ['ID', 'Stage', 'Destructive actions', 'Invoked skill'],
  inventory.commands.map((command) => [
    `\`${command.id}\``,
    command.stage,
    command.destructiveActions,
    `\`${command.invokesSkill}\``,
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    checkOrWriteGeneratedFiles(options.root, options.write);
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    process.exitCode = 1;
  }
}
