#!/usr/bin/env node
/**
 * Shared secret detection and redaction rules for distributed nova-plugin
 * runtime scripts. Distribution scans may layer public-repository-only checks
 * on top of these token and assignment patterns.
 */

import { basename, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const secretChecks = [
  {
    label: 'OpenAI API key',
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    replacement: '<redacted>',
  },
  {
    label: 'GitHub token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
    replacement: '<redacted>',
  },
  {
    label: 'Slack token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
    replacement: '<redacted>',
  },
  {
    label: 'npm token',
    pattern: /\bnpm_[A-Za-z0-9]{36,}\b/g,
    replacement: '<redacted>',
  },
  {
    label: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: '<redacted>',
  },
  {
    label: 'Authorization bearer',
    pattern: /(Authorization:\s*Bearer\s+)[^\s]+/gi,
    replacement: '$1<redacted>',
  },
  {
    label: 'secret assignment',
    pattern: /\b(password|secret|api[_-]?key|access[_-]?token|auth[_-]?token|bearer[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|npm[_-]?token|github[_-]?token|openai[_-]?api[_-]?key)\b\s*[:=]\s*(?:"[^"]{6,}"|'[^']{6,}'|[^\s#"'=]{16,})/gi,
    replacement: '$1=<redacted>',
  },
];

export function hasSensitiveText(value) {
  return secretChecks.some((check) => {
    check.pattern.lastIndex = 0;
    return check.pattern.test(value);
  });
}

export function redactSensitiveText(value) {
  let redacted = value;
  for (const check of secretChecks) {
    check.pattern.lastIndex = 0;
    redacted = redacted.replace(check.pattern, check.replacement);
  }
  return redacted;
}

export function isSensitivePath(value) {
  const name = basename(String(value)).toLowerCase();
  return (
    name === '.env'
    || name.startsWith('.env.')
    || name.endsWith('.pem')
    || name.endsWith('.key')
    || name === 'id_rsa'
    || name.startsWith('id_rsa.')
    || name === 'id_ed25519'
    || name.startsWith('id_ed25519.')
  );
}

function readStdin() {
  return readFileSync(0, 'utf8');
}

function usage() {
  return [
    'Usage: node nova-plugin/runtime/secret-rules.mjs <command> [args]',
    '',
    'Commands:',
    '  detect-text       Exit 0 when stdin contains a sensitive value; 1 otherwise.',
    '  redact-text       Redact sensitive values from stdin and write stdout.',
    '  detect-file PATH  Exit 0 when PATH contains a sensitive value; 1 otherwise.',
    '  sensitive-path PATH',
    '                    Exit 0 when PATH is a sensitive untracked path; 1 otherwise.',
  ].join('\n');
}

export function main(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (command === '--help' || command === '-h') {
    console.log(usage());
    return 0;
  }

  if (command === 'detect-text') {
    return hasSensitiveText(readStdin()) ? 0 : 1;
  }

  if (command === 'redact-text') {
    process.stdout.write(redactSensitiveText(readStdin()));
    return 0;
  }

  if (command === 'detect-file') {
    const [filePath] = args;
    if (!filePath) {
      console.error('ERROR detect-file requires PATH');
      return 2;
    }
    return hasSensitiveText(readFileSync(filePath, 'utf8')) ? 0 : 1;
  }

  if (command === 'sensitive-path') {
    const [filePath] = args;
    if (!filePath) {
      console.error('ERROR sensitive-path requires PATH');
      return 2;
    }
    return isSensitivePath(filePath) ? 0 : 1;
  }

  console.error(usage());
  return 2;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  process.exit(main());
}
