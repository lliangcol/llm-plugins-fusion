#!/usr/bin/env node
/** Dependency-free targeted mutation gate for high-risk path and secret policies. */

import { linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const target = 'evals/baselines/critical-mutation.json';

const mutants = [
  {
    id: 'path-containment-always-allow',
    source: 'nova-plugin/runtime/safe-workspace-path.mjs',
    from: "  return rel === '' || (rel !== '..' && !rel.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(rel));",
    to: '  return true;',
    async test(module) { if (module.isPathInside('/workspace', '/outside')) throw new Error('outside path accepted'); },
  },
  {
    id: 'protected-hardlink-check-disabled',
    source: 'nova-plugin/runtime/safe-workspace-path.mjs',
    from: '    if (protectedTarget && statSync(target).nlink > 1) {',
    to: '    if (false && protectedTarget && statSync(target).nlink > 1) {',
    async test(module, temp) {
      const workspace = resolve(temp, 'workspace');
      mkdirSync(workspace);
      const targetFile = resolve(workspace, 'hooks.json');
      writeFileSync(targetFile, '{}\n');
      linkSync(targetFile, resolve(workspace, 'copy.json'));
      let rejected = false;
      try { module.resolveWorkspaceTarget({ filePath: targetFile, projectRoot: workspace, protectedTarget: true }); } catch { rejected = true; }
      if (!rejected) throw new Error('protected hard link accepted');
    },
  },
  {
    id: 'secret-detection-disabled',
    source: 'nova-plugin/runtime/secret-rules.mjs',
    from: '  return findSensitiveText(value).length > 0;',
    to: '  return false;',
    async test(module) { if (!module.hasSensitiveText(`sk-proj-${'a'.repeat(24)}`)) throw new Error('secret not detected'); },
  },
];

export async function runMutations() {
  const results = [];
  for (const mutant of mutants) {
    const temp = mkdtempSync(resolve(tmpdir(), 'nova-mutation-'));
    try {
      const source = readFileSync(resolve(root, mutant.source), 'utf8');
      if (!source.includes(mutant.from)) throw new Error(`${mutant.id}: mutation anchor drifted`);
      const mutated = source.replace(mutant.from, mutant.to);
      const file = resolve(temp, `${mutant.id}.mjs`);
      writeFileSync(file, mutated, 'utf8');
      let killed = false;
      let reason = null;
      try {
        const module = await import(`${pathToFileURL(file).href}?mutation=${Date.now()}`);
        await mutant.test(module, temp);
      } catch (error) {
        killed = true;
        reason = error.message;
      }
      results.push({ id: mutant.id, source: mutant.source, killed, reason });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }
  return { schemaVersion: 1, executionMode: 'targeted-source-mutation', results, score: results.filter((entry) => entry.killed).length / results.length, targetScore: 0.8 };
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/run-critical-mutations.mjs [--write]');
  const report = await runMutations();
  if (args.includes('--write')) writeFileSync(resolve(root, target), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (report.score < report.targetScore) throw new Error(`critical mutation score ${report.score} is below ${report.targetScore}`);
  console.log(`OK critical mutation score ${(report.score * 100).toFixed(0)}% (${report.results.filter((entry) => entry.killed).length}/${report.results.length})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
});
