#!/usr/bin/env node
/** Generate native Claude frontmatter and effective permission reports. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const sourcePath = 'nova-plugin/runtime/workflow-permissions.json';
const generatedJson = 'docs/generated/effective-permissions.json';
const generatedMarkdown = 'docs/generated/effective-permissions.md';
const managedFields = new Set([
  'allowed-tools',
  'disallowed-tools',
  'user-invocable',
  'disable-model-invocation',
  'compatibility',
  'metadata',
]);

function usage() {
  return 'Usage: node scripts/generate-workflow-permissions.mjs [--write]';
}

function loadSpec(root) {
  return JSON.parse(readFileSync(resolve(root, sourcePath), 'utf8'));
}

function splitFrontmatter(source, relPath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  if (!match) throw new Error(`${relPath} missing frontmatter`);
  return { frontmatter: match[1], body: source.slice(match[0].length) };
}

function removeManagedFields(frontmatter) {
  const lines = frontmatter.split(/\r?\n/);
  const kept = [];
  for (let index = 0; index < lines.length;) {
    const match = /^([A-Za-z][\w-]*)\s*:/.exec(lines[index]);
    if (!match || !managedFields.has(match[1])) {
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

function renderSurface(root, workflow, kind) {
  const relPath = kind === 'command'
    ? `nova-plugin/commands/${workflow.id}.md`
    : `nova-plugin/skills/nova-${workflow.id}/SKILL.md`;
  const source = readFileSync(resolve(root, relPath), 'utf8');
  const { frontmatter, body } = splitFrontmatter(source, relPath);
  let lines = removeManagedFields(frontmatter);
  lines = insertAfter(lines, kind === 'command' ? 'destructive-actions' : 'license', managedLines(workflow, kind));
  return { relPath, content: `---\n${lines.join('\n')}\n---\n${body}` };
}

function invocation(namespace, workflow, kind) {
  return `/${namespace}:${kind === 'command' ? workflow.id : `nova-${workflow.id}`}`;
}

export function buildEffectivePermissions(spec) {
  const primary = new Set(spec.primaryEntrypoints);
  const entries = [];
  for (const workflow of spec.workflows) {
    for (const kind of ['command', 'skill']) {
      entries.push({
        surface: kind,
        id: kind === 'command' ? workflow.id : `nova-${workflow.id}`,
        invocation: invocation(spec.pluginNamespace, workflow, kind),
        visibility: kind === 'skill' ? 'compatibility' : (primary.has(workflow.id) ? 'primary' : 'advanced'),
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

export function generateWorkflowPermissionFiles(root = defaultRoot) {
  const spec = loadSpec(root);
  const workflowIds = spec.workflows.map((workflow) => workflow.id).sort();
  const commandIds = [...spec.expectedInventory.commandIds].sort();
  const skillNames = [...spec.expectedInventory.skillNames].sort();
  if (workflowIds.length !== 21 || JSON.stringify(workflowIds) !== JSON.stringify(commandIds)) {
    throw new Error('workflow permissions must define the exact 21 command ids');
  }
  if (JSON.stringify(skillNames) !== JSON.stringify(commandIds.map((id) => `nova-${id}`).sort())) {
    throw new Error('expected skill inventory must map one-to-one to command ids');
  }
  const report = buildEffectivePermissions(spec);
  if (report.entries.length !== spec.expectedInventory.combinedSkillCount) {
    throw new Error(`effective permission count ${report.entries.length} does not match expected ${spec.expectedInventory.combinedSkillCount}`);
  }
  return [
    ...spec.workflows.flatMap((workflow) => [
      renderSurface(root, workflow, 'command'),
      renderSurface(root, workflow, 'skill'),
    ]),
    { relPath: generatedJson, content: `${JSON.stringify(report, null, 2)}\n` },
    { relPath: generatedMarkdown, content: renderMarkdown(report) },
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
