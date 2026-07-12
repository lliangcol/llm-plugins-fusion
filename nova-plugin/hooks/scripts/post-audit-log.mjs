#!/usr/bin/env node
/** Write one atomic audit spool record and compact only after a bounded threshold. */

import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const compactRecordThreshold = 50;
const compactByteThreshold = 1024 * 1024;

export function chmodBestEffort(path, mode, chmod = chmodSync) {
  try { chmod(path, mode); } catch { /* platform may not support POSIX modes */ }
}

export function parsePayload(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function isoTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function auditOutcome(payload, response) {
  if (payload.hook_event_name === 'PostToolUseFailure') return 'failed';
  if (payload.hook_event_name === 'PermissionDenied') return 'denied';
  if (response.success === true) return 'success';
  if (response.success === false) return 'failed';
  return 'unknown';
}

export function publicPathSummary(value, payload, env = process.env) {
  if (!value) return '';
  const cwd = resolve(payload.cwd || env.CLAUDE_PROJECT_DIR || process.cwd());
  const target = resolve(cwd, value);
  const rel = relative(cwd, target).replaceAll('\\', '/');
  if (rel && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel)) return sanitizeAuditField(rel, 200);
  const digest = createHash('sha256').update(target).digest('hex').slice(0, 16);
  return `external-path:${digest}`;
}

export function health(logDir, reason, write = writeFileSync, chmod = chmodSync) {
  try {
    const path = resolve(logDir, 'audit-health.log');
    write(path, `${JSON.stringify({ timestamp: isoTimestamp(), status: 'degraded', reason: sanitizeAuditField(reason, 160) })}\n`, { flag: 'a', encoding: 'utf8' });
    chmodBestEffort(path, 0o600, chmod);
  } catch { /* audit health is best effort */ }
}

export function shouldCompact(recordCount, bytes) {
  return recordCount >= compactRecordThreshold || bytes >= compactByteThreshold;
}

export function writeAuditRecord(payload, { env = process.env, spawnProcess = spawn } = {}) {
  const input = payload.tool_input || {};
  const response = payload.tool_response || {};
  const filePath = input.file_path || input.notebook_path || response.filePath || '';
  const command = input.command || '';
  const stateHome = env.XDG_STATE_HOME || resolve(env.HOME || env.USERPROFILE || '/tmp', '.local/state');
  const logDir = env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');
  const spoolDir = resolve(logDir, 'audit-spool');
  mkdirSync(spoolDir, { recursive: true, mode: 0o700 });
  chmodBestEffort(spoolDir, 0o700);
  const stamp = `${Date.now().toString().padStart(13, '0')}-${process.hrtime.bigint().toString().padStart(20, '0')}-${process.pid}-${randomUUID()}`;
  const record = {
    schemaVersion: 3,
    timestamp: isoTimestamp(),
    sessionId: sanitizeAuditField(payload.session_id || 'unknown', 96) || 'unknown',
    event: sanitizeAuditField(payload.hook_event_name || 'unknown', 48) || 'unknown',
    tool: sanitizeAuditField(payload.tool_name || 'unknown', 32) || 'unknown',
    outcome: auditOutcome(payload, response),
    summary: publicPathSummary(filePath, payload, env) || sanitizeAuditField(command || Object.keys(input).join(',') || 'N/A', 200) || 'N/A',
    sequence: stamp,
    toolUseId: sanitizeAuditField(payload.tool_use_id || 'unknown', 96) || 'unknown',
    durationMs: Number.isFinite(payload.duration_ms) ? payload.duration_ms : null,
  };
  const temp = resolve(spoolDir, `${stamp}.tmp`);
  const final = resolve(spoolDir, `${stamp}.json`);
  writeFileSync(temp, `${JSON.stringify(record)}\n`, { flag: 'wx', encoding: 'utf8', mode: 0o600 });
  renameSync(temp, final);
  const records = readdirSync(spoolDir).filter((name) => name.endsWith('.json'));
  const bytes = records.reduce((total, name) => total + statSync(resolve(spoolDir, name)).size, 0);
  if (shouldCompact(records.length, bytes)) {
    const compact = spawnProcess(process.execPath, [resolve(scriptDir, 'audit-compactor.mjs')], {
      env,
      detached: process.platform !== 'win32',
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    compact.on('error', (error) => health(logDir, error.message));
    compact.unref();
  }
  return { record, logDir, spoolDir };
}

export function main(raw = readFileSync(0, 'utf8'), env = process.env) {
  if (env.NOVA_AUDIT_DISABLED === '1') return 0;
  const payload = parsePayload(raw);
  const stateHome = env.XDG_STATE_HOME || resolve(env.HOME || env.USERPROFILE || '/tmp', '.local/state');
  const logDir = env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');
  try {
    writeAuditRecord(payload, { env });
    return 0;
  } catch (error) {
    health(logDir, error.message);
    return 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
