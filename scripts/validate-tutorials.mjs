#!/usr/bin/env node
/** Execute the public-safe, non-credential tutorial path with semantic assertions. */
import { execFileSync } from 'node:child_process'; import { readFileSync } from 'node:fs'; import { resolve } from 'node:path'; import { repoRoot } from './lib/repo-root.mjs';
const root=repoRoot(import.meta.url); const run=(script)=>execFileSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
const route=run('scripts/demo-route.mjs'); const review=run('scripts/demo-review.mjs'); run('scripts/validate-route-conformance.mjs');
if(!route.includes('Boundary: deterministic local fixture only')||!route.includes('Expected next command')) throw new Error('route tutorial semantics drifted');
if(!review.includes('Primary finding:')||!review.includes('Skipped checks:')) throw new Error('review tutorial semantics drifted');
for(const path of ['docs/tutorials/java-backend.md','docs/tutorials/frontend.md','docs/tutorials/release-and-docs.md','docs/tutorials/workflow-evaluation.md','docs/tutorials/consumer-minimal.md']) { const text=readFileSync(resolve(root,path),'utf8'); if(!text.match(/^# /mu)) throw new Error(`${path} lacks an H1`); }
console.log('OK tutorial smoke (deterministic fixtures; no credentials or user-scope writes)');
