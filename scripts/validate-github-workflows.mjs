#!/usr/bin/env node
/**
 * Validate GitHub Actions workflow contracts that protect release credibility.
 *
 * This keeps source-owned workflow permission checks separate from Markdown
 * documentation validation, while preserving the public repository boundary:
 * read-only default tokens, no pull_request_target trigger, scoped release
 * writes, and isolated mutating plugin install smoke.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'GitHub workflow validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');

function usage() {
  return 'Usage: node scripts/validate-github-workflows.mjs [--root <repo-root>]';
}

function parseRoot(args) {
  let selectedRoot = defaultRoot;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--root') {
      const value = args[index + 1];
      if (!value) {
        console.error('ERROR --root requires a path');
        console.error(usage());
        process.exit(1);
      }
      selectedRoot = resolve(value);
      index += 1;
      continue;
    }
    console.error(`ERROR unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }
  return selectedRoot;
}

const root = parseRoot(process.argv.slice(2));
const errors = [];
const EXTERNAL_REQUIRED_CHECKS = [
  'Dependency Review',
  'CodeQL / Analyze JavaScript',
];
const WORKFLOW_CONTRACTS = [
  {
    file: '.github/workflows/ci.yml',
    permissions: [['contents', 'read']],
    label: 'CI workflow top-level permissions',
  },
  {
    file: '.github/workflows/reusable-node-check.yml',
    permissions: [['contents', 'read']],
    label: 'reusable node check workflow top-level permissions',
  },
  {
    file: '.github/workflows/plugin-install-smoke.yml',
    permissions: [['contents', 'read']],
    label: 'plugin install smoke workflow top-level permissions',
  },
  {
    file: '.github/workflows/dependency-review.yml',
    permissions: [['contents', 'read'], ['pull-requests', 'read']],
    label: 'dependency review workflow top-level permissions',
  },
  {
    file: '.github/workflows/codeql.yml',
    permissions: [['contents', 'read'], ['security-events', 'write']],
    label: 'CodeQL workflow top-level permissions',
  },
  {
    file: '.github/workflows/release.yml',
    permissions: [['contents', 'read']],
    label: 'release workflow top-level permissions',
  },
];
const EXPECTED_WORKFLOW_FILES = WORKFLOW_CONTRACTS
  .map((workflow) => workflow.file)
  .sort();

function recordError(file, msg) {
  errors.push(`  - ${file}: ${msg}`);
}

function readWorkflow(file) {
  const abs = resolve(root, file);
  if (!existsSync(abs)) {
    recordError(file, 'missing required workflow file');
    return null;
  }
  return readFileSync(abs, 'utf8');
}

function readRequiredFile(file) {
  const abs = resolve(root, file);
  if (!existsSync(abs)) {
    recordError(file, 'missing required file');
    return null;
  }
  return readFileSync(abs, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function lineIndent(line) {
  return line.match(/^ */)?.[0].length ?? 0;
}

function extractYamlBlock(file, src, key, indent, label, searchStart = 0, searchEnd = null) {
  const lines = src.split(/\r?\n/);
  const endIndex = searchEnd ?? lines.length;
  const prefix = ' '.repeat(indent);
  const pattern = new RegExp(`^${prefix}${escapeRegExp(key)}:\\s*$`);
  const startIndex = lines.findIndex((line, index) => (
    index >= searchStart
    && index < endIndex
    && pattern.test(line)
  ));

  if (startIndex === -1) {
    recordError(file, `missing ${label}`);
    return null;
  }

  let blockEnd = startIndex + 1;
  while (blockEnd < endIndex) {
    const line = lines[blockEnd];
    if (line.trim() !== '' && lineIndent(line) <= indent) break;
    blockEnd += 1;
  }

  return {
    start: startIndex,
    end: blockEnd,
    lines: lines.slice(startIndex + 1, blockEnd),
  };
}

function parsePermissionEntries(file, block, indent, label) {
  const expectedIndent = indent + 2;
  const entries = new Map();
  for (const line of block.lines) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const match = line.match(new RegExp(`^ {${expectedIndent}}([A-Za-z0-9_-]+):\\s*(read|write|none)\\s*$`));
    if (!match) {
      recordError(file, `${label} contains unsupported permission syntax: "${line.trim()}"`);
      continue;
    }
    entries.set(match[1], match[2]);
  }
  return entries;
}

function formatPermissionEntries(entries) {
  return [...entries.entries()]
    .map(([key, value]) => `${key}: ${value}`)
    .sort()
    .join(', ');
}

function expectPermissionSet(file, src, key, indent, expected, label, searchStart = 0, searchEnd = null) {
  const block = extractYamlBlock(file, src, key, indent, label, searchStart, searchEnd);
  if (!block) return;

  const actual = parsePermissionEntries(file, block, indent, label);
  const expectedMap = new Map(expected);
  const actualFormatted = formatPermissionEntries(actual);
  const expectedFormatted = formatPermissionEntries(expectedMap);

  for (const [permission, value] of expectedMap.entries()) {
    if (actual.get(permission) !== value) {
      recordError(
        file,
        `${label} has "${actualFormatted || 'none'}"; expected "${expectedFormatted}"`,
      );
      return;
    }
  }

  for (const permission of actual.keys()) {
    if (!expectedMap.has(permission)) {
      recordError(
        file,
        `${label} has unexpected "${permission}: ${actual.get(permission)}"; expected "${expectedFormatted}"`,
      );
      return;
    }
  }
}

function stripYamlScalar(value) {
  const trimmed = value.trim();
  const quoted = trimmed.match(/^(['"])(.*)\1$/);
  return quoted ? quoted[2] : trimmed;
}

function findYamlScalar(lines, key, indent) {
  const pattern = new RegExp(`^ {${indent}}${escapeRegExp(key)}:\\s*(.*?)\\s*$`);
  for (const line of lines) {
    const match = line.match(pattern);
    if (match) return stripYamlScalar(match[1]);
  }
  return null;
}

function uniqueDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function extractCiRequiredChecks() {
  const file = '.github/workflows/ci.yml';
  const src = readWorkflow(file);
  if (!src) return null;

  const jobsBlock = extractYamlBlock(file, src, 'jobs', 0, 'CI jobs block');
  if (!jobsBlock) return null;

  const checks = [];
  const lines = jobsBlock.lines;
  for (let index = 0; index < lines.length;) {
    const jobMatch = lines[index].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (!jobMatch) {
      index += 1;
      continue;
    }

    const jobId = jobMatch[1];
    let jobEnd = index + 1;
    while (jobEnd < lines.length) {
      const line = lines[jobEnd];
      if (line.trim() !== '' && lineIndent(line) <= 2) break;
      jobEnd += 1;
    }

    const jobLines = lines.slice(index + 1, jobEnd);
    const label = findYamlScalar(jobLines, 'label', 6);
    const name = findYamlScalar(jobLines, 'name', 4);
    const checkName = label ?? name;
    if (!checkName) {
      recordError(file, `CI job "${jobId}" must expose a required-check name or label`);
    } else {
      checks.push(checkName);
    }
    index = jobEnd;
  }

  const duplicates = uniqueDuplicates(checks);
  if (duplicates.length > 0) {
    recordError(file, `CI required check labels contain duplicates: ${duplicates.join(', ')}`);
  }

  return checks;
}

function parseSuggestedRequiredChecks() {
  const file = 'docs/maintainers/github-security-settings.md';
  const src = readRequiredFile(file);
  if (!src) return null;

  const match = src.match(/^## Suggested Required Checks\r?\n[\s\S]*?```text\r?\n([\s\S]*?)\r?\n```/m);
  if (!match) {
    recordError(file, 'missing Suggested Required Checks text block');
    return null;
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePrintRequiredChecks() {
  const file = 'scripts/print-github-security-settings.mjs';
  const src = readRequiredFile(file);
  if (!src) return null;

  const arrayMatch = src.match(/const requiredChecks = \[([\s\S]*?)\];/);
  if (!arrayMatch) {
    recordError(file, 'missing requiredChecks array');
    return null;
  }

  return [...arrayMatch[1].matchAll(/['"]([^'"\r\n]+)['"],?/g)].map((match) => match[1]);
}

function formatCheckList(values) {
  return values.join(' | ');
}

function expectRequiredCheckList(file, actual, expected, label) {
  if (!actual) return;

  const duplicates = uniqueDuplicates(actual);
  if (duplicates.length > 0) {
    recordError(file, `${label} contains duplicates: ${duplicates.join(', ')}`);
    return;
  }

  if (
    actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])
  ) {
    recordError(
      file,
      `${label} must match CI workflow coverage plus external checks; actual "${formatCheckList(actual)}"; expected "${formatCheckList(expected)}"`,
    );
  }
}

function expectWorkflowFileList(file, actual, expected, label) {
  if (!actual) return;
  if (
    actual.length !== expected.length
    || actual.some((value, index) => value !== expected[index])
  ) {
    recordError(
      file,
      `${label} must match validate-github-workflows contracts; actual "${formatCheckList(actual)}"; expected "${formatCheckList(expected)}"`,
    );
  }
}

function extractClaudeWorkflowLayout() {
  const file = 'CLAUDE.md';
  const src = readRequiredFile(file);
  if (!src) return null;

  const match = src.match(/^\|-- \.github\/workflows\/\r?\n([\s\S]*?)^\|-- docs\//m);
  if (!match) {
    recordError(file, 'missing .github/workflows repository layout block');
    return null;
  }

  return [...match[1].matchAll(/^\|   (?:\|--|`--)\s+([A-Za-z0-9_.-]+)\s*$/gm)]
    .map((entry) => `.github/workflows/${entry[1]}`)
    .sort();
}

function validateWorkflowInventory() {
  const file = '.github/workflows';
  const workflowsDir = resolve(root, file);
  if (!existsSync(workflowsDir)) {
    recordError(file, 'missing workflow directory');
    return;
  }

  const actualWorkflowFiles = readdirSync(workflowsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => `.github/workflows/${entry.name}`)
    .sort();

  expectWorkflowFileList(
    file,
    actualWorkflowFiles,
    EXPECTED_WORKFLOW_FILES,
    'GitHub workflow file inventory',
  );
  expectWorkflowFileList(
    'CLAUDE.md',
    extractClaudeWorkflowLayout(),
    EXPECTED_WORKFLOW_FILES,
    'CLAUDE repository workflow layout',
  );
}

function validateWorkflowContracts() {
  for (const workflow of WORKFLOW_CONTRACTS) {
    const src = readWorkflow(workflow.file);
    if (!src) continue;
    if (/^\s*pull_request_target\s*:/m.test(src)) {
      recordError(workflow.file, 'workflow trigger safety contract forbids pull_request_target');
    }
    if (/^\s*permissions:\s*(?:write-all|read-all)\s*$/m.test(src)) {
      recordError(workflow.file, 'workflow permission contract forbids broad read-all/write-all shortcuts');
    }
    expectPermissionSet(workflow.file, src, 'permissions', 0, workflow.permissions, workflow.label);
  }

  const releaseFile = '.github/workflows/release.yml';
  const releaseSrc = readWorkflow(releaseFile);
  if (releaseSrc) {
    const releaseJob = extractYamlBlock(
      releaseFile,
      releaseSrc,
      'release',
      2,
      'release job block',
    );
    if (releaseJob) {
      expectPermissionSet(
        releaseFile,
        releaseSrc,
        'permissions',
        4,
        [['contents', 'write']],
        'release job scoped write permission',
        releaseJob.start + 1,
        releaseJob.end,
      );
    }
  }

  const smokeFile = '.github/workflows/plugin-install-smoke.yml';
  const smokeSrc = readWorkflow(smokeFile);
  if (!smokeSrc) return;
  const smokeOnBlock = extractYamlBlock(smokeFile, smokeSrc, 'on', 0, 'plugin install smoke trigger block');
  if (smokeOnBlock) {
    const triggerText = smokeOnBlock.lines.join('\n');
    if (!/^\s+workflow_dispatch\s*:/m.test(triggerText) || !/^\s+schedule\s*:/m.test(triggerText)) {
      recordError(smokeFile, 'plugin install smoke isolation contract requires manual and scheduled triggers');
    }
    if (/^\s+pull_request\s*:/m.test(triggerText) || /^\s+push\s*:/m.test(triggerText)) {
      recordError(smokeFile, 'plugin install smoke isolation contract forbids pull_request or push triggers');
    }
  }
  if (!/node scripts\/validate-plugin-install\.mjs --accept-user-scope-mutation/.test(smokeSrc)) {
    recordError(smokeFile, 'plugin install smoke isolation contract requires explicit user-scope mutation opt-in');
  }
  if (!/disposable runner/i.test(smokeSrc)) {
    recordError(smokeFile, 'plugin install smoke isolation contract requires disposable runner wording');
  }
}

function validateRequiredCheckContracts() {
  const ciChecks = extractCiRequiredChecks();
  if (!ciChecks) return;

  const expectedRequiredChecks = [
    ...ciChecks,
    ...EXTERNAL_REQUIRED_CHECKS,
  ];

  expectRequiredCheckList(
    'docs/maintainers/github-security-settings.md',
    parseSuggestedRequiredChecks(),
    expectedRequiredChecks,
    'GitHub security settings required checks',
  );
  expectRequiredCheckList(
    'scripts/print-github-security-settings.mjs',
    parsePrintRequiredChecks(),
    expectedRequiredChecks,
    'print GitHub security settings required checks',
  );
}

validateWorkflowInventory();
validateWorkflowContracts();
validateRequiredCheckContracts();

if (errors.length) {
  console.error(`GitHub workflow validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log('OK GitHub workflow validation passed');
