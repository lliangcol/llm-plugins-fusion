#!/usr/bin/env node
/** Validate generated assistant adapters and the public consumer fixture. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkOrWrite } from './generate-adapters.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

checkOrWrite();
const spec = readJson('workflow-specs/workflows.json');
const generic = readJson('adapters/generic-agent-skills/manifest.json');
const claude = readJson('adapters/claude/manifest.json');
const codex = read('adapters/codex/AGENTS.md');

assert.equal(generic.compatibilityLevel, 'L1-parseable');
assert.equal(claude.compatibilityLevel, 'L4-verified');
assert.deepEqual(generic.workflows.map((entry) => entry.id), spec.workflows.map((entry) => entry.id));
assert.equal(claude.commands.length, 21);
assert.equal(claude.legacyAliases.length, 21);
assert.match(codex, /Never claim Claude hooks or permissions are active in Codex/);

for (const workflow of generic.workflows) {
  assert.equal(existsSync(resolve(root, 'adapters/generic-agent-skills', workflow.contract)), true, `${workflow.id}: contract missing`);
  assert.equal(workflow.capabilities.credentials, false, `${workflow.id}: credentials must not be implicit`);
  assert.equal(workflow.capabilities.externalPublish, false, `${workflow.id}: publish must not be implicit`);
  assert.equal(workflow.capabilities.gitHistoryMutation, false, `${workflow.id}: history mutation must not be implicit`);
}

const fixture = readJson('fixtures/consumer/minimal/expected.json');
const selected = generic.workflows.find((entry) => entry.id === fixture.workflow);
assert.ok(selected, 'consumer fixture selects an unknown workflow');
assert.deepEqual(selected.requiredInputs, fixture.requiredInputs);
assert.equal(selected.capabilities.workspaceWrite, fixture.workspaceWrite);
assert.equal(selected.capabilities.shell, fixture.shell);
for (const path of ['README.md', 'AGENTS.md', 'request.md', 'expected.json']) {
  assert.equal(existsSync(resolve(root, 'fixtures/consumer/minimal', path)), true, `consumer fixture missing ${path}`);
}

console.log('OK adapter conformance passed (Claude, Codex, generic, consumer fixture)');
