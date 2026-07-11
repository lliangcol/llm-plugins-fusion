#!/usr/bin/env node
/** Validate public route cases against canonical workflow and inventory contracts. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const spec = readJson('workflow-specs/workflows.json');
const fixture = readJson('evals/route/cases.json');
const workflows = new Map(spec.workflows.map((workflow) => [workflow.id, workflow]));
const agents = new Set(['architect', 'builder', 'orchestrator', 'publisher', 'reviewer', 'verifier']);
const packs = new Set(['dependency', 'docs', 'frontend', 'java', 'marketplace', 'mcp', 'release', 'security']);

assert.equal(fixture.schemaVersion, 1);
assert.equal(fixture.executionMode, 'deterministic-contract');
assert.ok(fixture.cases.length >= 10 && fixture.cases.length <= 15, 'route suite must contain 10-15 cases');
assert.equal(new Set(fixture.cases.map((entry) => entry.id)).size, fixture.cases.length, 'route case ids must be unique');

for (const entry of fixture.cases) {
  assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(entry.request.length >= 20, `${entry.id}: request is too small`);
  assert.equal(entry.commands.length, entry.skills.length, `${entry.id}: command/skill count differs`);
  const owners = new Set();
  const requiredInputs = new Set();
  for (let index = 0; index < entry.commands.length; index += 1) {
    const command = entry.commands[index];
    const workflow = workflows.get(command);
    assert.ok(workflow, `${entry.id}: invented command ${command}`);
    assert.equal(entry.skills[index], `nova-${command}`, `${entry.id}: command/skill mapping differs`);
    for (const owner of workflow.ownerAgents) owners.add(owner);
    for (const input of workflow.requiredInputs) requiredInputs.add(input);
  }
  for (const agent of entry.coreAgents) {
    assert.ok(agents.has(agent), `${entry.id}: invented agent ${agent}`);
    assert.ok(owners.has(agent), `${entry.id}: ${agent} does not own a selected workflow`);
  }
  for (const pack of entry.packs) assert.ok(packs.has(pack), `${entry.id}: invented pack ${pack}`);
  assert.deepEqual([...new Set(entry.requiredInputs)], [...requiredInputs], `${entry.id}: required inputs differ`);
  if (entry.zeroWrite) {
    for (const command of entry.commands) {
      const workflow = workflows.get(command);
      const profile = spec.permissionProfiles[workflow.permissionProfile];
      assert.equal(profile.capabilities.workspaceWrite, false, `${entry.id}: zero-write route selects ${command}`);
    }
  }
}

console.log(`OK route conformance passed (${fixture.cases.length} deterministic cases)`);
