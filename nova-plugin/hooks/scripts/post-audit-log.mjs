#!/usr/bin/env node
/** Write one atomic audit spool record, then ask the independent compactor to flush. */

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

function parsePayload(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function isoTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function auditOutcome(payload, response) {
  if (payload.hook_event_name === 'PostToolUseFailure') return 'failed';
  if (payload.hook_event_name === 'PermissionDenied') return 'denied';
  if (response.success === true) return 'success';
  if (response.success === false) return 'failed';
  return 'unknown';
}

function publicPathSummary(value, payload) {
  if (!value) return '';
  const cwd = resolve(payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const target = resolve(cwd, value);
  const rel = relative(cwd, target).replaceAll('\\', '/');
  if (rel && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel)) return sanitizeAuditField(rel, 200);
  const digest = createHash('sha256').update(target).digest('hex').slice(0, 16);
  return `external-path:${digest}`;
}

function health(logDir, reason) {
  try {
    const path = resolve(logDir, 'audit-health.log');
    writeFileSync(path, `${JSON.stringify({ timestamp: isoTimestamp(), status: 'degraded', reason: sanitizeAuditField(reason, 160) })}\n`, { flag: 'a', encoding: 'utf8' });
  } catch { /* audit health is best effort */ }
}

if (process.env.NOVA_AUDIT_DISABLED === '1') process.exit(0);

const payload = parsePayload(readFileSync(0, 'utf8'));
const input = payload.tool_input || {};
const response = payload.tool_response || {};
const filePath = input.file_path || input.notebook_path || response.filePath || '';
const command = input.command || '';
const stateHome = process.env.XDG_STATE_HOME || resolve(process.env.HOME || process.env.USERPROFILE || '/tmp', '.local/state');
const logDir = process.env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');

try {
  const spoolDir = resolve(logDir, 'audit-spool');
  mkdirSync(spoolDir, { recursive: true, mode: 0o700 });
  const stamp = `${Date.now().toString().padStart(13, '0')}-${process.hrtime.bigint().toString().padStart(20, '0')}-${process.pid}-${randomUUID()}`;
  const record = {
    schemaVersion: 3,
    timestamp: isoTimestamp(),
    sessionId: sanitizeAuditField(payload.session_id || 'unknown', 96) || 'unknown',
    event: sanitizeAuditField(payload.hook_event_name || 'unknown', 48) || 'unknown',
    tool: sanitizeAuditField(payload.tool_name || 'unknown', 32) || 'unknown',
    outcome: auditOutcome(payload, response),
    summary: publicPathSummary(filePath, payload) || sanitizeAuditField(command || Object.keys(input).join(',') || 'N/A', 200) || 'N/A',
    sequence: stamp,
    toolUseId: sanitizeAuditField(payload.tool_use_id || 'unknown', 96) || 'unknown',
    durationMs: Number.isFinite(payload.duration_ms) ? payload.duration_ms : null,
  };
  const temp = resolve(spoolDir, `${stamp}.tmp`);
  const final = resolve(spoolDir, `${stamp}.json`);
  writeFileSync(temp, `${JSON.stringify(record)}\n`, { flag: 'wx', encoding: 'utf8', mode: 0o600 });
  renameSync(temp, final);
  const compact = spawnSync(process.execPath, [resolve(scriptDir, 'audit-compactor.mjs')], {
    env: process.env,
    encoding: 'utf8',
    timeout: 5_000,
    shell: false,
    windowsHide: true,
  });
  if (compact.error || compact.status !== 0) health(logDir, compact.error?.message || compact.stderr || `compactor exit ${compact.status}`);
} catch (error) {
  health(logDir, error.message);
}
