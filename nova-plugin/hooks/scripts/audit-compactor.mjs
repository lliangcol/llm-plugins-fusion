#!/usr/bin/env node
/** Compact atomic audit spool records under a cross-process directory lock. */

import {
  chmodSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';

const stateHome = process.env.XDG_STATE_HOME || resolve(process.env.HOME || process.env.USERPROFILE || '/tmp', '.local/state');
const logDir = process.env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');
const spoolDir = resolve(logDir, 'audit-spool');
const lockDir = resolve(logDir, '.audit-compact.lock');
const lockOwnerPath = resolve(lockDir, 'owner.json');
const staleLockTtlMs = Number.parseInt(process.env.NOVA_AUDIT_LOCK_TTL_MS ?? '300000', 10);

function health(reason) {
  try {
    writeFileSync(resolve(logDir, 'audit-health.log'), `${JSON.stringify({ timestamp: new Date().toISOString(), status: 'degraded', reason: sanitizeAuditField(reason, 160) })}\n`, { flag: 'a', encoding: 'utf8' });
  } catch { /* best effort */ }
}

function chmodBestEffort(path, mode) {
  try { chmodSync(path, mode); } catch { /* platform may not support POSIX modes */ }
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function processStartIdentity(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', shell: false });
  return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
}

function recoverStaleLock() {
  let owner = null;
  try { owner = JSON.parse(readFileSync(lockOwnerPath, 'utf8')); } catch { /* legacy or interrupted lock */ }
  const lockAgeMs = owner?.startedAt
    ? Date.now() - Date.parse(owner.startedAt)
    : Date.now() - statSync(lockDir).mtimeMs;
  const ownerProcessExists = processExists(owner?.pid);
  const observedIdentity = ownerProcessExists ? processStartIdentity(owner?.pid) : null;
  const ownerStillMatches = ownerProcessExists && (!owner?.processStartIdentity || !observedIdentity || owner.processStartIdentity === observedIdentity);
  if (!Number.isFinite(lockAgeMs) || lockAgeMs <= staleLockTtlMs || ownerStillMatches) return false;
  const recovered = `${lockDir}.stale-${process.pid}-${Date.now()}`;
  renameSync(lockDir, recovered);
  health(`recovered stale audit compaction lock ageMs=${Math.trunc(lockAgeMs)} ownerPid=${owner?.pid ?? 'unknown'}`);
  rmSync(recovered, { recursive: true, force: true });
  return true;
}

function acquireLock() {
  while (true) {
    try {
      mkdirSync(lockDir);
      writeFileSync(lockOwnerPath, `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        host: hostname(),
        processStartIdentity: processStartIdentity(process.pid) ?? `${process.pid}:${Math.trunc(Date.now() - process.uptime() * 1000)}`,
      })}\n`, { flag: 'wx', encoding: 'utf8', mode: 0o600 });
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!recoverStaleLock()) return false;
    }
  }
}

if (process.env.NOVA_AUDIT_DISABLED === '1') process.exit(0);

let locked = false;
try {
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  locked = acquireLock();
  if (!locked) process.exit(0);
  const logFile = resolve(logDir, 'audit.log');
  writeFileSync(logFile, '', { flag: 'a', encoding: 'utf8', mode: 0o600 });
  chmodBestEffort(logFile, 0o600);
  const records = readdirSync(spoolDir).filter((name) => name.endsWith('.json')).sort();
  if (records.length && statSync(logFile).size > 5_242_880) {
    renameSync(logFile, `${logFile}.1`);
    writeFileSync(logFile, '', { flag: 'wx', encoding: 'utf8', mode: 0o600 });
  }
  for (const name of records) {
    const path = resolve(spoolDir, name);
    const raw = readFileSync(path, 'utf8');
    JSON.parse(raw);
    writeFileSync(logFile, raw.endsWith('\n') ? raw : `${raw}\n`, { flag: 'a', encoding: 'utf8' });
    unlinkSync(path);
  }
} catch (error) {
  health(error.message);
  process.exitCode = 1;
} finally {
  if (locked) rmSync(lockDir, { recursive: true, force: true });
}
