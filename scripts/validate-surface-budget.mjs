#!/usr/bin/env node
/**
 * Validate prompt-surface size budgets for shipped nova-plugin assets.
 *
 * This is a bloat guard, not a quality metric. If a surface needs to exceed the
 * default budget, add an explicit override with a rationale and split plan.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const DEFAULT_ALLOWLIST = 'scripts/surface-budget.allowlist.json';

const SURFACES = [
  {
    label: 'command',
    dir: 'nova-plugin/commands',
    budget: 120,
    files: (dir) => readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => resolve(dir, file)),
  },
  {
    label: 'skill',
    dir: 'nova-plugin/skills',
    budget: 300,
    files: (dir) => readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('nova-'))
      .map((entry) => resolve(dir, entry.name, 'SKILL.md'))
      .filter(existsSync),
  },
  {
    label: 'agent',
    dir: 'nova-plugin/agents',
    budget: 250,
    files: (dir) => readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => resolve(dir, file)),
  },
  {
    label: 'pack',
    dir: 'nova-plugin/packs',
    budget: 220,
    files: (dir) => [
      resolve(dir, 'README.md'),
      ...readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => resolve(dir, entry.name, 'README.md')),
    ].filter(existsSync),
  },
];

function rel(absPath) {
  return relative(root, absPath).split(sep).join('/');
}

function lineCount(absPath) {
  const content = readFileSync(absPath, 'utf8');
  if (!content) return 0;
  return content.replace(/\r\n/g, '\n').split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

function loadAllowlist() {
  const fullPath = resolve(root, DEFAULT_ALLOWLIST);
  if (!existsSync(fullPath)) return new Map();
  const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
  const entries = Array.isArray(raw.overrides) ? raw.overrides : [];
  const map = new Map();
  for (const entry of entries) {
    if (
      typeof entry?.path !== 'string'
      || !Number.isInteger(entry?.limit)
      || entry.limit <= 0
      || typeof entry?.reason !== 'string'
      || !entry.reason.trim()
      || typeof entry?.splitPlan !== 'string'
      || !entry.splitPlan.trim()
    ) {
      throw new Error('surface-budget allowlist entries require path, positive integer limit, reason, and splitPlan');
    }
    map.set(entry.path.replace(/\\/g, '/'), entry);
  }
  return map;
}

function validate() {
  const allowlist = loadAllowlist();
  const errors = [];
  const warnings = [];
  let checked = 0;

  for (const surface of SURFACES) {
    const dir = resolve(root, surface.dir);
    if (!existsSync(dir)) {
      errors.push(`${surface.dir}: directory missing`);
      continue;
    }
    for (const file of surface.files(dir)) {
      const path = rel(file);
      const lines = lineCount(file);
      const override = allowlist.get(path);
      const limit = override?.limit ?? surface.budget;
      checked += 1;

      if (lines > limit) {
        errors.push(`${path}: ${lines} lines exceeds ${surface.label} budget ${limit}`);
      } else if (override && lines > surface.budget) {
        warnings.push(`${path}: ${lines} lines exceeds default ${surface.budget} but is allowlisted to ${limit} (${override.reason})`);
      }
    }
  }

  return { checked, errors, warnings };
}

const result = validate();
for (const warning of result.warnings) console.warn(`WARNING ${warning}`);
if (result.errors.length) {
  console.error(`Surface budget validation failed (${result.errors.length} finding${result.errors.length === 1 ? '' : 's'}):`);
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`OK surface budget validation passed (${result.checked} files checked)`);
