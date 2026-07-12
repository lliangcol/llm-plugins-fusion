#!/usr/bin/env node
/** Validate lightweight CODEOWNERS, labels-as-code, ADR, and private-reporting contracts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const owners = read('.github/CODEOWNERS');
const labels = read('.github/labels.yml');
const security = read('SECURITY.md');
const adr = read('docs/adr/0001-truth-release-capability-evidence.md');
assert.match(owners, /^\*\s+@/m);
for (const path of ['/.github/', '/schemas/', '/workflow-specs/', '/framework/', '/nova-plugin/hooks/', '/nova-plugin/runtime/']) assert.match(owners, new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+@`, 'm'));
const names = [...labels.matchAll(/name:\s*"([^"]+)"/g)].map((match) => match[1]);
assert.ok(names.length >= 7);
assert.equal(new Set(names).size, names.length);
assert.ok(names.includes('needs evidence'));
assert.match(security, /private vulnerability reporting/i);
assert.match(adr, /Status: accepted/);
console.log(`OK community governance (${names.length} labels, CODEOWNERS, ADR, private reporting)`);
