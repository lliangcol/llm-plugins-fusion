import assert from 'node:assert/strict';
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  preparePluginEvidenceOutputPlan,
  validatePluginEvidenceOutputPath,
  validatePluginEvidenceOutputSelection,
  writePluginEvidenceOutput,
} from '../../scripts/lib/plugin-evidence-output.mjs';

function fixture(t, name) {
  const root = mkdtempSync(resolve(tmpdir(), name));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('plugin evidence paths are restricted to dedicated plugin or candidate JSON subtrees', () => {
  for (const path of [
    '.metrics/plugin-install-smoke/inventory.json',
    '.metrics/plugin-latest-drift/nested/inventory.json',
    '.metrics/candidate-live/route-smoke.json',
  ]) assert.equal(validatePluginEvidenceOutputPath(path), path);

  for (const path of [
    'package.json',
    '.git/config',
    'scripts/validate-plugin-install.mjs',
    '.metrics/live-eval/result.json',
    '.metrics/plugin-install-smoke',
    '.metrics/plugin-install-smoke/result.txt',
    '.metrics/plugin-install-smoke/../package.json',
    '/tmp/result.json',
  ]) {
    assert.throws(
      () => validatePluginEvidenceOutputPath(path),
      /portable relative path|traversal|must name a JSON file/u,
      path,
    );
  }
});

test('plugin evidence selection rejects aliases and portable collisions before creating parents', (t) => {
  const root = fixture(t, 'nova-plugin-output-selection-');
  assert.throws(
    () => preparePluginEvidenceOutputPlan(root, [
      { key: 'inventoryOut', path: '.metrics/plugin-case/Inventory.json', label: 'first output' },
      { key: 'routeSmokeOut', path: '.metrics/plugin-case/inventory.json', label: 'second output' },
    ]),
    /portably collide/u,
  );
  assert.equal(existsSync(resolve(root, '.metrics')), false);

  mkdirSync(resolve(root, '.metrics'));
  writeFileSync(resolve(root, '.metrics/plugin-blocked'), 'blocking file\n');
  assert.throws(
    () => preparePluginEvidenceOutputPlan(root, [
      { key: 'first', path: '.metrics/plugin-created-too-early/result.json', label: 'first output' },
      { key: 'second', path: '.metrics/plugin-blocked/result.json', label: 'invalid later output' },
    ]),
    /physical directory/u,
  );
  assert.equal(existsSync(resolve(root, '.metrics/plugin-created-too-early')), false);

  assert.throws(
    () => validatePluginEvidenceOutputSelection(root, [
      { key: 'inventoryOut', path: '.metrics/plugin-case/inventory.json', label: 'output' },
    ], { protectedPaths: ['.metrics/Plugin-Case/INVENTORY.json'] }),
    /protected input/u,
  );
});

test('plugin evidence output uses a prepared atomic lease and rejects target races', (t) => {
  const root = fixture(t, 'nova-plugin-output-atomic-');
  const path = '.metrics/plugin-atomic/result.json';
  const plan = preparePluginEvidenceOutputPlan(root, [
    { key: 'inventoryOut', path, label: 'install inventory output' },
  ]);
  const target = resolve(root, path);
  assert.equal(existsSync(target), false);
  writePluginEvidenceOutput(plan, 'inventoryOut', '{"first":true}\n');
  assert.equal(readFileSync(target, 'utf8'), '{"first":true}\n');

  const originalInode = lstatSync(target).ino;
  const replacement = preparePluginEvidenceOutputPlan(root, [
    { key: 'inventoryOut', path, label: 'install inventory output' },
  ]);
  writePluginEvidenceOutput(replacement, 'inventoryOut', '{"second":true}\n');
  assert.equal(readFileSync(target, 'utf8'), '{"second":true}\n');
  assert.notEqual(lstatSync(target).ino, originalInode);

  const racedPath = '.metrics/plugin-atomic/raced.json';
  const raced = preparePluginEvidenceOutputPlan(root, [
    { key: 'routeSmokeOut', path: racedPath, label: 'route smoke output' },
  ]);
  writeFileSync(resolve(root, racedPath), 'appeared\n');
  assert.throws(
    () => writePluginEvidenceOutput(raced, 'routeSmokeOut', 'must-not-overwrite\n'),
    /appeared while its atomic write was prepared/u,
  );
  assert.equal(readFileSync(resolve(root, racedPath), 'utf8'), 'appeared\n');
});

test('plugin evidence preparation rejects linked parents and linked targets', { skip: process.platform === 'win32' }, (t) => {
  const root = fixture(t, 'nova-plugin-output-links-');
  const base = resolve(root, '.metrics/plugin-links');
  mkdirSync(resolve(base, 'real'), { recursive: true });
  symlinkSync('real', resolve(base, 'linked-parent'));
  assert.throws(
    () => preparePluginEvidenceOutputPlan(root, [
      { key: 'inventoryOut', path: '.metrics/plugin-links/linked-parent/result.json', label: 'install inventory output' },
    ]),
    /physical directory|symlink|junction/u,
  );

  const source = resolve(base, 'source.json');
  writeFileSync(source, 'source\n');
  symlinkSync('source.json', resolve(base, 'symlink.json'));
  assert.throws(
    () => preparePluginEvidenceOutputPlan(root, [
      { key: 'inventoryOut', path: '.metrics/plugin-links/symlink.json', label: 'install inventory output' },
    ]),
    /physical regular file|symlink|junction/u,
  );

  linkSync(source, resolve(base, 'hardlink.json'));
  assert.throws(
    () => preparePluginEvidenceOutputPlan(root, [
      { key: 'inventoryOut', path: '.metrics/plugin-links/hardlink.json', label: 'install inventory output' },
    ]),
    /must not be hard linked/u,
  );
});

test('plugin evidence plans reject ancestor targets and store prototype-like keys as own properties', (t) => {
  const root = fixture(t, 'nova-plugin-output-plan-hardening-');
  assert.throws(
    () => preparePluginEvidenceOutputPlan(root, [
      { key: 'parent', path: '.metrics/plugin-plan/parent.json', label: 'parent output' },
      { key: 'child', path: '.metrics/plugin-plan/parent.json/child.json', label: 'child output' },
    ]),
    /ancestor or descendant/u,
  );
  assert.equal(existsSync(resolve(root, '.metrics')), false);

  const plan = preparePluginEvidenceOutputPlan(root, [
    { key: '__proto__', path: '.metrics/plugin-plan/prototype.json', label: 'prototype output' },
  ]);
  assert.equal(Object.getPrototypeOf(plan.outputs), null);
  assert.equal(Object.hasOwn(plan.outputs, '__proto__'), true);
  writePluginEvidenceOutput(plan, '__proto__', '{"safe":true}\n');
  assert.equal(readFileSync(resolve(root, '.metrics/plugin-plan/prototype.json'), 'utf8'), '{"safe":true}\n');
  assert.throws(
    () => writePluginEvidenceOutput(plan, 'constructor', '{}\n'),
    /does not contain constructor/u,
  );
});
