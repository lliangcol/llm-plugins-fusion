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
import { checkOrWrite as checkPromptSurfaceReport, validatePromptSurfaceBudgets } from './generate-prompt-surface-report.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const DEFAULT_ALLOWLIST = 'scripts/surface-budget.allowlist.json';

const SURFACES = [
  {
    label: 'command',
    dir: 'nova-plugin/commands',
    budget: { lines: 120, bytes: 12_000, tokens: 3_000, maxParagraph: 3_000, duplicateRatio: 0.2 },
    files: (dir) => readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => resolve(dir, file)),
  },
  {
    label: 'skill',
    dir: 'nova-plugin/skills',
    budget: { lines: 300, bytes: 14_000, tokens: 3_500, maxParagraph: 4_000, duplicateRatio: 0.3 },
    files: (dir) => readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('nova-'))
      .map((entry) => resolve(dir, entry.name, 'SKILL.md'))
      .filter(existsSync),
  },
  {
    label: 'agent',
    dir: 'nova-plugin/agents',
    budget: { lines: 250, bytes: 16_000, tokens: 4_000, maxParagraph: 4_000, duplicateRatio: 0.3 },
    files: (dir) => readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => resolve(dir, file)),
  },
  {
    label: 'pack',
    dir: 'nova-plugin/packs',
    budget: { lines: 220, bytes: 18_000, tokens: 4_500, maxParagraph: 5_000, duplicateRatio: 0.35 },
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

function surfaceMetrics(absPath) {
  const content = readFileSync(absPath, 'utf8');
  const paragraphs = content.split(/\r?\n\s*\r?\n/)
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter((value) => value.length >= 40);
  const counts = new Map();
  for (const paragraph of paragraphs) counts.set(paragraph, (counts.get(paragraph) ?? 0) + 1);
  const duplicateCount = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return {
    lines: content ? content.replace(/\r\n/g, '\n').split('\n').length - (content.endsWith('\n') ? 1 : 0) : 0,
    bytes: Buffer.byteLength(content),
    tokens: Math.ceil(content.length / 4),
    maxParagraph: paragraphs.reduce((max, value) => Math.max(max, value.length), 0),
    duplicateRatio: paragraphs.length ? duplicateCount / paragraphs.length : 0,
  };
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
      || typeof entry?.limits !== 'object'
      || typeof entry?.reason !== 'string'
      || !entry.reason.trim()
      || typeof entry?.splitPlan !== 'string'
      || !entry.splitPlan.trim()
      || typeof entry?.owner !== 'string'
      || !entry.owner.trim()
      || typeof entry?.issue !== 'string'
      || !entry.issue.trim()
      || !/^\d{4}-\d{2}-\d{2}$/.test(entry?.reviewDate ?? '')
      || !/^\d{4}-\d{2}-\d{2}$/.test(entry?.expiresAt ?? '')
    ) {
      throw new Error('surface-budget allowlist entries require path, limits, reason, splitPlan, owner, issue, reviewDate, and expiresAt');
    }
    if (Date.parse(`${entry.expiresAt}T23:59:59Z`) < Date.now()) throw new Error(`${entry.path}: surface-budget override expired ${entry.expiresAt}`);
    for (const [metric, limit] of Object.entries(entry.limits)) {
      if (!(metric in SURFACES[0].budget) || typeof limit !== 'number' || limit <= 0) {
        throw new Error(`${entry.path}: invalid surface-budget override ${metric}`);
      }
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
      const metrics = surfaceMetrics(file);
      const override = allowlist.get(path);
      const limits = { ...surface.budget, ...(override?.limits ?? {}) };
      checked += 1;

      for (const [metric, limit] of Object.entries(limits)) {
        if (metrics[metric] > limit) {
          const actual = metric === 'duplicateRatio' ? metrics[metric].toFixed(3) : metrics[metric];
          errors.push(`${path}: ${metric} ${actual} exceeds ${surface.label} budget ${limit}`);
        } else if (override?.limits?.[metric] && metrics[metric] > surface.budget[metric]) {
          warnings.push(`${path}: ${metric} exceeds the default but is temporarily allowlisted (${override.owner}, ${override.issue}, expires ${override.expiresAt})`);
        }
      }
    }
  }

  return { checked, errors, warnings };
}

const result = validate();
const promptReport = checkPromptSurfaceReport();
result.errors.push(...validatePromptSurfaceBudgets(promptReport));
for (const warning of result.warnings) console.warn(`WARNING ${warning}`);
if (result.errors.length) {
  console.error(`Surface budget validation failed (${result.errors.length} finding${result.errors.length === 1 ? '' : 's'}):`);
  for (const error of result.errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`OK surface budget validation passed (${result.checked} files checked)`);
