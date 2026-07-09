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
import { redactSensitiveText } from '../../runtime/secret-rules.mjs';

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

function formatRow(timestamp, toolName, status, summary) {
  return `${timestamp.padEnd(24)} ${toolName.padEnd(16)} ${status.padEnd(8)} ${summary}\n`;
}

if (process.env.NOVA_AUDIT_DISABLED === '1') {
  process.exit(0);
}

const payload = parsePayload(readStdin());
const input = payload.tool_input || {};
const response = payload.tool_response || {};
const toolName = payload.tool_name || 'unknown';
const filePath = input.file_path || response.filePath || '';
const command = input.command || '';
const success = response.success == null ? true : response.success;
const timestamp = isoTimestamp();

let summary = '';
if (filePath) {
  summary = filePath;
} else if (command) {
  const redactedCommand = redactSensitiveText(command);
  summary = redactedCommand.slice(0, 60);
  if (redactedCommand.length > 60) summary = `${summary}...`;
} else {
  summary = Object.keys(input).join(',') || 'N/A';
}
summary = redactSensitiveText(summary);

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
    try {
      renameSync(logFile, `${logFile}.1`);
    } catch {
      // If rotation fails, keep best-effort append behavior.
    }
    writeFileSync(logFile, '', 'utf8');
    chmodBestEffort(logFile, 0o600);
  }

  appendLine(logFile, formatRow(timestamp, toolName, success === false ? 'FAILED' : 'SUCCESS', summary));
} catch {
  process.exit(0);
}
