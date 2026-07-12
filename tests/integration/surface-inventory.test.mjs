import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildSurfaceInventory,
  generateSurfaceInventoryFiles,
} from '../../scripts/generate-surface-inventory.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

test('surface inventory captures current public repository surfaces', () => {
  const inventory = buildSurfaceInventory(repoRoot);

  assert.deepEqual(inventory.counts, {
    commands: 21,
    skills: 6,
    activeAgents: 6,
    capabilityPacks: 8,
    generatedMarketplaceOutputs: 4,
    installedSkills: 27,
  });

  const commandsById = new Map(inventory.commands.map((command) => [command.id, command]));
  const skillsByName = new Map(inventory.skills.map((skill) => [skill.name, skill]));

  assert.equal(commandsById.get('review')?.stage, 'review');
  assert.equal(commandsById.get('review')?.canonicalSkill, 'nova-review');
  assert.equal(commandsById.get('review')?.runtimeDelegation, false);
  assert.equal(commandsById.get('review')?.supportingContract, 'nova-plugin/skills/nova-review/SKILL.md');
  assert.equal(skillsByName.get('nova-review')?.commandId, 'review');
  assert.equal(skillsByName.get('nova-review')?.subagentSafe, true);
  assert.equal(skillsByName.get('nova-review')?.modelInvocable, true);
  assert.equal(skillsByName.get('nova-implement-plan')?.modelInvocable, false);
  assert.deepEqual(inventory.runtimeCompatibility.primaryEntrypoints, [
    '/nova-plugin:route',
    '/nova-plugin:explore',
    '/nova-plugin:produce-plan',
    '/nova-plugin:review',
    '/nova-plugin:implement-plan',
    '/nova-plugin:finalize-work',
  ]);

  for (const command of inventory.commands) {
    const skill = skillsByName.get(command.canonicalSkill);
    assert.ok(skill, `${command.id} has missing canonical skill ${command.canonicalSkill}`);
    assert.equal(command.runtimeDelegation, false);
  }

  assert.deepEqual(
    inventory.activeAgents.map((agent) => agent.id),
    ['architect', 'builder', 'orchestrator', 'publisher', 'reviewer', 'verifier'],
  );
  assert.deepEqual(
    inventory.capabilityPacks.map((pack) => pack.id),
    ['dependency', 'docs', 'frontend', 'java', 'marketplace', 'mcp', 'release', 'security'],
  );
});

test('generated surface inventory files are current', async () => {
  for (const generated of generateSurfaceInventoryFiles(repoRoot)) {
    const actual = await readFile(resolve(repoRoot, generated.relPath), 'utf8');
    assert.equal(actual, generated.content, `${generated.relPath} is stale`);
  }
});
