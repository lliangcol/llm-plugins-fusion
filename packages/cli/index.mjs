import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDirectory, buildArtifact, migrateBehaviorSpec, migrateWorkflowSpec } from '@llm-plugins-fusion/compiler';
import { evaluateBundle, testConformance } from '@llm-plugins-fusion/conformance';
import { inspectSpecBundle, SPEC_ERROR, SpecBundleError, validateAndLoadSpecBundle } from '@llm-plugins-fusion/spec';
import { createSpecSchemaValidator } from './schema-validator.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry } from '../../scripts/lib/diagnostics.mjs';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

export const EXIT = Object.freeze({ OK: 0, USAGE: 2, VALIDATION: 3, IO: 4, CONFORMANCE: 5 });
const json = (value) => `${JSON.stringify(value)}\n`;
const validateSchema = createSpecSchemaValidator();
const repositoryPackageName = 'llm-plugins-fusion-maintenance';

const checkProfiles = Object.freeze({
  quick: [
    ['schemas', 'scripts/validate-schemas.mjs'],
    ['frontmatter', 'scripts/lint-frontmatter.mjs'],
    ['docs', 'scripts/validate-docs.mjs'],
    ['hooks', 'scripts/validate-hooks.mjs'],
  ],
  full: [
    ['full-validation', 'scripts/validate-all.mjs'],
  ],
  security: [
    ['typecheck', 'node', 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.checkjs.json'],
    [
      'shellcheck',
      'shellcheck',
      '-x',
      '-P',
      'nova-plugin/skills/nova-codex-review-fix/scripts',
      'scripts/verify-agents.sh',
      'nova-plugin/hooks/scripts/post-audit-log.sh',
      'nova-plugin/hooks/scripts/pre-bash-check.sh',
      'nova-plugin/hooks/scripts/pre-write-check.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
    ],
    ['actionlint', 'actionlint'],
    ['github-workflows', 'scripts/validate-github-workflows.mjs'],
    ['distribution-risk', 'scripts/scan-distribution-risk.mjs'],
  ],
  release: [
    ['coverage', 'scripts/run-test-coverage.mjs', '--check'],
    ['maintainer-evidence', 'scripts/validate-maintainer.mjs', '--evidence-only'],
    ['install-preview', 'scripts/validate-plugin-install.mjs', '--dry-run'],
  ],
});

const generateProfiles = Object.freeze({
  docs: [
    ['diagnostics-docs', 'scripts/generate-diagnostics-docs.mjs'],
    ['command-docs', 'scripts/generate-command-docs.mjs'],
    ['prompt-surface-report', 'scripts/generate-prompt-surface-report.mjs'],
    ['doc-governance', 'scripts/generate-doc-governance.mjs'],
  ],
  runtime: [
    ['contract-v6', 'scripts/migrate-v6-contracts.mjs'],
    ['workflow-permissions', 'scripts/generate-workflow-permissions.mjs'],
    ['runtime-contracts', 'scripts/generate-runtime-contracts.mjs'],
    ['behavior-surfaces', 'scripts/generate-behavior-surfaces.mjs'],
    ['adapters', 'scripts/generate-adapters.mjs'],
    ['eval-corpus', 'scripts/generate-eval-corpus.mjs'],
  ],
  release: [
    ['registry', 'scripts/generate-registry.mjs'],
    ['surface-inventory', 'scripts/generate-surface-inventory.mjs'],
    ['evaluation-profiles', 'scripts/generate-evaluation-profiles.mjs'],
    ['compatibility-evidence', 'scripts/generate-compatibility-evidence.mjs'],
    ['quality-report', 'scripts/generate-quality-report.mjs'],
    ['evidence-levels', 'scripts/generate-evidence-levels.mjs'],
    ['project-state', 'scripts/generate-project-state.mjs'],
    ['fact-graph', 'scripts/generate-fact-graph.mjs'],
    ['doc-facts', 'scripts/sync-doc-facts.mjs'],
    ['release-summary', 'scripts/generate-release-summary.mjs'],
    ['task-catalog', 'scripts/generate-task-catalog.mjs'],
    ['control-plane', 'scripts/generate-control-plane-inventory.mjs'],
  ],
});

function usageError(message) {
  return Object.assign(new Error(message), { exitCode: EXIT.USAGE });
}

export function parseRepositoryCommandArgs(command, args) {
  let profile = null;
  let root = '.';
  let rootSeen = false;
  let write = false;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') {
      if (rootSeen) throw usageError('--root may be specified only once');
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw usageError('--root requires a value');
      root = args[index + 1];
      rootSeen = true;
      index += 1;
      continue;
    }
    if (arg === '--write') {
      if (command !== 'generate') throw usageError('--write is valid only for generate');
      if (write) throw usageError('--write may be specified only once');
      write = true;
      continue;
    }
    if (arg.startsWith('-')) throw usageError(`unknown option: ${arg}`);
    if (profile !== null) throw usageError(`unexpected argument: ${arg}`);
    profile = arg;
  }
  if (!profile) throw usageError(`${command} requires a profile`);
  const profiles = command === 'check' ? checkProfiles : generateProfiles;
  if (profile !== 'all' && !Object.hasOwn(profiles, profile)) throw usageError(`unknown ${command} profile: ${profile}`);
  if (command === 'check' && profile === 'all') throw usageError('unknown check profile: all');
  return { profile, root: resolve(root), write };
}

function repositoryRoot(root) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  } catch (error) {
    throw Object.assign(new Error(`repository root is unreadable: ${error.message}`), { exitCode: EXIT.IO });
  }
  if (manifest.name !== repositoryPackageName || manifest.private !== true) {
    throw Object.assign(new Error(`--root must select the ${repositoryPackageName} repository`), { exitCode: EXIT.IO });
  }
  return root;
}

export function repositoryProfilePlan(command, profile, { write = false } = {}) {
  const profiles = command === 'check' ? checkProfiles : generateProfiles;
  const groups = command === 'generate' && profile === 'all'
    ? ['runtime', 'docs', 'release']
    : [profile];
  return groups.flatMap((group) => profiles[group]).map(([id, runner, ...args]) => {
    if (runner === 'node') {
      return { id, command: process.execPath, args, timeoutMs: 300_000 };
    }
    if (runner === 'shellcheck' || runner === 'actionlint') {
      return { id, command: runner, args, timeoutMs: 300_000 };
    }
    return {
      id,
      command: process.execPath,
      args: [runner, ...args, ...(command === 'generate' && write ? ['--write'] : [])],
      timeoutMs: ['full-validation', 'coverage'].includes(id) ? 300_000 : 180_000,
    };
  });
}

async function executeRepositoryProfile(command, config, runner) {
  const tasks = [];
  for (const task of repositoryProfilePlan(command, config.profile, { write: config.write })) {
    const observed = await runner(task.id, task.command, task.args, {
      cwd: config.root,
      capture: true,
      maxOutputBytes: 65_536,
      timeoutMs: task.timeoutMs,
    });
    const summary = {
      id: task.id,
      ok: observed.ok,
      code: observed.code,
      signal: observed.signal,
      timedOut: observed.timedOut,
      ms: observed.ms,
      stdoutTruncated: observed.stdoutTruncated,
      stderrTruncated: observed.stderrTruncated,
      ...(!observed.ok ? {
        error: observed.errorMessage ?? null,
        stdout: observed.stdout,
        stderr: observed.stderr,
      } : {}),
    };
    tasks.push(summary);
    if (!observed.ok) return { passed: false, tasks, exitCode: observed.code === null ? EXIT.IO : EXIT.VALIDATION };
  }
  return { passed: true, tasks, exitCode: EXIT.OK };
}

/**
 * @param {string[]} args
 * @param {string} name
 * @param {string | null} [fallback]
 * @returns {string | null}
 */
function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw Object.assign(new Error(`${name} requires a value`), { exitCode: EXIT.USAGE });
  return args[index + 1];
}

function init(root) {
  const adaptersRoot = resolve(root, 'adapters');
  try {
    const adapters = lstatSync(adaptersRoot);
    if (adapters.isSymbolicLink() || !adapters.isDirectory()) {
      throw new Error('initialization adapters target must be a real directory');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const files = {
    'framework.json': { schemaVersion: 4, permissionStates: ['denied', 'prompt', 'preapproved', 'unsupported', 'explicit'], permissionPolicyKeys: ['workspaceRead', 'workspaceWrite', 'shell', 'network', 'credentials', 'userScopeMutation', 'externalPublish', 'gitHistoryMutation'], riskLevels: ['none', 'low', 'medium', 'high'], runtimeNeedLevels: ['none', 'optional', 'required'], credentialSources: ['none', 'assistant-owned-authentication', 'consumer-owned-authentication'], enforcementLevels: ['native-and-hook', 'adapter', 'advisory', 'unsupported'] },
    'product.json': { schemaVersion: 2, pluginNamespace: 'example-flow', expectedWorkflowCount: 1, stages: ['intake'], primaryEntrypoints: ['triage'], runtimeCompatibility: { 'example-host': '1.0.0' }, adapterDefinitions: ['adapters/example.json'], agents: ['coordinator'], packs: [], tools: ['Inspect'] },
    'workflows.json': { schemaVersion: 5, contractVersions: { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' }, permissionProfiles: { inspect: { allowedTools: ['Inspect'], disallowedTools: [], permissionPolicy: { workspaceRead: 'preapproved', workspaceWrite: 'denied', shell: 'denied', network: 'denied', credentials: 'denied', userScopeMutation: 'denied', externalPublish: 'denied', gitHistoryMutation: 'denied' } } }, workflows: [{ id: 'triage', stage: 'intake', ownerAgents: ['coordinator'], recommendedPacks: [], requiredInputs: ['REQUEST'], outputContract: 'triage-v1', risk: 'none', modelInvocable: true, subagentSafe: true, permissionProfile: 'inspect', legacyAlias: 'example-triage', contractPath: 'contracts/triage.md', canonicalSurfaceId: 'triage', variantPreset: {}, compatibilityAlias: false }] },
    'behaviors.json': { schemaVersion: 1, behaviors: [{ id: 'triage', purpose: 'Triage a request.', inputs: [{ name: 'REQUEST', required: true, aliases: [], description: 'Request.' }], decisionTable: [{ when: 'REQUEST exists.', action: 'Triage it.' }], invariants: ['No writes.'], stopConditions: ['REQUEST missing.'], workflowSteps: [{ id: 'triage', action: 'Triage.' }], deviationPolicy: { mode: 'forbid', instructions: 'No deviation.' }, output: { mode: 'chat', fields: [{ name: 'next step', required: true, description: 'Next step.' }], order: ['next step'], severityLevels: [] }, validation: ['One next step.'], failureOutput: { fields: ['status'], order: ['status'] } }] },
    'adapters/example.json': { schemaVersion: 1, id: 'example', enforcement: 'advisory', declaredLevel: 'L1', maximumSupportedLevel: 'L2', invocation: { kind: 'contract-manifest', prefix: 'example:' }, evidenceRequiredFor: ['L2'] },
  };
  const existing = Object.keys(files).filter((path) => {
    try { lstatSync(resolve(root, path)); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  });
  if (existing.length) throw new Error(`initialization target already exists: ${existing.sort().join(', ')}`);
  mkdirSync(adaptersRoot, { recursive: true });
  const created = [];
  try {
    for (const [path, value] of Object.entries(files)) {
      writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      created.push(path);
    }
  } catch (error) {
    for (const path of created.reverse()) {
      try { rmSync(resolve(root, path), { force: true }); } catch { /* preserve the original initialization failure */ }
    }
    throw error;
  }
  return { files: Object.keys(files).sort() };
}

export async function runCli(args, io = process, { runner = runProcess } = {}) {
  const command = ['--help', '-h'].includes(args[0]) ? 'help' : args[0];
  if (!['help', 'init', 'validate', 'build', 'test', 'eval', 'doctor', 'inspect', 'migrate', 'check', 'generate'].includes(command)) return { exitCode: EXIT.USAGE, output: { ok: false, command: command ?? null, error: 'unknown-command' } };
  try {
    const repositoryConfig = ['check', 'generate'].includes(command)
      ? parseRepositoryCommandArgs(command, args)
      : null;
    const root = repositoryConfig
      ? repositoryRoot(repositoryConfig.root)
      : resolve(option(args, '--root', '.') ?? '.');
    let result;
    if (command === 'help') result = {
      usage: 'llmf <command> [--root <path>] [options]',
      commands: {
        init: 'create a minimal product specification',
        validate: 'compile and validate product conformance',
        build: 'write a compiled artifact with --out <path>',
        test: 'run deterministic conformance checks',
        eval: 'evaluate the compiled bundle',
        doctor: 'report local runtime support',
        inspect: 'summarize the loaded specification',
        migrate: 'preview or write Contract v6/v2 projections',
        check: 'run repository checks: quick, full, security, or release',
        generate: 'check or write repository projections: docs, runtime, release, or all',
      },
      exitCodes: EXIT,
    };
    else if (command === 'check' || command === 'generate') {
      const execution = await executeRepositoryProfile(command, { ...repositoryConfig, root }, runner);
      const repositoryResult = {
        profile: repositoryConfig.profile,
        ...(command === 'generate' ? { write: repositoryConfig.write } : {}),
        passed: execution.passed,
        tasks: execution.tasks,
      };
      if (!execution.passed) return { exitCode: execution.exitCode, output: { ok: false, command, result: repositoryResult } };
      result = repositoryResult;
    }
    else if (command === 'init') result = init(root);
    else if (command === 'doctor') {
      const supported = Number(process.versions.node.split('.')[0]) >= 22;
      const registry = loadReasonRegistry();
      result = diagnosticReport('llmf doctor', [diagnosticResult({ command: 'llmf doctor', check: 'node-version', status: supported ? 'passed' : 'failed', reasonCode: supported ? 'CHECK_PASSED' : 'NODE_VERSION_UNSUPPORTED', expected: '>=22', actual: process.versions.node }, registry)]);
    }
    else if (command === 'validate') { const compiled = compileDirectory(root, { validateSchema }); const conformance = testConformance(compiled); if (!conformance.passed) return { exitCode: EXIT.VALIDATION, output: { ok: false, command, result: conformance } }; result = { valid: true, ...inspectSpecBundle(compiled) }; }
    else if (command === 'inspect') result = inspectSpecBundle(validateAndLoadSpecBundle(root, { validateSchema }));
    else if (command === 'test') { result = testConformance(compileDirectory(root, { validateSchema })); if (!result.passed) return { exitCode: EXIT.CONFORMANCE, output: { ok: false, command, result } }; }
    else if (command === 'eval') result = evaluateBundle(compileDirectory(root, { validateSchema }));
    else if (command === 'build') { const out = option(args, '--out'); if (!out) throw Object.assign(new Error('--out is required'), { exitCode: EXIT.USAGE }); const artifact = buildArtifact(compileDirectory(root, { validateSchema })); mkdirSync(resolve(root, out, '..'), { recursive: true }); writeFileSync(resolve(root, out), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8'); result = { output: resolve(root, out), workflowCount: artifact.workflows.length }; }
    else if (command === 'migrate') { const bundle = validateAndLoadSpecBundle(root, { validateSchema }); const workflows = migrateWorkflowSpec(bundle.workflows, bundle.behaviors); const behaviors = migrateBehaviorSpec(bundle.behaviors); if (args.includes('--write')) { writeFileSync(resolve(root, 'workflows.v6.json'), `${JSON.stringify(workflows, null, 2)}\n`); writeFileSync(resolve(root, 'behaviors.v2.json'), `${JSON.stringify(behaviors, null, 2)}\n`); } result = { write: args.includes('--write'), workflowCount: workflows.workflows.length, workflowSchemaVersion: 6, behaviorSchemaVersion: 2 }; }
    return { exitCode: EXIT.OK, output: { ok: true, command, result } };
  } catch (error) {
    const failure = /** @type {Error & { exitCode?: number }} */ (error);
    const specValidationFailure = failure instanceof SpecBundleError && (failure.code === SPEC_ERROR.SCHEMA || failure.code === SPEC_ERROR.INVARIANT);
    return { exitCode: failure.exitCode ?? (failure instanceof SyntaxError || specValidationFailure ? EXIT.VALIDATION : EXIT.IO), output: { ok: false, command, error: failure.message } };
  }
}

export async function main(args = process.argv.slice(2), io = process) {
  const result = await runCli(args, io);
  (result.exitCode === 0 ? io.stdout : io.stderr).write(json(result.output));
  return result.exitCode;
}
