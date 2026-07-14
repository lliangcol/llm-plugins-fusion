#!/usr/bin/env node
/** Validate elapsed-wall performance only against an exact governed profile. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { validationEvidenceDigests } from './lib/validation-performance-profile.mjs';

const root = repoRoot(import.meta.url);
const policy = JSON.parse(readFileSync(resolve(root, 'governance/validation-performance.json'), 'utf8'));

export function validatePerformanceReport(report, performancePolicy = policy, { requireProfile = null, currentDigests = validationEvidenceDigests(root) } = {}) {
  if (report?.command !== 'validate-all') throw new Error('performance evidence must be a validate-all diagnostics report');
  if (!report.summary) return { comparable: false, status: 'not-comparable', reason: 'legacy report has summed task durations but no observed elapsed wall time' };
  const { summary } = report;
  for (const key of ['elapsedWallMs', 'sumTaskMs', 'runtimeSmokeMs']) if (!Number.isFinite(summary[key]) || summary[key] < 0) throw new Error(`performance evidence has invalid ${key}`);
  if (summary.mode !== 'full' || summary.cacheHitCount !== 0) throw new Error('fresh-process performance evidence requires full mode with zero cache hits');
  if (!summary.profile?.comparable) {
    if (requireProfile) throw new Error(`Blocked: required performance profile ${requireProfile} is unavailable or non-comparable`);
    return { comparable: false, status: 'not-comparable', reason: 'runner class is unknown or CPU profiling is active' };
  }
  if (summary.digests?.registry !== currentDigests.registry || summary.digests?.policy !== currentDigests.policy) throw new Error('performance evidence registry/policy digest is stale');
  if (requireProfile && summary.profile.id !== requireProfile) throw new Error(`Blocked: report profile ${summary.profile.id} does not match required ${requireProfile}`);
  const profile = performancePolicy.profiles.find((candidate) => candidate.id === summary.profile.id);
  if (!profile) {
    if (requireProfile) throw new Error(`Blocked: required performance profile ${requireProfile} has no governed budget`);
    return { comparable: false, status: 'not-comparable', reason: `no governed budget for ${summary.profile.id}` };
  }
  if (profile.sampleCount < performancePolicy.minimumStableSamples) return { comparable: false, status: 'not-comparable', reason: `only ${profile.sampleCount}/${performancePolicy.minimumStableSamples} comparable samples` };
  if (summary.elapsedWallMs > profile.budgets.elapsedWallMs) throw new Error(`observed elapsed wall time ${summary.elapsedWallMs}ms exceeds ${profile.budgets.elapsedWallMs}ms`);
  if (summary.runtimeSmokeMs > profile.budgets.runtimeSmokeMs) throw new Error(`runtime smoke ${summary.runtimeSmokeMs}ms exceeds ${profile.budgets.runtimeSmokeMs}ms`);
  return { comparable: true, status: 'passed', profileId: profile.id, elapsedWallMs: summary.elapsedWallMs, sumTaskMs: summary.sumTaskMs, runtimeSmokeMs: summary.runtimeSmokeMs };
}

function parseArgs(args) {
  let reportPath = null;
  let requireProfile = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--require-profile') {
      if (!args[index + 1]) throw new Error('--require-profile requires a profile id');
      requireProfile = args[++index];
    } else if (!reportPath) reportPath = args[index];
    else throw new Error(`unknown argument: ${args[index]}`);
  }
  return { reportPath, requireProfile };
}

export function main(args = process.argv.slice(2)) {
  try {
    const { reportPath, requireProfile } = parseArgs(args);
    if (!reportPath) {
      if (requireProfile) throw new Error('Blocked: --require-profile requires an observed diagnostics report');
      console.log(`OK performance policy (profiles=${policy.profiles.length}; legacy summed-task budget is deprecated and not enforced)`);
      return 0;
    }
    const result = validatePerformanceReport(JSON.parse(readFileSync(resolve(root, reportPath), 'utf8')), policy, { requireProfile });
    if (!result.comparable) console.log(`NOT COMPARABLE ${result.reason}`);
    else console.log(`OK observed performance (${result.profileId}; elapsed=${result.elapsedWallMs}ms sum=${result.sumTaskMs}ms)`);
    return 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
