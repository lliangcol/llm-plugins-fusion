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
import { resolve } from 'node:path';
import { sanitizeAuditField } from '../../runtime/secret-rules.mjs';

const stateHome = process.env.XDG_STATE_HOME || resolve(process.env.HOME || process.env.USERPROFILE || '/tmp', '.local/state');
const logDir = process.env.CLAUDE_PLUGIN_DATA || resolve(stateHome, 'nova-plugin');
const spoolDir = resolve(logDir, 'audit-spool');
const lockDir = resolve(logDir, '.audit-compact.lock');

function health(reason) {
  try {
    writeFileSync(resolve(logDir, 'audit-health.log'), `${JSON.stringify({ timestamp: new Date().toISOString(), status: 'degraded', reason: sanitizeAuditField(reason, 160) })}\n`, { flag: 'a', encoding: 'utf8' });
  } catch { /* best effort */ }
}

function chmodBestEffort(path, mode) {
  try { chmodSync(path, mode); } catch { /* platform may not support POSIX modes */ }
}

if (process.env.NOVA_AUDIT_DISABLED === '1') process.exit(0);

let locked = false;
try {
  mkdirSync(logDir, { recursive: true, mode: 0o700 });
  try {
    mkdirSync(lockDir);
    locked = true;
  } catch (error) {
    if (error.code === 'EEXIST') process.exit(0);
    throw error;
  }
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
