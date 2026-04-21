#!/usr/bin/env node
/**
 * Ensure nova-plugin-command-generator/scripts/manifest-data.json stays in
 * sync with nova-plugin/commands/*.md and the workflows declared in it.
 *
 * Checks:
 *   1. Every commands/*.md has a matching entry in manifest-data.json commands.
 *   2. Every manifest-data.json commands entry references an existing .md file.
 *   3. Every workflow step commandId exists in commands.
 *   4. Every scenario.recommendCommandId / recommendWorkflowId resolves.
 *   5. Every command has a title / description.
 *
 * Exits 1 on drift.
 *
 * Usage:
 *   node scripts/check-manifest-drift.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const commandsDir = resolve(root, 'nova-plugin/commands');
const manifestPath = resolve(root, 'nova-plugin-command-generator/scripts/manifest-data.json');

const commandIds = readdirSync(commandsDir)
  .filter((f) => f.endsWith('.md'))
  .map((f) => basename(f, '.md'))
  .sort();

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const manifestCommands = manifest.commands ?? {};
const manifestIds = Object.keys(manifestCommands).sort();

const errors = [];

for (const id of commandIds) {
  if (!manifestCommands[id]) {
    errors.push(`commands/${id}.md has no entry in manifest-data.json commands`);
  }
}
for (const id of manifestIds) {
  if (!commandIds.includes(id)) {
    errors.push(`manifest-data.json commands["${id}"] has no matching commands/${id}.md`);
  }
}

for (const [id, cmd] of Object.entries(manifestCommands)) {
  if (!cmd.description) errors.push(`commands["${id}"] missing description`);
  if (!cmd.template) errors.push(`commands["${id}"] missing template`);
}

const workflows = Array.isArray(manifest.workflows) ? manifest.workflows : [];
const workflowIds = new Set(workflows.map((w) => w.id));
for (const wf of workflows) {
  if (!wf.id) { errors.push('a workflow is missing id'); continue; }
  const steps = Array.isArray(wf.steps) ? wf.steps : [];
  for (const step of steps) {
    if (!step.commandId) {
      errors.push(`workflow "${wf.id}" step ${step.stepId ?? '?'} missing commandId`);
      continue;
    }
    if (!manifestCommands[step.commandId]) {
      errors.push(`workflow "${wf.id}" step "${step.stepId ?? ''}" references unknown command "${step.commandId}"`);
    }
  }
}

const scenarios = Array.isArray(manifest.scenarios) ? manifest.scenarios : [];
for (const s of scenarios) {
  if (!s.id) { errors.push('a scenario is missing id'); continue; }
  if (s.recommendCommandId && !manifestCommands[s.recommendCommandId]) {
    errors.push(`scenario "${s.id}" recommendCommandId "${s.recommendCommandId}" not found`);
  }
  if (s.recommendWorkflowId && !workflowIds.has(s.recommendWorkflowId)) {
    errors.push(`scenario "${s.id}" recommendWorkflowId "${s.recommendWorkflowId}" not found`);
  }
}

if (errors.length) {
  console.error(`Manifest drift detected (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log(`✓ manifest-data.json in sync (${commandIds.length} commands, ${workflows.length} workflows, ${scenarios.length} scenarios)`);
