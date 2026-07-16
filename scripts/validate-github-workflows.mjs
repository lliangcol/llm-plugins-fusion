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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { inspectGovernedProfile } from './validate-performance-budget.mjs';
import { parseDocument } from 'yaml';

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
      return null;
    }
    if (arg === '--root') {
      const value = requireOptionValue(args, index, '--root');
      selectedRoot = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return selectedRoot;
}

let root = defaultRoot;
let errors = [];
let notices = [];
const PR_GOVERNANCE_CHECK = 'PR Governance';
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
    file: '.github/workflows/pr-governance.yml',
    permissions: [['contents', 'read'], ['pull-requests', 'read']],
    label: 'PR governance workflow top-level permissions',
  },
  {
    file: '.github/workflows/nightly.yml',
    permissions: [['contents', 'read']],
    label: 'nightly workflow top-level permissions',
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
  {
    file: '.github/workflows/release-candidate.yml',
    permissions: [['actions', 'read'], ['contents', 'read'], ['pull-requests', 'read']],
    label: 'release candidate workflow top-level permissions',
  },
  {
    file: '.github/workflows/promote-release.yml',
    permissions: [['contents', 'read']],
    label: 'release promotion workflow top-level permissions',
  },
  {
    file: '.github/workflows/release-recovery-drill.yml',
    permissions: [['contents', 'read'], ['attestations', 'read']],
    label: 'release recovery drill workflow top-level permissions',
  },
];
const EXPECTED_WORKFLOW_FILES = WORKFLOW_CONTRACTS
  .map((workflow) => workflow.file)
  .sort();
const CANDIDATE_PERFORMANCE_PROFILE = 'linux-x64-node22-github-hosted-3-fresh-process-full-uncached';
const CANDIDATE_PERFORMANCE_PROFILE_ENV = '${{ env.CANDIDATE_PERFORMANCE_PROFILE }}';
const CANDIDATE_PERFORMANCE_SAMPLE_MANIFEST = 'governance/evidence/validation-performance-samples.json';
const CANDIDATE_PERFORMANCE_COLLECTION = Object.freeze({
  repository: 'lliangcol/llm-plugins-fusion',
  workflowPath: '.github/workflows/ci.yml',
  workflowRef: 'refs/heads/main',
  jobName: 'Required / Tests',
  artifactName: 'validation-timing-trend',
});
const RELEASE_RUNTIME_WORKFLOW_FILES = [
  '.github/workflows/release-candidate.yml',
  '.github/workflows/promote-release.yml',
];

function recordError(file, msg) {
  errors.push(`  - ${file}: ${msg}`);
}

function recordNotice(message) {
  notices.push(message);
}

export function releaseRefTrustBoundaryErrors(file, model, {
  jobId,
  expectedVerifyTags,
  trustDirectory,
  expectedBootstrapRef,
}) {
  const findings = [];
  const steps = model?.jobs?.[jobId]?.steps ?? [];
  const trustStepIndexes = steps
    .map((step, index) => [step, index])
    .filter(([step]) => String(step.run ?? '').includes('git verify-tag'))
    .map(([, index]) => index);
  if (trustStepIndexes.length !== 1) {
    return [`${file}: job "${jobId}" must have exactly one signed-ref trust step before repository code`];
  }
  const trustIndex = trustStepIndexes[0];
  const trustRun = String(steps[trustIndex].run ?? '');
  const checkoutIndex = steps.findIndex((step) => String(step.uses ?? '').startsWith('actions/checkout@'));
  const firstRunIndex = steps.findIndex((step) => typeof step.run === 'string');
  const localActionBeforeTrustIndex = steps
    .slice(0, trustIndex)
    .findIndex((step) => String(step.uses ?? '').trim().startsWith('./'));
  if (checkoutIndex === -1 || checkoutIndex >= trustIndex) {
    findings.push(`${file}: job "${jobId}" must checkout the selected ref before its signed-ref trust step`);
  } else if (steps[checkoutIndex]?.with?.ref !== expectedBootstrapRef) {
    findings.push(`${file}: job "${jobId}" bootstrap checkout must use trusted workflow ref ${expectedBootstrapRef}`);
  }
  if (firstRunIndex !== trustIndex) {
    findings.push(`${file}: job "${jobId}" signed-ref verification must be its first run step`);
  }
  if (localActionBeforeTrustIndex !== -1) {
    findings.push(`${file}: job "${jobId}" must not execute a repository-local action before signed-ref verification`);
  }
  const requiredTrustFragments = [
    'git fetch --no-tags origin refs/heads/main:refs/remotes/origin/main',
    `git show origin/main:.github/release-signers > "\${RUNNER_TEMP}/${trustDirectory}/release-signers"`,
    `git config gpg.ssh.allowedSignersFile "\${RUNNER_TEMP}/${trustDirectory}/release-signers"`,
    'git merge-base --is-ancestor',
    'git checkout --detach',
  ];
  for (const fragment of requiredTrustFragments) {
    if (!trustRun.includes(fragment)) {
      findings.push(`${file}: job "${jobId}" signed-ref trust step is missing ${fragment}`);
    }
  }
  const verifyTagCount = trustRun.match(/git verify-tag/gu)?.length ?? 0;
  if (verifyTagCount !== expectedVerifyTags) {
    findings.push(`${file}: job "${jobId}" signed-ref trust step must verify exactly ${expectedVerifyTags} tag${expectedVerifyTags === 1 ? '' : 's'}`);
  }
  if (trustRun.lastIndexOf('git checkout --detach') < trustRun.lastIndexOf('git verify-tag')) {
    findings.push(`${file}: job "${jobId}" must verify every signed tag before checking out release source`);
  }
  return findings;
}

export function protectedMainDispatchErrors(file, model, expectedEventType) {
  const findings = [];
  const triggers = model?.on ?? {};
  const triggerNames = Object.keys(triggers).sort();
  if (JSON.stringify(triggerNames) !== JSON.stringify(['repository_dispatch'])) {
    findings.push(`${file}: privileged release entrypoint must use only repository_dispatch from the default branch`);
  }
  const configuredTypes = triggers?.repository_dispatch?.types;
  if (!Array.isArray(configuredTypes)
    || configuredTypes.length !== 1
    || configuredTypes[0] !== expectedEventType) {
    findings.push(`${file}: repository_dispatch must require exact event type ${expectedEventType}`);
  }
  return findings;
}

export function releaseCallerFailClosedErrors(file, caller) {
  if (caller && Object.hasOwn(caller, 'if')) {
    return [`${file}: stable release caller must not skip malformed repository-dispatch payloads with a job-level if`];
  }
  return [];
}

export function promotionTagIdentityErrors(file, model, jobId = 'verify') {
  const findings = [];
  const trustRun = String((model?.jobs?.[jobId]?.steps ?? [])
    .find((step) => String(step.run ?? '').includes('git verify-tag'))?.run ?? '');
  const stableGuard = 'if [[ ! "${STABLE_TAG}" =~ ^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$ ]]; then';
  const candidateGuard = 'if [[ ! "${CANDIDATE_TAG}" =~ ^v(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)-rc\\.(0|[1-9][0-9]*)$ ]]; then';
  const baseGuard = 'if [[ "${CANDIDATE_TAG%%-rc.*}" != "${STABLE_TAG}" ]]; then';
  const guards = [
    [stableGuard, 'strict stable-tag validation'],
    [candidateGuard, 'strict candidate-tag validation'],
    [baseGuard, 'candidate-base equality validation'],
    ['::error::invalid stable release tag:', 'explicit stable-tag failure'],
    ['::error::invalid candidate release tag:', 'explicit candidate-tag failure'],
    ['::error::candidate tag base must equal stable tag', 'explicit candidate-base failure'],
  ];
  for (const [fragment, label] of guards) {
    if (!trustRun.includes(fragment)) findings.push(`${file}: job "${jobId}" trust step is missing ${label}`);
  }
  const orderedGuards = [stableGuard, candidateGuard, baseGuard].map((fragment) => trustRun.indexOf(fragment));
  const firstFetchIndex = trustRun.indexOf('git fetch ');
  if (firstFetchIndex === -1
    || orderedGuards.some((index) => index === -1 || index > firstFetchIndex)
    || !(orderedGuards[0] < orderedGuards[1] && orderedGuards[1] < orderedGuards[2])) {
    findings.push(`${file}: job "${jobId}" must reject malformed and mismatched tags before any fetch`);
  }
  return findings;
}

export function releaseBundleAttestationOrderErrors(file, model, jobId) {
  const findings = [];
  const steps = model?.jobs?.[jobId]?.steps ?? [];
  const script = steps
    .map((step, index) => typeof step.run === 'string' ? `\n# step ${index}\n${step.run}` : '')
    .join('');
  const attestationIndexes = [...script.matchAll(/gh attestation verify "\$\{bundle\}"/gu)]
    .map((match) => match.index);
  const extractMatches = [...script.matchAll(/node scripts\/extract-release-bundle\.mjs/gu)];
  const extractIndex = extractMatches[0]?.index ?? -1;
  const coreReadIndex = script.indexOf('builder_workflow_commit=');
  if (attestationIndexes.length !== 2) {
    findings.push(`${file}: job "${jobId}" must verify the downloaded bundle exactly twice: generic before extraction and digest-bound after core read`);
    return findings;
  }
  if (extractMatches.length !== 1 || coreReadIndex === -1
    || !(attestationIndexes[0] < extractIndex
      && extractIndex < coreReadIndex
      && coreReadIndex < attestationIndexes[1])) {
    findings.push(`${file}: job "${jobId}" must order generic attestation, extraction, candidate workflow digest read, and exact attestation`);
  }
  const genericStepRun = String(steps.find((step) => String(step.run ?? '')
    .includes('gh attestation verify "${bundle}"'))?.run ?? '');
  const genericStepAttestationIndex = genericStepRun.indexOf('gh attestation verify "${bundle}"');
  const genericStepExtractIndex = genericStepRun.indexOf('node scripts/extract-release-bundle.mjs');
  const failClosedIndex = genericStepRun.indexOf('set -euo pipefail');
  const genericCommandRegion = genericStepRun.slice(
    genericStepAttestationIndex,
    genericStepExtractIndex === -1 ? genericStepRun.length : genericStepExtractIndex,
  );
  if (failClosedIndex === -1 || failClosedIndex > genericStepAttestationIndex
    || /\|\|\s*(?:true|:)/u.test(genericCommandRegion)) {
    findings.push(`${file}: job "${jobId}" generic pre-extraction attestation must fail closed before extraction`);
  }
  const genericBlock = script.slice(attestationIndexes[0], attestationIndexes[1]);
  const exactBlock = script.slice(attestationIndexes[1]);
  for (const fragment of [
    '--signer-workflow "${GITHUB_REPOSITORY}/.github/workflows/release-candidate.yml"',
    '--source-ref refs/heads/main',
    '--deny-self-hosted-runners',
  ]) {
    if (!genericBlock.includes(fragment)) findings.push(`${file}: job "${jobId}" generic pre-extraction attestation is missing ${fragment}`);
  }
  if (/--(?:source|signer)-digest/u.test(genericBlock)) {
    findings.push(`${file}: job "${jobId}" generic pre-extraction attestation must not trust a bundle-owned digest`);
  }
  for (const fragment of [
    '--source-ref refs/heads/main',
    '--source-digest "${builder_workflow_commit}"',
    '--signer-digest "${builder_workflow_commit}"',
    '--deny-self-hosted-runners',
  ]) {
    if (!exactBlock.includes(fragment)) findings.push(`${file}: job "${jobId}" exact post-extraction attestation is missing ${fragment}`);
  }
  return findings;
}

function readWorkflow(file) {
  const abs = resolve(root, file);
  if (!existsSync(abs)) {
    recordError(file, 'missing required workflow file');
    return null;
  }
  return readFileSync(abs, 'utf8');
}

function parseWorkflow(file, src) {
  try {
    const document = parseDocument(src, { uniqueKeys: true });
    if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join('; '));
    return document.toJS();
  } catch (error) {
    recordError(file, `workflow YAML AST parse failed: ${error.message}`);
    return null;
  }
}

function allSteps(model) {
  return Object.values(model?.jobs ?? {}).flatMap((job) => job?.steps ?? []);
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

function extractRunScripts(src) {
  const lines = src.split(/\r?\n/);
  const scripts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(\s*)run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1].length;
    const marker = match[2].trim();
    if (marker !== '|' && marker !== '>') {
      scripts.push(match[2]);
      continue;
    }
    const body = [];
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex += 1) {
      const line = lines[bodyIndex];
      if (line.trim() && lineIndent(line) <= indent) break;
      body.push(line);
      index = bodyIndex;
    }
    scripts.push(body.join('\n'));
  }
  return scripts;
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

function parseUsesReference(line) {
  const match = line.match(/^\s*(?:-\s*)?uses:\s*(.*?)\s*(?:#(.*))?$/);
  if (!match) return null;
  return {
    ref: stripYamlScalar(match[1]),
    comment: match[2]?.trim() ?? '',
  };
}

function validatePinnedExternalActions(file, src) {
  const lines = src.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const parsed = parseUsesReference(line);
    if (!parsed) continue;

    if (parsed.ref.startsWith('./')) continue;

    const match = parsed.ref.match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)@(.+)$/);
    if (!match) {
      recordError(file, `line ${index + 1} external action reference "${parsed.ref}" must include an explicit commit SHA`);
      continue;
    }

    const [, action, ref] = match;
    if (!/^[a-f0-9]{40}$/i.test(ref)) {
      recordError(file, `line ${index + 1} external action "${action}" must pin a full 40-character commit SHA instead of "${ref}"`);
      continue;
    }

    if (!/^v[0-9][A-Za-z0-9._-]*\b/.test(parsed.comment)) {
      recordError(file, `line ${index + 1} external action "${action}" must preserve the upstream tag comment, for example "# v1"`);
    }
  }
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

  const required = checks.filter((check) => check === 'Required / Aggregate');
  if (required.length !== 1) recordError(file, 'CI must expose exactly one branch-protection aggregator named "Required / Aggregate"');
  return required;
}

function extractCiJobLines(jobId) {
  const file = '.github/workflows/ci.yml';
  const src = readWorkflow(file);
  if (!src) return null;

  const jobsBlock = extractYamlBlock(file, src, 'jobs', 0, 'CI jobs block');
  if (!jobsBlock) return null;

  const lines = jobsBlock.lines;
  for (let index = 0; index < lines.length;) {
    const jobMatch = lines[index].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (!jobMatch) {
      index += 1;
      continue;
    }

    let jobEnd = index + 1;
    while (jobEnd < lines.length) {
      const line = lines[jobEnd];
      if (line.trim() !== '' && lineIndent(line) <= 2) break;
      jobEnd += 1;
    }

    if (jobMatch[1] === jobId) {
      return lines.slice(index + 1, jobEnd);
    }
    index = jobEnd;
  }

  recordError(file, `missing required CI job "${jobId}"`);
  return null;
}

function validateNpmTestGate() {
  const file = '.github/workflows/ci.yml';
  const jobLines = extractCiJobLines('tests');
  if (!jobLines) return;
  const text = jobLines.join('\n');
  if (!/name:\s*Required \/ Tests/.test(text)) recordError(file, 'tests job must expose "Required / Tests"');
  if (!/run:\s*npm test/.test(text)) recordError(file, 'Required / Tests must run npm test');
  if (!/run:\s*npm run test:coverage:check/.test(text)) recordError(file, 'Required / Tests must run the coverage gate');
  if (!/run:\s*npm run test:mutation:critical/.test(text)) recordError(file, 'Required / Tests must run critical mutation testing');
}

function parseSuggestedRequiredChecks() {
  const file = 'docs/operations/maintainers/github-security.md';
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

function validateCandidatePerformanceContracts(file, model) {
  const configuredProfile = model?.env?.CANDIDATE_PERFORMANCE_PROFILE;
  if (configuredProfile !== CANDIDATE_PERFORMANCE_PROFILE) {
    recordError(file, `candidate workflow must declare exact performance profile ${CANDIDATE_PERFORMANCE_PROFILE} once in top-level env`);
    return;
  }
  const configuredManifest = model?.env?.CANDIDATE_PERFORMANCE_SAMPLE_MANIFEST;
  if (configuredManifest !== CANDIDATE_PERFORMANCE_SAMPLE_MANIFEST) {
    recordError(file, `candidate workflow must declare exact performance sample manifest ${CANDIDATE_PERFORMANCE_SAMPLE_MANIFEST} once in top-level env`);
    return;
  }

  const validateJob = model?.jobs?.validate;
  const steps = validateJob?.steps ?? [];
  const maintainerSteps = steps.filter((step) => String(step.run ?? '').trim() === 'npm run validate:maintainer');
  if (maintainerSteps.length !== 1) {
    recordError(file, 'candidate validation must invoke npm run validate:maintainer exactly once');
    return;
  }

  const maintainerStep = maintainerSteps[0];
  if (maintainerStep.env?.NOVA_REQUIRED_VALIDATION_PROFILE !== CANDIDATE_PERFORMANCE_PROFILE_ENV) {
    recordError(file, 'candidate validation must consume the top-level governed performance profile env');
    return;
  }
  if (maintainerStep.env?.NOVA_RUNNER_CLASS !== 'github-hosted') {
    recordError(file, 'candidate performance evidence must declare the github-hosted runner class');
  }

  const preflightSteps = model?.jobs?.preflight?.steps ?? [];
  const expectedCheck = 'node scripts/validate-performance-budget.mjs --check-profile "${CANDIDATE_PERFORMANCE_PROFILE}" --sample-manifest "${CANDIDATE_PERFORMANCE_SAMPLE_MANIFEST}" --verify-github';
  const profileCheckIndex = preflightSteps.findIndex((step) => String(step.run ?? '').trim() === expectedCheck);
  const trustIndex = preflightSteps.findIndex((step) => String(step.run ?? '').includes('git verify-tag'));
  const reviewIndex = preflightSteps.findIndex((step) => String(step.run ?? '').includes('verify-independent-release-review.mjs'));
  const allProfileChecks = allSteps(model).filter((step) => String(step.run ?? '').includes('validate-performance-budget.mjs --check-profile'));
  if (profileCheckIndex === -1 || allProfileChecks.length !== 1) {
    recordError(file, 'candidate preflight must check the top-level governed performance profile exactly once');
  } else if (trustIndex === -1 || profileCheckIndex <= trustIndex || reviewIndex === -1 || profileCheckIndex >= reviewIndex) {
    recordError(file, 'candidate preflight must verify the signed ref, then fail on a missing performance profile before review and archive work');
  }
  const profileCheck = profileCheckIndex === -1 ? null : preflightSteps[profileCheckIndex];
  if (profileCheck?.env?.GH_TOKEN !== '${{ github.token }}') recordError(file, 'candidate performance preflight must authenticate external GitHub Actions provenance with the job token');
  if (maintainerStep.env?.GH_TOKEN !== '${{ github.token }}') recordError(file, 'candidate observed performance validation must authenticate external GitHub Actions provenance with the job token');

  const policyFile = 'governance/engineering-evidence.json';
  const policySrc = readRequiredFile(policyFile);
  if (!policySrc) return;
  let performancePolicy;
  try {
    performancePolicy = JSON.parse(policySrc).validationPerformance;
  } catch (error) {
    recordError(policyFile, `invalid performance policy JSON: ${error.message}`);
    return;
  }
  if (performancePolicy?.enforcement !== 'profile-required') {
    recordError(policyFile, 'candidate performance contract requires profile-required enforcement');
    return;
  }
  if (!Number.isInteger(performancePolicy.minimumStableSamples) || performancePolicy.minimumStableSamples < 1) {
    recordError(policyFile, 'candidate performance contract requires a positive minimumStableSamples');
    return;
  }
  if (!Array.isArray(performancePolicy.profiles)) {
    recordError(policyFile, 'candidate performance contract requires a governed profiles array');
    return;
  }
  const matches = performancePolicy.profiles.filter((profile) => profile.id === configuredProfile);
  if (matches.length > 1) {
    recordError(policyFile, `candidate performance profile ${configuredProfile} is duplicated`);
    return;
  }
  if (matches.length === 0) {
    recordNotice(`BLOCKED_EXTERNAL_GATE candidate performance profile ${configuredProfile} has no governed budget; exact-tag candidate preflight will fail closed`);
    return;
  }
  if (JSON.stringify(matches[0].collection) !== JSON.stringify(CANDIDATE_PERFORMANCE_COLLECTION)) {
    recordError(policyFile, `candidate performance collection must remain ${JSON.stringify(CANDIDATE_PERFORMANCE_COLLECTION)}`);
    return;
  }
  const collectionWorkflowSrc = readRequiredFile(CANDIDATE_PERFORMANCE_COLLECTION.workflowPath);
  if (!collectionWorkflowSrc) return;
  const collectionWorkflow = parseWorkflow(CANDIDATE_PERFORMANCE_COLLECTION.workflowPath, collectionWorkflowSrc);
  const collectionJobs = Object.values(collectionWorkflow?.jobs ?? {}).filter((job) => job?.name === CANDIDATE_PERFORMANCE_COLLECTION.jobName);
  if (collectionJobs.length !== 1) {
    recordError(CANDIDATE_PERFORMANCE_COLLECTION.workflowPath, `performance collection workflow must contain exactly one ${CANDIDATE_PERFORMANCE_COLLECTION.jobName} job`);
    return;
  }
  const artifactSteps = (collectionJobs[0].steps ?? []).filter((step) => step?.with?.name === CANDIDATE_PERFORMANCE_COLLECTION.artifactName);
  const artifactPaths = String(artifactSteps[0]?.with?.path ?? '').split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
  if (artifactSteps.length !== 1
    || artifactSteps[0]?.with?.['if-no-files-found'] !== 'error'
    || artifactSteps[0]?.with?.['include-hidden-files'] !== true
    || artifactSteps[0]?.with?.['retention-days'] !== 90
    || !artifactPaths.includes('.metrics/validation-timings.json')
    || !artifactPaths.includes('.metrics/validation-timing-trend.json')) {
    recordError(CANDIDATE_PERFORMANCE_COLLECTION.workflowPath, 'performance collection artifact must fail closed, include hidden .metrics files, retain for 90 days, and contain both the raw validation-timings report and its trend projection');
    return;
  }
  const manifestSrc = readRequiredFile(configuredManifest);
  if (!manifestSrc) return;
  let sampleManifest;
  try {
    sampleManifest = JSON.parse(manifestSrc);
  } catch (error) {
    recordError(configuredManifest, `invalid performance sample manifest JSON: ${error.message}`);
    return;
  }
  try {
    const { evidence } = inspectGovernedProfile(performancePolicy, configuredProfile, sampleManifest);
    if (evidence.sampleCount < performancePolicy.minimumStableSamples) {
      recordNotice(`BLOCKED_EXTERNAL_GATE candidate performance profile ${configuredProfile} has only ${evidence.sampleCount}/${performancePolicy.minimumStableSamples} manifest-bound records; exact-tag candidate preflight will fail closed and any future records still require external GitHub verification`);
    }
  } catch (error) {
    recordError(configuredManifest, `candidate performance sample manifest integrity failed: ${error.message}`);
  }
}

function validateWorkflowContracts() {
  for (const workflow of WORKFLOW_CONTRACTS) {
    const src = readWorkflow(workflow.file);
    if (!src) continue;
    const model = parseWorkflow(workflow.file, src);
    validatePinnedExternalActions(workflow.file, src);
    if (/^\s*pull_request_target\s*:/m.test(src)) {
      recordError(workflow.file, 'workflow trigger safety contract forbids pull_request_target');
    }
    if (/^\s*permissions:\s*(?:write-all|read-all)\s*$/m.test(src)) {
      recordError(workflow.file, 'workflow permission contract forbids broad read-all/write-all shortcuts');
    }
    expectPermissionSet(workflow.file, src, 'permissions', 0, workflow.permissions, workflow.label);
    if (allSteps(model).some((step) => typeof step.run === 'string' && /\$\{\{\s*inputs\.command\s*\}\}/u.test(step.run))) {
      recordError(workflow.file, 'workflow must not execute a free shell command input');
    }
    if (allSteps(model).some((step) => typeof step.run === 'string' && /\$\{\{\s*(?:github\.|steps\.[^.]+\.outputs\.)/u.test(step.run))) {
      recordError(workflow.file, 'promotion shell scripts must receive GitHub contexts and step outputs through env');
    }
    if (['.github/workflows/plugin-install-smoke.yml', '.github/workflows/release.yml', '.github/workflows/release-candidate.yml', '.github/workflows/promote-release.yml', '.github/workflows/release-recovery-drill.yml'].includes(workflow.file)) {
      for (const step of allSteps(model).filter((entry) => String(entry.uses ?? '').startsWith('actions/checkout@'))) {
        if (step.with?.['persist-credentials'] !== false) recordError(workflow.file, 'trust-boundary checkout must set persist-credentials: false');
      }
    }
  }

  const releaseFile = '.github/workflows/release.yml';
  const releaseSrc = readWorkflow(releaseFile);
  if (releaseSrc) {
    const model = parseWorkflow(releaseFile, releaseSrc);
    for (const finding of protectedMainDispatchErrors(releaseFile, model, 'promote-release')) errors.push(`  - ${finding}`);
    const caller = model?.jobs?.recover;
    for (const finding of releaseCallerFailClosedErrors(releaseFile, caller)) errors.push(`  - ${finding}`);
    if (caller?.uses !== './.github/workflows/promote-release.yml') recordError(releaseFile, 'stable release trigger must delegate to promote-release.yml');
    if (caller?.with?.['release-tag'] !== '${{ github.event.client_payload.stable_tag }}'
      || caller?.with?.['candidate-tag'] !== '${{ github.event.client_payload.candidate_tag }}') {
      recordError(releaseFile, 'stable release caller must pass both repository-dispatch identities');
    }
    const callerPermissions = caller?.permissions ?? {};
    const expectedCallerPermissions = { contents: 'write', checks: 'read', 'id-token': 'write', attestations: 'write' };
    if (JSON.stringify(callerPermissions) !== JSON.stringify(expectedCallerPermissions)) recordError(releaseFile, 'stable promotion caller scoped permission must be exact');
    if (releaseSrc.includes('secrets: inherit')) recordError(releaseFile, 'stable release caller must not inherit repository secrets');
  }

  const candidateFile = '.github/workflows/release-candidate.yml';
  const candidateSrc = readWorkflow(candidateFile);
  if (candidateSrc) {
    const model = parseWorkflow(candidateFile, candidateSrc);
    for (const finding of protectedMainDispatchErrors(candidateFile, model, 'release-candidate')) errors.push(`  - ${finding}`);
    for (const finding of releaseRefTrustBoundaryErrors(candidateFile, model, {
      jobId: 'preflight',
      expectedVerifyTags: 1,
      trustDirectory: 'candidate-trust',
      expectedBootstrapRef: '${{ github.workflow_sha }}',
    })) errors.push(`  - ${finding}`);
    validateCandidatePerformanceContracts(candidateFile, model);
    if (!model?.jobs?.['claude-package'] || model.jobs['claude-package'].environment) recordError(candidateFile, 'candidate must verify the mutable CLI package in an unprivileged no-secret job');
    if (allSteps(model?.jobs?.['claude-package'] ? { jobs: { only: model.jobs['claude-package'] } } : {}).some((step) => step.env && Object.keys(step.env).some((key) => /TOKEN|SECRET/u.test(key)))) recordError(candidateFile, 'CLI package verification job must not receive secrets');
    if (!model?.jobs?.live?.needs?.includes?.('claude-package')) recordError(candidateFile, 'secret-bearing live job must consume the verified CLI package artifact');
    if (allSteps({ jobs: { live: model?.jobs?.live } }).some((step) => String(step.uses ?? '').startsWith('actions/checkout@'))) recordError(candidateFile, 'secret-bearing live job must not checkout repository credentials or source');
    if (!candidateSrc.includes('build-release-control-bundle.mjs') || !candidateSrc.includes('promotion-intent.json') || !candidateSrc.includes('--control-bundle-manifest')) recordError(candidateFile, 'candidate must bind promotion intent and a content-addressed control bundle');
    if (!candidateSrc.includes('build-candidate-bundle.mjs')) recordError(candidateFile, 'candidate bundle must use the deterministic Node archive builder');
    if (!candidateSrc.includes("NOVA_VALIDATE_WRITE_TIMINGS: '1'")) recordError(candidateFile, 'candidate validation must persist machine-readable validation timings');
    if (!candidateSrc.includes('npm install -g ./cli/claude-code.tgz')) recordError(candidateFile, 'candidate live gate must install the verified Claude package through an explicit local path');
    if (candidateSrc.includes('npm install -g ./cli/claude-code.tgz --ignore-scripts')) recordError(candidateFile, 'candidate live gate must allow the verified Claude package to install its native binary');
    if (!candidateSrc.includes('marketplace.canary.json')
      || !candidateSrc.includes('--expected-ref "${CANDIDATE_TAG}"')
      || !candidateSrc.includes('--expected-commit "${SOURCE_COMMIT}"')
      || !candidateSrc.includes('--evidence-source "lliangcol/llm-plugins-fusion@${CANDIDATE_TAG}"')) {
      recordError(candidateFile, 'candidate live gate must bind its temporary marketplace to preflight-verified tag and commit outputs');
    }
    for (const required of [
      'WORKFLOW_SOURCE_COMMIT: ${{ github.workflow_sha }}',
      'test "${TRIGGER_REF}" = refs/heads/main',
      'test "${TRIGGER_COMMIT}" = "${WORKFLOW_SOURCE_COMMIT}"',
      'release-candidate.yml@refs/heads/main',
      '--workflow-source-commit "${WORKFLOW_SOURCE_COMMIT}"',
    ]) {
      if (!candidateSrc.includes(required)) recordError(candidateFile, `candidate protected-main bootstrap is missing ${required}`);
    }
    if (!candidateSrc.includes('.metrics/nova-plugin-*-evidence-bundle.tar.gz') || !candidateSrc.includes('include-hidden-files: true') || !candidateSrc.includes('if-no-files-found: error')) recordError(candidateFile, 'candidate evidence bundle upload must select explicit hidden files and fail closed when absent');
    if (!candidateSrc.includes('test "$(find .metrics/candidate-publish -maxdepth 1 -type f | wc -l | tr -d \' \')" -eq 3')) recordError(candidateFile, 'candidate publication must expose exactly archive, checksums, and one evidence bundle');
    if (/ANTHROPIC_API_KEY/u.test(candidateSrc)) recordError(candidateFile, 'candidate live gate must not use ANTHROPIC_API_KEY');
  }

  const promotionFile = '.github/workflows/promote-release.yml';
  const promotionSrc = readWorkflow(promotionFile);
  if (promotionSrc) {
    const model = parseWorkflow(promotionFile, promotionSrc);
    for (const finding of releaseRefTrustBoundaryErrors(promotionFile, model, {
      jobId: 'verify',
      expectedVerifyTags: 2,
      trustDirectory: 'promotion-trust',
      expectedBootstrapRef: '${{ github.workflow_sha }}',
    })) errors.push(`  - ${finding}`);
    for (const finding of promotionTagIdentityErrors(promotionFile, model)) errors.push(`  - ${finding}`);
    for (const finding of releaseBundleAttestationOrderErrors(promotionFile, model, 'verify')) errors.push(`  - ${finding}`);
    const inputs = model?.on?.workflow_call?.inputs ?? {};
    if (!inputs['release-tag']?.required || !inputs['candidate-tag']?.required) recordError(promotionFile, 'promotion must require exact stable and candidate tags');
    if (/latest matching candidate|tail -n 1|sort -V/u.test(promotionSrc)) recordError(promotionFile, 'promotion must not infer the latest matching candidate');
    if (/Stage reviewed recovery verifier|Restore reviewed recovery verifier|cp scripts\/lib\/release-candidate/u.test(promotionSrc)) recordError(promotionFile, 'promotion must not mix current-main control with immutable release source');
    for (const required of ['extract-release-bundle.mjs', 'verify-release-promotion.mjs', 'release-orchestrator.mjs', 'reconcile-github-release.mjs', '--candidate-core', '--promotion-intent', '--control-bundle-manifest', '--candidate-verification-passed', 'governance/evidence/*.md', 'gh api', 'releases/tags/${CANDIDATE_TAG}', '--repository "${GITHUB_REPOSITORY}"', '--candidate-release-metadata', '--observation-evidence-out', 'candidate-observation.json "${handoff}/"']) {
      if (!promotionSrc.includes(required)) recordError(promotionFile, `promotion is missing state-machine control ${required}`);
    }
    for (const required of [
      'promote-release.yml@refs/heads/main',
      '--source-ref refs/heads/main',
      '--source-digest "${builder_workflow_commit}"',
      '--signer-digest "${builder_workflow_commit}"',
      '--deny-self-hosted-runners',
    ]) {
      if (!promotionSrc.includes(required)) recordError(promotionFile, `promotion builder provenance verification is missing ${required}`);
    }
    const verifyJob = model?.jobs?.verify;
    const publishJob = model?.jobs?.publish;
    if (!verifyJob || !publishJob || publishJob.needs !== 'verify') recordError(promotionFile, 'promotion must split verify and publish into ordered jobs');
    for (const [jobId, job] of Object.entries(model?.jobs ?? {})) {
      if (job?.permissions?.contents === 'write' && jobId !== 'publish') recordError(promotionFile, `only the publish job may receive contents write, found ${jobId}`);
    }
    if (verifyJob?.permissions?.contents !== 'read' || publishJob?.permissions?.contents !== 'write' || Object.keys(publishJob?.permissions ?? {}).length !== 1) recordError(promotionFile, 'verify must be read-only and publish must have only contents write');
    const publishText = JSON.stringify(publishJob ?? {});
    if (/npm (?:ci|install)|actions\/checkout/u.test(publishText)) recordError(promotionFile, 'publish job must not checkout source or install npm dependencies');
    for (const required of ['verified-promotion-handoff-', 'handoff.sha256', 'sha256sum -c', 'actions/upload-artifact@', 'actions/download-artifact@']) {
      if (!promotionSrc.includes(required)) recordError(promotionFile, `promotion digest-bound handoff is missing ${required}`);
    }
    if (!promotionSrc.includes('test "$(find "${handoff}/publish" -maxdepth 1 -type f | wc -l | tr -d \' \')" -eq 3')) recordError(promotionFile, 'stable publication must expose exactly archive, checksums, and one evidence bundle');
    for (const required of ["RELEASE_PROMOTION: '1'", 'CANDIDATE_TAG: ${{ inputs.candidate-tag }}', 'SOURCE_COMMIT: ${{ steps.identity.outputs.commit }}']) {
      if (!promotionSrc.includes(required)) recordError(promotionFile, `promotion release notes are missing exact fact input ${required}`);
    }
  }

  const recoveryFile = '.github/workflows/release-recovery-drill.yml';
  const recoverySrc = readWorkflow(recoveryFile);
  if (recoverySrc) {
    const model = parseWorkflow(recoveryFile, recoverySrc);
    for (const finding of protectedMainDispatchErrors(recoveryFile, model, 'release-recovery-drill')) errors.push(`  - ${finding}`);
    for (const finding of releaseRefTrustBoundaryErrors(recoveryFile, model, {
      jobId: 'recover',
      expectedVerifyTags: 1,
      trustDirectory: 'recovery-trust',
      expectedBootstrapRef: '${{ github.workflow_sha }}',
    })) errors.push(`  - ${finding}`);
    for (const finding of releaseBundleAttestationOrderErrors(recoveryFile, model, 'recover')) errors.push(`  - ${finding}`);
    for (const required of [
      'release-recovery-drill.yml@refs/heads/main',
      '--source-ref refs/heads/main',
      '--source-digest "${builder_workflow_commit}"',
      '--signer-digest "${builder_workflow_commit}"',
      '--deny-self-hosted-runners',
      '--candidate-release-metadata',
      '--observation-evidence-out',
    ]) {
      if (!recoverySrc.includes(required)) recordError(recoveryFile, `recovery builder provenance verification is missing ${required}`);
    }
  }

  const routeSmokeFile = 'scripts/validate-plugin-route-live.mjs';
  const routeSmokeSrc = readRequiredFile(routeSmokeFile);
  if (routeSmokeSrc) {
    if (!/CLAUDE_CODE_OAUTH_TOKEN/.test(routeSmokeSrc)) {
      recordError(routeSmokeFile, 'live route gate must require CLAUDE_CODE_OAUTH_TOKEN');
    }
    if (/['"]--bare['"]/.test(routeSmokeSrc)) {
      recordError(routeSmokeFile, 'OAuth live route gate must not invoke Claude with --bare');
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
  if (!/node scripts\/validate-plugin-install\.mjs --accept-user-scope-mutation --isolated-home/.test(smokeSrc)) {
    recordError(smokeFile, 'plugin install smoke isolation contract requires isolated home mode');
  }
  if (!/disposable runner/i.test(smokeSrc)) {
    recordError(smokeFile, 'plugin install smoke isolation contract requires disposable runner wording');
  }
  if (!/GH_REPO:\s*\$\{\{\s*github\.repository\s*\}\}/.test(smokeSrc)) {
    recordError(smokeFile, 'plugin install smoke issue reporter must bind GH_REPO outside a Git checkout');
  }

  const dependencyAuditFile = '.github/workflows/nightly.yml';
  const dependencyAuditSrc = readWorkflow(dependencyAuditFile);
  if (!dependencyAuditSrc) return;
  const dependencyAuditOnBlock = extractYamlBlock(dependencyAuditFile, dependencyAuditSrc, 'on', 0, 'dependency audit trigger block');
  if (dependencyAuditOnBlock) {
    const triggerText = dependencyAuditOnBlock.lines.join('\n');
    if (!/^\s+workflow_dispatch\s*:/m.test(triggerText) || !/^\s+schedule\s*:/m.test(triggerText)) {
      recordError(dependencyAuditFile, 'dependency audit requires manual and scheduled triggers');
    }
    if (/^\s+(?:pull_request|push)\s*:/m.test(triggerText)) {
      recordError(dependencyAuditFile, 'nightly maintenance must not duplicate pull-request or push dependency review');
    }
  }
  for (const required of [
    'timeout-minutes: 15',
    'node-version: 24',
    'npm ci --ignore-scripts',
    'node scripts/audit-dependencies.mjs --write',
    'if: always()',
    'governance/dependency-governance.json',
    'docs/generated/dependency-audit.md',
  ]) {
    if (!dependencyAuditSrc.includes(required)) recordError(dependencyAuditFile, `dependency audit evidence contract requires ${required}`);
  }

  const labelSyncFile = '.github/workflows/pr-governance.yml';
  const labelSyncSrc = readWorkflow(labelSyncFile);
  if (!labelSyncSrc) return;
  const labelSyncModel = parseWorkflow(labelSyncFile, labelSyncSrc);
  const labelJob = labelSyncModel?.jobs?.['label-sync'];
  if (!labelJob) recordError(labelSyncFile, 'PR governance workflow must include the label-sync maintenance job');
  else {
    if (JSON.stringify(labelJob.permissions) !== JSON.stringify({ contents: 'read', issues: 'write' })) recordError(labelSyncFile, 'label-sync job permissions must be exactly contents:read and issues:write');
    if (!String(labelJob.if ?? '').includes("github.event_name == 'push'") || !String(labelJob.if ?? '').includes("github.event_name == 'workflow_dispatch'")) recordError(labelSyncFile, 'label-sync job must run only for push or manual dispatch');
  }
  for (const required of [
    'workflow_dispatch:',
    "branches: [main]",
    "'.github/labels.yml'",
    "'.github/workflows/pr-governance.yml'",
    'node scripts/sync-github-labels.mjs --apply',
    'GH_TOKEN: ${{ github.token }}',
  ]) {
    if (!labelSyncSrc.includes(required)) recordError(labelSyncFile, `label sync contract requires ${required}`);
  }

  const dependencyReviewFile = '.github/workflows/dependency-review.yml';
  const dependencyReviewSrc = readWorkflow(dependencyReviewFile);
  if (!dependencyReviewSrc) return;
  const dependencyPolicyFile = 'governance/dependency-governance.json';
  const dependencyPolicySrc = readRequiredFile(dependencyPolicyFile);
  if (!dependencyPolicySrc) return;
  let dependencyPolicy;
  try {
    dependencyPolicy = JSON.parse(dependencyPolicySrc).policy;
  } catch (error) {
    recordError(dependencyPolicyFile, `invalid dependency policy JSON: ${error.message}`);
    return;
  }
  if (typeof dependencyPolicy.failOnSeverity !== 'string'
    || !Array.isArray(dependencyPolicy.deniedLicenses)
    || typeof dependencyPolicy.commentSummaryInPr !== 'string') {
    recordError(dependencyPolicyFile, 'dependency policy is missing required review fields');
    return;
  }
  if (!/BASE_REPOSITORY:\s*\$\{\{\s*github\.event\.pull_request\.base\.repo\.full_name\s*\}\}/.test(dependencyReviewSrc)) {
    recordError(dependencyReviewFile, 'dependency review fail-closed contract requires base repository identity');
  }
  if (!/HEAD_REPOSITORY:\s*\$\{\{\s*github\.event\.pull_request\.head\.repo\.full_name\s*\}\}/.test(dependencyReviewSrc)) {
    recordError(dependencyReviewFile, 'dependency review fail-closed contract requires head repository identity');
  }
  if (!/\[\s*"\$\{HEAD_REPOSITORY\}"\s*!=\s*"\$\{BASE_REPOSITORY\}"\s*\]/.test(dependencyReviewSrc)) {
    recordError(dependencyReviewFile, 'dependency review fail-closed contract may warning-skip only fork PRs');
  }
  if (!/Dependency graph is unavailable for protected same-repository PR/.test(dependencyReviewSrc)) {
    recordError(dependencyReviewFile, 'dependency review fail-closed contract requires same-repository PR failure text');
  }
  if (!/Dependency review is blocked for this fork PR[\s\S]*maintainer security approval is required/.test(dependencyReviewSrc)) {
    recordError(dependencyReviewFile, 'dependency review fail-closed contract requires fork blocked maintainer approval text');
  }
  const configuredSeverity = dependencyReviewSrc.match(/^\s*fail-on-severity:\s*(\S+)\s*$/mu)?.[1];
  if (configuredSeverity !== dependencyPolicy.failOnSeverity) {
    recordError(dependencyReviewFile, `dependency review severity must match ${dependencyPolicyFile}`);
  }
  const deniedLicenses = dependencyReviewSrc.match(/^\s*deny-licenses:\s*(.+)$/mu)?.[1]
    ?.split(',')
    .map((license) => license.trim());
  if (!deniedLicenses || JSON.stringify([...deniedLicenses].sort()) !== JSON.stringify([...dependencyPolicy.deniedLicenses].sort())) {
    recordError(dependencyReviewFile, `dependency review denied licenses must match ${dependencyPolicyFile}`);
  }
  const configuredSummary = dependencyReviewSrc.match(/^\s*comment-summary-in-pr:\s*(\S+)\s*$/mu)?.[1];
  if (configuredSummary !== dependencyPolicy.commentSummaryInPr) {
    recordError(dependencyReviewFile, `dependency review summary mode must match ${dependencyPolicyFile}`);
  }
}

function validateRequiredCheckContracts() {
  const ciChecks = extractCiRequiredChecks();
  if (!ciChecks) return;

  validateNpmTestGate();

  const expectedRequiredChecks = [
    ...ciChecks,
    PR_GOVERNANCE_CHECK,
    ...EXTERNAL_REQUIRED_CHECKS,
  ];

  expectRequiredCheckList(
    'docs/operations/maintainers/github-security.md',
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

function validatePrGovernanceContracts() {
  const workflowFile = '.github/workflows/pr-governance.yml';
  const workflowSrc = readWorkflow(workflowFile);
  if (workflowSrc) {
    const model = parseWorkflow(workflowFile, workflowSrc);
    const triggers = model?.on ?? {};
    const pullRequestTypes = triggers?.pull_request?.types ?? [];
    const reviewTypes = triggers?.pull_request_review?.types ?? [];
    for (const type of ['opened', 'edited', 'synchronize', 'reopened', 'ready_for_review']) {
      if (!pullRequestTypes.includes(type)) recordError(workflowFile, `PR governance trigger is missing pull_request type ${type}`);
    }
    for (const type of ['submitted', 'edited', 'dismissed']) {
      if (!reviewTypes.includes(type)) recordError(workflowFile, `PR governance trigger is missing pull_request_review type ${type}`);
    }
    if (triggers.pull_request_target) recordError(workflowFile, 'PR governance must not use pull_request_target');
    const job = model?.jobs?.governance;
    if (job?.name !== PR_GOVERNANCE_CHECK) recordError(workflowFile, `governance job must expose stable check name "${PR_GOVERNANCE_CHECK}"`);
    if (job?.['timeout-minutes'] !== 5) recordError(workflowFile, 'PR governance must retain its five-minute lightweight timeout');
    const steps = job?.steps ?? [];
    const checkout = steps.find((step) => String(step.uses ?? '').startsWith('actions/checkout@'));
    if (checkout?.with?.['persist-credentials'] !== false) recordError(workflowFile, 'PR governance checkout must not persist Git credentials');
    const setupNode = steps.find((step) => String(step.uses ?? '').startsWith('actions/setup-node@'));
    if (String(setupNode?.with?.['node-version']) !== '22') recordError(workflowFile, 'PR governance must run on the minimum supported Node 22');
    if (!steps.some((step) => step.run === 'node scripts/validate-pr-governance.mjs')) recordError(workflowFile, 'PR governance must invoke the source-owned validator with fixed argv');
    if (!String(job?.if ?? '').includes("github.event_name == 'pull_request'") || !String(job?.if ?? '').includes("github.event_name == 'pull_request_review'")) recordError(workflowFile, 'PR governance job must remain isolated to pull-request and review lifecycle events');
  }

  const templateFile = '.github/pull_request_template.md';
  const template = readRequiredFile(templateFile);
  if (template) {
    for (const heading of ['Summary', 'Why', 'Maintainer Owner', 'Risk', 'Validation Results', 'Large Change Exception']) {
      if (!new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, 'mu').test(template)) recordError(templateFile, `missing machine-validated section "${heading}"`);
    }
    for (const field of ['Status:', 'Reason:', 'Owner:']) {
      if (!template.includes(field)) recordError(templateFile, `large change exception is missing ${field}`);
    }
    if (!template.includes('bash -n nova-plugin/hooks/scripts/pre-bash-check.sh')) recordError(templateFile, 'Bash syntax checklist must include pre-bash-check.sh');
    if (!template.includes('bash -n nova-plugin/hooks/scripts/trusted-node-hook.sh')) recordError(templateFile, 'Bash syntax checklist must include trusted-node-hook.sh');
  }

  const ownersFile = '.github/CODEOWNERS';
  const owners = readRequiredFile(ownersFile);
  if (owners) {
    for (const path of ['/scripts/validate-github-workflows.mjs', '/scripts/validate-pr-governance.mjs', '/scripts/lib/pr-governance.mjs']) {
      if (!owners.includes(path)) recordError(ownersFile, `PR governance policy surface must have an explicit code owner: ${path}`);
    }

    const reviewerFile = 'governance/release-reviewers.json';
    const reviewerSrc = readRequiredFile(reviewerFile);
    if (reviewerSrc) {
      try {
        const reviewerPolicy = JSON.parse(reviewerSrc);
        const trustedOwners = new Set([
          ...(reviewerPolicy.trustedUsers ?? []).map((user) => `@${user}`),
          ...(reviewerPolicy.trustedTeams ?? []).map((team) => `@${team}`),
        ]);
        const configuredOwners = new Set(
          owners
            .split(/\r?\n/u)
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith('#'))
            .flatMap((line) => line.split(/\s+/u).slice(1)),
        );
        if (reviewerPolicy.status === 'configured' && ![...trustedOwners].some((owner) => configuredOwners.has(owner))) {
          recordError(ownersFile, `at least one trusted independent reviewer from ${reviewerFile} must be a Code Owner`);
        }
      } catch (error) {
        recordError(reviewerFile, `invalid reviewer policy JSON: ${error.message}`);
      }
    }
  }

}

function validateCiRuntimeEvidenceContracts() {
  const file = '.github/workflows/ci.yml';
  const src = readWorkflow(file);
  if (!src) return;
  const model = parseWorkflow(file, src);

  const coverageLines = extractCiJobLines('tests');
  if (coverageLines) {
    const coverage = coverageLines.join('\n');
    if (!/node-version:\s*['"]22['"]/.test(coverage)) {
      recordError(file, 'Required / Tests must run on the minimum supported Node 22 lane');
    }
    if (!/run:\s*npm run test:coverage:check/.test(coverage)) {
      recordError(file, 'Test Coverage must run npm run test:coverage:check');
    }
    const coverageSteps = (model?.jobs?.tests?.steps ?? [])
      .filter((step) => step?.with?.name === 'test-coverage-evidence');
    if (coverageSteps.length !== 1
      || coverageSteps[0]?.with?.path !== '.metrics/coverage/'
      || coverageSteps[0]?.with?.['include-hidden-files'] !== true) {
      recordError(file, 'Test Coverage artifact must explicitly upload hidden .metrics/coverage content');
    }
  }
  const securityLines = extractCiJobLines('security');
  if (securityLines) {
    const security = securityLines.join('\n');
    for (const required of ['ACTIONLINT_VERSION', 'ACTIONLINT_SHA256', 'npm run typecheck', 'npm run lint:shell', 'npm run lint:actions']) {
      if (!security.includes(required)) recordError(file, `Required / Security is missing static quality control ${required}`);
    }
    if (!/sha256sum --check --strict/.test(security)) recordError(file, 'Required / Security must verify downloaded lint tool checksums');
  }

  const platformLines = extractCiJobLines('platform');
  if (platformLines) {
    const platform = platformLines.join('\n');
    for (const required of ['Linux Node 22', 'Linux Node 24', 'Windows Node 22', 'macOS Node 22']) {
      if (!platform.includes(required)) recordError(file, `platform matrix is missing ${required}`);
    }
    if (!/\/bin\/bash nova-plugin\/skills\/nova-codex-review-fix\/scripts\/run-project-checks\.sh --test-only/.test(platform)) {
      recordError(file, 'platform matrix must exercise the normal project-check path with macOS system /bin/bash');
    }
  }
  const aggregateLines = extractCiJobLines('aggregate');
  if (aggregateLines && !/needs:\s*\[classify, fast, contracts, tests, security, platform, package, live-evidence\]/.test(aggregateLines.join('\n'))) {
    recordError(file, 'Required / Aggregate must depend on every consolidated CI lane');
  }
  if (!/name:\s*Required \/ PR Fast/.test(src) || !/name:\s*Classify sensitive paths/.test(src)) recordError(file, 'CI must expose PR fast and sensitive-path classification lanes');
  for (const path of ['.github/', '.claude-plugin/', 'nova-plugin/', 'workflow-specs/', 'adapters/', 'schemas/', 'governance/', 'framework/', 'packages/', 'scripts/', 'tests/']) {
    if (!src.includes(path.replace('.', '\\.'))) recordError(file, `sensitive path classifier is missing ${path}`);
  }
  if (!/generate-validation-timing-trend\.mjs/.test(src)) recordError(file, 'full CI must produce validation timing trend evidence');
}

export function npmCacheContractErrors(file, model) {
  const findings = [];
  for (const [jobId, job] of Object.entries(model?.jobs ?? {})) {
    const steps = job?.steps ?? [];
    for (const [index, step] of steps.entries()) {
      if (!String(step.uses ?? '').startsWith('actions/setup-node@') || step.with?.cache !== 'npm') continue;
      const checkoutPrecedesCache = steps
        .slice(0, index)
        .some((candidate) => String(candidate.uses ?? '').startsWith('actions/checkout@'));
      if (!checkoutPrecedesCache) {
        findings.push(`${file}: job "${jobId}" must checkout a lockfile before enabling setup-node npm cache`);
      }
    }

    for (const [index, step] of steps.entries()) {
      if (!/^npm ci --ignore-scripts(?:\s|$)/u.test(String(step.run ?? '').trim())) continue;
      const cachedSetupPrecedesInstall = steps
        .slice(0, index)
        .some((candidate) => String(candidate.uses ?? '').startsWith('actions/setup-node@') && candidate.with?.cache === 'npm');
      if (!cachedSetupPrecedesInstall) {
        findings.push(`${file}: job "${jobId}" setup-node step before npm ci must enable the npm cache`);
      }
    }
  }
  return findings;
}

function runUsesNodeOrNpm(run) {
  return String(run ?? '')
    .split(/\r?\n/u)
    .some((line) => /(?:^|[\s;&|($`])(?:node|npm)(?=\s|$)/u.test(line));
}

export function nodeRuntimeContractErrors(file, model) {
  const findings = [];
  for (const [jobId, job] of Object.entries(model?.jobs ?? {})) {
    const steps = job?.steps ?? [];
    const firstRuntimeCommand = steps.findIndex((step) => runUsesNodeOrNpm(step.run));
    if (firstRuntimeCommand === -1) continue;

    const precedingSetups = steps
      .slice(0, firstRuntimeCommand)
      .filter((step) => String(step.uses ?? '').startsWith('actions/setup-node@'));
    if (precedingSetups.length === 0) {
      findings.push(`${file}: job "${jobId}" must setup Node 22 before executing node or npm`);
      continue;
    }
    if (!precedingSetups.some((step) => String(step.with?.['node-version']) === '22')) {
      findings.push(`${file}: job "${jobId}" must setup exact Node 22 before executing node or npm`);
    }
  }
  return findings;
}

function validateReleaseNodeRuntimeContracts() {
  for (const file of RELEASE_RUNTIME_WORKFLOW_FILES) {
    const src = readWorkflow(file);
    if (!src) continue;
    const model = parseWorkflow(file, src);
    if (!model) continue;
    for (const finding of nodeRuntimeContractErrors(file, model)) errors.push(`  - ${finding}`);
  }
}

function validateNpmCacheContracts() {
  for (const file of EXPECTED_WORKFLOW_FILES) {
    const src = readWorkflow(file);
    if (!src) continue;
    const model = parseWorkflow(file, src);
    if (!model) continue;
    for (const finding of npmCacheContractErrors(file, model)) errors.push(`  - ${finding}`);
  }
}

export function main(args = process.argv.slice(2)) {
  errors = [];
  notices = [];
  try {
    const selectedRoot = parseRoot(args);
    if (!selectedRoot) {
      console.log(usage());
      return 0;
    }
    root = selectedRoot;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }

  validateWorkflowInventory();
  validateWorkflowContracts();
  validateRequiredCheckContracts();
  validatePrGovernanceContracts();
  validateCiRuntimeEvidenceContracts();
  validateReleaseNodeRuntimeContracts();
  validateNpmCacheContracts();

  if (errors.length) {
    console.error(`GitHub workflow validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(error);
    return 1;
  }

  console.log('OK GitHub workflow validation passed');
  for (const notice of notices) console.log(notice);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
