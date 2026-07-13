#!/usr/bin/env node
/** Normalize validation timing evidence into a stable trend artifact. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function timingTrend(records) {
  const runs = records.map((record) => ({ runId: record.runId, generatedAt: record.generatedAt, failed: record.failed, skipped: record.skipped, totalDurationMs: record.gates.reduce((sum, gate) => sum + gate.durationMs, 0), gates: record.gates.map((gate) => ({ id: gate.id, status: gate.status, durationMs: gate.durationMs })) }));
  const gateIds = [...new Set(runs.flatMap((run) => run.gates.map((gate) => gate.id)))].sort();
  return { schemaVersion: 1, runCount: runs.length, gateIds, runs };
}

export function main(args = process.argv.slice(2)) {
  const inputAt = args.indexOf('--input'); const outputAt = args.indexOf('--output');
  if (inputAt === -1 || outputAt === -1 || !args[inputAt + 1] || !args[outputAt + 1]) throw new Error('Usage: node scripts/generate-validation-timing-trend.mjs --input <timings.json> --output <trend.json>');
  const input = JSON.parse(readFileSync(resolve(args[inputAt + 1]), 'utf8'));
  writeFileSync(resolve(args[outputAt + 1]), `${JSON.stringify(timingTrend([input]), null, 2)}\n`, 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { try { main(); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; } }
