#!/usr/bin/env node
/** Plan and aggregate the fixed real-task benchmark without fabricating live evidence. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { deriveEvaluationFacts } from './lib/evaluation-facts.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const interval = (values) => {
  if (!values.length) return { estimate: null, lower95: null, upper95: null, n: 0 };
  const estimate = mean(values); const variance = values.length > 1 ? values.reduce((sum, value) => sum + (value - estimate) ** 2, 0) / (values.length - 1) : 0;
  const margin = 1.96 * Math.sqrt(variance / values.length);
  return { estimate, lower95: estimate - margin, upper95: estimate + margin, n: values.length };
};

export function benchmarkPlan() {
  const dataset = readJson('benchmarks/real-tasks.json');
  const facts = deriveEvaluationFacts(root).realTask;
  if (dataset.tasks.length < 20 || dataset.tasks.length > 30) throw new Error('benchmark requires 20-30 fixed tasks');
  if (new Set(dataset.tasks.map((entry) => entry.id)).size !== dataset.tasks.length) throw new Error('benchmark task ids must be unique');
  if (new Set(dataset.tasks.map((entry) => entry.prompt.replace(/\s+/gu, ' ').trim().toLowerCase())).size !== dataset.tasks.length) throw new Error('benchmark prompts must be unique');
  if (JSON.stringify(dataset).match(/credential|secret|token_[a-z0-9]/iu)) throw new Error('benchmark must remain public-safe');
  if (JSON.stringify(dataset.conditions) !== JSON.stringify(['raw', 'wrapper-full', 'wrapper-compact'])) throw new Error('benchmark condition inventory drift');
  return { schemaVersion: 1, status: 'AWAITING_LIVE_EVIDENCE', datasetId: facts.datasetId, tasks: facts.taskCount, conditions: facts.conditions, assistants: facts.assistants, attempts: facts.attempts, plannedInvocations: facts.plannedInvocations, externalGates: ['Claude and Codex credentials', 'evaluation budget'] };
}

function metrics(records) {
  return {
    safety: interval(records.map((entry) => Number(entry.safetyPassed === true))),
    taskSuccess: interval(records.map((entry) => Number(entry.taskSuccess === true))),
    costUsd: interval(records.map((entry) => entry.costUsd).filter(Number.isFinite)),
    totalTokens: interval(records.map((entry) => entry.totalTokens).filter(Number.isFinite)),
    latencyMs: interval(records.map((entry) => entry.latencyMs).filter(Number.isFinite)),
  };
}

export function aggregateBenchmark(records) {
  const allowedConditions = ['raw', 'wrapper-full', 'wrapper-compact'];
  for (const record of records) if (!allowedConditions.includes(record.condition)) throw new Error(`unknown benchmark condition ${record.condition}`);
  const taxonomy = {};
  for (const record of records) if (record.failureCategory) taxonomy[record.failureCategory] = (taxonomy[record.failureCategory] ?? 0) + 1;
  return {
    schemaVersion: 1,
    status: records.length ? 'MEASURED_LOCAL_EVIDENCE' : 'AWAITING_LIVE_EVIDENCE',
    recordCount: records.length,
    metrics: metrics(records),
    conditions: Object.fromEntries(allowedConditions.map((condition) => [condition, metrics(records.filter((entry) => entry.condition === condition))])),
    failureTaxonomy: taxonomy,
    claimBoundary: records.length ? 'Metrics summarize supplied digest-bound records only.' : 'No live assistant record supplied; metric estimates and confidence intervals are unavailable.',
  };
}

function markdown(plan, report) {
  const metricRows = Object.entries(report.metrics).map(([name, value]) => `| ${name} | ${value.estimate ?? 'Unavailable'} | ${value.lower95 ?? 'Unavailable'} | ${value.upper95 ?? 'Unavailable'} | ${value.n} |`).join('\n');
  return `# Real Task Benchmark\n\nStatus: ${report.status}\n\n${report.claimBoundary}\n\n- Fixed tasks: ${plan.tasks}\n- Conditions: ${plan.conditions.join(', ')}\n- Assistants: ${plan.assistants.join(', ')}\n- Attempts: ${plan.attempts}\n- Planned invocations: ${plan.plannedInvocations}\n- External gates: ${plan.externalGates.join('; ')}\n\n| Metric | Estimate | Lower 95% | Upper 95% | n |\n| --- | ---: | ---: | ---: | ---: |\n${metricRows}\n\n## Failure Taxonomy\n\n${Object.keys(report.failureTaxonomy).length ? Object.entries(report.failureTaxonomy).map(([name, count]) => `- ${name}: ${count}`).join('\n') : '- No live records; taxonomy unavailable.'}\n`;
}

export function checkOrWrite({ write = false, records = [] } = {}) {
  const plan = benchmarkPlan(); const report = aggregateBenchmark(records);
  const combined = { plan, report };
  const outputs = [['docs/generated/real-task-benchmark.json', `${JSON.stringify(combined, null, 2)}\n`], ['docs/generated/real-task-benchmark.md', markdown(plan, report)]];
  for (const [path, content] of outputs) { const full = resolve(root, path); if (write) { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, content, 'utf8'); } else if (!existsSync(full) || readFileSync(full, 'utf8') !== content) throw new Error(`${path} is stale`); }
  return combined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2); const write = args.includes('--write'); const inputAt = args.indexOf('--input');
    if (args.some((arg, index) => !['--write', '--input'].includes(arg) && index !== inputAt + 1) || (inputAt !== -1 && !args[inputAt + 1])) throw new Error('Usage: node scripts/run-real-task-benchmark.mjs [--input <records.json>] [--write]');
    const records = inputAt === -1 ? [] : readJson(args[inputAt + 1]).records;
    const result = checkOrWrite({ write, records }); console.log(JSON.stringify(result.plan));
  } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}
