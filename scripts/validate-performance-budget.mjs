#!/usr/bin/env node
/** Validate comparable validate-all timing evidence when a diagnostics report is supplied. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const policy = JSON.parse(readFileSync(resolve(root, 'governance/validation-performance.json'), 'utf8'));

export function validatePerformanceReport(report, performancePolicy = policy) {
  if (report?.command !== 'validate-all') throw new Error('performance evidence must be a validate-all diagnostics report');
  if (report.platform !== performancePolicy.platform) {
    throw new Error(`performance evidence platform ${report.platform ?? 'missing'} is not comparable to ${performancePolicy.platform}`);
  }
  if (!Array.isArray(report.results) || report.results.length === 0) throw new Error('performance evidence has no validation results');
  for (const result of report.results) {
    if (!Number.isFinite(result.actual?.durationMs) || result.actual.durationMs < 0) {
      throw new Error(`performance evidence has an invalid duration for ${result.check ?? 'unknown check'}`);
    }
  }
  const runtimeResults = report.results.filter((result) => result.check === 'runtime.smoke');
  if (runtimeResults.length !== 1 || runtimeResults[0].status !== 'passed') throw new Error('performance evidence requires exactly one passed runtime.smoke result');
  const [runtime] = runtimeResults;
  const total = report.results.reduce((sum, result) => sum + result.actual.durationMs, 0);
  if (total > performancePolicy.budgets.validateAllWallMs) {
    throw new Error(`validate-all task wall time ${total}ms exceeds ${performancePolicy.budgets.validateAllWallMs}ms`);
  }
  if (runtime.actual.durationMs > performancePolicy.budgets.runtimeSmokeWallMs) {
    throw new Error(`runtime smoke ${runtime.actual.durationMs}ms exceeds ${performancePolicy.budgets.runtimeSmokeWallMs}ms`);
  }
  return { totalMs: total, runtimeSmokeMs: runtime.actual.durationMs };
}

export function main(args = process.argv.slice(2)) {
  try {
    if (args.length > 1) throw new Error('Usage: node scripts/validate-performance-budget.mjs [diagnostics.json]');
    if (args.length === 0) {
      console.log(`OK performance budgets (${policy.platform}; evidence not supplied)`);
      return 0;
    }
    const report = JSON.parse(readFileSync(resolve(root, args[0]), 'utf8'));
    const result = validatePerformanceReport(report);
    console.log(`OK observed performance budgets (${result.totalMs}ms summed task wall time; CPU time unavailable)`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
