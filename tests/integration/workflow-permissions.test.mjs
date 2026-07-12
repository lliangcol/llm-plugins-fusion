import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  buildEffectivePermissions,
  generateWorkflowPermissionFiles,
} from '../../scripts/generate-workflow-permissions.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../..');

test('workflow permission source defines the 21-command plus six-skill runtime surface', async () => {
  const spec = JSON.parse(await readFile(
    resolve(root, 'nova-plugin/runtime/workflow-permissions.json'),
    'utf8',
  ));
  const report = buildEffectivePermissions(spec);

  assert.equal(spec.workflows.length, 21);
  assert.equal(report.entries.length, 27);
  assert.ok(report.entries.some((entry) => entry.invocation === '/nova-plugin:route'));
  assert.ok(report.entries.some((entry) => entry.invocation === '/nova-plugin:nova-route'));

  for (const workflow of spec.workflows) {
    assert.equal(
      workflow.allowedTools.some((tool) => workflow.disallowedTools.includes(tool)),
      false,
      `${workflow.id} overlaps allowed and disallowed tools`,
    );
    assert.equal(workflow.allowedTools.includes('LS'), false);
    assert.equal(workflow.allowedTools.includes('MultiEdit'), false);
    if (workflow.destructiveActions !== 'none') {
      assert.equal(workflow.modelInvocable, false, `${workflow.id} must require explicit invocation`);
    }
  }
});

test('workflow classes retain the native permission contract', async () => {
  const spec = JSON.parse(await readFile(
    resolve(root, 'nova-plugin/runtime/workflow-permissions.json'),
    'utf8',
  ));
  const workflows = new Map(spec.workflows.map((workflow) => [workflow.id, workflow]));
  const assertTools = (ids, allowedTools, disallowedTools, modelInvocable) => {
    for (const id of ids) {
      const workflow = workflows.get(id);
      assert.ok(workflow, `missing workflow ${id}`);
      assert.deepEqual(workflow.allowedTools, allowedTools, `${id} allowed tools drifted`);
      assert.deepEqual(workflow.disallowedTools, disallowedTools, `${id} disallowed tools drifted`);
      assert.equal(workflow.modelInvocable, modelInvocable, `${id} model invocation drifted`);
    }
  };

  assertTools(
    ['explore', 'explore-lite', 'explore-review', 'plan-lite', 'plan-review', 'review-lite', 'review-only', 'review-strict', 'route', 'finalize-lite'],
    ['Read', 'Glob', 'Grep'],
    ['Write', 'Edit', 'NotebookEdit', 'Bash'],
    true,
  );
  assertTools(
    ['backend-plan', 'produce-plan', 'senior-explore'],
    ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    ['NotebookEdit', 'Bash'],
    false,
  );
  assertTools(
    ['codex-review-only', 'codex-verify-only'],
    ['Read', 'Glob', 'Grep'],
    ['Write', 'Edit', 'NotebookEdit'],
    false,
  );
  assertTools(
    ['review'],
    ['Read', 'Glob', 'Grep'],
    ['Write', 'Edit', 'NotebookEdit'],
    true,
  );
  assertTools(
    ['implement-lite', 'implement-plan', 'implement-standard', 'codex-review-fix'],
    ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
    ['NotebookEdit'],
    false,
  );
  assertTools(
    ['finalize-work'],
    ['Read', 'Glob', 'Grep'],
    ['Write', 'Edit', 'NotebookEdit'],
    true,
  );
});

test('generated workflow permission files are current', async () => {
  for (const generated of generateWorkflowPermissionFiles(root)) {
    const actual = await readFile(resolve(root, generated.relPath), 'utf8');
    assert.equal(actual, generated.content, `${generated.relPath} is stale`);
  }
});
