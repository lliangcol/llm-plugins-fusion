import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createValidationCache, expandFileArguments, globRegex, selectValidationTasks } from '../../scripts/lib/validation-selection.mjs';
import { registryMetadata, validationTaskDefinitions } from '../../scripts/lib/validation-task-registry.mjs';

test('runnable registry exposes the required review metadata', () => {
  const required = ['id', 'label', 'runner', 'args', 'inputs', 'outputs', 'deps', 'platforms', 'networkPolicy', 'mutationPolicy', 'cachePolicy', 'timeoutMs', 'reasonCodes'];
  for (const entry of registryMetadata()) for (const field of required) assert.ok(field in entry, `${entry.id} missing ${field}`);
  assert.equal(new Set(validationTaskDefinitions.map((entry) => entry.id)).size, validationTaskDefinitions.length);
});

test('glob matching and file argument expansion are platform independent', () => {
  assert.equal(globRegex('docs/**').test('docs/README.md'), true);
  assert.equal(globRegex('**/*.md').test('README.md'), true);
  assert.deepEqual(expandFileArguments(['docs/*.md'], ['docs/README.md', 'docs/a.json']), ['docs/README.md']);
});

test('README-only selection is bounded while shared runners and unknown paths fail closed', () => {
  const docs = selectValidationTasks(validationTaskDefinitions, ['README.md']);
  assert.equal(docs.full, false);
  assert.ok(docs.selectedIds.length < validationTaskDefinitions.length / 2);
  assert.equal(selectValidationTasks(validationTaskDefinitions, ['scripts/lib/process-runner.mjs']).full, true);
  assert.equal(selectValidationTasks(validationTaskDefinitions, ['unknown.surface']).full, true);
});

test('content cache invalidates when input or output content changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'nova-cache-'));
  try {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs/input.md'), 'one');
    writeFileSync(join(root, 'docs/output.md'), 'stable');
    const definition = { ...validationTaskDefinitions.find((entry) => entry.id === 'docs.validate'), inputs: ['docs/input.md'], outputs: ['docs/output.md'] };
    const task = { id: definition.id, label: definition.label };
    const cache = createValidationCache({ root, definitions: [definition], repoFiles: ['docs/input.md', 'docs/output.md'], enabled: true });
    cache.store(task, { ok: true });
    assert.equal(cache.lookup(task)?.cached, true);
    writeFileSync(join(root, 'docs/output.md'), 'changed');
    assert.equal(cache.lookup(task), null);
    writeFileSync(join(root, 'docs/output.md'), 'stable');
    writeFileSync(join(root, 'docs/input.md'), 'two');
    assert.equal(cache.lookup(task), null);
    assert.match(readFileSync(join(root, '.cache/nova-validate/docs.validate.json'), 'utf8'), /"status": "passed"/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
