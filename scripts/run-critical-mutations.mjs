#!/usr/bin/env node
/** Dependency-free targeted mutation gate for high-risk path and secret policies. */

import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const target = 'evals/baselines/critical-mutation.json';

const mutants = [
  {
    id: 'path-containment-always-allow',
    source: 'nova-plugin/runtime/safe-workspace-path.mjs',
    from: "  return rel === '' || (rel !== '..' && !rel.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(rel));",
    to: '  return true;',
    async test(module) { if (module.isPathInside('/workspace', '/outside')) throw new Error('outside path accepted'); },
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
      if (!rejected) throw new Error('ordinary hard link accepted');
    },
  },
  {
    id: 'secret-detection-disabled',
    source: 'nova-plugin/runtime/secret-rules.mjs',
    from: '  return findSensitiveText(value).length > 0;',
    to: '  return false;',
    async test(module) { if (!module.hasSensitiveText(`sk-proj-${'a'.repeat(24)}`)) throw new Error('secret not detected'); },
  },
  {
    id: 'trusted-review-allowlist-disabled',
    source: 'scripts/lib/release-review.mjs',
    from: '    && trusted.has(review.reviewer)\n',
    to: '',
    async test(module) {
      const result = module.evaluateIndependentReview({ pullRequestAuthor: 'author', candidateActor: 'actor', trustedReviewers: [], reviews: [{ reviewer: 'stranger', state: 'APPROVED', submittedAt: '2026-01-01T00:00:00Z' }] });
      if (result.passed) throw new Error('untrusted reviewer accepted');
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
      if (!rejected) throw new Error('tampered ledger accepted');
    },
  },
  {
    id: 'unavailable-eval-metric-coerced-to-zero',
    source: 'scripts/evaluate-paired-live.mjs',
    dependencies: ['scripts/lib/cli-args.mjs'],
    from: "  const delta = (left, right) => typeof left === 'number' && typeof right === 'number' ? left - right : null;",
    to: '  const delta = (left, right) => (left ?? 0) - (right ?? 0);',
    async test(module) {
      const entry = { caseId: 'x', attempt: 1, contractValid: true, routeValid: true, top2RouteValid: true, requiredInputsValid: true, approvalValid: true, zeroProjectWrites: true, inventedSurfaces: [], latencyMs: 1, totalTokens: null, costUsd: null };
      const report = module.aggregatePaired({ cases: [entry] }, { cases: [{ ...entry, totalTokens: 2, costUsd: 1 }] });
      if (report.pairs[0].tokenDelta !== null || report.pairs[0].costDeltaUsd !== null) throw new Error('unavailable metric coerced to zero');
    },
  },
  {
    id: 'git-injection-argument-check-disabled',
    source: 'nova-plugin/hooks/scripts/pre-bash-check.mjs',
    from: "    return !tokens.slice(2).some((arg) => rule.forbiddenArguments.some((forbidden) => arg === forbidden || arg.startsWith(`${forbidden}=`)));",
    to: '    return true;',
    async test(module, temp) {
      const policy = { maxCommandBytes: 1000, projectPolicyPath: '.nova/missing.json', rules: [{ id: 'git-read', type: 'git-subcommand', subcommands: ['status'], forbiddenArguments: ['--config-env'] }] };
      const result = module.authorizeBashCommand('git status --config-env=credential.helper=x', { workspaceRoot: temp, basePolicy: policy, env: process.env });
      if (result.allowed) throw new Error('git config injection accepted');
    },
  },
];

export async function runMutations() {
  const results = [];
  for (const mutant of mutants) {
    const temp = mkdtempSync(resolve(tmpdir(), 'nova-mutation-'));
    try {
      const source = readFileSync(resolve(root, mutant.source), 'utf8');
      if (!source.includes(mutant.from)) throw new Error(`${mutant.id}: mutation anchor drifted`);
      const mutated = source.replace(mutant.from, mutant.to);
      const file = resolve(temp, mutant.source);
      mkdirSync(resolve(file, '..'), { recursive: true });
      writeFileSync(file, mutated, 'utf8');
      for (const dependency of mutant.dependencies ?? []) {
        const targetDependency = resolve(temp, dependency);
        mkdirSync(resolve(targetDependency, '..'), { recursive: true });
        writeFileSync(targetDependency, readFileSync(resolve(root, dependency)));
      }
      let killed = false;
      let reason = null;
      try {
        const module = await import(`${pathToFileURL(file).href}?mutation=${Date.now()}`);
        await mutant.test(module, temp);
      } catch (error) {
        killed = true;
        reason = error.message;
      }
      results.push({ id: mutant.id, source: mutant.source, killed, reason });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  return { schemaVersion: 1, executionMode: 'targeted-source-mutation', results, score: results.filter((entry) => entry.killed).length / results.length, targetScore: 0.8 };
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/run-critical-mutations.mjs [--write]');
  const report = await runMutations();
  if (args.includes('--write')) writeFileSync(resolve(root, target), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (report.score < report.targetScore) throw new Error(`critical mutation score ${report.score} is below ${report.targetScore}`);
  console.log(`OK critical mutation score ${(report.score * 100).toFixed(0)}% (${report.results.filter((entry) => entry.killed).length}/${report.results.length})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
});
