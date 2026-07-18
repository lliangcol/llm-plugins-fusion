import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { commandWrapperContractFailures } from '../../scripts/lib/command-wrapper-contract.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

async function markdownIds(dir, transform = (value) => value) {
  const entries = await readdir(resolve(repoRoot, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => transform(entry.name.replace(/\.md$/, '')))
    .sort();
}

async function skillIds() {
  const entries = await readdir(resolve(repoRoot, 'nova-plugin/skills'), { withFileTypes: true });
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('nova-')) continue;
    const skillFile = join(repoRoot, 'nova-plugin/skills', entry.name, 'SKILL.md');
    try {
      await access(skillFile);
      ids.push(entry.name.replace(/^nova-/, ''));
    } catch {
      // Supporting assets may remain under retired compatibility skill paths.
    }
  }
  return ids.sort();
}

test('six canonical skills own behavior and commands are generated projections', async () => {
  const commands = await markdownIds('nova-plugin/commands');
  const skills = await skillIds();

  assert.equal(commands.length, 21);
  assert.deepEqual(skills, ['explore', 'finalize-work', 'implement-plan', 'produce-plan', 'review', 'route']);
});

test('every command is a thin generated wrapper for one canonical skill and preset', async () => {
  const commands = await markdownIds('nova-plugin/commands');
  const spec = JSON.parse(await readFile(resolve(repoRoot, 'workflow-specs/workflows.json'), 'utf8'));
  const workflowById = new Map(spec.workflows.map((workflow) => [workflow.id, workflow]));
  for (const id of commands) {
    const source = await readFile(resolve(repoRoot, 'nova-plugin/commands', `${id}.md`), 'utf8');
    assert.match(source, new RegExp(`runtime/contracts/${id}\\.json`));
    assert.match(source, /variant preset `\{.*\}`/u);
    assert.deepEqual(commandWrapperContractFailures(source, workflowById.get(id)), []);
    assert.match(source, /fail closed/iu);
    assert.doesNotMatch(source, /## Purpose|## Invariants|## Failure Output/iu);
  }
});

test('wrapper validation fails when resolved-contract authority is removed', async () => {
  const spec = JSON.parse(await readFile(resolve(repoRoot, 'workflow-specs/workflows.json'), 'utf8'));
  const workflow = spec.workflows.find((entry) => entry.id === 'review');
  const source = await readFile(resolve(repoRoot, 'nova-plugin/commands/review.md'), 'utf8');
  const missingResolution = source.replace('${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json', 'missing-index.json');
  assert.ok(commandWrapperContractFailures(missingResolution, workflow).includes('missing resolved variant contract index'));
  const missingAuthority = source.replace('The complete resolved runtime contract is authoritative', 'The canonical prose is authoritative');
  assert.ok(commandWrapperContractFailures(missingAuthority, workflow).includes('missing complete resolved-contract authority'));
  const missingMarker = source.replace('Canonical command wrapper.', 'Unclassified wrapper.');
  assert.ok(commandWrapperContractFailures(missingMarker, workflow).includes('missing canonical command wrapper marker'));
  const wrongSelectorKey = source.replace('selector keys declared for `review` in', 'selector keys declared for `nova-review` in');
  assert.ok(commandWrapperContractFailures(wrongSelectorKey, workflow).includes('missing selector lookup for canonical surface review'));
});
