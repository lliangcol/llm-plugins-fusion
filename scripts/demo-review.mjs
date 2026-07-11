#!/usr/bin/env node
/**
 * Deterministic headless review and verification demo.
 *
 * This reads public-safe fixtures and prints expected signals. It does not
 * execute Claude Code, Codex, network calls, or marketplace installation.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

function appendList(lines, label, values) {
  lines.push(`${label}:`);
  for (const value of values) lines.push(`  - ${value}`);
}

export function renderReviewDemo(review, verification) {
  const lines = [
    `Headless demo fixture: ${review.id}`,
    `Mode: ${review.mode}`,
    `Title: ${review.title}`,
    '',
    'Boundary: deterministic local fixture only; no LLM, network, Codex, Claude Code, or install path is executed.',
    '',
    `Request: ${review.request}`,
    `Expected command: ${review.expected.command}`,
    `Primary finding: [${review.expected.primaryFinding.severity}] ${review.expected.primaryFinding.signal}`,
    `Fix direction: ${review.expected.primaryFinding.expectedFixDirection}`,
  ];
  appendList(lines, 'Required inputs', review.expected.requiredInputs);
  appendList(lines, 'Good review signals', review.expected.outputSignals);
  appendList(lines, 'Review failure signals', review.expected.failureSignals);
  lines.push('', `Verification fixture: ${verification.id}`, `Expected command: ${verification.expected.command}`);
  appendList(lines, 'Changed files', verification.expected.changedFiles);
  appendList(lines, 'Validation evidence', verification.expected.validation);
  appendList(lines, 'Skipped checks', verification.expected.skippedChecks);
  appendList(lines, 'Residual risk', verification.expected.residualRisk);
  appendList(lines, 'Good handoff signals', verification.expected.outputSignals);
  appendList(lines, 'Handoff failure signals', verification.expected.failureSignals);
  return `${lines.join('\n')}\n`;
}

export function main() {
  process.stdout.write(renderReviewDemo(
    readJson('fixtures/demo/review-signal.json'),
    readJson('fixtures/demo/verification-evidence.json'),
  ));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
