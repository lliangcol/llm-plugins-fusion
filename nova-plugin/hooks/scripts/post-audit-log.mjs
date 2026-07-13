#!/usr/bin/env node
/** Write one atomic audit spool record and compact only after a bounded threshold. */

import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const compactRecordThreshold = 50;
const compactByteThreshold = 1024 * 1024;

export function chmodBestEffort(path, mode, chmod = chmodSync) {
  try { chmod(path, mode); } catch { /* platform may not support POSIX modes */ }
}

function lstatIfPresent(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function assertSingleLinkRegular(stats, path) {
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`audit path is not a regular file: ${path}`);
  if (!Number.isInteger(stats.nlink) || stats.nlink !== 1) throw new Error(`audit path must have exactly one hard link: ${path}`);
  return stats;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertNoLinkedDirectoryComponents(path) {
  const absolute = resolve(path);
  const { root } = parse(absolute);
  const parts = relative(root, absolute).split(sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    const next = resolve(current, parts[index]);
    const stats = lstatIfPresent(next);
    if (!stats) break;
    if (stats.isSymbolicLink()) {
      // macOS commonly exposes /var and /tmp as root-level aliases. Normalize
      // that platform boundary, but reject links inside the caller-owned path.
      if (current !== root) throw new Error(`audit path component is a symlink: ${next}`);
      current = realpathSync.native(next);
      continue;
    }
    if (index < parts.length - 1 && !stats.isDirectory()) {
      throw new Error(`audit path component is not a directory: ${next}`);
    }
    current = next;
  }
}

export function assertPrivateRegularFile(path, { allowMissing = false } = {}) {
  const stats = lstatIfPresent(path);
  if (!stats && allowMissing) return null;
  if (!stats) throw Object.assign(new Error(`audit file is missing: ${path}`), { code: 'ENOENT' });
  return assertSingleLinkRegular(stats, path);
}

export function ensurePrivateDirectory(path) {
  assertNoLinkedDirectoryComponents(path);
  const existing = lstatIfPresent(path);
  if (!existing) mkdirSync(path, { recursive: true, mode: 0o700 });
  assertNoLinkedDirectoryComponents(path);
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`audit path is not a real directory: ${path}`);
  chmodBestEffort(path, 0o700);
  return stats;
}

function openPrivateFile(path, flags, mode = 0o600) {
  const before = assertPrivateRegularFile(path, { allowMissing: Boolean(flags & constants.O_CREAT) });
  const createExclusively = !before && Boolean(flags & constants.O_CREAT);
  const descriptor = openSync(path, flags | (constants.O_NOFOLLOW ?? 0) | (createExclusively ? constants.O_EXCL : 0), mode);
  try {
    const opened = assertSingleLinkRegular(fstatSync(descriptor), path);
    const after = assertPrivateRegularFile(path);
    if ((before && !sameFile(before, opened)) || !sameFile(opened, after)) {
      throw new Error(`audit path changed while opening: ${path}`);
    }
    try { fchmodSync(descriptor, mode); } catch { /* platform may not support POSIX modes */ }
    return descriptor;
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

export function appendPrivateFile(path, content) {
  const descriptor = openPrivateFile(path, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT);
  try {
    assertSingleLinkRegular(fstatSync(descriptor), path);
    writeFileSync(descriptor, content, { encoding: 'utf8' });
  } finally { closeSync(descriptor); }
}

export function readPrivateFile(path) {
  const descriptor = openPrivateFile(path, constants.O_RDONLY);
  try {
    const stats = assertSingleLinkRegular(fstatSync(descriptor), path);
    return { content: readFileSync(descriptor, 'utf8'), stats };
  } finally { closeSync(descriptor); }
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

export function health(logDir, reason, write = null, chmod = chmodSync) {
  try {
    const path = resolve(logDir, 'audit-health.log');
    const line = `${JSON.stringify({ timestamp: isoTimestamp(), status: 'degraded', reason: sanitizeAuditField(reason, 160) })}\n`;
    if (write) {
      write(path, line, { flag: 'a', encoding: 'utf8' });
      chmodBestEffort(path, 0o600, chmod);
    } else {
      ensurePrivateDirectory(logDir);
      appendPrivateFile(path, line);
    }
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
  ensurePrivateDirectory(logDir);
  ensurePrivateDirectory(spoolDir);
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
