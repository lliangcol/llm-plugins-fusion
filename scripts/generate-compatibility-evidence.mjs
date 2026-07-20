#!/usr/bin/env node
/** Derive current compatibility claims from static adapters and digest-bound evidence. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gitResolveCommit } from './lib/git-source-snapshot.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const registryPath = 'governance/compatibility-evidence.generated.json';
const summaryPath = 'docs/generated/assistant-compatibility.md';
const matrixPath = 'docs/reference/compatibility/marketplace.md';
const matrixStart = '<!-- generated:assistant-compatibility:start -->';
const matrixEnd = '<!-- generated:assistant-compatibility:end -->';

const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const sha256 = (path) => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const minimumLiveCases = 20;
const minimumLiveAttempts = 3;
const canaryTtlMs = 14 * 24 * 60 * 60 * 1000;
export const CURRENT_COMPATIBILITY_EVIDENCE_STATUSES = Object.freeze(['exact', 'carried-forward']);

export function isCurrentCompatibilityEvidenceStatus(status) {
  return CURRENT_COMPATIBILITY_EVIDENCE_STATUSES.includes(status);
}

const declarations = Object.freeze({
  'claude-code': { declaredLevel: 'L2', maximumSupportedLevel: 'L4', adapter: 'adapters/claude/manifest.json', scope: 'stable Claude command invocation; hooks and release verification require current evidence' },
  codex: { declaredLevel: 'L2', maximumSupportedLevel: 'L4', adapter: 'adapters/codex/AGENTS.md', scope: 'generated local adapter; enforcement and live behavior require current evidence' },
  generic: { declaredLevel: 'L1', maximumSupportedLevel: 'L4', adapter: 'adapters/generic-agent-skills/manifest.json', scope: 'parseable contracts only; consumer owns invocation and enforcement' },
});

function evidenceFiles() {
  return readdirSync(resolve(root, 'evals/evidence'))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `evals/evidence/${name}`);
}

function evidenceStatus(path, evidence, assistant, eligibilityReasons = []) {
  const staleReasons = [...eligibilityReasons];
  for (const [sourcePath, expected] of Object.entries(evidence.sourceDigests ?? {})) {
    if (!existsSync(resolve(root, sourcePath))) staleReasons.push(`${sourcePath}:missing`);
    else if (sha256(sourcePath) !== expected) staleReasons.push(`${sourcePath}:digest-changed`);
  }
  if (evidence.sourceState && evidence.sourceState !== 'clean-commit') staleReasons.push('source-state:not-clean-commit');
  const recordedAt = evidence.recordedAt ? Date.parse(evidence.recordedAt) : Number.NaN;
  const expired = evidence.lane === 'latest-canary' && (!Number.isFinite(recordedAt) || Date.now() - recordedAt > canaryTtlMs);
  let status = 'historical';
  if (expired) status = 'expired';
  else if (staleReasons.length === 0) {
    const tagCommit = evidence.releaseTag ? gitResolveCommit(root, evidence.releaseTag) : null;
    status = tagCommit && tagCommit === evidence.baseCommit ? 'exact' : 'carried-forward';
  }
  return {
    assistant: assistant.id,
    assistantVersion: assistant.version,
    observedLevel: assistant.compatibilityLevel,
    recordedAt: evidence.recordedAt,
    source: path,
    releaseTag: evidence.releaseTag ?? null,
    commit: evidence.baseCommit ?? evidence.commit ?? null,
    status,
    staleReasons,
  };
}

function liveEligibilityReasons(evidence) {
  const reasons = [];
  const caseIds = new Set((evidence.cases ?? []).map((entry) => entry.caseId));
  const attempts = new Map();
  for (const entry of evidence.cases ?? []) attempts.set(entry.caseId, (attempts.get(entry.caseId) ?? 0) + 1);
  if (evidence.sourceState !== 'clean-commit') reasons.push('live-source:not-clean');
  if (!/^v\d+\.\d+\.\d+(?:-rc\.\d+)?$/u.test(evidence.releaseTag ?? '')) reasons.push('live-source:exact-tag-missing');
  const adapterLoadObserved = evidence.assistant?.adapterLoadObserved === 'observed'
    || (evidence.assistant?.adapterLoaded === true && Boolean(evidence.runtime?.adapterLoadProof));
  if (!adapterLoadObserved) reasons.push('live-runtime:adapter-load-unproven');
  const casesPath = evidence.casesPath ?? 'evals/live/cases.json';
  const labelsPath = evidence.labelsPath === undefined ? 'evals/live/labels.locked.json' : evidence.labelsPath;
  if (evidence.datasetId !== 'live-paired' || !evidence.sourceDigests?.['scripts/run-live-assistant-evals.mjs'] || !evidence.sourceDigests?.[casesPath] || !labelsPath || !evidence.sourceDigests?.[labelsPath]) reasons.push('live-source:runner-or-release-dataset-digest-missing');
  if (caseIds.size < minimumLiveCases) reasons.push(`live-dataset:fewer-than-${minimumLiveCases}-cases`);
  if ([...attempts.values()].some((count) => count < minimumLiveAttempts) || attempts.size === 0) reasons.push(`live-dataset:fewer-than-${minimumLiveAttempts}-attempts`);
  return reasons;
}

export function buildRegistry() {
  const support = readJson('governance/assistant-support.json');
  const records = evidenceFiles().flatMap((path) => {
    const evidence = readJson(path);
    if (evidence.layer === 'live-assistant' && evidence.assistant) {
      const exactVersion = String(evidence.assistant.version).replace(/^codex-cli\s+/, '').replace(/\s+\(Claude Code\)$/, '');
      return [evidenceStatus(path, {
        recordedAt: evidence.completedAt,
        sourceDigests: evidence.sourceDigests,
        baseCommit: evidence.baseCommit,
        sourceState: evidence.sourceState,
        releaseTag: evidence.releaseTag,
        lane: evidence.lane,
      }, {
        id: evidence.assistant.id,
        version: exactVersion,
        compatibilityLevel: evidence.summary?.passed === evidence.summary?.total && liveEligibilityReasons(evidence).length === 0 ? 'L4-local' : 'L2',
      }, liveEligibilityReasons(evidence))];
    }
    return (evidence.assistants ?? []).map((assistant) => evidenceStatus(path, evidence, assistant));
  });
  const claims = Object.entries(declarations).map(([assistant, declaration]) => {
    const current = records.filter((record) => record.assistant === assistant && isCurrentCompatibilityEvidenceStatus(record.status)).at(-1) ?? null;
    return {
      assistant,
      ...declaration,
      effectiveLevel: current?.observedLevel ?? declaration.declaredLevel,
      evidenceStatus: current?.status ?? 'declaration-only',
      currentEvidence: current?.source ?? null,
    };
  });
  return {
    $schema: '../schemas/adapter-evidence.schema.json',
    schemaVersion: 1,
    generatedFrom: 'static adapter declarations plus digest-bound evals/evidence records',
    sourceDigests: Object.fromEntries([
      'workflow-specs/workflows.v6.json',
      'workflow-specs/adapters/claude.json',
      'workflow-specs/adapters/codex.json',
      'workflow-specs/adapters/generic.json',
      'adapters/claude/manifest.json',
      'adapters/codex/AGENTS.md',
      'adapters/generic-agent-skills/manifest.json',
      'governance/assistant-support.json',
    ].map((path) => [path, sha256(path)])),
    knownGoodLanes: [
      ...support.knownGood.map((entry) => ({ ...entry, lane: 'known-good' })),
      ...support.latestCanary.map((entry) => ({ ...entry, lane: 'latest-canary' })),
    ],
    currentClaims: claims,
    historicalEvidence: records.filter((record) => !isCurrentCompatibilityEvidenceStatus(record.status)),
  };
}

function table(registry) {
  const rows = registry.currentClaims.map((claim) => `| ${claim.assistant} | ${claim.effectiveLevel} | ${claim.maximumSupportedLevel} | ${claim.evidenceStatus} | ${claim.scope} |`).join('\n');
  return `| Assistant | Effective current level | Maximum | Evidence state | Claim boundary |\n| --- | --- | --- | --- | --- |\n${rows}`;
}

function summary(registry) {
  const historical = registry.historicalEvidence.length
    ? registry.historicalEvidence.map((record) => `- ${record.assistant}@${record.assistantVersion}: ${record.observedLevel}, now ${record.status} (${record.staleReasons.join(', ')})`).join('\n')
    : '- None';
  return `# Assistant Compatibility Evidence\n\nStatus: generated\n\nCompatibility levels are derived from current source digests. Static manifests declare only a baseline and a maximum; L3/L4 require current evidence.\n\n${table(registry)}\n\n## Evidence Lanes\n\n- Known-good lanes are blocking and pinned to exact versions.\n- Latest-canary lanes are non-blocking drift detectors.\n\n## Historical Evidence\n\n${historical}\n`;
}

function replaceMatrix(source, block) {
  const start = source.indexOf(matrixStart);
  const end = source.indexOf(matrixEnd);
  if (start === -1 || end === -1 || end < start) throw new Error(`${matrixPath} missing generated compatibility markers`);
  return `${source.slice(0, start)}${matrixStart}\n${block}\n${matrixEnd}${source.slice(end + matrixEnd.length)}`;
}

export function checkOrWrite({ write = false } = {}) {
  const registry = buildRegistry();
  const outputs = [
    { path: registryPath, content: `${JSON.stringify(registry, null, 2)}\n` },
    { path: summaryPath, content: summary(registry) },
    { path: matrixPath, content: replaceMatrix(readFileSync(resolve(root, matrixPath), 'utf8'), table(registry)) },
  ];
  const stale = [];
  for (const output of outputs) {
    const path = resolve(root, output.path);
    if (write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, output.content, 'utf8');
    } else if (!existsSync(path) || readFileSync(path, 'utf8') !== output.content) stale.push(output.path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} stale; run node scripts/generate-compatibility-evidence.mjs --write`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-compatibility-evidence.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote compatibility evidence registry and generated docs' : 'OK compatibility evidence registry');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
