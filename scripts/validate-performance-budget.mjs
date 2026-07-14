#!/usr/bin/env node
/** Validate comparable validate-all timing evidence when a diagnostics report is supplied. */
import { readFileSync } from 'node:fs'; import { resolve } from 'node:path'; import { repoRoot } from './lib/repo-root.mjs';
const root=repoRoot(import.meta.url); const policy=JSON.parse(readFileSync(resolve(root,'governance/validation-performance.json'),'utf8')); const arg=process.argv[2];
if (process.argv.length>3) throw new Error('Usage: node scripts/validate-performance-budget.mjs [diagnostics.json]');
if (!arg) { console.log(`OK performance budgets (${policy.platform}; evidence not supplied)`); process.exit(0); }
const report=JSON.parse(readFileSync(resolve(root,arg),'utf8')); const runtime=report.results?.find((r)=>r.check==='runtime.smoke'); const total=report.results?.reduce((sum,r)=>sum+(r.actual?.durationMs??0),0);
if (typeof total==='number' && total>policy.budgets.validateAllWallMs) throw new Error(`validate-all task wall time ${total}ms exceeds ${policy.budgets.validateAllWallMs}ms`); if(runtime?.actual?.durationMs>policy.budgets.runtimeSmokeWallMs) throw new Error(`runtime smoke ${runtime.actual.durationMs}ms exceeds ${policy.budgets.runtimeSmokeWallMs}ms`); console.log(`OK observed performance budgets (${total ?? 'unavailable'}ms summed task wall time; CPU time unavailable)`);
