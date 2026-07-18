#!/usr/bin/env node
/** Generate layered evaluation plans and a public, claim-bounded quality report. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deriveEvaluationFacts } from './lib/evaluation-facts.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const target = 'docs/reference/evaluation/benchmark.md';
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const expectedProfileIds = ['critical', 'manual', 'nightly', 'pilot', 'pr', 'release'];

export function buildEvaluationProfiles(registry, datasets) {
  const ids = registry.profiles.map((profile) => profile.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(expectedProfileIds)) throw new Error('evaluation profiles must contain each governed profile exactly once');
  return registry.profiles.map((profile) => {
    const dataset = datasets[profile.casesPath] ?? datasets[profile.datasetId];
    const source = Array.isArray(dataset) ? dataset : dataset?.cases;
    if (!source) throw new Error(`unknown evaluation dataset: ${profile.datasetId}`);
    if (!Array.isArray(dataset)) {
      if (dataset.datasetId !== profile.datasetId || dataset.datasetVersion !== profile.datasetVersion) throw new Error(`${profile.id} semantic dataset identity differs from its governed profile`);
    }
    const categories = profile.selection.categories ?? [];
    const caseIds = profile.selection.caseIds ?? [];
    const selectAll = profile.selection.all === true;
    if ([selectAll, categories.length > 0, caseIds.length > 0].filter(Boolean).length !== 1) throw new Error(`${profile.id} must select all cases, categories, or case ids`);
    const availableCategories = new Set(source.map((entry) => entry.category));
    for (const category of categories) if (!availableCategories.has(category)) throw new Error(`${profile.id} selects unknown category ${category}`);
    const availableCaseIds = new Set(source.map((entry) => entry.id));
    for (const id of caseIds) if (!availableCaseIds.has(id)) throw new Error(`${profile.id} selects unknown case ${id}`);
    const cases = selectAll ? source : source.filter((entry) => categories.includes(entry.category) || caseIds.includes(entry.id));
    if (cases.length === 0) throw new Error(`${profile.id} selects no evaluation cases`);
    const external = profile.executionKind === 'external-live';
    if (external && profile.assistants.length === 0) throw new Error(`${profile.id} external-live profile requires assistants`);
    if (!external && profile.assistants.length > 0) throw new Error(`${profile.id} non-live profile must not claim assistant executions`);
    if (external && (!Number.isInteger(profile.attempts) || profile.attempts < 3 || profile.attempts > 5)) throw new Error(`${profile.id} external-live attempts must be between 3 and 5`);
    if (['pilot', 'critical'].includes(profile.id) && (profile.attempts !== 3 || profile.datasetId !== 'critical-live')) throw new Error(`${profile.id} profile must use critical-live with exactly 3 attempts`);
    if (profile.id === 'pilot' && (cases.length !== 1 || profile.conditions.length !== 2 || profile.assistants.length !== 2)) throw new Error('pilot profile must define the bounded 12-invocation matrix');
    const expectedPrerequisites = profile.id === 'critical' ? ['pilot'] : ['release', 'manual'].includes(profile.id) ? ['pilot', 'critical'] : [];
    if (JSON.stringify(profile.prerequisiteProfiles) !== JSON.stringify(expectedPrerequisites)) throw new Error(`${profile.id} prerequisite profile order or inventory drifted`);
    const planned = external ? cases.length * profile.attempts * profile.conditions.length * profile.assistants.length : cases.length;
    return {
      id: profile.id,
      datasetId: profile.datasetId,
      datasetVersion: profile.datasetVersion,
      casesPath: profile.casesPath,
      labelsPath: profile.labelsPath,
      datasetHash: `sha256:${createHash('sha256').update(JSON.stringify(source)).digest('hex')}`,
      executionKind: profile.executionKind,
      selectedCases: cases.length,
      attempts: profile.attempts,
      conditions: profile.conditions.length,
      assistants: profile.assistants.length,
      prerequisiteProfiles: profile.prerequisiteProfiles,
      planned,
      executed: 0,
      passed: 0,
      skipped: 0,
      blocked: external ? planned : 0,
      evidenceStatus: external ? 'external-evidence' : 'not-verified',
    };
  });
}

function evaluationProfileOutputs() {
  const registry = readJson('governance/evaluation-profiles.json');
  const datasets = {
    'evals/live/v5/cases.json': readJson('evals/live/v5/cases.json'),
    'evals/critical-live/v5/cases.json': readJson('evals/critical-live/v5/cases.json'),
  };
  const rows = buildEvaluationProfiles(registry, datasets);
  const facts = deriveEvaluationFacts(root).realTask;
  const json = `${JSON.stringify({ schemaVersion: 1, profiles: rows, evidenceBoundary: 'Plans and local simulations are not live assistant evidence. Runner-selected executables have unverified caller-supplied provenance and cannot authorize E5; critical, full, and paired E5 remain blocked until an external governed assistant-release receipt is independently verified. Model, token, and cost remain unavailable until reported by an authorized runner. Public evidence excludes raw prompts, raw model responses, credentials, and local absolute paths.' }, null, 2)}\n`;
  const md = `# Evaluation profiles\n\nGenerated from \`governance/evaluation-profiles.json\`. Planned, executed, passed, skipped, and blocked are never interchangeable.\n\n| Profile | Dataset | Mode | Cases | Planned | Prerequisites | Executed | Passed | Skipped | Blocked | Evidence |\n| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |\n${rows.map((row) => `| ${row.id} | ${row.datasetId}@v${row.datasetVersion} | ${row.executionKind} | ${row.selectedCases} | ${row.planned} | ${row.prerequisiteProfiles.join(', ') || 'none'} | ${row.executed} | ${row.passed} | ${row.skipped} | ${row.blocked} | ${row.evidenceStatus} |`).join('\n')}\n\nThe 12-invocation pilot is diagnostic only while assistant executable provenance is caller-supplied. Critical, full, and paired E5 execution remain blocked by an external governed assistant-release provenance gate even when prerequisite slices pass schema, digest, semantic, completeness, and safety inspection. The ${facts.taskCount}-task real-task benchmark remains a separate dataset with ${facts.plannedInvocations} planned external invocations and zero newly authorized executions in this remediation. Legacy minimal CLI observations do not raise compatibility levels.\n`;
  return [['docs/generated/evaluation-profiles.json', json], ['docs/generated/evaluation-profiles.md', md]];
}

function checkOrWriteEvaluationProfiles({ write = false } = {}) {
  const stale = [];
  for (const [path, content] of evaluationProfileOutputs()) {
    const output = resolve(root, path);
    if (!existsSync(output) || readFileSync(output, 'utf8') !== content) {
      if (write) {
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, content);
      } else stale.push(path);
    }
  }
  if (stale.length) throw new Error(`${stale.join(', ')} evaluation profile outputs are stale`);
}

export function report() {
  const evaluation = deriveEvaluationFacts(root);
  const pilotInvocations = evaluation.livePaired.profileCaseCounts.pilot
    * evaluation.criticalLive.assistants.length
    * evaluation.criticalLive.conditions.length
    * evaluation.criticalLive.attempts;
  const staticResult = readJson('evals/baselines/static-contract.json');
  const simulation = readJson('evals/baselines/adapter-simulation.json');
  const mutation = readJson('evals/baselines/critical-mutation.json');
  const live = ['evals/evidence/2026-07-12-claude-code-live.json', 'evals/evidence/2026-07-12-codex-live.json'].map(readJson);
  const liveRows = live.map((entry) => {
    const latencies = entry.cases.map((item) => item.latencyMs).sort((left, right) => left - right);
    const midpoint = Math.floor(latencies.length / 2);
    const median = latencies.length % 2 === 0
      ? Math.round((latencies[midpoint - 1] + latencies[midpoint]) / 2)
      : latencies[midpoint];
    return `| ${entry.assistant.id} | ${entry.assistant.version} | ${entry.summary.passed}/${entry.summary.total} | ${entry.summary.unsafeSideEffects} | ${entry.summary.inventedSurfaces} | ${median} | ${latencies[0]}–${latencies.at(-1)} | ${latencies.length} | ${entry.workflowSpecSha256.slice(0, 12)} |`;
  }).join('\n');
  return `<!-- migrated-from: docs/quality/benchmark.md -->
# Public Workflow Quality Benchmark

Status: generated
Date: 2026-07-12

## Claim Boundary

Static results prove dataset/spec integrity and simulation proves deterministic adapter state transitions. The checked-in live files below are legacy bare-CLI observations covering only two public-safe prompts; they do not load an adapter, prove broad model quality, establish production latency, or prove release publication. The current \`${evaluation.livePaired.datasetId}\` runner derives ${evaluation.livePaired.caseCount} cases and ${evaluation.livePaired.plannedInvocations} planned invocations from the dataset and paired-plan parameters. The separate \`${evaluation.realTask.datasetId}\` derives ${evaluation.realTask.taskCount} tasks and ${evaluation.realTask.plannedInvocations} planned invocations. Neither plan upgrades claims until complete digest-bound records are retained.

## Staged Live Execution Safety

The bounded \`pilot\` is ${pilotInvocations} invocations: one canonical review case, ${evaluation.criticalLive.assistants.length} assistants, ${evaluation.criticalLive.conditions.length} conditions, and ${evaluation.criticalLive.attempts} attempts. The governed \`critical\` profile is ${evaluation.criticalLive.plannedInvocations} invocations. The full v${evaluation.livePaired.datasetVersion} release profile is ${evaluation.livePaired.plannedInvocations} invocations. The profile registry is the source of truth. Every runner-selected assistant executable is recorded as \`unverified-caller-supplied-executable\`: its bytes are digest-bound for diagnostic attribution, but the caller cannot self-authorize official release provenance. Pilot, partial, and complete multi-case slices therefore make no E5 claim. Critical, full, and paired E5 execution remain blocked by an external governed assistant-release provenance gate until a separately verified release receipt is available. Preview each pilot assistant/condition slice with a hard three-call cap before authorizing any authenticated diagnostic invocation:

\`\`\`bash
node scripts/run-live-assistant-evals.mjs --assistant codex --profile pilot --condition plugin-enabled --max-invocations 3 --output .metrics/live-eval/pilot-codex-enabled.json --plan
\`\`\`

Remove \`--plan\` only after verifying the case list, assistant, condition, attempts, planned calls, cap, output location, and estimated evidence level. Plan mode performs no writes. Live and paired outputs must name a file strictly below \`.metrics/live-eval/\`; tracked files, Git control data, and other repository paths are not valid evidence targets. During an actual run, that bounded output is lexically validated and its missing physical parent directories are prepared before assistant discovery. The exact preparation lease is revalidated for the final atomic commit, so a target or parent that appears, changes identity, becomes linked, or aliases an input after preflight fails closed instead of being overwritten. Enabled prerequisites must pass exact Nova semantics. Disabled baselines may use generic routing, but must be complete, parseable, process-successful, safe, zero-write, cleaned up, and free of plugin staging or load evidence; the CLI uses those gates rather than Nova contract success for the disabled exit code. Critical and full execution require a clean worktree, complete prerequisite slices, and the external provenance gate. Paired verification rejects a dirty worktree, skip-worktree or assume-unchanged flags, and any physical runtime-module drift before loading evidence; it loads schema, profile contract, product semantics, and source digests through one commit snapshot reader so HEAD and worktree state cannot be combined. Prerequisite and output paths must be distinct. Stale, incomplete, duplicate, unsafe, or aliased evidence is rejected before assistant discovery. The runner also records a per-invocation timeout (maximum 240000 ms) and a total runtime cap (maximum 900000 ms); lower values may be supplied explicitly with \`--timeout-ms\` and \`--max-total-runtime-ms\`. Unknown arguments, an attempts override that differs from governance, unsafe output paths, unsafe timeout values, and planned calls above \`--max-invocations\` fail before assistant discovery or execution. Raw stdout, stderr, model responses, CLI debug logs, and last-message files exist only inside a disposable OS temporary directory and are removed after each attempt. Codex additionally uses a disposable \`CODEX_HOME\`, copies only the existing authentication record into it for the invocation, and disables configured MCP, plugin, shell, web-search, browser, computer-use, image, and workspace-dependency surfaces. Both version discovery and live calls receive a minimal allowlisted environment with isolated home/configuration directories; endpoint, provider, model, proxy, shell-startup, and runtime-injection overrides are not inherited. Executable bytes and supported launcher dependencies are physically resolved, digest-bound, and revalidated before discovery and every call. The only supported POSIX script launcher is the exact \`#!/usr/bin/env node\` form; other shebang interpreters, \`env -S\`, and Windows Volta shims fail closed. Public assistant version text is retained only when it matches a conservative path- and credential-free syntax; other version output is represented by a SHA-256 identity. Semantic validity is computed before model-derived route, required-input, and variant fields are normalized; unsafe strings and object keys become deterministic SHA-256 identifiers, so prerequisite and paired recomputation remains idempotent without retaining payload text. Public records retain normalized results, counts, timings, reported usage, bounded summaries, and SHA-256 digests. Credentials, control characters, raw prompts, file URLs, and embedded local absolute paths under any POSIX, Windows, UNC, or custom mount root are rejected; web URLs and controlled \`/nova-plugin:<id>\` routes remain valid public identifiers. Token and cost values remain \`null\` when the CLI does not report them, with \`usageStatus\` and a stable \`usageReasonCode\` explaining availability; the runner never estimates them.

Tool evidence separates allowed read-only orchestration, dangerous attempts, completed dangerous execution, denied or failed dangerous attempts, and fail-closed unknown use. Claude \`Skill\` is allowed read-only orchestration and canonical adapter-load evidence only for \`plugin-enabled\`; any \`Skill\` signal in \`plugin-disabled\` fails evidence classification. Denied \`Write\`, \`Edit\`, \`NotebookEdit\`, \`Bash\`, or unauthorized network tools remain visible but do not count as executed unsafe tool use. Codex JSONL items are deduplicated by item id and retain the final normalized lifecycle state: only completed dangerous calls count as executed, failed or denied calls remain behavioral evidence, and started-only or unknown lifecycles fail closed. Public records retain only tool type, normalized status, hashed item identity, and public-safe or hashed MCP server/tool identifiers; parameters, responses, paths, credentials, and raw events are discarded.

\`adapterStaged\`, \`adapterLoadObserved\`, and \`contractValid\` are independent facts. A matching staged Codex \`AGENTS.md\` digest does not prove that the runtime loaded it, and a route failure does not negate staging or load evidence. Claude \`Skill\` supplies an observed load signal. Codex JSONL currently has no explicit \`AGENTS.md\` load event, so the load state is \`unavailable\` with a stable reason code rather than inferred from contract success. Windows executable lookup prefers direct \`.exe\` files and recognizes only fixed-argv Volta or Node \`.cmd\` shims; generic shell execution and command-string interpretation are forbidden.

## Deterministic Gates

| Layer | Passed | Safety result |
| --- | ---: | --- |
| Static contract | ${staticResult.summary.passed}/${staticResult.summary.total} | Invented surface rate ${staticResult.summary.inventedSurfaceRate} |
| Adapter simulation | ${simulation.summary.passed}/${simulation.summary.total} | Unsafe continuation ${simulation.summary.unsafeContinuation} |
| Targeted critical mutants | ${mutation.results.filter((entry) => entry.killed).length}/${mutation.results.length} | Targeted high-risk operators; not a repository-wide mutation score |

## Historical Bare-CLI Exact-Version Observations

| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | Median ms | Min–max ms | n | Workflow digest |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${liveRows}

Small samples are reported as median and range, not P95. Failed or superseded probes remain under \`evals/evidence-attempts/\` and never upgrade compatibility. Current claims are derived in \`governance/compatibility-evidence.generated.json\`.
`;
}

export function checkOrWrite({ write = false } = {}) {
  checkOrWriteEvaluationProfiles({ write });
  const expected = report();
  const path = resolve(root, target);
  if (write) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected, 'utf8');
  } else if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    throw new Error(`${target} is stale; run node scripts/generate-quality-report.mjs --write`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-quality-report.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? `Wrote evaluation profiles and ${target}` : 'OK evaluation profiles and public quality report');
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
