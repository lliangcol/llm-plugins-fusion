#!/usr/bin/env node
/** Default-deny validation command broker for Bash PreToolUse events. */

import { createHash } from 'node:crypto';
import { accessSync, constants, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, posix, relative, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertArtifactRootsOutsideExecutableSearch,
  configuredArtifactRoots,
  resolveGitControlDirectories,
} from '../../runtime/safe-workspace-path.mjs';
import { inspectProjectHookSettings } from '../../runtime/hook-bootstrap-trust.mjs';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const defaultPolicyPath = resolve(moduleDir, '../../runtime/shell-command-policy.json');
function trustedExecutableToken(token) {
  if (typeof token !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/iu.test(token)) return null;
  if (token.includes('/') || token.includes('\\')) return null;
  return token.toLowerCase();
}

const executableEnvironmentDenyRules = Object.freeze({
  git: Object.freeze({
    // Git exposes a broad, evolving GIT_* environment API. Several variables
    // can redirect repository/config lookup or launch helpers despite safe
    // argv (for example GIT_CONFIG_PARAMETERS can set diff.external). Keep the
    // broker fail-closed for the entire namespace instead of maintaining a
    // necessarily incomplete denylist.
    exact: Object.freeze(['PAGER']),
    prefixes: Object.freeze(['GIT_']),
  }),
  rg: Object.freeze({
    exact: Object.freeze(['RIPGREP_CONFIG_PATH']),
    prefixes: Object.freeze([]),
  }),
});

function isLiteralCatPager(executable, variable, value) {
  return trustedExecutableToken(executable) === 'git'
    && (variable === 'GIT_PAGER' || variable === 'PAGER')
    && value === 'cat';
}

/**
 * Return inherited variables that can change the selected executable's behavior
 * or launch another program despite an otherwise read-only argv policy.
 *
 * @param {string} executable
 * @param {NodeJS.ProcessEnv} [env]
 */
export function rejectedEnvironmentForExecutable(executable, env = process.env) {
  const rule = executableEnvironmentDenyRules[trustedExecutableToken(executable)];
  if (!rule) return [];
  const exact = new Set(rule.exact);
  return Object.keys(env)
    .filter((variable) => {
      const normalized = variable.toUpperCase();
      if (isLiteralCatPager(executable, normalized, env[variable])) return false;
      return exact.has(normalized) || rule.prefixes.some((prefix) => normalized.startsWith(prefix));
    })
    .sort();
}

function tokenizeDetailed(command) {
  const tokens = [];
  let token = '';
  let quote = null;
  let escaped = false;
  let started = false;
  let expansion = false;
  let composition = false;
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
      else {
        if (quote === '"' && (character === '$' || character === '`')) expansion = true;
        token += character;
      }
      started = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      started = true;
      continue;
    }
    if (character === '\r' || character === '\n') composition = true;
    if (/\s/u.test(character)) {
      if (started) {
        tokens.push({ value: token, expansion, composition });
        token = '';
        started = false;
        expansion = false;
        composition = character === '\r' || character === '\n';
      }
      continue;
    }
    if (/[;&|<>`]/u.test(character)) composition = true;
    if (/[$*?\[\]{}]/u.test(character) || (character === '~' && !started)) expansion = true;
    if (/\p{Cc}/u.test(character)) composition = true;
    token += character;
    started = true;
  }
  if (quote) throw new Error('unterminated shell quote');
  if (escaped) throw new Error('trailing shell escape');
  if (started) tokens.push({ value: token, expansion, composition });
  return tokens;
}

export function tokenizeShellCommand(command) {
  return tokenizeDetailed(command).map((token) => token.value);
}

function readBasePolicy(path = defaultPolicyPath) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pathInside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

const gitHelperConfigKeys = Object.freeze({
  core: new Set(['fsmonitor', 'hookspath', 'pager']),
  diff: new Set(['command', 'external', 'textconv']),
  extensions: new Set(['partialclone', 'worktreeconfig']),
  // Worktree comparisons in status, diff, ls-files, and describe dirtiness
  // checks can apply clean/process filters selected by .gitattributes.
  filter: new Set(['clean', 'process']),
  format: new Set(['pretty']),
  gpg: new Set(['program']),
  include: '*',
  includeif: '*',
  // log.showSignature invokes the signature verifier during an allowed log.
  log: new Set(['showsignature']),
  pager: '*',
  pretty: '*',
  remote: new Set(['partialclonefilter', 'promisor']),
  submodule: '*',
});

function unquotedGitConfigValue(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  return trimmed;
}

const guardedGitSubcommands = new Set(['status', 'diff', 'show', 'log', 'rev-parse', 'describe', 'ls-files']);

function guardedGitConfigKey(section, key) {
  const guarded = gitHelperConfigKeys[section];
  return guarded === '*' || guarded?.has(key) === true;
}

function gitConfigBoolean(value) {
  const match = /^\s*"?(1|0|true|false|yes|no|on|off)"?\s*(?:[#;].*)?$/iu.exec(value);
  if (!match) return null;
  return /^(?:1|true|yes|on)$/iu.test(match[1]);
}

function gitConfigEntryCanInvokeHelper(section, key, rawValue, subcommand) {
  if (!guardedGitConfigKey(section, key)) return false;
  const value = unquotedGitConfigValue(rawValue);
  const booleanFalse = gitConfigBoolean(rawValue) === false;
  if ((section === 'pager' || (section === 'log' && key === 'showsignature')) && booleanFalse) return false;
  if (section === 'core' && key === 'fsmonitor' && booleanFalse) return false;
  if (section === 'extensions' && key === 'worktreeconfig') return false;
  if (section === 'remote' && key === 'promisor' && booleanFalse) return false;
  if (section !== 'include' && section !== 'includeif' && value === '') return false;
  if (!guardedGitSubcommands.has(subcommand)) return true;
  if (section === 'include' || section === 'includeif') return true;
  if (section === 'extensions' || section === 'remote') return true;
  if (section === 'submodule') return ['status', 'diff'].includes(subcommand);
  if (section === 'core' && key === 'hookspath') return ['status', 'diff', 'ls-files'].includes(subcommand);
  if (section === 'pager') return key === subcommand;
  if (section === 'core' && key === 'pager') return ['diff', 'show', 'log'].includes(subcommand);
  if (section === 'core' && key === 'fsmonitor') return ['status', 'diff', 'ls-files'].includes(subcommand);
  if (section === 'diff' && key === 'textconv') return ['diff', 'show', 'log'].includes(subcommand);
  if (section === 'diff') return subcommand === 'diff';
  if (section === 'filter') return ['status', 'diff', 'describe', 'ls-files'].includes(subcommand);
  if (section === 'format' || section === 'gpg' || section === 'pretty') return ['show', 'log'].includes(subcommand);
  if (section === 'log') return ['show', 'log'].includes(subcommand);
  return true;
}

function gitConfigValueContinues(value) {
  let quoted = false;
  let escaped = false;
  let contentEnd = value.length;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) { escaped = false; continue; }
    if (character === '\\') { escaped = true; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && (character === '#' || character === ';')) { contentEnd = index; break; }
  }
  return /(?:^|[^\\])(?:\\\\)*\\$/u.test(value.slice(0, contentEnd));
}

function ripgrepPathCandidates(tokens) {
  const candidates = [];
  let literalOperands = false;
  for (const token of tokens.slice(1)) {
    if (token === '--') {
      literalOperands = true;
      continue;
    }
    if (literalOperands || (token !== '-' && !token.startsWith('-'))) {
      candidates.push(token);
      continue;
    }
    for (const prefix of ['--file=', '--ignore-file=']) {
      if (token.startsWith(prefix) && token.length > prefix.length) candidates.push(token.slice(prefix.length));
    }
    if (/^-f[^-].+/u.test(token)) candidates.push(token.slice(2));
  }
  return [...new Set(candidates.filter((candidate) => candidate && candidate !== '-'))];
}

function ripgrepReadBoundaryFindings(tokens, projectRoot, effectiveCwd) {
  const findings = [];
  try {
    const physicalProjectRoot = realpathSync(projectRoot);
    const physicalEffectiveCwd = realpathSync(effectiveCwd);
    for (const candidate of ripgrepPathCandidates(tokens)) {
      const target = resolve(physicalEffectiveCwd, candidate);
      if (!pathInside(physicalProjectRoot, target)) {
        findings.push(`ripgrep read path escapes the project root: ${candidate}`);
        continue;
      }
      const rel = relative(physicalProjectRoot, target);
      let current = physicalProjectRoot;
      let exists = true;
      for (const part of rel.split(/[\\/]/u).filter(Boolean)) {
        current = resolve(current, part);
        const stats = lstatSync(current, { throwIfNoEntry: false });
        if (!stats) {
          exists = false;
          break;
        }
        if (stats.isSymbolicLink()) {
          findings.push(`ripgrep read path contains a symlink or junction: ${candidate}`);
          exists = false;
          break;
        }
      }
      if (exists && !pathInside(physicalProjectRoot, realpathSync(target))) {
        findings.push(`ripgrep read path resolves outside the project root: ${candidate}`);
      }
    }
  } catch (error) {
    findings.push(`ripgrep read paths could not be inspected safely: ${error.message}`);
  }
  return findings;
}

function gitGlobalConfigPaths(env) {
  const home = env.HOME || (process.platform === 'win32' ? env.USERPROFILE : null);
  const paths = [];
  if (home) {
    if (!isAbsolute(home) && !posix.isAbsolute(home) && !win32.isAbsolute(home)) {
      throw new Error('HOME must be absolute before guarded Git execution');
    }
    paths.push(resolve(home, '.gitconfig'));
  }
  const xdg = env.XDG_CONFIG_HOME || (home ? resolve(home, '.config') : null);
  if (xdg && !isAbsolute(xdg) && !posix.isAbsolute(xdg) && !win32.isAbsolute(xdg)) {
    throw new Error('XDG_CONFIG_HOME must be absolute before guarded Git execution');
  }
  if (xdg) paths.push(resolve(xdg, 'git/config'));
  return [...new Set(paths)];
}

function readGitConfigEntries(path) {
  const before = lstatSync(path, { throwIfNoEntry: false });
  if (!before) return [];
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
    throw new Error('Git config is not a single-link regular physical file');
  }
  if (before.size > 1024 * 1024) throw new Error('Git config exceeds the inspection limit');
  const lines = readFileSync(path, 'utf8').replace(/^\uFEFF/u, '').split(/\r?\n/u);
  const after = lstatSync(path);
  if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1
    || before.dev !== after.dev || before.ino !== after.ino || before.mode !== after.mode
    || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
    throw new Error('Git config changed identity while it was inspected');
  }
  let section = null;
  let ignoringContinuation = false;
  const entries = [];
  for (const [index, line] of lines.entries()) {
    if (ignoringContinuation) {
      ignoringContinuation = gitConfigValueContinues(line);
      continue;
    }
    if (!line.trim() || /^\s*[#;]/u.test(line)) continue;
    const sectionMatch = /^\s*\[\s*([A-Za-z0-9.-]+)(?:\s+"(?:[^"\\]|\\.)*")?\s*\]\s*(?:[#;].*)?$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].toLowerCase().split('.')[0];
      continue;
    }
    const keyMatch = /^\s*([A-Za-z][A-Za-z0-9-]*)\s*(?:=(.*))?$/u.exec(line);
    if (!section || !keyMatch) {
      if (section && gitHelperConfigKeys[section] === undefined) {
        ignoringContinuation = gitConfigValueContinues(line);
        continue;
      }
      throw new Error(`repository-local Git config cannot be parsed on line ${index + 1}`);
    }
    const key = keyMatch[1].toLowerCase();
    const value = keyMatch[2] ?? 'true';
    const relevant = guardedGitConfigKey(section, key);
    if (gitConfigValueContinues(value)) {
      if (relevant) throw new Error(`repository-local Git config uses a continuation for ${section}.${key} on line ${index + 1}`);
      ignoringContinuation = true;
      continue;
    }
    if (relevant) entries.push({ section, key, value });
  }
  return entries;
}

function gitWorktreeConfigEnabled(path) {
  const settings = readGitConfigEntries(path)
    .filter(({ section, key }) => section === 'extensions' && key === 'worktreeconfig');
  if (settings.length === 0) return false;
  const value = settings.at(-1).value;
  const enabled = gitConfigBoolean(value);
  if (enabled === null) throw new Error('extensions.worktreeConfig is not a supported boolean value');
  return enabled;
}

function helperKeysInGitConfig(path, subcommand) {
  return readGitConfigEntries(path)
    .filter(({ section, key, value }) => gitConfigEntryCanInvokeHelper(section, key, value, subcommand))
    .map(({ section, key }) => `${section}.${key}`);
}

export function repositoryGitConfigFindings(projectRoot, subcommand = null, {
  effectiveCwd = projectRoot,
  env = process.env,
} = {}) {
  try {
    const physicalProjectRoot = realpathSync(projectRoot);
    const physicalEffectiveCwd = realpathSync(effectiveCwd);
    if (!pathInside(physicalProjectRoot, physicalEffectiveCwd)) {
      throw new Error('Git cwd is outside the project root');
    }
    const metadata = resolveGitControlDirectories(physicalEffectiveCwd);
    const repositoryRoot = metadata?.repositoryRoot ?? null;
    if (repositoryRoot && !pathInside(physicalProjectRoot, repositoryRoot)) {
      return ['Git would discover repository metadata outside the project root'];
    }
    const configPaths = [];
    if (metadata) {
      const commonConfig = join(metadata.commonDir, 'config');
      configPaths.push(commonConfig);
      if (gitWorktreeConfigEnabled(commonConfig)) configPaths.push(join(metadata.gitDir, 'config.worktree'));
    }
    const findings = [
      ...gitGlobalConfigPaths(env).flatMap((path) => helperKeysInGitConfig(path, subcommand))
        .map((key) => `user Git config can invoke a helper via ${key}`),
      ...[...new Set(configPaths)].flatMap((path) => helperKeysInGitConfig(path, subcommand))
        .map((key) => `repository-local Git config can invoke a helper via ${key}`),
    ];
    if (subcommand === null || ['status', 'diff'].includes(subcommand)) {
      const gitmodules = resolve(repositoryRoot ?? physicalProjectRoot, '.gitmodules');
      const gitmodulesStats = lstatSync(gitmodules, { throwIfNoEntry: false });
      if (gitmodulesStats) findings.push('repository submodules can execute nested Git hooks or helpers during status or diff');
      if (metadata?.commonDir) {
        const modulesDirectory = join(metadata.commonDir, 'modules');
        const modulesStats = lstatSync(modulesDirectory, { throwIfNoEntry: false });
        if (modulesStats) findings.push('initialized repository submodules can execute nested Git hooks or helpers during status or diff');
      }
    }
    if (subcommand === null || ['status', 'diff', 'ls-files'].includes(subcommand)) {
      if (metadata?.commonDir) {
        const hooksDirectory = join(metadata.commonDir, 'hooks');
        const hooksStats = lstatSync(hooksDirectory, { throwIfNoEntry: false });
        if (hooksStats?.isSymbolicLink() || (hooksStats && !hooksStats.isDirectory())) {
          findings.push('repository Git hooks directory is not a physical directory');
        } else if (hooksStats) {
          const hook = join(hooksDirectory, 'post-index-change');
          if (lstatSync(hook, { throwIfNoEntry: false })) {
            findings.push('repository Git hook post-index-change can execute during status or diff');
          }
        }
      }
    }
    return findings;
  } catch (error) {
    return [`repository-local Git configuration could not be inspected safely: ${error.message}`];
  }
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
  let raw;
  try { raw = readFileSync(real, 'utf8'); policy = JSON.parse(raw); } catch (error) { return { policy: null, errors: [`project shell policy is invalid JSON: ${error.message}`] }; }
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
  return { policy: errors.length ? null : policy, errors, digest: createHash('sha256').update(raw).digest('hex') };
}

/** @param {string} token @param {{workspaceRoot?: string, effectiveCwd?: string, env?: NodeJS.ProcessEnv}} [options] */
function executableIdentity(token, { workspaceRoot = process.cwd(), effectiveCwd = workspaceRoot, env = process.env } = {}) {
  const physicalWorkspaceRoot = realpathSync(workspaceRoot);
  const physicalEffectiveCwd = realpathSync(effectiveCwd);
  const pathEntries = String(env.PATH ?? '').split(delimiter);
  const names = [token];
  if (process.platform === 'win32') {
    names.length = 0;
    for (const extension of String(env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)) {
      names.push(token.toLowerCase().endsWith(extension.toLowerCase()) ? token : `${token}${extension.toLowerCase()}`);
    }
  }
  for (const entry of pathEntries) {
    for (const name of names) {
      // Shells interpret relative and empty PATH entries from the command cwd.
      const candidate = resolve(physicalEffectiveCwd, entry, name);
      const stats = statSync(candidate, { throwIfNoEntry: false });
      if (!stats?.isFile()) continue;
      try { accessSync(candidate, constants.X_OK); } catch { continue; }
      const real = realpathSync.native(candidate);
      if (pathInside(physicalWorkspaceRoot, candidate) || pathInside(physicalWorkspaceRoot, real)) {
        throw new Error(`executable resolves inside the workspace: ${token}`);
      }
      return { real, dev: stats.dev, ino: stats.ino };
    }
  }
  throw new Error(`executable was not found on PATH: ${token}`);
}

function pinSessionPolicy({ sessionId, workspaceRoot, basePolicy, projectDigest = 'absent', stateRoot = join(tmpdir(), 'nova-shell-policy-sessions') }) {
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/u.test(sessionId)) throw new Error('session_id is required for shell policy pinning');
  const root = realpathSync(workspaceRoot);
  const key = createHash('sha256').update(`${root}\0${sessionId}`).digest('hex');
  const policyDigest = createHash('sha256').update(JSON.stringify(basePolicy)).update('\0').update(projectDigest).digest('hex');
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const statePath = join(stateRoot, `${key}.json`);
  const expected = `${JSON.stringify({ schemaVersion: 1, policyDigest })}\n`;
  try {
    writeFileSync(statePath, expected, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (readFileSync(statePath, 'utf8') !== expected) throw new Error('shell policy changed after the session policy was pinned');
  }
}

function matchesForbiddenGitArgument(argument, forbidden) {
  if (argument === forbidden || argument.startsWith(`${forbidden}=`)) return true;
  if (!forbidden.startsWith('--') || !argument.startsWith('--')) return false;
  const equals = argument.indexOf('=');
  const option = equals === -1 ? argument : argument.slice(0, equals);
  return option.length > 2 && option.length < forbidden.length && forbidden.startsWith(option);
}

function matchesRule(tokens, rule) {
  const executable = trustedExecutableToken(tokens[0]);
  if (!executable) return false;
  if (rule.type === 'exact-tail') {
    return rule.executables.includes(executable) && rule.tails.some((tail) => JSON.stringify(tokens.slice(1)) === JSON.stringify(tail));
  }
  if (rule.type === 'git-subcommand') {
    if (executable !== 'git' || !rule.subcommands.includes(tokens[1])) return false;
    if (['log', 'show'].includes(tokens[1]) && tokens.slice(2).some((arg) => /%G(?:[A-Za-z?])/u.test(arg))) return false;
    return !tokens.slice(2).some((arg) => rule.forbiddenArguments
      .some((forbidden) => matchesForbiddenGitArgument(arg, forbidden)));
  }
  if (rule.type === 'read-only-executable') {
    if (!rule.executables.includes(executable)) return false;
    if (executable === 'rg' && tokens.slice(1).some((arg) => /^-(?!-)[A-Za-z0-9]*L[A-Za-z0-9]*$/u.test(arg))) return false;
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

/**
 * @param {string} command
 * @param {{projectRoot?: string, workspaceRoot?: string, effectiveCwd?: string, artifactRoots?: string[], basePolicy?: any, sessionId?: string | null, stateRoot?: string, env?: NodeJS.ProcessEnv}} [options]
 */
export function authorizeBashCommand(command, options = {}) {
  const {
    basePolicy = readBasePolicy(),
    sessionId = null,
    stateRoot,
    env = process.env,
  } = options;
  const projectRoot = resolve(options.projectRoot ?? options.workspaceRoot ?? process.cwd());
  const effectiveCwd = resolve(options.effectiveCwd ?? projectRoot);
  const reasons = [];
  const projectSettingsTrust = inspectProjectHookSettings(projectRoot);
  if (!projectSettingsTrust.trusted) reasons.push(...projectSettingsTrust.findings);
  try {
    const artifactRoots = options.artifactRoots ?? configuredArtifactRoots(env);
    assertArtifactRootsOutsideExecutableSearch({ artifactRoots, cwd: effectiveCwd, projectRoot, env });
  } catch (error) {
    reasons.push(`explicit artifact root conflicts with executable trust: ${error.message}`);
  }
  if (typeof command !== 'string' || command.trim() === '') return { allowed: false, source: null, ruleId: null, reasons: ['Bash command must be a non-empty string'] };
  if (Buffer.byteLength(command, 'utf8') > basePolicy.maxCommandBytes) reasons.push('command exceeds the guarded size limit');
  if (/[\r\n]/u.test(command)) reasons.push('shell composition, expansion, redirection, pipes, or command substitution are not allowed');
  let detailedTokens = [];
  let tokens = [];
  try {
    detailedTokens = tokenizeDetailed(command.trim());
    tokens = detailedTokens.map((token) => token.value);
  } catch (error) { reasons.push(error.message); }
  if (detailedTokens.some((token) => token.composition || token.expansion)) {
    reasons.push('shell composition, expansion, redirection, pipes, or command substitution are not allowed');
  }
  if (tokens[0] && /^[A-Za-z_][A-Za-z0-9_]*=/u.test(tokens[0])) reasons.push('environment assignment prefixes are not allowed');
  if (tokens[0] && !trustedExecutableToken(tokens[0])) reasons.push('executable must be a bare trusted command token without path semantics');
  for (const variable of ['BASH_ENV', 'ENV']) {
    if (Object.hasOwn(env, variable)) reasons.push(`${variable} is not allowed for guarded Bash execution`);
  }
  if (tokens[0]) {
    for (const variable of rejectedEnvironmentForExecutable(tokens[0], env)) {
      reasons.push(`${variable} is not allowed for guarded ${trustedExecutableToken(tokens[0])} execution`);
    }
  }
  const executable = trustedExecutableToken(tokens[0]);
  const usesLiteralCatPager = executable === 'git' && Object.entries(env)
    .some(([variable, value]) => isLiteralCatPager(executable, variable.toUpperCase(), value));
  if (usesLiteralCatPager) {
    if (Object.hasOwn(env, 'BASH_FUNC_cat%%')) {
      reasons.push('exported Bash function overrides the trusted Git pager: cat');
    } else {
      try {
        executableIdentity('cat', { workspaceRoot: projectRoot, effectiveCwd, env });
      } catch (error) {
        reasons.push(`trusted Git pager cat could not be resolved safely: ${error.message}`);
      }
    }
  }
  if (tokens[0] && Object.hasOwn(env, `BASH_FUNC_${tokens[0]}%%`)) reasons.push(`exported Bash function overrides executable resolution: ${tokens[0]}`);
  if (tokens.slice(1).some((token) => isAbsolute(token) || posix.isAbsolute(token) || win32.isAbsolute(token) || token.split(/[\\/]/u).includes('..'))) reasons.push('absolute or parent-traversal arguments are not allowed');
  try {
    const physicalProjectRoot = realpathSync(projectRoot);
    const physicalEffectiveCwd = realpathSync(effectiveCwd);
    if (!pathInside(physicalProjectRoot, physicalEffectiveCwd)) reasons.push('Bash cwd is outside the project root');
  } catch (error) {
    reasons.push(`Bash project root or cwd could not be resolved: ${error.message}`);
  }
  if (executable === 'git' && !['--version', '-v'].includes(tokens[1])) {
    reasons.push(...repositoryGitConfigFindings(projectRoot, tokens[1], { effectiveCwd, env }));
  }
  if (executable === 'rg' && !['--version', '-v'].includes(tokens[1])) {
    reasons.push(...ripgrepReadBoundaryFindings(tokens, projectRoot, effectiveCwd));
  }
  if (reasons.length) return { allowed: false, source: null, ruleId: null, reasons: [...new Set(reasons)] };

  try { executableIdentity(tokens[0], { workspaceRoot: projectRoot, effectiveCwd, env }); } catch (error) { reasons.push(error.message); }

  const project = loadProjectPolicy(projectRoot, basePolicy.projectPolicyPath);
  if (project.errors.length) reasons.push(...project.errors);
  if (sessionId) {
    try { pinSessionPolicy({ sessionId, workspaceRoot: projectRoot, basePolicy, projectDigest: project.digest, stateRoot }); } catch (error) { reasons.push(error.message); }
  }
  if (reasons.length) return { allowed: false, source: null, ruleId: null, reasons: [...new Set(reasons)] };

  for (const rule of basePolicy.rules) {
    if (matchesRule(tokens, rule)) return { allowed: true, source: 'distributed-policy', ruleId: rule.id, reasons: [] };
  }

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
  const projectRoot = resolve(process.env.CLAUDE_PROJECT_DIR || payload?.cwd || process.cwd());
  const effectiveCwd = resolve(payload?.cwd || projectRoot);
  const decision = authorizeBashCommand(payload?.tool_input?.command, { projectRoot, effectiveCwd, sessionId: payload?.session_id });
  if (!decision.allowed) block(decision.reasons);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
