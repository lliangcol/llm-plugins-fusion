#!/usr/bin/env node
/**
 * Migrate SKILL.md frontmatter to the Agent Skills open standard (2025-12-18).
 *
 * Rules:
 *   - Keep: name, description.
 *   - Add: license (default MIT) if missing.
 *   - Collapse into metadata.novaPlugin.*:
 *       user-invocable        -> metadata.novaPlugin.userInvocable
 *       auto-load             -> metadata.novaPlugin.autoLoad
 *       subagent-safe         -> metadata.novaPlugin.subagentSafe
 *       destructive-actions   -> metadata.novaPlugin.destructiveActions
 *   - Convert allowed-tools (YAML list) -> space-separated string.
 *   - Keep argument-hint as-is (Claude Code-specific extension, tracked separately).
 *   - Preserve body content after the second `---`.
 *
 * Usage:
 *   node scripts/migrate-skill-frontmatter.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const DRY_RUN = process.argv.includes('--dry-run');

function listSkillFiles() {
  const skillsDir = resolve(root, 'nova-plugin/skills');
  const entries = readdirSync(skillsDir);
  const results = [];
  for (const entry of entries) {
    const p = resolve(skillsDir, entry);
    try {
      if (statSync(p).isDirectory()) {
        const skillMd = resolve(p, 'SKILL.md');
        try {
          if (statSync(skillMd).isFile()) results.push(skillMd);
        } catch {}
      }
    } catch {}
  }
  return results;
}

function splitFrontmatter(src) {
  if (!src.startsWith('---')) return { fm: '', body: src, hasFm: false };
  const rest = src.slice(3);
  const endIdx = rest.indexOf('\n---');
  if (endIdx === -1) return { fm: '', body: src, hasFm: false };
  const fm = rest.slice(0, endIdx).replace(/^\r?\n/, '');
  const afterMarker = rest.slice(endIdx + 4);
  const body = afterMarker.replace(/^\r?\n/, '');
  return { fm, body, hasFm: true };
}

// Minimal YAML subset parser for the known SKILL.md shape.
// Supports: scalar `key: value`, `key: "quoted"`, and list `key:\n  - item`.
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
      const list = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        list.push(lines[j].replace(/^\s+-\s+/, '').trim());
        j++;
      }
      obj[key] = list;
      i = j;
    } else {
      let v = rawVal.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (v === 'true') obj[key] = true;
      else if (v === 'false') obj[key] = false;
      else obj[key] = v;
      i++;
    }
  }
  return obj;
}

function quoteYamlString(s) {
  if (s === '') return '""';
  if (/[:#&*!|>'"%@`{}\[\],]/.test(s) || /^\s|\s$/.test(s)) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }
  return s;
}

function emitFrontmatter(parsed) {
  const {
    name,
    description,
    license,
    'allowed-tools': allowedToolsRaw,
    'argument-hint': argHint,
    'user-invocable': userInv,
    'auto-load': autoLoad,
    'subagent-safe': subagentSafe,
    'destructive-actions': destructive,
    ...rest
  } = parsed;

  const out = [];
  out.push('---');
  if (name !== undefined) out.push(`name: ${quoteYamlString(String(name))}`);
  if (description !== undefined) out.push(`description: ${quoteYamlString(String(description))}`);

  const licenseVal = license !== undefined ? license : 'MIT';
  out.push(`license: ${quoteYamlString(String(licenseVal))}`);

  if (allowedToolsRaw !== undefined) {
    const asString = Array.isArray(allowedToolsRaw)
      ? allowedToolsRaw.join(' ')
      : String(allowedToolsRaw);
    out.push(`allowed-tools: ${quoteYamlString(asString)}`);
  }
  if (argHint !== undefined) out.push(`argument-hint: ${quoteYamlString(String(argHint))}`);

  const novaMeta = {};
  if (userInv !== undefined) novaMeta.userInvocable = userInv;
  if (autoLoad !== undefined) novaMeta.autoLoad = autoLoad;
  if (subagentSafe !== undefined) novaMeta.subagentSafe = subagentSafe;
  if (destructive !== undefined) novaMeta.destructiveActions = destructive;
  if (Object.keys(novaMeta).length) {
    out.push('metadata:');
    out.push('  novaPlugin:');
    for (const [k, v] of Object.entries(novaMeta)) {
      out.push(`    ${k}: ${typeof v === 'string' ? quoteYamlString(v) : v}`);
    }
  }

  for (const [k, v] of Object.entries(rest)) {
    if (Array.isArray(v)) {
      out.push(`${k}:`);
      for (const item of v) out.push(`  - ${quoteYamlString(String(item))}`);
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      out.push(`${k}: ${v}`);
    } else {
      out.push(`${k}: ${quoteYamlString(String(v))}`);
    }
  }
  out.push('---');
  return out.join('\n');
}

const files = listSkillFiles();
let changed = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const { fm, body, hasFm } = splitFrontmatter(src);
  if (!hasFm) {
    console.warn(`! ${file}: no frontmatter, skipped`);
    continue;
  }
  // Idempotency guard: our parser does not understand nested YAML maps, so a
  // previously-migrated file would be re-emitted with an empty `metadata:` line.
  // Skip once the novaPlugin metadata block is present.
  if (/\bmetadata:\s*\n\s+novaPlugin:/.test(fm)) {
    continue;
  }
  const parsed = parseFrontmatter(fm);
  const newFm = emitFrontmatter(parsed);
  const next = `${newFm}\n\n${body.replace(/^\n+/, '')}`;
  if (next === src) continue;
  if (DRY_RUN) {
    console.log(`~ ${file} (would change)`);
  } else {
    writeFileSync(file, next, 'utf8');
    console.log(`✓ ${file}`);
  }
  changed++;
}
console.log(`${DRY_RUN ? '[dry-run] ' : ''}${changed}/${files.length} file(s) updated`);
