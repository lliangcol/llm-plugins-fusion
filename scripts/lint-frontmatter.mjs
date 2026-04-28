#!/usr/bin/env node
/**
 * Lint command & skill frontmatter for shape conformance.
 *
 * Contracts:
 *   commands/*.md required:
 *     - id (string, matches folder/filename basename)
 *     - stage (enum: explore|plan|implement|review|finalize)
 *     - title (string)
 *     - destructive-actions (enum: none|low|medium|high)
 *     - allowed-tools (space-separated string)
 *     - invokes.skill (string matching nova-<id>)
 *
 *   skills/nova-*\/SKILL.md required:
 *     - name (string, matches folder)
 *     - description (string)
 *     - license (MIT)
 *     - allowed-tools (string)
 *     - metadata.novaPlugin.{userInvocable,autoLoad,subagentSafe,destructiveActions}
 *
 * Exits 1 on any violation; prints a machine-readable report.
 *
 * Usage:
 *   node scripts/lint-frontmatter.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const STAGES = new Set(['explore', 'plan', 'implement', 'review', 'finalize']);
const DESTRUCTIVE = new Set(['none', 'low', 'medium', 'high']);

const errors = [];
const warnings = [];

function recordError(file, msg) {
  errors.push(`  ✗ ${file}: ${msg}`);
}
function recordWarning(file, msg) {
  warnings.push(`  ! ${file}: ${msg}`);
}

function splitFrontmatter(src) {
  if (!src.startsWith('---')) return null;
  const rest = src.slice(3);
  const endIdx = rest.indexOf('\n---');
  if (endIdx === -1) return null;
  return rest.slice(0, endIdx).replace(/^\r?\n/, '');
}

// Minimal YAML reader supporting scalars, lists, and one level of nested map.
function parseFrontmatter(fm) {
  const lines = fm.split(/\r?\n/);
  const obj = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const m = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, rawVal] = m;
    if (rawVal === '') {
      let j = i + 1;
      const nested = {};
      const list = [];
      while (j < lines.length) {
        const l = lines[j];
        if (!l.trim()) { j++; continue; }
        const listMatch = l.match(/^\s+-\s+(.*)$/);
        const nestMatch = l.match(/^(\s+)([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
        if (listMatch) {
          list.push(listMatch[1].trim());
          j++;
          continue;
        }
        if (nestMatch) {
          nested[nestMatch[2]] = parseScalar(nestMatch[3]);
          j++;
          // Handle one more level of nesting (metadata.novaPlugin.*)
          while (j < lines.length && /^\s{4,}[a-zA-Z]/.test(lines[j])) {
            const deep = lines[j].match(/^\s+([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
            if (!deep) break;
            // attach to the last nested key if it was empty (meaning it is itself a map)
            const lastKey = nestMatch[2];
            if (typeof nested[lastKey] === 'string' && nested[lastKey] === '') {
              nested[lastKey] = {};
            }
            if (typeof nested[lastKey] === 'object' && nested[lastKey] !== null) {
              nested[lastKey][deep[1]] = parseScalar(deep[2]);
            }
            j++;
          }
          continue;
        }
        break;
      }
      if (list.length) obj[key] = list;
      else if (Object.keys(nested).length) obj[key] = nested;
      else obj[key] = '';
      i = j;
    } else {
      obj[key] = parseScalar(rawVal);
      i++;
    }
  }
  return obj;
}

function parseScalar(raw) {
  let v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function lintCommands() {
  const dir = resolve(root, 'nova-plugin/commands');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const f of files) {
    const fp = resolve(dir, f);
    const src = readFileSync(fp, 'utf8').replace(/\r\n/g, '\n');
    const fm = splitFrontmatter(src);
    const rel = `commands/${f}`;
    if (!fm) { recordError(rel, 'missing frontmatter'); continue; }
    const obj = parseFrontmatter(fm);
    const expectedId = basename(f, '.md');

    if (!obj.id) recordError(rel, 'missing id');
    else if (obj.id !== expectedId) recordError(rel, `id "${obj.id}" does not match filename "${expectedId}"`);

    if (!obj.stage) recordError(rel, 'missing stage');
    else if (!STAGES.has(obj.stage)) recordError(rel, `invalid stage "${obj.stage}" (must be one of ${[...STAGES].join('|')})`);

    if (!obj.title) recordError(rel, 'missing title');

    if (obj['destructive-actions'] === undefined) recordError(rel, 'missing destructive-actions');
    else if (!DESTRUCTIVE.has(String(obj['destructive-actions']))) recordError(rel, `invalid destructive-actions "${obj['destructive-actions']}" (must be ${[...DESTRUCTIVE].join('|')})`);

    if (!obj['allowed-tools']) recordError(rel, 'missing allowed-tools');
    else if (typeof obj['allowed-tools'] !== 'string') recordError(rel, 'allowed-tools must be a space-separated string');

    if (!obj.invokes || typeof obj.invokes !== 'object') {
      recordError(rel, 'missing invokes.skill');
    } else {
      const expectSkill = `nova-${expectedId}`;
      if (!obj.invokes.skill) recordError(rel, 'missing invokes.skill');
      else if (obj.invokes.skill !== expectSkill) recordError(rel, `invokes.skill "${obj.invokes.skill}" expected "${expectSkill}"`);
    }
  }
}

function lintSkills() {
  const skillsDir = resolve(root, 'nova-plugin/skills');
  const entries = readdirSync(skillsDir);
  for (const entry of entries) {
    const dir = resolve(skillsDir, entry);
    try { if (!statSync(dir).isDirectory()) continue; } catch { continue; }
    const skillMd = resolve(dir, 'SKILL.md');
    try { if (!statSync(skillMd).isFile()) continue; } catch { continue; }
    const rel = `skills/${entry}/SKILL.md`;
    const src = readFileSync(skillMd, 'utf8').replace(/\r\n/g, '\n');
    const fm = splitFrontmatter(src);
    if (!fm) { recordError(rel, 'missing frontmatter'); continue; }
    const obj = parseFrontmatter(fm);

    if (!obj.name) recordError(rel, 'missing name');
    else if (obj.name !== entry) recordError(rel, `name "${obj.name}" does not match folder "${entry}"`);

    if (!obj.description) recordError(rel, 'missing description');
    else if (typeof obj.description === 'string' && obj.description.length > 1024) {
      recordError(rel, `description exceeds 1024 chars (${obj.description.length})`);
    }

    if (!obj.license) recordError(rel, 'missing license');
    else if (obj.license !== 'MIT') recordError(rel, `license must be MIT (got "${obj.license}")`);

    if (!obj['allowed-tools']) recordError(rel, 'missing allowed-tools');
    else if (typeof obj['allowed-tools'] !== 'string') recordError(rel, 'allowed-tools must be a space-separated string');

    const meta = obj.metadata;
    if (!meta || typeof meta !== 'object') {
      recordError(rel, 'missing metadata block');
    } else {
      const nova = meta.novaPlugin;
      if (!nova || typeof nova !== 'object') {
        recordError(rel, 'missing metadata.novaPlugin');
      } else {
        for (const k of ['userInvocable', 'autoLoad', 'subagentSafe', 'destructiveActions']) {
          if (nova[k] === undefined) recordError(rel, `missing metadata.novaPlugin.${k}`);
        }
        if (nova.destructiveActions !== undefined && !DESTRUCTIVE.has(String(nova.destructiveActions))) {
          recordError(rel, `metadata.novaPlugin.destructiveActions invalid: "${nova.destructiveActions}"`);
        }
      }
    }
  }
}

lintCommands();
lintSkills();

if (warnings.length) {
  console.warn('Warnings:');
  for (const w of warnings) console.warn(w);
}
if (errors.length) {
  console.error(`\nFrontmatter lint failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log('✓ frontmatter lint passed');
