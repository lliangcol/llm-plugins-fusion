#!/usr/bin/env node
/**
 * Scan distributable repository content for high-risk private data signals.
 *
 * This is a release-oriented guardrail. It uses strong token, endpoint, path,
 * and runtime-env patterns, and always redacts matched source text from output.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const scriptPath = fileURLToPath(import.meta.url);

export const DEFAULT_ALLOWLIST_PATH = 'scripts/distribution-risk.allowlist.json';

const skipDirs = new Set([
  '.git',
  '.codex',
  '.cache',
  '.idea',
  '.vite',
  '.vscode',
  'node_modules',
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
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

const historicalSegments = [
  ['.claude', 'agents', 'archive'],
  ['docs', 'reports', 'archive'],
  ['nova-plugin', 'docs', 'history'],
];

export const checks = [
  {
    label: 'private key block',
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  },
  {
    label: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: 'GitHub token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  },
  {
    label: 'AWS access key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    label: 'Slack token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
  {
    label: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    label: 'npm token',
    pattern: /\bnpm_[A-Za-z0-9]{36,}\b/g,
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
    label: 'hard-coded secret assignment',
    pattern: /\b(?:password|secret|api[_-]?key|access[_-]?token|private[_-]?key)\b\s*[:=]\s*["'][^"']{6,}["']/gi,
  },
  {
    label: 'machine-local absolute path',
    pattern: /\b[A-Za-z]:\\(?!Path\\To\\)(?:Users|Projects|Work|Repos|Source|dev|Code|workspace|Downloads|Desktop)\\[^\s`"')<>]+/g,
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

function shouldSkipDir(rootDir, absPath) {
  const name = rel(rootDir, absPath).split('/').at(-1);
  return skipDirs.has(name) || name.startsWith('.runtime-smoke-');
}

function shouldReadFile(fileName) {
  const ext = extname(fileName).toLowerCase();
  return textExtensions.has(ext) || fileName.startsWith('.env');
}

function walk(rootDir, dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(rootDir, abs)) walk(rootDir, abs, files);
    } else if (entry.isFile() && shouldReadFile(entry.name)) {
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
  return new Set(entries
    .filter((entry) => typeof entry?.path === 'string' && typeof entry?.label === 'string')
    .map((entry) => `${entry.path.replace(/\\/g, '/')}::${entry.label}`));
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

  if (historical) {
    warnings.push({ ...item, scope: allowlisted ? 'allowlisted historical' : 'historical' });
  } else {
    errors.push({ ...item, scope: 'active' });
  }
}

function recordPathFinding({ rootDir, relPath, label, errors }) {
  errors.push({
    path: relPath,
    line: 1,
    label,
    redacted: '<redacted>',
    scope: 'active',
  });
}

export function formatFinding(finding) {
  const prefix = finding.scope ? `${finding.scope} ` : '';
  return `${prefix}${finding.path}:${finding.line} ${finding.label}: ${finding.redacted}`;
}

function trackedCodexArtifacts(rootDir) {
  const result = spawnSync('git', ['ls-files', '-z', '--', '.codex'], {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0 || !result.stdout) return [];
  return result.stdout.split('\0').filter(Boolean).map((path) => path.replace(/\\/g, '/'));
}

export function scanDistributionRisk(options = {}) {
  const rootDir = resolve(options.rootDir ?? defaultRoot);
  const allowlist = loadAllowlist(rootDir, options.allowlistPath ?? DEFAULT_ALLOWLIST_PATH);
  const errors = [];
  const warnings = [];

  for (const artifact of trackedCodexArtifacts(rootDir)) {
    recordPathFinding({
      rootDir,
      relPath: artifact,
      label: 'tracked Codex runtime artifact',
      errors,
    });
  }

  for (const file of walk(rootDir, rootDir)) {
    let src;
    try {
      const stats = statSync(file);
      if (stats.size > 1024 * 1024) continue;
      src = readFileSync(file, 'utf8');
    } catch {
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

function runCli() {
  const { errors, warnings } = scanDistributionRisk({ rootDir: defaultRoot });

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
  process.exitCode = runCli();
}
