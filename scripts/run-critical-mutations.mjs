#!/usr/bin/env node
/** Dependency-free targeted mutation gate for high-risk path and secret policies. */

import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const target = 'evals/baselines/critical-mutation.json';
const correctionRecordedAt = '2026-07-16T00:00:00Z';
const correctionEvidence = { path: 'governance/evidence/test.md', sha256: 'e'.repeat(64), recordedAt: correctionRecordedAt };

function mutationCorrection(status, overrides = {}) {
  const actionsByStatus = {
    'active-release-hold': ['created'],
    'authorized-for-new-candidate': ['created', 'authorized'],
    'candidate-verified': ['created', 'authorized', 'candidate-verified'],
    'resolved-by-governed-release': ['created', 'authorized', 'candidate-verified', 'closed'],
  };
  const entry = {
    id: 'REL-001', issue: 73, status, affectedCommits: ['a'.repeat(40)],
    stableRelease: { tag: 'v4.0.0', commit: 'd'.repeat(40), state: 'INSTALL_PROVEN' },
    decision: { authorizedByIssue: 73, nonRetroactive: true, summary: 'mutation fixture' },
    releaseBoundary: {
      mayPublishStable: status === 'resolved-by-governed-release', requiresNewCandidate: true,
      requiresCurrentIndependentReview: true, requiresProtectedPublicationEvidence: true, requiresInstallProof: true,
    },
    authorizationEvidence: correctionEvidence,
    candidateEvidence: correctionEvidence,
    resolutionEvidence: correctionEvidence,
    targetRelease: status === 'active-release-hold'
      ? undefined
      : { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1' },
    auditTrail: actionsByStatus[status].map((action) => ({
      action, actorRole: 'maintainer', recordedAt: correctionRecordedAt, evidence: correctionEvidence,
    })),
    ...overrides,
  };
  return entry;
}

const mutants = [
  {
    id: 'active-release-hold-ignored',
    source: 'scripts/lib/release-corrections.mjs',
    dependencies: ['scripts/lib/canonical-json.mjs', 'scripts/lib/physical-read-boundary.mjs'],
    from: "  if (correction.status === 'active-release-hold') return true;",
    to: "  if (correction.status === 'active-release-hold') return false;",
    async test(module) {
      const result = module.evaluateReleaseCorrections({ mode: 'candidate', stableTag: 'v9.0.0', candidateTag: 'v9.0.0-rc.1', sourceCommit: 'a'.repeat(40), correctionsSha256: 'b'.repeat(64), corrections: [mutationCorrection('active-release-hold', { affectedCommits: ['c'.repeat(40)] })] });
      return result.status !== 'BLOCKED_POLICY' ? 'active release hold ignored' : null;
    },
  },
  {
    id: 'correction-identity-binding-disabled',
    source: 'scripts/lib/release-corrections.mjs',
    dependencies: ['scripts/lib/canonical-json.mjs', 'scripts/lib/physical-read-boundary.mjs'],
    from: "    if (identityMismatch) {",
    to: "    if (false) {",
    async test(module) {
      const result = module.evaluateReleaseCorrections({ mode: 'candidate', stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.2', sourceCommit: 'a'.repeat(40), correctionsSha256: 'b'.repeat(64), independentReview: { passed: true }, corrections: [mutationCorrection('authorized-for-new-candidate')] });
      return result.reasonCode !== 'CORRECTION_IDENTITY_MISMATCH' ? 'correction identity mismatch accepted' : null;
    },
  },
  {
    id: 'path-containment-always-allow',
    source: 'nova-plugin/runtime/safe-workspace-path.mjs',
    from: "  return rel === '' || (rel !== '..' && !rel.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(rel));",
    to: '  return true;',
    async test(module) { return module.isPathInside('/workspace', '/outside') ? 'outside path accepted' : null; },
  },
  {
    id: 'all-target-hardlink-check-disabled',
    source: 'nova-plugin/runtime/safe-workspace-path.mjs',
    from: '    if (links !== 1) {',
    to: '    if (false) {',
    async test(module, temp) {
      const workspace = resolve(temp, 'workspace');
      mkdirSync(workspace);
      const targetFile = resolve(workspace, 'hooks.json');
      writeFileSync(targetFile, '{}\n');
      linkSync(targetFile, resolve(workspace, 'copy.json'));
      let rejected = false;
      try { module.resolveWorkspaceTarget({ filePath: targetFile, projectRoot: workspace }); } catch { rejected = true; }
      return !rejected ? 'ordinary hard link accepted' : null;
    },
  },
  {
    id: 'secret-detection-disabled',
    source: 'nova-plugin/runtime/secret-rules.mjs',
    from: '  return findSensitiveText(value).length > 0;',
    to: '  return false;',
    async test(module) { return !module.hasSensitiveText(`sk-proj-${'a'.repeat(24)}`) ? 'secret not detected' : null; },
  },
  {
    id: 'trusted-review-allowlist-disabled',
    source: 'scripts/lib/release-review.mjs',
    dependencies: ['scripts/lib/github-identity.mjs'],
    from: '    && trusted.has(review.reviewer)\n',
    to: '',
    async test(module) {
      const result = module.evaluateIndependentReview({ pullRequestAuthor: 'author', candidateActor: 'actor', trustedReviewers: [], reviews: [{ reviewer: 'stranger', state: 'APPROVED', submittedAt: '2026-01-01T00:00:00Z' }] });
      return result.passed ? 'untrusted reviewer accepted' : null;
    },
  },
  {
    id: 'release-ledger-digest-check-disabled',
    source: 'scripts/lib/release-state-machine.mjs',
    dependencies: ['scripts/lib/canonical-json.mjs'],
    from: '    const digest = canonicalSha256(record.event);',
    to: '    const digest = record.sha256;',
    async test(module) {
      const identity = { stableTag: 'v1.0.0', candidateTag: 'v1.0.0-rc.1', sourceCommit: 'a'.repeat(40), candidateManifestSha256: 'b'.repeat(64), controlBundleSha256: 'c'.repeat(64) };
      const ledger = module.appendReleaseLedger(module.createReleaseLedger(identity), { transition: { from: 'DRAFT', to: 'CANDIDATE_TAGGED' }, identity, runId: '1', createdAt: '2026-01-01T00:00:00Z' }, 'promote');
      ledger.events[0].event.runId = 'tampered';
      let rejected = false; try { module.verifyReleaseLedger(ledger); } catch { rejected = true; }
      return !rejected ? 'tampered ledger accepted' : null;
    },
  },
  {
    id: 'unavailable-eval-metric-coerced-to-zero',
    source: 'scripts/lib/evaluation-evidence.mjs',
    dependencies: ['nova-plugin/runtime/secret-rules.mjs'],
    from: "  return typeof left === 'number' && typeof right === 'number' ? left - right : null;",
    to: '  return (left ?? 0) - (right ?? 0);',
    async test(module) {
      return module.nullableMetricDelta(null, 2) !== null || module.nullableMetricDelta(2, null) !== null
        ? 'unavailable metric coerced to zero' : null;
    },
  },
  {
    id: 'git-injection-argument-check-disabled',
    source: 'nova-plugin/hooks/scripts/pre-bash-check.mjs',
    dependencies: [
      'nova-plugin/runtime/safe-workspace-path.mjs',
      'nova-plugin/runtime/hook-bootstrap-trust.mjs',
    ],
    from: "    return !tokens.slice(2).some((arg) => rule.forbiddenArguments\n      .some((forbidden) => matchesForbiddenGitArgument(arg, forbidden)));",
    to: '    return true;',
    async test(module, temp) {
      const policy = { maxCommandBytes: 1000, projectPolicyPath: '.nova/missing.json', rules: [{ id: 'git-read', type: 'git-subcommand', subcommands: ['describe'], forbiddenArguments: ['--dirty'] }] };
      const result = module.authorizeBashCommand('git describe --dir', { workspaceRoot: temp, basePolicy: policy, env: process.env });
      return result.allowed ? 'abbreviated forbidden Git option accepted' : null;
    },
  },
  {
    id: 'trusted-git-environment-inheritance-restored',
    source: 'scripts/lib/git-source-snapshot.mjs',
    dependencies: ['scripts/lib/portable-path.mjs', 'framework/io/portable-path.mjs'],
    from: "  return {\n    GIT_NO_REPLACE_OBJECTS: '1',",
    to: "  return {\n    ...process.env,\n    GIT_NO_REPLACE_OBJECTS: '1',",
    async test(module) {
      const key = 'NOVA_MUTATION_HOSTILE_ENVIRONMENT';
      const previous = process.env[key];
      try {
        process.env[key] = 'must-not-reach-git';
        return Object.hasOwn(module.trustedGitEnvironment({ directory: '/trusted/git' }), key)
          ? 'caller environment reached trusted Git' : null;
      } finally {
        if (previous === undefined) delete process.env[key];
        else process.env[key] = previous;
      }
    },
  },
];

function validateProbeReason(mutant, phase, reason) {
  if (reason !== null && (typeof reason !== 'string' || reason.length === 0)) {
    throw new Error(`${mutant.id}: ${phase} mutation probe returned an invalid result`);
  }
}

/**
 * @param {{ id: string, test: (module: any, temp?: string) => string | null | Promise<string | null> }} mutant
 * @param {any} baselineModule
 * @param {any} mutatedModule
 * @param {{ baselineTemp?: string, mutatedTemp?: string }} [options]
 */
export async function evaluateMutationProbe(mutant, baselineModule, mutatedModule, {
  baselineTemp,
  mutatedTemp,
} = {}) {
  const baselineReason = await mutant.test(baselineModule, baselineTemp);
  validateProbeReason(mutant, 'baseline', baselineReason);
  if (baselineReason !== null) {
    throw new Error(`${mutant.id}: baseline probe failed before mutation: ${baselineReason}`);
  }
  const reason = await mutant.test(mutatedModule, mutatedTemp);
  validateProbeReason(mutant, 'mutated', reason);
  return { killed: reason !== null, reason };
}

export async function runMutations() {
  const results = [];
  for (const mutant of mutants) {
    const temp = mkdtempSync(resolve(tmpdir(), 'nova-mutation-'));
    try {
      const source = readFileSync(resolve(root, mutant.source), 'utf8');
      if (!source.includes(mutant.from)) throw new Error(`${mutant.id}: mutation anchor drifted`);
      const mutated = source.replace(mutant.from, mutant.to);
      const baselineTemp = resolve(temp, 'baseline-probe');
      const mutatedTemp = resolve(temp, 'mutated-probe');
      mkdirSync(baselineTemp);
      mkdirSync(mutatedTemp);
      const file = resolve(temp, mutant.source);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, mutated, 'utf8');
      for (const dependency of mutant.dependencies ?? []) {
        const targetDependency = resolve(temp, dependency);
        mkdirSync(resolve(targetDependency, '..'), { recursive: true });
        writeFileSync(targetDependency, readFileSync(resolve(root, dependency)));
      }
      // The repository source is never rewritten during mutation execution, so
      // reuse its canonical module instance across probes. Query-string cache
      // busting created duplicate coverage identities without strengthening the
      // baseline check; only the temporary mutated module needs a unique URL.
      const baselineModule = await import(pathToFileURL(resolve(root, mutant.source)).href);
      const module = await import(`${pathToFileURL(file).href}?mutation=${Date.now()}`);
      const { killed, reason } = await evaluateMutationProbe(mutant, baselineModule, module, {
        baselineTemp,
        mutatedTemp,
      });
      results.push({ id: mutant.id, source: mutant.source, killed, reason });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  return { schemaVersion: 1, executionMode: 'targeted-source-mutation', results, score: results.filter((entry) => entry.killed).length / results.length, targetScore: 1 };
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/run-critical-mutations.mjs [--write]');
  const report = await runMutations();
  finalizeMutationReport(report, { write: args.includes('--write') });
  console.log(`OK critical mutation score ${(report.score * 100).toFixed(0)}% (${report.results.filter((entry) => entry.killed).length}/${report.results.length})`);
}

export function finalizeMutationReport(report, options = {}) {
  const results = Array.isArray(report.results) ? report.results : [];
  const killed = results.filter((entry) => entry?.killed === true).length;
  if (report.targetScore !== 1 || report.score !== 1 || results.length === 0 || killed !== results.length) {
    throw new Error(`critical mutation gate must kill every governed probe (${killed}/${results.length}); targetScore and score must both equal 1`);
  }
  checkOrWriteReport(report, options);
}

export function checkOrWriteReport(report, { write = false, path = resolve(root, target) } = {}) {
  const expected = `${JSON.stringify(report, null, 2)}\n`;
  if (write) writeFileSync(path, expected, 'utf8');
  else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    throw new Error(`${target} is stale; run node scripts/run-critical-mutations.mjs --write`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
});
