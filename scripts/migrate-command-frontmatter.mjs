#!/usr/bin/env node
/**
 * Migrate command frontmatter (commands/*.md) to align with SKILL.md.
 *
 * For each command id `foo`, we locate `nova-foo` skill, copy `allowed-tools`
 * and `destructiveActions` enum over, and add an `invokes.skill` pointer so
 * the command → skill binding becomes machine-readable.
 *
 * Rules:
 *   - allowed-tools: copy space-separated string from skill
 *   - destructive-actions: replace boolean with skill's destructiveActions enum
 *     (none/low/medium/high); falls back to "low" if skill had `true` previously
 *     and "none" if `false`, when the skill value is unavailable
 *   - invokes.skill: `nova-<id>`
 *   - Preserve existing keys: id, stage, title
 *
 * Usage:
 *   node scripts/migrate-command-frontmatter.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function splitFrontmatter(src) {
  if (!src.startsWith('---')) return { fm: '', body: src, hasFm: false };
  const rest = src.slice(3);
  const endIdx = rest.indexOf('\n---');
  if (endIdx === -1) return { fm: '', body: src, hasFm: false };
  const fm = rest.slice(0, endIdx).replace(/^\r?\n/, '');
  const afterMarker = rest.slice(endIdx + 4).replace(/^\r?\n/, '');
  return { fm, body: afterMarker, hasFm: true };
}

function parseSimpleFrontmatter(fm) {
  const obj = {};
  const lines = fm.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v === 'true') obj[m[1]] = true;
    else if (v === 'false') obj[m[1]] = false;
    else obj[m[1]] = v;
  }
  return obj;
}

function readSkillMetadata(skillName) {
  const skillPath = resolve(root, 'nova-plugin/skills', skillName, 'SKILL.md');
  try {
    if (!statSync(skillPath).isFile()) return null;
  } catch {
    return null;
  }
  const src = readFileSync(skillPath, 'utf8').replace(/\r\n/g, '\n');
  const { fm } = splitFrontmatter(src);
  const allowedToolsMatch = fm.match(/^allowed-tools:\s*(.+)$/m);
  const destructiveMatch = fm.match(/destructiveActions:\s*(.+)$/);
  const allowedTools = allowedToolsMatch
    ? allowedToolsMatch[1].trim().replace(/^['"]|['"]$/g, '')
    : '';
  const destructive = destructiveMatch ? destructiveMatch[1].trim() : null;
  return { allowedTools, destructive };
}

function quoteYamlString(s) {
  if (s === '') return '""';
  if (/[:#&*!|>'"%@`{}\[\],]/.test(s) || /^\s|\s$/.test(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}

const commandsDir = resolve(root, 'nova-plugin/commands');
const files = readdirSync(commandsDir).filter((f) => f.endsWith('.md')).map((f) => resolve(commandsDir, f));
let changed = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const { fm, body, hasFm } = splitFrontmatter(src);
  if (!hasFm) {
    console.warn(`! ${file}: no frontmatter`);
    continue;
  }
  if (/\binvokes:/.test(fm)) {
    continue;
  }
  const parsed = parseSimpleFrontmatter(fm);
  const id = parsed.id;
  if (!id) {
    console.warn(`! ${file}: missing id`);
    continue;
  }
  const skillName = `nova-${id}`;
  const skillMeta = readSkillMetadata(skillName);
  if (!skillMeta) {
    console.warn(`! ${file}: skill ${skillName} not found`);
    continue;
  }

  const destructiveOld = parsed['destructive-actions'];
  let destructive = skillMeta.destructive;
  if (!destructive) {
    destructive = destructiveOld === true ? 'low' : 'none';
  }

  const out = ['---'];
  out.push(`id: ${parsed.id}`);
  if (parsed.stage !== undefined) out.push(`stage: ${parsed.stage}`);
  if (parsed.title !== undefined) out.push(`title: ${quoteYamlString(String(parsed.title))}`);
  out.push(`destructive-actions: ${destructive}`);
  if (skillMeta.allowedTools) out.push(`allowed-tools: ${quoteYamlString(skillMeta.allowedTools)}`);
  out.push('invokes:');
  out.push(`  skill: ${skillName}`);
  for (const [k, v] of Object.entries(parsed)) {
    if (['id', 'stage', 'title', 'destructive-actions'].includes(k)) continue;
    if (typeof v === 'boolean' || typeof v === 'number') out.push(`${k}: ${v}`);
    else out.push(`${k}: ${quoteYamlString(String(v))}`);
  }
  out.push('---');
  const next = `${out.join('\n')}\n\n${body.replace(/^\n+/, '')}`;
  if (next === src) continue;
  if (DRY_RUN) {
    console.log(`~ ${file}`);
  } else {
    writeFileSync(file, next, 'utf8');
    console.log(`✓ ${file}`);
  }
  changed++;
}
console.log(`${DRY_RUN ? '[dry-run] ' : ''}${changed}/${files.length} file(s) updated`);
