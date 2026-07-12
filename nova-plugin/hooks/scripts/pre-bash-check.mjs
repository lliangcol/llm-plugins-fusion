#!/usr/bin/env node
/** Default-deny validation command broker for Bash PreToolUse events. */

import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultPolicyPath = resolve(moduleDir, '../../runtime/shell-command-policy.json');
const lexicalHazards = /[;&|<>`\r\n]/u;

function executableName(token = '') {
  return basename(token).toLowerCase();
}

export function tokenizeShellCommand(command) {
  const tokens = [];
  let token = '';
  let quote = null;
  let escaped = false;
  let started = false;
  for (const character of command) {
    if (escaped) {
      token += character;
      escaped = false;
      started = true;
      continue;
    }
    if (character === '\\' && quote !== "'") {
      escaped = true;
      started = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
      started = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      started = true;
      continue;
    }
    if (/\s/u.test(character)) {
      if (started) {
        tokens.push(token);
        token = '';
        started = false;
      }
      continue;
    }
    token += character;
    started = true;
  }
  if (quote) throw new Error('unterminated shell quote');
  if (escaped) throw new Error('trailing shell escape');
  if (started) tokens.push(token);
  return tokens;
}

function readBasePolicy(path = defaultPolicyPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pathInside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function loadProjectPolicy(workspaceRoot, relativePath) {
  const root = realpathSync(workspaceRoot);
  const path = resolve(root, relativePath);
  const stats = lstatSync(path, { throwIfNoEntry: false });
  if (!stats) return { policy: null, errors: [] };
  if (!stats.isFile() || stats.isSymbolicLink()) return { policy: null, errors: ['project shell policy must be a regular non-symlink file'] };
  const real = realpathSync(path);
  if (!pathInside(root, real)) return { policy: null, errors: ['project shell policy resolves outside the workspace'] };
  let policy;
  try { policy = JSON.parse(readFileSync(real, 'utf8')); } catch (error) { return { policy: null, errors: [`project shell policy is invalid JSON: ${error.message}`] }; }
  const errors = [];
  if (policy.schemaVersion !== 1) errors.push('project shell policy schemaVersion must be 1');
  if (!Array.isArray(policy.allowCommands)) errors.push('project shell policy allowCommands must be an array');
  const allowedKeys = new Set(['$schema', 'schemaVersion', 'allowCommands']);
  for (const key of Object.keys(policy)) if (!allowedKeys.has(key)) errors.push(`project shell policy contains unsupported key ${key}`);
  for (const [index, entry] of (policy.allowCommands ?? []).entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(`allowCommands[${index}] must be an object`); continue; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(entry.id ?? '')) errors.push(`allowCommands[${index}].id is invalid`);
    if (!Array.isArray(entry.argv) || entry.argv.length === 0 || entry.argv.some((value) => typeof value !== 'string' || value.length === 0)) errors.push(`allowCommands[${index}].argv must be a non-empty string array`);
    if (typeof entry.purpose !== 'string' || entry.purpose.length === 0) errors.push(`allowCommands[${index}].purpose is required`);
    for (const key of Object.keys(entry)) if (!['id', 'argv', 'purpose'].includes(key)) errors.push(`allowCommands[${index}] contains unsupported key ${key}`);
  }
  return { policy: errors.length ? null : policy, errors };
}

function matchesRule(tokens, rule) {
  const executable = executableName(tokens[0]);
  if (rule.type === 'exact-tail') {
    return rule.executables.includes(executable) && rule.tails.some((tail) => JSON.stringify(tokens.slice(1)) === JSON.stringify(tail));
  }
  if (rule.type === 'git-subcommand') {
    if (executable !== 'git' || !rule.subcommands.includes(tokens[1])) return false;
    return !tokens.slice(2).some((arg) => rule.forbiddenArguments.some((forbidden) => arg === forbidden || arg.startsWith(`${forbidden}=`)));
  }
  if (rule.type === 'read-only-executable') {
    if (!rule.executables.includes(executable)) return false;
    return !tokens.slice(1).some((arg) => rule.forbiddenArguments.some((forbidden) => arg === forbidden || arg.startsWith(`${forbidden}=`)));
  }
  if (rule.type === 'syntax-check') {
    return executable === rule.executable
      && JSON.stringify(tokens.slice(1, 1 + rule.requiredPrefix.length)) === JSON.stringify(rule.requiredPrefix)
      && tokens.length > 1 + rule.requiredPrefix.length
      && tokens.slice(1 + rule.requiredPrefix.length).every((arg) => arg && !arg.startsWith('-'));
  }
  return false;
}

export function authorizeBashCommand(command, { workspaceRoot = process.cwd(), basePolicy = readBasePolicy() } = {}) {
  const reasons = [];
  if (typeof command !== 'string' || command.trim() === '') return { allowed: false, source: null, ruleId: null, reasons: ['Bash command must be a non-empty string'] };
  if (Buffer.byteLength(command, 'utf8') > basePolicy.maxCommandBytes) reasons.push('command exceeds the guarded size limit');
  if (lexicalHazards.test(command) || /\$\(|\$\{|\$[A-Za-z_]/u.test(command)) reasons.push('shell composition, expansion, redirection, pipes, or command substitution are not allowed');
  let tokens = [];
  try { tokens = tokenizeShellCommand(command.trim()); } catch (error) { reasons.push(error.message); }
  if (tokens[0] && /^[A-Za-z_][A-Za-z0-9_]*=/u.test(tokens[0])) reasons.push('environment assignment prefixes are not allowed');
  if (tokens.slice(1).some((token) => isAbsolute(token) || token.split(/[\\/]/u).includes('..'))) reasons.push('absolute or parent-traversal arguments are not allowed');
  if (reasons.length) return { allowed: false, source: null, ruleId: null, reasons: [...new Set(reasons)] };

  for (const rule of basePolicy.rules) {
    if (matchesRule(tokens, rule)) return { allowed: true, source: 'distributed-policy', ruleId: rule.id, reasons: [] };
  }

  const project = loadProjectPolicy(workspaceRoot, basePolicy.projectPolicyPath);
  if (project.errors.length) return { allowed: false, source: null, ruleId: null, reasons: project.errors };
  for (const entry of project.policy?.allowCommands ?? []) {
    if (JSON.stringify(tokens) === JSON.stringify(entry.argv)) return { allowed: true, source: 'project-exact-policy', ruleId: entry.id, reasons: [] };
  }
  return { allowed: false, source: null, ruleId: null, reasons: ['command is not allow-listed by the distributed broker or exact project policy'] };
}

export function validateBashCommand(command, options) {
  return authorizeBashCommand(command, options).reasons;
}

function block(reasons) {
  console.error('[nova-plugin] Bash command was denied by the default-deny validation command broker.');
  for (const reason of reasons) console.error(`  ${reason}`);
  console.error('  Add an exact argv entry to .nova/shell-policy.json after repository review, or run the command outside this workflow after explicit review. Normal Bash permission checks still apply to allowed commands.');
  process.exit(2);
}

function main() {
  let payload;
  try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { block(['hook payload is not valid JSON']); }
  if (payload?.tool_name !== 'Bash') block([`unexpected tool ${JSON.stringify(payload?.tool_name)}`]);
  const decision = authorizeBashCommand(payload?.tool_input?.command, { workspaceRoot: payload?.cwd ?? process.cwd() });
  if (!decision.allowed) block(decision.reasons);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
