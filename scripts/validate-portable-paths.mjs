#!/usr/bin/env node
/** Reject file-URL pathname shortcuts that break Windows drive-letter paths. */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const excluded = new Set(['.git', '.codex', '.metrics', 'node_modules', 'coverage', 'dist', 'build']);
const offenders = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (/\.[cm]?js$/u.test(entry.name)) {
      const source = readFileSync(path, 'utf8');
      if (/new URL\([^\n]*import\.meta\.url[^\n]*\)\.pathname/u.test(source)
        || /new URL\(`file:\/\/\$\{process\.argv\[1\]\}`\)/u.test(source)) {
        offenders.push(path.slice(root.length + 1).replaceAll('\\', '/'));
      }
    }
  }
}

visit(root);
assert.deepEqual(offenders, [], `non-portable file URL path handling: ${offenders.join(', ')}`);
console.log('OK portable file URL handling');
