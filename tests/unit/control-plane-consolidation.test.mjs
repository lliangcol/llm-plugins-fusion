import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { buildInventory, inventoryBudgetErrors } from '../../scripts/validate-control-plane-complexity.mjs';
import { registryMetadata } from '../../scripts/lib/validation-task-registry.mjs';
import { repositoryProfilePlan } from '../../packages/cli/index.mjs';

const root = resolve(import.meta.dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const registryRunners = new Set(registryMetadata().flatMap((task) => [task.runner, ...(task.components ?? []).map((component) => component.runner)]));

const removedEntrypoints = {
  'eval:dataset-integrity': { replacement: 'eval:route', command: 'node scripts/validate-route-conformance.mjs' },
  'check:contracts': { replacement: 'validate', command: 'node scripts/validate-all.mjs' },
  'check:tests': { replacement: 'test', command: 'npm run test:unit && npm run test:integration && npm run test:e2e' },
  'check:coverage': { replacement: 'test:coverage:check', command: 'node scripts/run-test-coverage.mjs --check' },
  'validate:release-channels': { replacement: 'validate:release-truth', command: 'node scripts/validate-release-channel-facts.mjs' },
  'validate:evaluation-profiles': { replacement: null, command: 'node scripts/generate-quality-report.mjs' },
  'validate:release-summary': { replacement: null, command: 'node scripts/generate-release-summary.mjs' },
  'validate:tasks': { replacement: null, command: 'node scripts/generate-task-catalog.mjs' },
  'validate:control-plane': { replacement: null, command: 'node scripts/validate-control-plane-complexity.mjs' },
  'validate:evidence-levels': { replacement: null, command: 'node scripts/generate-release-summary.mjs' },
  'validate:permissions': { replacement: null, command: 'node scripts/generate-workflow-permissions.mjs' },
  'validate:command-docs': { replacement: null, command: 'node scripts/generate-command-docs.mjs' },
  'validate:doc-governance': { replacement: null, command: 'node scripts/generate-doc-governance.mjs' },
  'validate:doc-migrations': { replacement: null, command: 'node scripts/migrate-documentation-layout.mjs' },
  'validate:facts': { replacement: null, command: 'node scripts/generate-fact-graph.mjs' },
  'validate:hook-truth': { replacement: null, command: 'node scripts/validate-hooks.mjs' },
  'check:truth': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['check', 'full'] },
  'check:runtime': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['check', 'full'] },
  'check:compatibility': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['check', 'full'] },
  'check:docs': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['check', 'quick'] },
  'check:security': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['check', 'security'] },
  'check:release': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['check', 'release'] },
  'generate:evaluation-profiles': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:release-summary': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:compatibility-evidence': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:facts': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:task-catalog': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:control-plane': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:evidence-levels': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:adapters': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'runtime'] },
  'generate:runtime-contracts': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'runtime'] },
  'generate:behavior-surfaces': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'runtime'] },
  'generate:quality-report': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'release'] },
  'generate:diagnostics-docs': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'docs'] },
  'generate:command-docs': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'docs'] },
  'generate:doc-governance': { replacement: 'llmf', command: 'node packages/cli/bin/llmf.mjs', profile: ['generate', 'docs'] },
};

function walk(directory, extensions) {
  const files = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(path, extensions));
    else if (extensions.some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
  return files;
}

function npmInvocationPattern(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`npm run ${escaped}(?![A-Za-z0-9:_-])`, 'u');
}

test('removed shortcuts resolve to the same retained task or direct read-only command', () => {
  for (const [removed, mapping] of Object.entries(removedEntrypoints)) {
    assert.equal(Object.hasOwn(packageJson.scripts, removed), false, `${removed} must remain removed`);
    if (mapping.replacement) {
      assert.equal(packageJson.scripts[mapping.replacement], mapping.command, `${mapping.replacement} changed underlying task`);
      if (mapping.profile) assert.ok(repositoryProfilePlan(...mapping.profile).length > 0, `${removed} replacement profile is empty`);
    } else {
      assert.equal(mapping.command.includes('--write'), false, `${removed} replacement must remain read-only`);
      const runner = mapping.command.replace(/^node /u, '');
      assert.equal(existsSync(resolve(root, runner)), true, `${removed} direct replacement is missing: ${runner}`);
      assert.equal(registryRunners.has(runner), true, `${removed} direct replacement left the validation registry`);
    }
  }

  assert.equal(packageJson.scripts['ci:full'], packageJson.scripts.validate);
  assert.equal(packageJson.scripts['scan:secrets'], 'node scripts/scan-distribution-risk.mjs');
  assert.equal(packageJson.scripts['scan:distribution'], 'node scripts/scan-distribution-risk.mjs');
});

test('workflows, docs, and maintenance shell call sites do not invoke removed shortcuts', () => {
  const files = [
    ...walk('.github/workflows', ['.yml', '.yaml']),
    ...walk('docs', ['.md']),
    ...walk('scripts', ['.mjs', '.sh', '.ps1']),
    'AGENTS.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    'README.md',
  ];
  for (const path of files) {
    const content = readFileSync(resolve(root, path), 'utf8');
    for (const removed of Object.keys(removedEntrypoints)) {
      assert.doesNotMatch(content, npmInvocationPattern(removed), `${path} invokes removed shortcut ${removed}`);
    }
  }
  for (const [caller, command] of Object.entries(packageJson.scripts)) {
    for (const removed of Object.keys(removedEntrypoints)) {
      assert.doesNotMatch(command, npmInvocationPattern(removed), `package script ${caller} invokes removed shortcut ${removed}`);
    }
  }
});

test('required CI check names and their package-backed behavior remain stable', () => {
  const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
  const workflows = walk('.github/workflows', ['.yml', '.yaml'])
    .map((path) => readFileSync(resolve(root, path), 'utf8'))
    .join('\n');
  for (const name of [
    'CI / Classify',
    'Required / PR Fast',
    'Required / Contracts',
    'Required / Tests',
    'Required / Security',
    'Required / Platform (${{ matrix.label }})',
    'Required / Package',
    'Conditional / Evidence Registry Integrity',
    'Required / Aggregate',
  ]) {
    assert.match(ci, new RegExp(`name: ${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`, 'u'));
  }
  for (const command of [
    'npm test',
    'npm run test:coverage:check',
    'npm run test:mutation:critical',
  ]) assert.ok(ci.includes(command), `CI no longer runs ${command}`);
  for (const command of ['npm run scan:secrets', 'npm run scan:distribution']) {
    assert.ok(workflows.includes(command), `workflow control plane no longer runs ${command}`);
  }
});

test('complexity budget rejects any renewed overage in the inventory-backed counts', () => {
  const budget = JSON.parse(readFileSync(resolve(root, 'governance/complexity-budget.json'), 'utf8'));
  const inventory = buildInventory();
  assert.deepEqual(inventoryBudgetErrors(budget, inventory), []);

  const metrics = [
    ['maximumPackageScripts', 'packageScripts', 'package scripts'],
    ['maximumValidationTasks', 'validationTasks', 'validation tasks'],
    ['maximumWorkflowFiles', 'workflows', 'workflow files'],
    ['maximumGovernanceSources', 'governanceSources', 'governance sources'],
    ['maximumGenerators', 'generators', 'generators'],
  ];
  for (const [budgetKey, inventoryKey, label] of metrics) {
    const constrained = { ...budget, [budgetKey]: inventory[inventoryKey].length - 1 };
    assert.deepEqual(
      inventoryBudgetErrors(constrained, inventory),
      [`${label} ${inventory[inventoryKey].length} > ${constrained[budgetKey]}`],
    );
    assert.deepEqual(
      inventoryBudgetErrors({ ...budget, [budgetKey]: undefined }, inventory),
      [`invalid ${budgetKey}: expected a positive integer`],
    );
  }
});

test('write variants remain explicitly mutating while validation replacements remain read-only', () => {
  assert.match(packageJson.scripts['migrate:docs'], / --write$/u, 'migrate:docs lost its explicit write mode');
  for (const profile of ['docs', 'runtime', 'release', 'all']) {
    const drift = repositoryProfilePlan('generate', profile);
    const write = repositoryProfilePlan('generate', profile, { write: true });
    assert.ok(drift.every((entry) => !entry.args.includes('--write')), `${profile} drift mode became mutating`);
    assert.ok(write.every((entry) => entry.args.at(-1) === '--write'), `${profile} write mode is not explicit`);
  }

  for (const { command } of Object.values(removedEntrypoints)) {
    if (command.startsWith('node scripts/generate-') || command.startsWith('node scripts/migrate-')) {
      assert.equal(command.includes('--write'), false, `${command} must remain the read-only form`);
    }
  }

  assert.equal(Object.keys(packageJson.scripts).length, 78);
});
