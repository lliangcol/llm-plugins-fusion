#!/usr/bin/env node
/** Normalize shipped skill contracts while preserving workflow-specific behavior. */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = resolve(root, 'nova-plugin/skills');

function usage() {
  return 'Usage: node scripts/normalize-workflow-surfaces.mjs [--write]';
}

function sharedContract(id) {
  return `## Shared Execution Policy

This file is the supporting behavioral contract for \`/nova-plugin:${id}\` and the deprecated \`/nova-plugin:nova-${id}\` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

- Resolve natural-language and explicit \`KEY=value\` inputs using \`../_shared/parameter-resolution.md\`; explicit non-conflicting values take precedence.
- Apply \`../_shared/safety-preflight.md\` before side effects. Never infer approval, destructive scope, credentials, or output destinations.
- Follow \`../_shared/output-contracts.md\` and \`../_shared/artifact-policy.md\`; report completed, skipped, and blocked validation truthfully.
- Respect the frontmatter tool boundary. Missing inputs, unavailable dependencies, overlapping user changes, or repository-policy conflicts are blockers rather than permission to broaden scope.

## Execution

1. Parse \`$ARGUMENTS\` against the workflow-specific inputs below.
2. Read only the context required for the requested scope.
3. Apply the workflow contract and its strict output format.
4. Stop before unauthorized side effects; otherwise validate in proportion to risk and report residual risk.

## Workflow Contract

`;
}

export function normalizeSkill(source, id) {
  const marker = '\n## Skill-Specific Guidance\n';
  if (source.includes(marker)) {
    const frontmatter = /^(---\r?\n[\s\S]*?\r?\n---\r?\n)/.exec(source)?.[1];
    if (!frontmatter) throw new Error(`nova-${id}: missing frontmatter`);
    source = `${frontmatter}\n${sharedContract(id)}${source.split(marker, 2)[1].replace(/^\n+/, '')}`;
  }
  source = source
    .replace(/\n## Migrated Slash Command Contract\n\nMigrated from[^\n]*\n\n/g, '\n## Detailed Contract\n\n')
    .replace(/\$([A-Z][A-Z0-9_]*)/g, (match, name) => (name === 'ARGUMENTS' ? match : `<${name}>`));
  return source.endsWith('\n') ? source : `${source}\n`;
}

export function checkOrWrite({ write = false } = {}) {
  const stale = [];
  const dirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('nova-'))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const dir of dirs) {
    const path = resolve(skillsRoot, dir.name, 'SKILL.md');
    if (!existsSync(path)) continue;
    const source = readFileSync(path, 'utf8');
    const normalized = normalizeSkill(source, dir.name.slice('nova-'.length));
    if (source === normalized) continue;
    if (write) writeFileSync(path, normalized, 'utf8');
    else stale.push(path.replace(`${root}/`, ''));
  }
  if (stale.length) throw new Error(`${stale.join(', ')} require normalization; run node scripts/normalize-workflow-surfaces.mjs --write`);
  return dirs.length;
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
    const count = checkOrWrite({ write });
    console.log(`${write ? 'Normalized' : 'OK'} ${count} workflow skill contracts`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = main();
}
