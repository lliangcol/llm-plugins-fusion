#!/usr/bin/env node
/** Compact atomic audit spool records under a cross-process directory lock. */

import {
  lstatSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';
import {
  appendPrivateFile,
  assertPrivateRegularFile,
  ensurePrivateDirectory,
  readPrivateFile,
} from './post-audit-log.mjs';

const stateHome = process.env.XDG_STATE_HOME || resolve(process.env.HOME || process.env.USERPROFILE || '/tmp', '.local/state');
const logDir = process.env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');
const spoolDir = resolve(logDir, 'audit-spool');
const lockDir = resolve(logDir, '.audit-compact.lock');
const lockOwnerPath = resolve(lockDir, 'owner.json');
const staleLockTtlMs = Number.parseInt(process.env.NOVA_AUDIT_LOCK_TTL_MS ?? '300000', 10);

function health(reason) {
  try {
    const path = resolve(logDir, 'audit-health.log');
    ensurePrivateDirectory(logDir);
    appendPrivateFile(path, `${JSON.stringify({ timestamp: new Date().toISOString(), status: 'degraded', reason: sanitizeAuditField(reason, 160) })}\n`);
  } catch { /* best effort */ }
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
  const lockStats = lstatSync(lockDir);
  if (lockStats.isSymbolicLink() || !lockStats.isDirectory()) throw new Error('audit compaction lock is not a real directory');
  let owner = null;
  try {
    owner = JSON.parse(readPrivateFile(lockOwnerPath).content);
  } catch (error) {
    if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error;
    /* legacy or interrupted lock */
  }
  const lockAgeMs = owner?.startedAt
    ? Date.now() - Date.parse(owner.startedAt)
    : Date.now() - lockStats.mtimeMs;
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
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let recovered;
      try {
        recovered = recoverStaleLock();
      } catch (recoveryError) {
        if (recoveryError.code === 'ENOENT') continue;
        throw recoveryError;
      }
      if (!recovered) return false;
      continue;
    }
    try {
      appendPrivateFile(lockOwnerPath, `${JSON.stringify({
        pid: process.pid,
        startedAt: new Date().toISOString(),
        host: hostname(),
        processStartIdentity: processStartIdentity(process.pid) ?? `${process.pid}:${Math.trunc(Date.now() - process.uptime() * 1000)}`,
      })}\n`);
      return true;
    } catch (error) {
      rmSync(lockDir, { recursive: true, force: true });
      throw error;
    }
  }
}

if (process.env.NOVA_AUDIT_DISABLED === '1') process.exit(0);

let locked = false;
try {
  ensurePrivateDirectory(logDir);
  locked = acquireLock();
  if (!locked) process.exit(0);
  ensurePrivateDirectory(spoolDir);
  const logFile = resolve(logDir, 'audit.log');
  const records = readdirSync(spoolDir).filter((name) => name.endsWith('.json')).sort();
  const logStats = assertPrivateRegularFile(logFile, { allowMissing: true });
  if (records.length && logStats?.size > 5_242_880) {
    assertPrivateRegularFile(`${logFile}.1`, { allowMissing: true });
    renameSync(logFile, `${logFile}.1`);
  }
  appendPrivateFile(logFile, '');
  for (const name of records) {
    const path = resolve(spoolDir, name);
    const { content: raw, stats } = readPrivateFile(path);
    JSON.parse(raw);
    appendPrivateFile(logFile, raw.endsWith('\n') ? raw : `${raw}\n`);
    const current = assertPrivateRegularFile(path);
    if (current.dev !== stats.dev || current.ino !== stats.ino) throw new Error(`audit spool record changed during compaction: ${name}`);
    unlinkSync(path);
  }
} catch (error) {
  health(error.message);
  process.exitCode = 1;
} finally {
  if (locked) rmSync(lockDir, { recursive: true, force: true });
}
