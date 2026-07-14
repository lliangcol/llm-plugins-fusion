#!/usr/bin/env node
/** Run every public-safe demo in non-mutating preview mode. */
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { runProcess } from './lib/process-runner.mjs';

const root = repoRoot(import.meta.url);

export async function main(args = process.argv.slice(2)) {
  if (args.length) { console.error('Usage: node scripts/demo-all.mjs'); return 1; }
  for (const [label, script, scriptArgs = []] of [
    ['route demo', 'scripts/demo-route.mjs'],
    ['review demo', 'scripts/demo-review.mjs'],
    ['plugin install preview', 'scripts/validate-plugin-install.mjs', ['--dry-run']],
  ]) {
    console.log(`\n== ${label} ==`);
    const result = await runProcess(label, process.execPath, [script, ...scriptArgs], { cwd: root, capture: false, timeoutMs: 60_000 });
    if (!result.ok) return 1;
  }
  console.log('\nOK demo:all completed without user-scope mutation.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
