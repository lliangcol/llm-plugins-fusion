#!/usr/bin/env node
/** Generate a public, exact-version, claim-bounded workflow quality report. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const target = 'docs/quality/benchmark.md';
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function report() {
  const staticResult = readJson('evals/baselines/static-contract.json');
  const simulation = readJson('evals/baselines/adapter-simulation.json');
  const mutation = readJson('evals/baselines/critical-mutation.json');
  const live = ['evals/evidence/2026-07-12-claude-code-live.json', 'evals/evidence/2026-07-12-codex-live.json'].map(readJson);
  const liveRows = live.map((entry) => {
    const latencies = entry.cases.map((item) => item.latencyMs).sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
    return `| ${entry.assistant.id} | ${entry.assistant.version} | ${entry.summary.passed}/${entry.summary.total} | ${entry.summary.unsafeSideEffects} | ${entry.summary.inventedSurfaces} | ${p95} | ${entry.workflowSpecSha256.slice(0, 12)} |`;
  }).join('\n');
  return `# Public Workflow Quality Benchmark\n\nStatus: generated\nDate: 2026-07-12\n\n## Claim Boundary\n\nStatic results prove dataset/spec integrity, simulation proves deterministic adapter state transitions, and live results cover only two public-safe route/approval probes on the exact CLI versions and source digests shown. They do not prove broad model quality, production latency, or release publication.\n\n## Deterministic Gates\n\n| Layer | Passed | Safety result |\n| --- | ---: | --- |\n| Static contract | ${staticResult.summary.passed}/${staticResult.summary.total} | Invented surface rate ${staticResult.summary.inventedSurfaceRate} |\n| Adapter simulation | ${simulation.summary.passed}/${simulation.summary.total} | Unsafe continuation ${simulation.summary.unsafeContinuation} |\n| Critical mutation | ${mutation.results.filter((entry) => entry.killed).length}/${mutation.results.length} | Score ${(mutation.score * 100).toFixed(0)}% |\n\n## Live Exact-Version Probes\n\n| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | P95 latency ms | Workflow digest |\n| --- | --- | ---: | ---: | ---: | ---: | --- |\n${liveRows}\n\nFailed or superseded probes remain under \`evals/evidence-attempts/\` and never upgrade compatibility. Current claims are derived in \`governance/compatibility-evidence.generated.json\`.\n`;
}

export function checkOrWrite({ write = false } = {}) {
  const expected = report();
  const path = resolve(root, target);
  if (write) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, expected, 'utf8'); }
  else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) throw new Error(`${target} is stale; run node scripts/generate-quality-report.mjs --write`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const args = process.argv.slice(2); if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-quality-report.mjs [--write]'); checkOrWrite({ write: args.includes('--write') }); console.log(args.includes('--write') ? `Wrote ${target}` : 'OK public quality report'); }
  catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}
