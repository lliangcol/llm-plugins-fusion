#!/usr/bin/env node
/** Generate a read-only v2 compatibility projection during the v3 migration window. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { legacyCapabilities } from './generate-workflow-permissions.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModel } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const target = 'docs/generated/workflow-spec-v2.compat.json';

export function content() {
  const { spec } = loadNovaWorkflowModel(root);
  const projection = {
    schemaVersion: 2,
    sourceSchemaVersion: spec.schemaVersion,
    source: 'workflow-specs/workflows.json',
    migrationBoundary: 'Read-only compatibility projection; new consumers must use runtimeRequirements, permissionPolicy, and enforcement.',
    pluginNamespace: spec.pluginNamespace,
    permissionProfiles: Object.fromEntries(Object.entries(spec.permissionProfiles).map(([name, profile]) => [name, {
      allowedTools: profile.allowedTools,
      disallowedTools: profile.disallowedTools,
      capabilities: legacyCapabilities(profile.permissionPolicy),
    }])),
    workflows: spec.workflows.map(({ runtimeRequirements, ...workflow }) => workflow),
  };
  return `${JSON.stringify(projection, null, 2)}\n`;
}

export function checkOrWrite({ write = false } = {}) {
  const expected = content();
  const path = resolve(root, target);
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
  } else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    throw new Error(`${target} is stale; run node scripts/generate-workflow-v2-compat.mjs --write`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-workflow-v2-compat.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? `Wrote ${target}` : 'OK workflow v2 compatibility projection');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
