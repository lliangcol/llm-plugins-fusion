#!/usr/bin/env node
/** Validate ownership, cadence, expiry, and evidence boundaries for governed facts. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);

export function evaluateGovernanceFreshness(document, now = new Date()) {
  if (document?.schemaVersion !== 1 || !Array.isArray(document.facts)) throw new Error('invalid evidence governance document');
  const ids = new Set();
  const stale = [];
  const unavailable = [];
  for (const fact of document.facts) {
    if (ids.has(fact.id)) throw new Error(`duplicate governed fact: ${fact.id}`);
    ids.add(fact.id);
    if (!fact.ownerRole || !Number.isInteger(fact.cadenceDays) || !Number.isInteger(fact.expiresAfterDays)) throw new Error(`${fact.id}: owner and cadence are required`);
    if (!existsSync(resolve(root, fact.source))) throw new Error(`${fact.id}: source does not exist`);
    if (fact.evidencePath && !existsSync(resolve(root, fact.evidencePath))) throw new Error(`${fact.id}: evidence path does not exist`);
    if (!fact.reviewedAt) unavailable.push(fact.id);
    else if ((now.getTime() - new Date(`${fact.reviewedAt}T00:00:00Z`).getTime()) / 86_400_000 > fact.expiresAfterDays) stale.push(fact.id);
  }
  return { schemaVersion: 1, status: stale.length ? 'STALE' : (unavailable.length ? 'EVIDENCE_PENDING' : 'CURRENT'), stale, unavailable };
}

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--require-current')) { console.error('Usage: node scripts/validate-governance-freshness.mjs [--require-current]'); return 1; }
  try {
    const result = evaluateGovernanceFreshness(JSON.parse(readFileSync(resolve(root, 'governance/evidence-governance.json'), 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    return args.includes('--require-current') && result.status !== 'CURRENT' ? 2 : 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
