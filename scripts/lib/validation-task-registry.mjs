import { commandExists, runProcess } from './process-runner.mjs';

const common = {
  outputs: [], deps: [], platforms: ['windows', 'linux', 'macos'], networkPolicy: 'deny',
  mutationPolicy: 'deny', cachePolicy: 'never', timeoutMs: 120_000, reasonCodes: ['CHECK_PASSED', 'VALIDATION_FAILED'],
  skippedPattern: null,
};

const patterns = {
  core: ['package.json', 'package-lock.json', '.node-version', 'tsconfig.checkjs.json', 'scripts/**/*.mjs', 'framework/**', 'packages/**'],
  schema: ['schemas/**', 'governance/**/*.json', 'workflow-specs/**/*.json', 'fixtures/**/*.json'],
  workflow: ['workflow-specs/**', 'nova-plugin/commands/**', 'nova-plugin/skills/**', 'nova-plugin/runtime/contracts/**', 'adapters/**', 'evals/**'],
  docs: ['**/*.md', 'governance/doc-metadata.json', 'governance/docs-migrations.json', 'governance/workflow-docs.json', 'scripts/generate-*.mjs', 'scripts/validate-docs/**'],
  hooks: ['nova-plugin/hooks/**', 'nova-plugin/runtime/**', 'scripts/validate-hooks.mjs', 'scripts/validate-runtime-smoke.mjs'],
  github: ['.github/**', 'scripts/validate-github-workflows.mjs'],
  release: ['governance/release-*.json', 'governance/stable-install-proof.json', 'scripts/*release*.mjs', 'docs/operations/releases/**', 'docs/templates/evidence/**'],
  dependency: ['package.json', 'package-lock.json', 'governance/dependency-*.json', 'schemas/dependency-*.json', 'scripts/audit-dependenc*.mjs', 'docs/generated/dependency-*.md'],
  tests: ['tests/**', 'fixtures/**', 'scripts/run-*.mjs', 'scripts/validate-regression.mjs'],
};

function node(id, label, script, group, inputs, extra = {}) {
  return { ...common, id, label, group, runner: { kind: 'node', command: process.execPath, args: [script] }, inputs, ...extra };
}

function command(id, label, commandValue, args, group, inputs, extra = {}) {
  return { ...common, id, label, group, runner: { kind: 'command', command: commandValue, args }, inputs, ...extra };
}

function dynamic(id, label, dynamicKind, group, inputs, extra = {}) {
  return { ...common, id, label, group, runner: { kind: 'dynamic', dynamicKind }, inputs, ...extra };
}

export const validationTaskDefinitions = [
  command('js.typecheck', 'typecheck JavaScript package boundaries', process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.checkjs.json'], 1, patterns.core),
  node('packages.workspaces', 'validate private workspace boundaries', 'scripts/validate-workspaces.mjs', 1, patterns.core),
  node('schema.validate', 'validate schemas', 'scripts/validate-schemas.mjs', 1, patterns.schema),
  node('project.state', 'validate project state', 'scripts/validate-project-state.mjs', 1, [...patterns.schema, 'CLAUDE.md']),
  node('registry.fixtures', 'validate registry fixtures', 'scripts/validate-registry-fixtures.mjs', 1, ['.claude-plugin/**', 'fixtures/registry/**', 'schemas/registry-source.schema.json']),
  node('claude.manifest.static', 'validate Claude compatibility', 'scripts/validate-claude-compat.mjs', 1, ['.claude-plugin/**', 'nova-plugin/**'], { skippedPattern: 'skipping live claude plugin validate checks' }),
  node('frontmatter.lint', 'lint frontmatter', 'scripts/lint-frontmatter.mjs', 1, ['nova-plugin/commands/**', 'nova-plugin/skills/**', 'nova-plugin/agents/**']),
  node('workflow.permissions', 'validate workflow permissions', 'scripts/generate-workflow-permissions.mjs', 1, patterns.workflow),
  node('workflow.contract.v5', 'validate workflow capability contract v5', 'scripts/validate-workflow-contract-v5.mjs', 1, patterns.workflow),
  node('workflow.contract.v6.projection', 'validate deterministic Contract v6 projection', 'scripts/migrate-v6-contracts.mjs', 1, patterns.workflow),
  node('workflow.eval.corpus.projection', 'validate deterministic bilingual eval corpus', 'scripts/generate-eval-corpus.mjs', 1, patterns.workflow),
  node('workflow.behavior.surfaces', 'validate generated behavior surfaces', 'scripts/generate-behavior-surfaces.mjs', 1, patterns.workflow),
  node('workflow.runtime.contracts', 'validate behavior-complete runtime contracts', 'scripts/generate-runtime-contracts.mjs', 1, patterns.workflow),
  node('workflow.runtime.behavior', 'validate direct command behavior contracts', 'scripts/validate-runtime-behavior-contracts.mjs', 1, patterns.workflow),
  node('workflow.behavior.golden', 'validate behavior IR golden suites', 'scripts/validate-behavior-golden.mjs', 1, [...patterns.workflow, ...patterns.tests]),
  node('workflow.live.dataset', 'validate live eval dataset', 'scripts/validate-live-eval-dataset.mjs', 1, ['evals/**', 'schemas/eval-*.json']),
  node('workflow.real-task.benchmark', 'validate real-task benchmark plan and report', 'scripts/run-real-task-benchmark.mjs', 1, ['evals/**', 'scripts/run-real-task-benchmark.mjs']),
  node('workflow.second-product', 'validate second-product full chain', 'scripts/validate-second-product-fixture.mjs', 1, [...patterns.workflow, 'fixtures/products/**']),
  node('schemas.differential', 'validate standard schema engine differential', 'scripts/validate-schema-engine-differential.mjs', 1, patterns.schema),
  node('release.operations', 'validate release operations governance', 'scripts/validate-release-operations.mjs', 1, patterns.release),
  node('governance.freshness', 'validate governed fact freshness', 'scripts/validate-governance-freshness.mjs', 1, ['governance/**', 'scripts/validate-governance-freshness.mjs']),
  node('release.channels', 'validate release-channel facts', 'scripts/validate-release-channel-facts.mjs', 1, patterns.release),
  node('control.complexity', 'validate control-plane complexity budget', 'scripts/validate-control-plane-complexity.mjs', 1, ['governance/complexity-budget.json', 'scripts/**', 'package.json']),
  node('control.task.catalog', 'validate maintainer task catalog', 'scripts/generate-task-catalog.mjs', 1, ['governance/task-registry.json', 'scripts/**', 'package.json', '.github/**']),
  node('control.inventory', 'validate generated control-plane inventory', 'scripts/generate-control-plane-inventory.mjs', 1, ['package.json', 'scripts/**', 'governance/**', '.github/**', 'docs/reference/architecture/control-plane.md']),
  node('facts.graph', 'validate generated fact graph', 'scripts/generate-fact-graph.mjs', 1, ['governance/**', 'package.json', 'CLAUDE.md']),
  node('platform.file.urls', 'validate portable file URL handling', 'scripts/validate-portable-paths.mjs', 1, ['scripts/**', 'tests/**']),
  node('workflow.surface.normalization', 'validate normalized workflow surfaces', 'scripts/normalize-workflow-surfaces.mjs', 1, patterns.workflow),

  dynamic('agents.verify', 'verify agents', 'agents', 2, ['nova-plugin/agents/**', 'scripts/verify-agents.*']),
  node('packs.validate', 'validate packs', 'scripts/validate-packs.mjs', 2, ['nova-plugin/packs/**']),
  node('hooks.policy', 'validate hooks', 'scripts/validate-hooks.mjs', 2, patterns.hooks),
  node('github.workflows', 'validate GitHub workflows', 'scripts/validate-github-workflows.mjs', 2, patterns.github),
  node('platform.evidence', 'validate platform evidence matrix', 'scripts/validate-platform-evidence.mjs', 2, ['governance/platform-evidence.json', 'schemas/platform-evidence.schema.json', 'docs/generated/platform-evidence.md', '.github/workflows/ci.yml']),
  dynamic('hooks.syntax', 'hook shell syntax', 'hook-syntax', 2, patterns.hooks, { timeoutMs: 30_000, reasonCodes: ['CHECK_PASSED', 'BASH_CAPABILITY_UNAVAILABLE', 'VALIDATION_FAILED'] }),

  dynamic('runtime.smoke', 'validate runtime smoke', 'runtime-smoke', 3, patterns.hooks, { reasonCodes: ['CHECK_PASSED', 'BASH_CAPABILITY_UNAVAILABLE', 'VALIDATION_FAILED'] }),
  node('surface.budget', 'validate surface budget', 'scripts/validate-surface-budget.mjs', 3, ['nova-plugin/**', 'scripts/surface-budget.allowlist.json']),
  node('surface.inventory', 'validate surface inventory', 'scripts/generate-surface-inventory.mjs', 3, ['nova-plugin/**', 'docs/**', 'scripts/generate-surface-inventory.mjs'], { cachePolicy: 'content' }),
  node('distribution.risk', 'scan distribution risk', 'scripts/scan-distribution-risk.mjs', 3, ['nova-plugin/**', 'docs/**', 'README.md', 'CLAUDE.md', 'AGENTS.md', 'governance/**', 'scripts/distribution-risk.allowlist.json'], { cachePolicy: 'content' }),
  node('regression.validate', 'validate regression', 'scripts/validate-regression.mjs', 3, [...patterns.tests, 'README.md', 'CLAUDE.md', 'AGENTS.md']),
  node('workflow.fixtures', 'validate workflow fixtures', 'scripts/validate-workflow-fixtures.mjs', 3, [...patterns.workflow, 'fixtures/workflow/**']),
  node('workflow.route.conformance', 'validate route conformance cases', 'scripts/validate-route-conformance.mjs', 3, ['evals/**', ...patterns.workflow]),
  node('workflow.static.contract', 'validate static contract baseline', 'scripts/evaluate-static-contracts.mjs', 3, ['evals/**', ...patterns.workflow]),
  node('workflow.adapter.simulation', 'validate adapter simulation baseline', 'scripts/evaluate-adapter-simulation.mjs', 3, ['evals/**', ...patterns.workflow]),
  node('workflow.surface.ab', 'validate workflow surface A/B evidence', 'scripts/evaluate-workflow-surfaces.mjs', 3, ['evals/**', ...patterns.workflow]),
  node('assistant.adapters', 'validate assistant adapter conformance', 'scripts/validate-adapter-conformance.mjs', 3, ['adapters/**', ...patterns.workflow]),
  node('workflow.quality.dataset', 'validate workflow quality dataset', 'scripts/validate-workflow-quality-evals.mjs', 3, ['evals/**', ...patterns.workflow]),
  command('workflow.paired.dry-run', 'validate paired live evaluation plan', process.execPath, ['scripts/evaluate-paired-live.mjs', '--dry-run'], 3, ['evals/**', ...patterns.workflow]),
  node('assistant.live.evidence', 'validate assistant live evidence', 'scripts/validate-assistant-evidence.mjs', 3, ['evals/**', 'governance/assistant-support.json', 'schemas/adapter-evidence.schema.json']),
  node('assistant.compatibility.registry', 'validate compatibility evidence registry', 'scripts/generate-compatibility-evidence.mjs', 3, ['governance/assistant-support.json', 'governance/compatibility-evidence.generated.json', 'evals/**']),
  node('quality.public.report', 'validate public quality report', 'scripts/generate-quality-report.mjs', 3, ['docs/**', 'evals/**', 'governance/**'], { cachePolicy: 'content' }),
  node('community.governance', 'validate community governance', 'scripts/validate-community-governance.mjs', 3, ['.github/**', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs/**'], { cachePolicy: 'content' }),
  node('critical.mutation', 'validate critical mutation score', 'scripts/run-critical-mutations.mjs', 3, [...patterns.tests, 'scripts/**']),
  node('docs.validate', 'validate docs', 'scripts/validate-docs.mjs', 3, patterns.docs, { cachePolicy: 'content' }),
  node('docs.command.generated', 'validate generated command docs', 'scripts/generate-command-docs.mjs', 3, [...patterns.docs, ...patterns.workflow], { cachePolicy: 'content' }),
  node('docs.governance.generated', 'validate document governance outputs', 'scripts/generate-doc-governance.mjs', 3, patterns.docs, { cachePolicy: 'content' }),
  node('docs.migrations', 'validate documentation compatibility migrations', 'scripts/migrate-documentation-layout.mjs', 3, patterns.docs, { cachePolicy: 'content' }),
  node('security.dependency-audit', 'validate dependency vulnerability evidence', 'scripts/audit-dependencies.mjs', 3, patterns.dependency),
  node('security.license-audit', 'validate dependency license evidence', 'scripts/audit-dependency-licenses.mjs', 3, patterns.dependency),
  node('eval.profiles', 'validate layered evaluation profiles', 'scripts/generate-evaluation-profiles.mjs', 3, ['evals/**', 'governance/evaluation-profiles.json']),
  node('evidence.levels', 'validate engineering evidence taxonomy', 'scripts/generate-evidence-levels.mjs', 3, ['governance/evidence-levels.json', 'docs/generated/evidence-levels.md', 'governance/stable-install-proof.json']),
  node('performance.policy', 'validate performance policy', 'scripts/validate-performance-budget.mjs', 3, ['governance/validation-performance.json', 'schemas/validation-performance.schema.json', 'scripts/validate-performance-budget.mjs']),
  node('docs.tutorials', 'validate executable tutorials', 'scripts/validate-tutorials.mjs', 3, ['docs/tutorials/**', 'fixtures/**', 'scripts/validate-tutorials.mjs']),
  node('release.summary', 'validate generated release summary', 'scripts/generate-release-summary.mjs', 3, patterns.release),
];

export function registryMetadata() {
  return validationTaskDefinitions.map(({ runner, skippedPattern, ...definition }) => ({
    ...definition, runner: runner.kind === 'node' ? runner.args[0] : runner.dynamicKind ?? (runner.command === process.execPath ? 'node' : runner.command),
    args: runner.args ?? [], ...(skippedPattern ? { skippedPattern } : {}),
  }));
}

function skippedResult(definition, message) {
  return { id: definition.id, label: definition.label, ok: true, skipped: true, warning: message, stdout: '', stderr: '', ms: 0, reasonCode: 'BASH_CAPABILITY_UNAVAILABLE' };
}

function failedResult(definition, message) {
  return { id: definition.id, label: definition.label, ok: false, errorMessage: message, stdout: '', stderr: '', ms: 0 };
}

async function dynamicRunners(definition, { root, bashCommand, hasBash }) {
  const run = (commandValue, args, label = definition.label) => runProcess(label, commandValue, args, { cwd: root, timeoutMs: definition.timeoutMs });
  if (definition.runner.dynamicKind === 'agents') {
    if (process.platform !== 'win32') return [{ ...definition, run: () => run(bashCommand, ['scripts/verify-agents.sh']) }];
    const powershell = await commandExists('powershell', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { cwd: root, timeoutMs: 10_000 });
    const pwsh = powershell ? false : await commandExists('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { cwd: root, timeoutMs: 10_000 });
    const shell = powershell ? 'powershell' : pwsh ? 'pwsh' : null;
    return [{ ...definition, run: async () => shell ? { ...await run(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/verify-agents.ps1']), id: definition.id } : failedResult(definition, 'neither powershell nor pwsh was found') }];
  }
  if (definition.runner.dynamicKind === 'hook-syntax') {
    if (!hasBash) return [{ ...definition, run: async () => process.platform === 'win32' ? skippedResult(definition, 'WARNING hook shell syntax: bash not found; local Bash evidence is skipped') : failedResult(definition, 'bash is required outside Windows') }];
    return ['pre-write-check.sh', 'pre-bash-check.sh', 'post-audit-log.sh'].map((file) => {
      const id = `hooks.syntax.${file.split('.')[0].replaceAll('-', '')}`;
      const label = `hook shell syntax nova-plugin/hooks/scripts/${file}`;
      return { ...definition, id, label, run: async () => ({ ...await run(bashCommand, ['-n', `nova-plugin/hooks/scripts/${file}`], label), id }) };
    });
  }
  if (definition.runner.dynamicKind === 'runtime-smoke') {
    if (hasBash) return [{ ...definition, run: async () => ({ ...await run(process.execPath, ['scripts/validate-runtime-smoke.mjs']), id: definition.id }) }];
    return [{ ...definition, run: async () => process.platform === 'win32' ? skippedResult(definition, 'WARNING runtime smoke: bash not found; local Bash launcher evidence is skipped') : failedResult(definition, 'bash is required outside Windows') }];
  }
  throw new Error(`unknown dynamic validation runner: ${definition.runner.dynamicKind}`);
}

export async function createRunnableTasks({ root, bashCommand, hasBash, selectedIds = null }) {
  const groups = new Map([[1, []], [2, []], [3, []]]);
  for (const definition of validationTaskDefinitions) {
    if (selectedIds && !selectedIds.includes(definition.id)) continue;
    let tasks;
    if (definition.runner.kind === 'dynamic') tasks = await dynamicRunners(definition, { root, bashCommand, hasBash });
    else tasks = [{ ...definition, run: async () => {
      const result = await runProcess(definition.label, definition.runner.command, definition.runner.args, { cwd: root, timeoutMs: definition.timeoutMs });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      return { ...result, id: definition.id, skipped: result.ok && definition.skippedPattern ? output.toLowerCase().includes(definition.skippedPattern) : false };
    } }];
    groups.get(definition.group).push(...tasks);
  }
  return groups;
}
