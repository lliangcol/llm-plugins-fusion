#!/usr/bin/env node
/** Generate a public, exact-version, claim-bounded workflow quality report. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { deriveEvaluationFacts } from './lib/evaluation-facts.mjs';

const root = repoRoot(import.meta.url);
const target = 'docs/reference/evaluation/benchmark.md';
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function report() {
  const evaluation = deriveEvaluationFacts(root);
  const staticResult = readJson('evals/baselines/static-contract.json');
  const simulation = readJson('evals/baselines/adapter-simulation.json');
  const mutation = readJson('evals/baselines/critical-mutation.json');
  const live = ['evals/evidence/2026-07-12-claude-code-live.json', 'evals/evidence/2026-07-12-codex-live.json'].map(readJson);
  const liveRows = live.map((entry) => {
    const latencies = entry.cases.map((item) => item.latencyMs).sort((a, b) => a - b);
    const midpoint = Math.floor(latencies.length / 2);
    const median = latencies.length % 2 === 0 ? Math.round((latencies[midpoint - 1] + latencies[midpoint]) / 2) : latencies[midpoint];
    return `| ${entry.assistant.id} | ${entry.assistant.version} | ${entry.summary.passed}/${entry.summary.total} | ${entry.summary.unsafeSideEffects} | ${entry.summary.inventedSurfaces} | ${median} | ${latencies[0]}–${latencies.at(-1)} | ${latencies.length} | ${entry.workflowSpecSha256.slice(0, 12)} |`;
  }).join('\n');
  return `# Public Workflow Quality Benchmark\n\nStatus: generated\nDate: 2026-07-12\n\n## Claim Boundary\n\nStatic results prove dataset/spec integrity and simulation proves deterministic adapter state transitions. The checked-in live files below are legacy bare-CLI observations covering only two public-safe prompts; they do not load an adapter, prove broad model quality, establish production latency, or prove release publication. The current \`${evaluation.livePaired.datasetId}\` runner derives ${evaluation.livePaired.caseCount} cases and ${evaluation.livePaired.plannedInvocations} planned invocations from the dataset and paired-plan parameters. The separate \`${evaluation.realTask.datasetId}\` derives ${evaluation.realTask.taskCount} tasks and ${evaluation.realTask.plannedInvocations} planned invocations. Neither plan upgrades claims until complete digest-bound records are retained.\n\n## Deterministic Gates\n\n| Layer | Passed | Safety result |\n| --- | ---: | --- |\n| Static contract | ${staticResult.summary.passed}/${staticResult.summary.total} | Invented surface rate ${staticResult.summary.inventedSurfaceRate} |\n| Adapter simulation | ${simulation.summary.passed}/${simulation.summary.total} | Unsafe continuation ${simulation.summary.unsafeContinuation} |\n| Targeted critical mutants | ${mutation.results.filter((entry) => entry.killed).length}/${mutation.results.length} | Three manually selected operators; not a repository-wide mutation score |\n\n## Historical Bare-CLI Exact-Version Observations\n\n| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | Median ms | Min–max ms | n | Workflow digest |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${liveRows}\n\nSmall samples are reported as median and range, not P95. Failed or superseded probes remain under \`evals/evidence-attempts/\` and never upgrade compatibility. Current claims are derived in \`governance/compatibility-evidence.generated.json\`.\n`;
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
