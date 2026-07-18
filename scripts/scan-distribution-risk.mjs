#!/usr/bin/env node
/**
 * Scan distributable repository content for high-risk private data signals.
 *
 * This is a release-oriented guardrail. It uses strong token, endpoint, path,
 * and runtime-env patterns, and always redacts matched source text from output.
 */

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  lstatSync,
  statSync,
} from 'node:fs';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { secretChecks } from '../nova-plugin/runtime/secret-rules.mjs';
import { writeArtifactFileAtomically } from './lib/artifact-output.mjs';
import { gitTrackedFiles } from './lib/git-source-snapshot.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const scriptPath = fileURLToPath(import.meta.url);

export const DEFAULT_ALLOWLIST_PATH = 'scripts/distribution-risk.allowlist.json';

const alwaysSkipDirs = new Set([
  '.git',
  '.codex',
  '.cache',
  '.idea',
  '.vite',
  '.vscode',
  '.metrics',
  'node_modules',
]);

const generatedSkipDirs = new Set([
  'coverage',
  'logs',
  'dist',
  'build',
  'target',
  '.next',
  '.nuxt',
  'out',
  'tmp',
  'temp',
]);

const textExtensions = new Set([
  '',
  '.cjs',
  '.css',
  '.diff',
  '.env',
  '.go',
  '.html',
  '.ini',
  '.java',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.patch',
  '.properties',
  '.ps1',
  '.py',
  '.rb',
  '.rs',
  '.sh',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const binaryExtensions = new Set([
  '.7z', '.avi', '.bmp', '.class', '.dll', '.dylib', '.exe', '.gif', '.gz',
  '.ico', '.jpeg', '.jpg', '.mov', '.mp3', '.mp4', '.o', '.pdf', '.png',
  '.so', '.tar', '.webm', '.webp', '.woff', '.woff2', '.zip',
]);

const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024;
const BINARY_SAMPLE_BYTES = 8192;

const historicalSegments = [
  ['.claude', 'agents', 'archive'],
  ['docs', 'reports', 'archive'],
  ['nova-plugin', 'docs', 'history'],
];

const fatalCredentialLabels = new Set([
  'private key block',
  'OpenAI API key',
  'GitHub token',
  'Slack token',
  'npm token',
  'JWT',
  'AWS access key',
  'Azure storage secret',
  'GCP API key',
  'Authorization bearer',
  'hard-coded secret assignment',
  'real .env value',
]);

const runtimeSecretChecks = secretChecks
  .filter((check) => !['Authorization bearer', 'secret assignment'].includes(check.label))
  .map((check) => ({
    label: check.label,
    pattern: new RegExp(check.pattern.source, check.pattern.flags),
  }));

/**
 * @typedef {object} DistributionCheck
 * @property {string} label
 * @property {RegExp} pattern
 * @property {(relPath: string) => boolean} [fileFilter]
 * @property {(context: {src: string, match: RegExpMatchArray, relPath: string}) => boolean} [matchFilter]
 */

/** @type {DistributionCheck[]} */
export const checks = [
  {
    label: 'private key block',
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  },
  ...runtimeSecretChecks,
  {
    label: 'AWS access key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    label: 'Azure storage secret',
    pattern: /\b(?:AccountKey|azure[_-]?storage[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9+/=]{40,}["']?/gi,
  },
  {
    label: 'GCP API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    label: 'Authorization bearer',
    pattern: /(Authorization:\s*Bearer\s+)[A-Za-z0-9._~+/-]{20,}/gi,
  },
  {
    label: 'hard-coded secret assignment',
    pattern: /\b(?:password|secret|api[_-]?key|access[_-]?token|private[_-]?key)\b\s*[:=]\s*(?:"[^"\r\n]{6,}"|'[^'\r\n]{6,}'|[^\s#'"][^\r\n#]{5,})/gi,
  },
  {
    label: 'machine-local absolute path',
    pattern: /\b[A-Za-z]:\\(?!Path\\To\\)(?:Users|Documents|Projects|Repositories|GitHub|Workbench|Work|Repos|Source|dev|Code|workspace|Downloads|Desktop)\\[^\s`"')<>]+/g,
  },
  {
    label: 'private network address',
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})\b/g,
  },
  {
    label: 'internal endpoint',
    pattern: /\bhttps?:\/\/[^\s)'"`<>]*(?:internal|intranet|corp|\.lan|\.local)[^\s)'"`<>]*/gi,
  },
  {
    label: 'private SSH repository URL',
    pattern: /\b(?:git@|ssh:\/\/git@)[A-Za-z0-9.-]+\.[A-Za-z]{2,}[:/][A-Za-z0-9._~/-]+\.git\b/g,
  },
  {
    label: 'real .env value',
    pattern: /^\s*(?!#)([A-Z][A-Z0-9_]{2,})\s*=\s*(?!(?:<[^>]+>|\$\{[^}]+\}|REPLACE(?:_ME)?|TODO|TBD|CHANGEME|CHANGE_ME|EXAMPLE|PLACEHOLDER|DUMMY|SAMPLE|REDACTED|null|true|false|0|1)\s*$)(?:"[^"\r\n]{8,}"|'[^'\r\n]{8,}'|[^\s#'"][^\r\n#]{7,})/gmi,
    fileFilter: isRuntimeEnvFile,
  },
  {
    label: 'high-risk blanket permission advice',
    pattern: /\b(?:dangerously-skip-permissions|skip[- ]permissions)\b/gi,
    matchFilter: isAffirmativePermissionAdvice,
  },
];

function rel(rootDir, absPath) {
  return relative(rootDir, absPath).split(sep).join('/');
}

function hasPathSegments(rootDir, absPath, segmentGroups) {
  const parts = rel(rootDir, absPath).split('/');
  return segmentGroups.some((segments) => {
    for (let i = 0; i <= parts.length - segments.length; i += 1) {
      if (segments.every((segment, offset) => parts[i + offset] === segment)) {
        return true;
      }
    }
    return false;
  });
}

function isHistorical(rootDir, absPath) {
  return hasPathSegments(rootDir, absPath, historicalSegments);
}

function trackedFiles(rootDir, { required = true } = {}) {
  try {
    const deletedPaths = new Set(gitTrackedFiles(rootDir, { deleted: true }));
    return gitTrackedFiles(rootDir).filter((path) => !deletedPaths.has(path));
  } catch (error) {
    if (!required && /not a git repository/u.test(error?.message ?? '')) return null;
    throw error;
  }
}

function hasTrackedFilesUnder(rootDir, absPath, repositoryFiles) {
  if (repositoryFiles === null) return false;
  const prefix = `${rel(rootDir, absPath).replace(/\/?$/, '/')}`;
  return repositoryFiles.some((path) => path.startsWith(prefix));
}

function shouldSkipDir(rootDir, absPath, repositoryFiles) {
  const name = rel(rootDir, absPath).split('/').at(-1);
  if (alwaysSkipDirs.has(name) || name.startsWith('.runtime-smoke-')) return true;
  if (!generatedSkipDirs.has(name)) return false;
  return !hasTrackedFilesUnder(rootDir, absPath, repositoryFiles);
}

function isTextCandidate(absPath, fileName, size, { strict = false } = {}) {
  const ext = extname(fileName).toLowerCase();
  if (textExtensions.has(ext) || fileName.startsWith('.env')) return true;
  if (binaryExtensions.has(ext)) return false;

  const sample = Buffer.alloc(Math.min(size, BINARY_SAMPLE_BYTES));
  let fd;
  try {
    fd = openSync(absPath, 'r');
    const bytesRead = readSync(fd, sample, 0, sample.length, 0);
    return !sample.subarray(0, bytesRead).includes(0);
  } catch (error) {
    if (strict) throw error;
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function walk(rootDir, dir, repositoryFiles, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(rootDir, abs, repositoryFiles)) walk(rootDir, abs, repositoryFiles, files);
    } else if (entry.isFile()) {
      files.push(abs);
    }
  }
  return files;
}

function lineNumberAt(src, index) {
  return src.slice(0, index).split(/\r?\n/).length;
}

function lineAt(src, index) {
  const start = src.lastIndexOf('\n', index) + 1;
  const end = src.indexOf('\n', index);
  return src.slice(start, end === -1 ? src.length : end);
}

function isRuntimeEnvFile(relPath) {
  const name = basename(relPath).toLowerCase();
  if (!name.startsWith('.env')) return false;
  return !/(?:example|template|sample|dist)$/.test(name);
}

function loadAllowlist(rootDir, relPath = DEFAULT_ALLOWLIST_PATH) {
  const fullPath = resolve(rootDir, relPath);
  if (!existsSync(fullPath)) return new Set();
  const raw = JSON.parse(readFileSync(fullPath, 'utf8'));
  const entries = Array.isArray(raw.warnings) ? raw.warnings : [];
  const now = Date.now();
  return new Set(entries.map((entry) => {
    for (const field of ['path', 'label', 'owner', 'reason', 'createdAt', 'expiresAt', 'issue']) {
      if (typeof entry?.[field] !== 'string' || !entry[field].trim()) {
        throw new Error(`distribution risk allowlist entry requires ${field}`);
      }
    }
    const createdAt = Date.parse(entry.createdAt);
    const expiresAt = Date.parse(entry.expiresAt);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= createdAt) {
      throw new Error(`distribution risk allowlist entry has invalid dates: ${entry.path}`);
    }
    if (expiresAt <= now) throw new Error(`distribution risk allowlist entry expired: ${entry.path}`);
    if (fatalCredentialLabels.has(entry.label)) {
      throw new Error(`credential findings cannot be allowlisted: ${entry.path}::${entry.label}`);
    }
    return `${entry.path.replace(/\\/g, '/')}::${entry.label}`;
  }));
}

function isAllowlistedWarning(rootDir, absPath, label, allowlist) {
  return allowlist.has(`${rel(rootDir, absPath)}::${label}`);
}

function isAffirmativePermissionAdvice({ src, match }) {
  const line = lineAt(src, match.index ?? 0);
  if (/\b(?:do not|don't|never|avoid|not recommend|not recommended|forbid|forbidden|prohibit|prohibited)\b/i.test(line)) {
    return false;
  }
  if (/(?:不建议|不要|不得|禁止|避免)/.test(line)) return false;
  return /\b(?:recommend|recommended|required|requires|use|run|enable|set|默认|推荐|要求|使用|运行|启用)\b/i.test(line);
}

function recordFinding({ rootDir, absPath, src, match, label, allowlist, errors, warnings }) {
  const item = {
    path: rel(rootDir, absPath),
    line: lineNumberAt(src, match.index ?? 0),
    label,
    redacted: '<redacted>',
  };
  const historical = isHistorical(rootDir, absPath);
  const allowlisted = historical && isAllowlistedWarning(rootDir, absPath, label, allowlist);

  if (historical && allowlisted && !fatalCredentialLabels.has(label)) {
    warnings.push({ ...item, scope: 'allowlisted historical' });
  } else {
    errors.push({ ...item, scope: historical ? 'historical' : 'active' });
  }
}

function recordPathFinding({ relPath, label, errors, redacted = '<redacted>' }) {
  errors.push({
    path: relPath,
    line: 1,
    label,
    redacted,
    scope: 'active',
  });
}

export function formatFinding(finding) {
  const prefix = finding.scope ? `${finding.scope} ` : '';
  return `${prefix}${finding.path}:${finding.line} ${finding.label}: ${finding.redacted}`;
}

function trackedCodexArtifacts(repositoryFiles) {
  return repositoryFiles?.filter((path) => path === '.codex' || path.startsWith('.codex/')) ?? [];
}

export function scanDistributionRisk(options = {}) {
  const rootDir = resolve(options.rootDir ?? defaultRoot);
  const mode = options.mode ?? 'workspace';
  if (!['workspace', 'release'].includes(mode)) throw new Error(`unsupported scan mode: ${mode}`);
  const allowlist = loadAllowlist(rootDir, options.allowlistPath ?? DEFAULT_ALLOWLIST_PATH);
  const readTextFile = options.readTextFile ?? readFileSync;
  const errors = [];
  const warnings = [];
  const repositoryFiles = trackedFiles(rootDir, { required: mode === 'release' });

  for (const artifact of trackedCodexArtifacts(repositoryFiles)) {
    recordPathFinding({
      relPath: artifact,
      label: 'tracked Codex runtime artifact',
      errors,
    });
  }

  const files = mode === 'release'
    ? repositoryFiles.map((path) => resolve(rootDir, path))
    : walk(rootDir, rootDir, repositoryFiles);
  for (const file of files) {
    let src;
    try {
      const lstat = lstatSync(file);
      if (lstat.isSymbolicLink()) {
        recordPathFinding({
          relPath: rel(rootDir, file),
          label: 'tracked symbolic link requires distribution review',
          errors,
        });
        continue;
      }
      if (!lstat.isFile()) continue;
      const stats = statSync(file);
      if (!isTextCandidate(file, basename(file), stats.size, { strict: mode === 'release' })) continue;
      if (stats.size > MAX_TEXT_FILE_BYTES) {
        recordPathFinding({
          relPath: rel(rootDir, file),
          label: `oversized text file (${stats.size} bytes; limit ${MAX_TEXT_FILE_BYTES} bytes)`,
          errors,
          redacted: '<not scanned>',
        });
        continue;
      }
      src = readTextFile(file, 'utf8');
    } catch {
      const finding = {
        path: rel(rootDir, file),
        line: 1,
        label: `${mode} file could not be read during distribution scan`,
        redacted: '<not scanned>',
        scope: mode === 'release' ? 'active' : 'workspace',
      };
      if (mode === 'release') errors.push(finding);
      else warnings.push(finding);
      continue;
    }

    const relPath = rel(rootDir, file);
    for (const check of checks) {
      if (check.fileFilter && !check.fileFilter(relPath)) continue;
      check.pattern.lastIndex = 0;
      for (const match of src.matchAll(check.pattern)) {
        if (check.matchFilter && !check.matchFilter({ src, match, relPath })) continue;
        recordFinding({
          rootDir,
          absPath: file,
          src,
          match,
          label: check.label,
          allowlist,
          errors,
          warnings,
        });
      }
    }
  }

  return { errors, warnings };
}

export function distributionRiskSarif({ errors, warnings }) {
  const findings = [...errors.map((finding) => ({ ...finding, level: 'error' })), ...warnings.map((finding) => ({ ...finding, level: 'warning' }))];
  const rules = [...new Set(findings.map((finding) => finding.label))].sort().map((label) => ({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: label,
    shortDescription: { text: label },
  }));
  const ruleIds = new Map(rules.map((rule) => [rule.name, rule.id]));
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'nova-distribution-risk', rules } },
      results: findings.map((finding) => ({
        ruleId: ruleIds.get(finding.label),
        level: finding.level,
        message: { text: `${finding.scope} ${finding.label}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: finding.path }, region: { startLine: finding.line } } }],
      })),
    }],
  };
}

function runCli(args = process.argv.slice(2)) {
  let mode = 'release';
  let sarifPath = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--workspace') mode = 'workspace';
    else if (args[index] === '--sarif') sarifPath = args[++index];
    else {
      console.error('Usage: node scripts/scan-distribution-risk.mjs [--workspace] [--sarif <path>]');
      return 2;
    }
  }
  if (sarifPath == null && args.includes('--sarif')) {
    console.error('ERROR --sarif requires a path');
    return 2;
  }
  const { errors, warnings } = scanDistributionRisk({ rootDir: defaultRoot, mode });
  if (sarifPath) {
    writeArtifactFileAtomically(
      defaultRoot,
      sarifPath,
      `${JSON.stringify(distributionRiskSarif({ errors, warnings }), null, 2)}\n`,
      { label: 'distribution risk SARIF output' },
    );
  }

  if (warnings.length) {
    console.warn('Distribution risk warnings:');
    for (const warning of warnings) console.warn(`  - ${formatFinding(warning)}`);
  }

  if (errors.length) {
    console.error(`Distribution risk scan failed (${errors.length} finding${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`  - ${formatFinding(error)}`);
    return 1;
  }

  console.log('OK distribution risk scan passed');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  process.exitCode = runCli(process.argv.slice(2));
}
