#!/usr/bin/env node
/** Generate a public, exact-version, claim-bounded workflow quality report. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveEvaluationFacts } from './lib/evaluation-facts.mjs';
import { repoRoot } from './lib/repo-root.mjs';

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
    const latencies = entry.cases.map((item) => item.latencyMs).sort((left, right) => left - right);
    const midpoint = Math.floor(latencies.length / 2);
    const median = latencies.length % 2 === 0
      ? Math.round((latencies[midpoint - 1] + latencies[midpoint]) / 2)
      : latencies[midpoint];
    return `| ${entry.assistant.id} | ${entry.assistant.version} | ${entry.summary.passed}/${entry.summary.total} | ${entry.summary.unsafeSideEffects} | ${entry.summary.inventedSurfaces} | ${median} | ${latencies[0]}–${latencies.at(-1)} | ${latencies.length} | ${entry.workflowSpecSha256.slice(0, 12)} |`;
  }).join('\n');
  return `<!-- migrated-from: docs/quality/benchmark.md -->
# Public Workflow Quality Benchmark

Status: generated
Date: 2026-07-12

## Claim Boundary

Static results prove dataset/spec integrity and simulation proves deterministic adapter state transitions. The checked-in live files below are legacy bare-CLI observations covering only two public-safe prompts; they do not load an adapter, prove broad model quality, establish production latency, or prove release publication. The current \`${evaluation.livePaired.datasetId}\` runner derives ${evaluation.livePaired.caseCount} cases and ${evaluation.livePaired.plannedInvocations} planned invocations from the dataset and paired-plan parameters. The separate \`${evaluation.realTask.datasetId}\` derives ${evaluation.realTask.taskCount} tasks and ${evaluation.realTask.plannedInvocations} planned invocations. Neither plan upgrades claims until complete digest-bound records are retained.

## Critical Live Execution Safety

The governed \`critical\` profile fixes ${evaluation.criticalLive.caseCount} cases, ${evaluation.criticalLive.assistants.length} assistants, ${evaluation.criticalLive.conditions.length} conditions, and ${evaluation.criticalLive.attempts} attempts: ${evaluation.criticalLive.plannedInvocations} planned invocations. The profile registry is the source of truth for attempts. Before any authenticated invocation, preview the exact slice and supply a hard budget:

\`\`\`bash
node scripts/run-live-assistant-evals.mjs --assistant codex --profile critical --condition plugin-enabled --case critical-read-only-review --max-invocations 3 --output .metrics/live-eval/codex-enabled.json --plan
\`\`\`

Remove \`--plan\` only after verifying the case list, assistant, condition, attempts, planned calls, cap, output location, and estimated evidence level. Unknown arguments, an attempts override that differs from governance, unsafe output paths, and planned calls above \`--max-invocations\` fail before assistant discovery or execution. Raw stdout, stderr, model responses, CLI debug logs, and last-message files exist only inside a disposable OS temporary directory and are removed after each attempt. Public or committable records retain normalized results, counts, timings, token/cost fields when available, bounded summaries, and SHA-256 digests; credentials, raw prompts, and local absolute paths are rejected.

## Deterministic Gates

| Layer | Passed | Safety result |
| --- | ---: | --- |
| Static contract | ${staticResult.summary.passed}/${staticResult.summary.total} | Invented surface rate ${staticResult.summary.inventedSurfaceRate} |
| Adapter simulation | ${simulation.summary.passed}/${simulation.summary.total} | Unsafe continuation ${simulation.summary.unsafeContinuation} |
| Targeted critical mutants | ${mutation.results.filter((entry) => entry.killed).length}/${mutation.results.length} | Three manually selected operators; not a repository-wide mutation score |

## Historical Bare-CLI Exact-Version Observations

| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | Median ms | Min–max ms | n | Workflow digest |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${liveRows}

Small samples are reported as median and range, not P95. Failed or superseded probes remain under \`evals/evidence-attempts/\` and never upgrade compatibility. Current claims are derived in \`governance/compatibility-evidence.generated.json\`.
`;
}

export function checkOrWrite({ write = false } = {}) {
  const expected = report();
  const path = resolve(root, target);
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
  } else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    throw new Error(`${target} is stale; run node scripts/generate-quality-report.mjs --write`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-quality-report.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? `Wrote ${target}` : 'OK public quality report');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
