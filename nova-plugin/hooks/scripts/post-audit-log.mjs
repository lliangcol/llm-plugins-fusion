#!/usr/bin/env node
/**
 * Node compatibility helper for PostToolUse audit logging.
 *
 * hooks.json still uses the Bash entry point. This helper mirrors the audit
 * redaction and local log behavior for portability validation.
 */

import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';

function readStdin() {
  return readFileSync(0, 'utf8');
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function isoTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function chmodBestEffort(path, mode) {
  try {
    chmodSync(path, mode);
  } catch {
    // Windows and restricted filesystems may ignore POSIX permissions.
  }
}

function appendLine(path, line) {
  writeFileSync(path, line, { flag: 'a', encoding: 'utf8' });
}

function auditOutcome(payload, response) {
  if (payload.hook_event_name === 'PostToolUseFailure') return 'failed';
  if (payload.hook_event_name === 'PermissionDenied') return 'denied';
  if (response.success === true) return 'success';
  if (response.success === false) return 'failed';
  return 'unknown';
}

if (process.env.NOVA_AUDIT_DISABLED === '1') {
  process.exit(0);
}

const payload = parsePayload(readStdin());
const input = payload.tool_input || {};
const response = payload.tool_response || {};
const toolName = sanitizeAuditField(payload.tool_name || 'unknown', 32) || 'unknown';
const filePath = input.file_path || input.notebook_path || response.filePath || '';
const command = input.command || '';
const timestamp = isoTimestamp();
const event = sanitizeAuditField(payload.hook_event_name || 'unknown', 48) || 'unknown';
const outcome = auditOutcome(payload, response);

let summary = '';
if (filePath) {
  summary = filePath;
} else if (command) {
  summary = command;
} else {
  summary = Object.keys(input).join(',') || 'N/A';
}
summary = sanitizeAuditField(summary, 200) || 'N/A';

const stateHome = process.env.XDG_STATE_HOME || resolve(process.env.HOME || process.env.USERPROFILE || '/tmp', '.local/state');
const logDir = process.env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');

try {
  mkdirSync(logDir, { recursive: true });
  chmodBestEffort(logDir, 0o700);
  const logFile = resolve(logDir, 'audit.log');
  writeFileSync(logFile, '', { flag: 'a', encoding: 'utf8' });
  chmodBestEffort(logFile, 0o600);

  const size = statSync(logFile).size;
  if (size > 5_242_880) {
    let rotated = false;
    try {
      renameSync(logFile, `${logFile}.1`);
      rotated = true;
    } catch {
      // If rotation fails, keep best-effort append behavior.
    }
    if (rotated) {
      writeFileSync(logFile, '', 'utf8');
      chmodBestEffort(logFile, 0o600);
    }
  }

  const record = {
    schemaVersion: 2,
    timestamp,
    sessionId: sanitizeAuditField(payload.session_id || 'unknown', 96) || 'unknown',
    event,
    tool: toolName,
    outcome,
    summary,
    sequence: Number(process.hrtime.bigint() % 9_000_000_000_000_000n),
    toolUseId: sanitizeAuditField(payload.tool_use_id || 'unknown', 96) || 'unknown',
    durationMs: Number.isFinite(payload.duration_ms) ? payload.duration_ms : null,
  };
  appendLine(logFile, `${JSON.stringify(record)}\n`);
} catch {
  process.exit(0);
}
