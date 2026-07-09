#!/usr/bin/env node
/**
 * Deterministic headless route demo.
 *
 * This reads a public-safe fixture and prints expected signals. It does not
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

const fixture = readJson('fixtures/demo/route-basic.json');

console.log(`Headless demo fixture: ${fixture.id}`);
console.log(`Mode: ${fixture.mode}`);
console.log(`Title: ${fixture.title}`);
console.log('');
console.log('Boundary: deterministic local fixture only; no LLM, network, Codex, Claude Code, or install path is executed.');
console.log('');
console.log(`Request: ${fixture.request}`);
console.log(`Expected next command: ${fixture.expected.nextCommand}`);
console.log(`Expected stage: ${fixture.expected.stage}`);
printList('Expected packs', fixture.expected.packs);
printList('Required inputs', fixture.expected.requiredInputs);
printList('Good output signals', fixture.expected.outputSignals);
printList('Failure signals', fixture.expected.failureSignals);
