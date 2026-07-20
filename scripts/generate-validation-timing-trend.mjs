#!/usr/bin/env node
/** Normalize validation timing evidence into a stable trend artifact. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareArtifactOutputPlan, writeArtifactOutput } from './lib/artifact-output.mjs';

const root = resolve(import.meta.dirname, '..');

export function timingTrend(records) {
  const runs = records.map((record) => ({ runId: record.runId, generatedAt: record.generatedAt, failed: record.failed, skipped: record.skipped, totalDurationMs: record.gates.reduce((sum, gate) => sum + gate.durationMs, 0), gates: record.gates.map((gate) => ({ id: gate.id, status: gate.status, durationMs: gate.durationMs })) }));
  const gateIds = [...new Set(runs.flatMap((run) => run.gates.map((gate) => gate.id)))].sort();
  return { schemaVersion: 1, runCount: runs.length, gateIds, runs };
}

export function main(args = process.argv.slice(2)) {
  const inputAt = args.indexOf('--input'); const outputAt = args.indexOf('--output');
  if (inputAt === -1 || outputAt === -1 || !args[inputAt + 1] || !args[outputAt + 1]
    || args[inputAt + 1].startsWith('--') || args[outputAt + 1].startsWith('--')
    || args.length !== 4) {
    throw new Error('Usage: node scripts/generate-validation-timing-trend.mjs --input <timings.json> --output <trend.json>');
  }
  const inputPath = resolve(args[inputAt + 1]);
  const plan = prepareArtifactOutputPlan(root, [{
    key: 'trend', path: args[outputAt + 1], label: 'validation timing trend output',
  }], { protectedPaths: [inputPath] });
  const input = JSON.parse(readFileSync(inputPath, 'utf8'));
  writeArtifactOutput(plan, 'trend', `${JSON.stringify(timingTrend([input]), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { try { main(); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; } }
