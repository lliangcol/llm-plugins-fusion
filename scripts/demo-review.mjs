#!/usr/bin/env node
/**
 * Deterministic headless review and verification demo.
 *
 * This reads public-safe fixtures and prints expected signals. It does not
 * execute Claude Code, Codex, network calls, or marketplace installation.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

function printList(label, values) {
  console.log(`${label}:`);
  for (const value of values) console.log(`  - ${value}`);
}

const review = readJson('fixtures/demo/review-signal.json');
const verification = readJson('fixtures/demo/verification-evidence.json');

console.log(`Headless demo fixture: ${review.id}`);
console.log(`Mode: ${review.mode}`);
console.log(`Title: ${review.title}`);
console.log('');
console.log('Boundary: deterministic local fixture only; no LLM, network, Codex, Claude Code, or install path is executed.');
console.log('');
console.log(`Request: ${review.request}`);
console.log(`Expected command: ${review.expected.command}`);
console.log(`Primary finding: [${review.expected.primaryFinding.severity}] ${review.expected.primaryFinding.signal}`);
console.log(`Fix direction: ${review.expected.primaryFinding.expectedFixDirection}`);
printList('Required inputs', review.expected.requiredInputs);
printList('Good review signals', review.expected.outputSignals);
printList('Review failure signals', review.expected.failureSignals);

console.log('');
console.log(`Verification fixture: ${verification.id}`);
console.log(`Expected command: ${verification.expected.command}`);
printList('Changed files', verification.expected.changedFiles);
printList('Validation evidence', verification.expected.validation);
printList('Skipped checks', verification.expected.skippedChecks);
printList('Residual risk', verification.expected.residualRisk);
printList('Good handoff signals', verification.expected.outputSignals);
printList('Handoff failure signals', verification.expected.failureSignals);
