#!/usr/bin/env node
/** Generate cost-layered evaluation plans without fabricating live evidence. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveEvaluationFacts } from './lib/evaluation-facts.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const expectedProfileIds = ['critical', 'manual', 'nightly', 'pr', 'release'];

export function buildEvaluationProfiles(registry, datasets) {
  const ids = registry.profiles.map((profile) => profile.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(expectedProfileIds)) throw new Error('evaluation profiles must contain each governed profile exactly once');
  return registry.profiles.map((profile) => {
    const source = datasets[profile.datasetId];
    if (!source) throw new Error(`unknown evaluation dataset: ${profile.datasetId}`);
    const categories = profile.selection.categories ?? [];
    const selectAll = profile.selection.all === true;
    if (selectAll === (categories.length > 0)) throw new Error(`${profile.id} must select either all cases or a non-empty category list`);
    const availableCategories = new Set(source.map((entry) => entry.category));
    for (const category of categories) if (!availableCategories.has(category)) throw new Error(`${profile.id} selects unknown category ${category}`);
    const cases = selectAll ? source : source.filter((entry) => categories.includes(entry.category));
    if (cases.length === 0) throw new Error(`${profile.id} selects no evaluation cases`);
    const external = profile.executionKind === 'external-live';
    if (external && profile.assistants.length === 0) throw new Error(`${profile.id} external-live profile requires assistants`);
    if (!external && profile.assistants.length > 0) throw new Error(`${profile.id} non-live profile must not claim assistant executions`);
    if (external && (!Number.isInteger(profile.attempts) || profile.attempts < 3 || profile.attempts > 5)) throw new Error(`${profile.id} external-live attempts must be between 3 and 5`);
    if (profile.id === 'critical' && (profile.attempts !== 3 || profile.datasetId !== 'critical-live')) throw new Error('critical profile must use critical-live with exactly 3 attempts');
    const planned = external ? cases.length * profile.attempts * profile.conditions.length * profile.assistants.length : cases.length;
    return {
      id: profile.id,
      datasetId: profile.datasetId,
      datasetHash: `sha256:${createHash('sha256').update(JSON.stringify(source)).digest('hex')}`,
      executionKind: profile.executionKind,
      selectedCases: cases.length,
      attempts: profile.attempts,
      conditions: profile.conditions.length,
      assistants: profile.assistants.length,
      planned,
      executed: 0,
      passed: 0,
      skipped: 0,
      blocked: external ? planned : 0,
      evidenceStatus: external ? 'external-evidence' : 'not-verified',
    };
  });
}

export function outputs() {
  const registry = read('governance/evaluation-profiles.json');
  const datasets = {
    'live-paired': read('evals/live/cases.json').cases,
    'critical-live': read('evals/critical-live/cases.json').cases,
  };
  const rows = buildEvaluationProfiles(registry, datasets);
  const facts = deriveEvaluationFacts(root).realTask;
  const json = `${JSON.stringify({ schemaVersion: 1, profiles: rows, evidenceBoundary: 'Plans and local simulations are not live assistant evidence. Model, token, and cost remain unavailable until reported by an authorized runner. Public evidence excludes raw prompts, raw model responses, credentials, and local absolute paths.' }, null, 2)}\n`;
  const md = `# Evaluation profiles\n\nGenerated from \`governance/evaluation-profiles.json\`. Planned, executed, passed, skipped, and blocked are never interchangeable.\n\n| Profile | Dataset | Mode | Cases | Planned | Executed | Passed | Skipped | Blocked | Evidence |\n| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |\n${rows.map((row) => `| ${row.id} | ${row.datasetId} | ${row.executionKind} | ${row.selectedCases} | ${row.planned} | ${row.executed} | ${row.passed} | ${row.skipped} | ${row.blocked} | ${row.evidenceStatus} |`).join('\n')}\n\nThe ${facts.taskCount}-task real-task benchmark remains a separate dataset with ${facts.plannedInvocations} planned external invocations and zero newly authorized executions in this remediation. Legacy minimal CLI observations do not raise compatibility levels.\n`;
  return [['docs/generated/evaluation-profiles.json', json], ['docs/generated/evaluation-profiles.md', md]];
}

export function checkOrWrite({ write = false } = {}) {
  const stale = [];
  for (const [path, content] of outputs()) {
    const target = resolve(root, path);
    if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
      if (write) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      } else stale.push(path);
    }
  }
  if (stale.length) throw new Error(`${stale.join(', ')} evaluation profile outputs are stale`);
}

export function main(args = process.argv.slice(2)) {
  try {
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-evaluation-profiles.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote evaluation profiles' : 'OK evaluation profiles');
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
