#!/usr/bin/env node
/**
 * Deterministic headless route demo.
 *
 * This reads a public-safe fixture and prints expected signals. It does not
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

export function renderRouteDemo(fixture) {
  const lines = [
    `Headless demo fixture: ${fixture.id}`,
    `Mode: ${fixture.mode}`,
    `Title: ${fixture.title}`,
    '',
    'Boundary: deterministic local fixture only; no LLM, network, Codex, Claude Code, or install path is executed.',
    '',
    `Request: ${fixture.request}`,
    `Expected next command: ${fixture.expected.nextCommand}`,
    `Expected stage: ${fixture.expected.stage}`,
  ];
  appendList(lines, 'Expected packs', fixture.expected.packs);
  appendList(lines, 'Required inputs', fixture.expected.requiredInputs);
  appendList(lines, 'Good output signals', fixture.expected.outputSignals);
  appendList(lines, 'Failure signals', fixture.expected.failureSignals);
  return `${lines.join('\n')}\n`;
}

export function main() {
  process.stdout.write(renderRouteDemo(readJson('fixtures/demo/route-basic.json')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
