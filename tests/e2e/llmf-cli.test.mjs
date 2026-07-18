import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renameSync, rmSync, symlinkSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseProductCommandArgs, resolveProductOutput, runCli, writeProductOutputsAtomically } from '../../packages/cli/index.mjs';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cli = resolve(repo, 'packages/cli/bin/llmf.mjs');

async function invoke(args) {
  const result = await runProcess(`llmf ${args[0]}`, process.execPath, [cli, ...args], { cwd: repo });
  return { ...result, exitCode: result.code, json: JSON.parse(result.stdout || result.stderr) };
}

test('llmf preview exposes stable JSON commands and builds the second product without product constants', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-second-product-'));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });
  for (const command of ['validate', 'test', 'eval', 'doctor', 'inspect']) {
    const result = await invoke([command, '--root', root]);
    assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.command, command);
  }
  const build = await invoke(['build', '--root', root, '--out', 'dist/bundle.json']);
  assert.equal(build.exitCode, 0);
  const artifact = await readFile(resolve(root, 'dist/bundle.json'), 'utf8');
  assert.doesNotMatch(artifact, /nova|claude|codex/iu);
  const migrate = await invoke(['migrate', '--root', root, '--write']);
  assert.equal(migrate.exitCode, 0);
  assert.equal(migrate.json.result.workflowSchemaVersion, 6);
});

test('llmf init is portable and usage failures have stable exit code 2', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-init-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const initialized = await invoke(['init', '--root', root]);
  assert.equal(initialized.exitCode, 0);
  assert.equal((await invoke(['validate', '--root', root])).exitCode, 0);
  const unknown = await invoke(['unknown']);
  assert.equal(unknown.exitCode, 2);
  assert.deepEqual(unknown.json, { ok: false, command: 'unknown', error: 'unknown-command' });
  const help = await invoke(['--help']);
  assert.equal(help.exitCode, 0);
  assert.equal(help.json.command, 'help');
  assert.equal(help.json.result.commands.migrate, 'preview or write Contract v6/v2 projections');

  for (const args of [
    ['doctor', '--bogus'],
    ['migrate', '--root', root, '--writ'],
    ['validate', '--root', root, '--root', root],
    ['build', '--root', root, '--out', 'first.json', '--out', 'second.json'],
    ['migrate', '--root', root, '--write', '--write'],
    ['--help', '--root', root],
    ['doctor', 'constructor', 'ignored'],
    ['doctor', 'toString', 'ignored'],
    ['doctor', 'hasOwnProperty', 'ignored'],
    ['doctor', '__proto__', 'ignored'],
  ]) {
    const invalid = await invoke(args);
    assert.equal(invalid.exitCode, 2, args.join(' '));
    assert.equal(invalid.json.ok, false, args.join(' '));
  }

  const untouched = await mkdtemp(resolve(tmpdir(), 'llmf-init-invalid-option-'));
  t.after(() => rm(untouched, { recursive: true, force: true }));
  for (const option of ['--bogus', 'constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    const args = option.startsWith('--')
      ? ['init', '--root', untouched, option]
      : ['init', option, 'ignored', '--root', untouched];
    const invalidInit = await invoke(args);
    assert.equal(invalidInit.exitCode, 2, option);
    assert.deepEqual(await readdir(untouched), [], option);
  }

  const conflictRoot = await mkdtemp(resolve(tmpdir(), 'llmf-init-conflict-'));
  t.after(() => rm(conflictRoot, { recursive: true, force: true }));
  await mkdir(resolve(conflictRoot, 'adapters'));
  await writeFile(resolve(conflictRoot, 'adapters/example.json'), '{"owned":true}\n');
  const conflict = await invoke(['init', '--root', conflictRoot]);
  assert.equal(conflict.exitCode, 4);
  assert.match(conflict.json.error, /initialization target already exists/u);
  for (const name of ['framework.json', 'product.json', 'workflows.json', 'behaviors.json']) {
    await assert.rejects(() => readFile(resolve(conflictRoot, name)), { code: 'ENOENT' });
  }
});

test('product command parsing rejects inherited command names for direct callers', () => {
  for (const command of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    assert.throws(() => parseProductCommandArgs(command, [command]), /unknown command/u, command);
  }
});

test('llmf init preserves support for a not-yet-created product root', async (t) => {
  const parent = await mkdtemp(resolve(tmpdir(), 'llmf-init-new-parent-'));
  const root = resolve(parent, 'new-product');
  t.after(() => rm(parent, { recursive: true, force: true }));
  const initialized = await invoke(['init', '--root', root]);
  assert.equal(initialized.exitCode, 0, initialized.stderr);
  assert.equal((await invoke(['validate', '--root', root])).exitCode, 0);
});

test('llmf validates schemas and contains adapter paths before compilation', async () => {
  const invalidRoot = await mkdtemp(resolve(tmpdir(), 'llmf-invalid-schema-'));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), invalidRoot, { recursive: true });
  const invalidProductPath = resolve(invalidRoot, 'product.json');
  const invalidProduct = JSON.parse(await readFile(invalidProductPath, 'utf8'));
  invalidProduct.expectedWorkflowCount = 'three';
  await writeFile(invalidProductPath, `${JSON.stringify(invalidProduct, null, 2)}\n`);
  const invalid = await invoke(['validate', '--root', invalidRoot]);
  assert.equal(invalid.exitCode, 3);
  assert.match(invalid.json.error, /schema validation failed for product/u);

  const escapedRoot = await mkdtemp(resolve(tmpdir(), 'llmf-escaped-adapter-'));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), escapedRoot, { recursive: true });
  const escapedProductPath = resolve(escapedRoot, 'product.json');
  const outsideName = `${basename(escapedRoot)}-outside.json`;
  const escapedProduct = JSON.parse(await readFile(escapedProductPath, 'utf8'));
  escapedProduct.adapterDefinitions = [`../${outsideName}`];
  await writeFile(escapedProductPath, `${JSON.stringify(escapedProduct, null, 2)}\n`);
  const outsidePath = resolve(escapedRoot, '..', outsideName);
  await writeFile(outsidePath, '{}\n');
  const escaped = await invoke(['validate', '--root', escapedRoot]);
  await rm(outsidePath, { force: true });
  assert.equal(escaped.exitCode, 4);
  assert.match(escaped.json.error, /adapter layout could not be loaded/u);
});

test('llmf init refuses an adapter-directory symlink without writing outside the root', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-init-link-root-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-init-link-outside-'));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  await symlink(outside, resolve(root, 'adapters'));
  const result = await invoke(['init', '--root', root]);
  assert.equal(result.exitCode, 4);
  assert.match(result.json.error, /adapters target must be a real directory/u);
  await assert.rejects(() => readFile(resolve(outside, 'example.json')), { code: 'ENOENT' });
  await assert.rejects(() => readFile(resolve(root, 'framework.json')), { code: 'ENOENT' });
});

test('llmf init detects an adapters parent swapped after transaction preflight', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-init-swap-root-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-init-swap-outside-'));
  const adapters = resolve(root, 'adapters');
  const displaced = resolve(root, 'adapters-old');
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  let swapped = false;
  const result = await runCli(['init', '--root', root], process, {
    outputTransactionOptions: {
      transactionId: 'init-parent-swap',
      renameFile(source, target) {
        if (!swapped) {
          renameSync(adapters, displaced);
          symlinkSync(outside, adapters);
          swapped = true;
        }
        renameSync(source, target);
      },
    },
  });
  assert.equal(result.exitCode, 4);
  assert.match(result.output.error, /parent boundary changed|rollback was incomplete/u);
  await assert.rejects(() => readFile(resolve(outside, 'example.json')), { code: 'ENOENT' });
  assert.deepEqual(await readdir(outside), []);
});

test('llmf build rejects absolute, traversal, and non-regular output targets', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-boundary-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-output-outside-'));
  const traversalTarget = resolve(root, '..', `${basename(root)}-escape.json`);
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
    rm(traversalTarget, { force: true }),
  ]));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });

  const absoluteTarget = resolve(outside, 'absolute.json');
  const absolute = await invoke(['build', '--root', root, '--out', absoluteTarget]);
  assert.equal(absolute.exitCode, 4);
  assert.match(absolute.json.error, /relative path inside the product root/u);
  await assert.rejects(() => readFile(absoluteTarget), { code: 'ENOENT' });

  const traversal = await invoke(['build', '--root', root, '--out', `../${basename(traversalTarget)}`]);
  assert.equal(traversal.exitCode, 4);
  assert.match(traversal.json.error, /traversal/u);
  await assert.rejects(() => readFile(traversalTarget), { code: 'ENOENT' });

  const driveRelative = await invoke(['build', '--root', root, '--out', 'C:drive-relative.json']);
  assert.equal(driveRelative.exitCode, 4);
  assert.match(driveRelative.json.error, /relative path inside the product root/u);

  await mkdir(resolve(root, 'directory-target'));
  const directory = await invoke(['build', '--root', root, '--out', 'directory-target']);
  assert.equal(directory.exitCode, 4);
  assert.match(directory.json.error, /regular non-symlink file/u);
});

test('llmf build applies portable component rules and treats backslashes as separators', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-portable-output-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });

  for (const output of ['CON', 'con.txt', 'nested\\AUX.json', 'report.json:stream', 'name.', 'name ']) {
    const result = await invoke(['build', '--root', root, '--out', output]);
    assert.equal(result.exitCode, 4, output);
    assert.match(result.json.error, /Windows-reserved|non-portable/u, output);
  }

  const backslash = await invoke(['build', '--root', root, '--out', 'portable\\bundle.json']);
  assert.equal(backslash.exitCode, 0, backslash.stderr);
  assert.equal(JSON.parse(await readFile(resolve(root, 'portable/bundle.json'), 'utf8')).workflows.length > 0, true);
  if (process.platform !== 'win32') await assert.rejects(() => readFile(resolve(root, 'portable\\bundle.json')), { code: 'ENOENT' });
});

test('llmf build and migrate reject linked outputs without modifying their targets', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-linked-output-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-linked-output-outside-'));
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
  ]));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });
  const outsideFile = resolve(outside, 'sentinel.json');
  await writeFile(outsideFile, 'outside\n');

  await symlink(outsideFile, resolve(root, 'linked-output.json'));
  const linkedTarget = await invoke(['build', '--root', root, '--out', 'linked-output.json']);
  assert.equal(linkedTarget.exitCode, 4);
  assert.match(linkedTarget.json.error, /regular non-symlink file/u);
  assert.equal(await readFile(outsideFile, 'utf8'), 'outside\n');

  await symlink(outside, resolve(root, 'linked-parent'));
  const linkedParent = await invoke(['build', '--root', root, '--out', 'linked-parent/bundle.json']);
  assert.equal(linkedParent.exitCode, 4);
  assert.match(linkedParent.json.error, /parent must be a real directory/u);
  await assert.rejects(() => readFile(resolve(outside, 'bundle.json')), { code: 'ENOENT' });

  await writeFile(resolve(root, 'workflows.v6.json'), 'preserve-workflow\n');
  await symlink(outsideFile, resolve(root, 'behaviors.v2.json'));
  const migrate = await invoke(['migrate', '--root', root, '--write']);
  assert.equal(migrate.exitCode, 4);
  assert.match(migrate.json.error, /regular non-symlink file/u);
  assert.equal(await readFile(resolve(root, 'workflows.v6.json'), 'utf8'), 'preserve-workflow\n');
  assert.equal(await readFile(outsideFile, 'utf8'), 'outside\n');
});

test('product output transactions reject a parent replaced after initial resolution', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-parent-swap-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-output-parent-swap-outside-'));
  const parent = resolve(root, 'parent');
  const displacedParent = resolve(root, 'parent-old');
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
  ]));
  await mkdir(parent);

  const initiallyResolved = resolveProductOutput(root, 'parent/result.json');
  assert.equal(basename(initiallyResolved), 'result.json');
  renameSync(parent, displacedParent);
  await symlink(outside, parent);

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'parent/result.json', content: '{"escaped":true}\n' },
    ], { transactionId: 'replaced-before-transaction' }),
    /parent must be a real directory/u,
  );
  await assert.rejects(() => readFile(resolve(outside, 'result.json')), { code: 'ENOENT' });
  assert.deepEqual(await readdir(outside), []);
});

test('product output transactions reject case and Unicode-normalized collisions before creating parents', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-collision-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const paths of [
    ['new/Result.json', 'new/result.json'],
    ['new/\u00c5.json', 'new/A\u030a.json'],
  ]) {
    assert.throws(
      () => writeProductOutputsAtomically(root, paths.map((requestedPath) => ({ requestedPath, content: '{}\n' })), { createParents: true }),
      /portable path collision/u,
    );
    await assert.rejects(() => readdir(resolve(root, 'new')), { code: 'ENOENT' });
  }
});

test('product output transactions preflight every target before creating any parent', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-preflight-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-output-preflight-outside-'));
  const outsideFile = resolve(outside, 'sentinel.json');
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
  ]));
  await writeFile(outsideFile, 'outside\n');
  await symlink(outsideFile, resolve(root, 'linked-output.json'));

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'new-parent/result.json', content: '{}\n' },
      { requestedPath: 'linked-output.json', content: '{"escaped":true}\n' },
    ], { createParents: true, transactionId: 'all-target-preflight' }),
    /regular non-symlink file/u,
  );
  await assert.rejects(() => readdir(resolve(root, 'new-parent')), { code: 'ENOENT' });
  assert.equal(await readFile(outsideFile, 'utf8'), 'outside\n');
});

test('product output transactions reject unwritable and ancestor targets before creating parents', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-complete-preflight-'));
  const readonly = resolve(root, 'readonly.json');
  t.after(async () => {
    await chmod(readonly, 0o600).catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(readonly, '{}\n');
  await chmod(readonly, 0o444);

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'new/nested/result.json', content: '{}\n' },
      { requestedPath: 'readonly.json', content: '{}\n' },
    ], { createParents: true, transactionId: 'readonly-preflight' }),
    /not writable/u,
  );
  await assert.rejects(() => readdir(resolve(root, 'new')), { code: 'ENOENT' });

  for (const paths of [
    ['a/b.json', 'a'],
    ['A', 'a/b.json'],
  ]) {
    assert.throws(
      () => writeProductOutputsAtomically(root, paths.map((requestedPath) => ({
        requestedPath,
        content: '{}\n',
      })), { createParents: true, transactionId: 'ancestor-preflight' }),
      /ancestor path collision/u,
    );
    await assert.rejects(() => readdir(resolve(root, 'a')), { code: 'ENOENT' });
  }
});

test('product output transactions reject requested paths that overlap their temporary namespace', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-temp-namespace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const temporaryPath of [
    'result.json.llmf-txn-temp-overlap-0.stage',
    'result.json.llmf-txn-temp-overlap-0.backup/nested.json',
  ]) {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: '{}\n' },
        { requestedPath: temporaryPath, content: '{}\n' },
      ], { createParents: true, transactionId: 'temp-overlap' }),
      /temporary namespace collision/u,
    );
    assert.deepEqual(await readdir(root), []);
  }
});

test('product output transactions remove a partially written stage', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-partial-stage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalWriteFileSync = fs.writeFileSync;
  let injected = false;
  fs.writeFileSync = function injectedPartialWrite(pathOrDescriptor, ...args) {
    if (!injected && typeof pathOrDescriptor === 'number') {
      injected = true;
      originalWriteFileSync(pathOrDescriptor, 'partial-private-content\n', { encoding: 'utf8' });
      throw new Error('injected partial stage write');
    }
    return originalWriteFileSync(pathOrDescriptor, ...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: '{"private":true}\n' },
      ], { transactionId: 'partial-stage-write' }),
      /injected partial stage write/u,
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    syncBuiltinESMExports();
  }

  assert.equal(injected, true);
  await assert.rejects(() => readFile(resolve(root, 'result.json')), { code: 'ENOENT' });
  assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false);
});

test('product output transactions reject a silent short write before replacing the original', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-short-stage-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'original\n');
  const originalWriteFileSync = fs.writeFileSync;
  let injected = false;
  fs.writeFileSync = function injectedShortWrite(pathOrDescriptor, content, ...args) {
    if (!injected && typeof pathOrDescriptor === 'number') {
      injected = true;
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
      return originalWriteFileSync(pathOrDescriptor, bytes.subarray(0, 2), ...args);
    }
    return originalWriteFileSync(pathOrDescriptor, content, ...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: 'expected-complete-content\n' },
      ], { transactionId: 'silent-short-stage' }),
      /stage content differs/u,
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.equal(await readFile(output, 'utf8'), 'original\n');
  assert.deepEqual(await readdir(root), ['result.json']);
});

test('product output transactions reverify staged bytes across install rename', async (t) => {
  for (const timing of ['before', 'after']) {
    const root = await mkdtemp(resolve(tmpdir(), `llmf-output-${timing}-rename-content-`));
    const output = resolve(root, 'result.json');
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(output, 'original\n');
    let injected = false;
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: 'expected\n' },
      ], {
        transactionId: `${timing}-rename-content`,
        renameFile(source, destination) {
          if (!injected && source.endsWith('.stage') && timing === 'before') {
            injected = true;
            fs.writeFileSync(source, 'tampered\n');
          }
          renameSync(source, destination);
          if (!injected && source.endsWith('.stage') && timing === 'after') {
            injected = true;
            fs.writeFileSync(destination, 'tampered\n');
          }
        },
      }),
      /content changed/u,
      timing,
    );
    assert.equal(injected, true, timing);
    assert.equal(await readFile(output, 'utf8'), 'original\n', timing);
    assert.deepEqual(await readdir(root), ['result.json'], timing);
  }
});

test('product output transactions reconcile an exclusive stage create that completes before throwing', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-open-reconcile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalOpenSync = fs.openSync;
  let injected = false;
  fs.openSync = function injectedOpen(path, ...args) {
    const descriptor = originalOpenSync(path, ...args);
    if (!injected && String(path).endsWith('.stage')) {
      injected = true;
      fs.closeSync(descriptor);
      throw new Error('injected post-open failure');
    }
    return descriptor;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: '{}\n' },
      ], { transactionId: 'open-post-throw' }),
      /injected post-open failure/u,
    );
  } finally {
    fs.openSync = originalOpenSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.deepEqual(await readdir(root), []);
});

test('product output transactions reconcile a coded post-open failure without leaving a stage', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-open-coded-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalOpenSync = fs.openSync;
  let injected = false;
  fs.openSync = function injectedOpen(path, ...args) {
    const descriptor = originalOpenSync(path, ...args);
    if (!injected && String(path).endsWith('.stage')) {
      injected = true;
      fs.closeSync(descriptor);
      const error = new Error('injected coded post-open failure');
      error.code = 'EIO';
      throw error;
    }
    return descriptor;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: '{}\n' },
      ], { transactionId: 'open-coded-post-throw' }),
      /injected coded post-open failure/u,
    );
  } finally {
    fs.openSync = originalOpenSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.deepEqual(await readdir(root), []);
});

test('product output transactions preserve an existing mode under a restrictive umask', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-mode-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'original\n');
  await chmod(output, 0o644);
  const previousUmask = process.umask(0o077);
  try {
    writeProductOutputsAtomically(root, [
      { requestedPath: 'result.json', content: 'replacement\n' },
    ], { transactionId: 'preserve-mode' });
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(fs.statSync(output).mode & 0o777, 0o644);
  assert.equal(await readFile(output, 'utf8'), 'replacement\n');
});

test('product output transactions preserve a foreign stage that wins the exclusive-create race', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-open-eexist-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalOpenSync = fs.openSync;
  let foreignStage = null;
  fs.openSync = function injectedForeignStage(path, ...args) {
    if (foreignStage === null && String(path).endsWith('.stage')) {
      foreignStage = String(path);
      const descriptor = originalOpenSync(path, ...args);
      fs.writeFileSync(descriptor, 'foreign\n');
      fs.closeSync(descriptor);
      const error = new Error('stage already exists');
      error.code = 'EEXIST';
      throw error;
    }
    return originalOpenSync(path, ...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: '{}\n' },
      ], { transactionId: 'open-eexist' }),
      /stage already exists/u,
    );
  } finally {
    fs.openSync = originalOpenSync;
    syncBuiltinESMExports();
  }
  assert.equal(await readFile(foreignStage, 'utf8'), 'foreign\n');
});

test('product output transactions roll back parents after a later mkdir failure', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-mkdir-rollback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalMkdirSync = fs.mkdirSync;
  let mkdirCalls = 0;
  fs.mkdirSync = function injectedMkdir(path, ...args) {
    mkdirCalls += 1;
    const result = originalMkdirSync(path, ...args);
    if (mkdirCalls === 2) throw new Error('injected post-mkdir failure');
    return result;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'a/b/result.json', content: '{}\n' },
      ], { createParents: true, transactionId: 'mkdir-rollback' }),
      /injected post-mkdir failure/u,
    );
  } finally {
    fs.mkdirSync = originalMkdirSync;
    syncBuiltinESMExports();
  }
  assert.equal(mkdirCalls, 2);
  assert.deepEqual(await readdir(root), []);

  mkdirCalls = 0;
  fs.mkdirSync = function injectedPreMkdir(path, ...args) {
    mkdirCalls += 1;
    if (mkdirCalls === 2) throw new Error('injected pre-mkdir failure');
    return originalMkdirSync(path, ...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'a/b/result.json', content: '{}\n' },
      ], { createParents: true, transactionId: 'pre-mkdir-rollback' }),
      /injected pre-mkdir failure/u,
    );
  } finally {
    fs.mkdirSync = originalMkdirSync;
    syncBuiltinESMExports();
  }
  assert.equal(mkdirCalls, 2);
  assert.deepEqual(await readdir(root), []);
});

test('product output transactions reconcile a created-parent removal that completes before throwing', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-rmdir-reconcile-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const originalRmdirSync = fs.rmdirSync;
  let injected = false;
  fs.rmdirSync = function injectedRmdir(path, ...args) {
    const result = originalRmdirSync(path, ...args);
    if (!injected) {
      injected = true;
      throw new Error('injected post-rmdir failure');
    }
    return result;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'new-parent/result.json', content: '{}\n' },
      ], {
        createParents: true,
        transactionId: 'rmdir-post-throw',
        renameFile() { throw new Error('injected commit failure'); },
      }),
      /injected commit failure/u,
    );
  } finally {
    fs.rmdirSync = originalRmdirSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.deepEqual(await readdir(root), []);
});

test('product output transactions reconcile a backup rename that completes before throwing', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-backup-reconcile-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'old\n');
  let injected = false;

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'result.json', content: 'new\n' },
    ], {
      transactionId: 'backup-post-throw',
      renameFile(source, destination) {
        renameSync(source, destination);
        if (!injected) {
          injected = true;
          throw new Error('injected post-backup rename failure');
        }
      },
    }),
    /injected post-backup rename failure/u,
  );
  assert.equal(await readFile(output, 'utf8'), 'old\n');
  assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false);
});

test('product output transactions reconcile a staged install that completes before throwing', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-install-reconcile-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'old\n');
  let injected = false;

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'result.json', content: 'new\n' },
    ], {
      transactionId: 'install-post-throw',
      renameFile(source, destination) {
        renameSync(source, destination);
        if (!injected && source.endsWith('.stage')) {
          injected = true;
          throw new Error('injected post-install rename failure');
        }
      },
    }),
    /injected post-install rename failure/u,
  );
  assert.equal(await readFile(output, 'utf8'), 'old\n');
  assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false);
});

test('product output rollback continues after an installed-target removal completes before throwing', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-remove-reconcile-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'old\n');
  let installFailed = false;
  let removeFailed = false;

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'result.json', content: 'new\n' },
    ], {
      transactionId: 'installed-remove-post-throw',
      renameFile(source, destination) {
        renameSync(source, destination);
        if (!installFailed && source.endsWith('.stage')) {
          installFailed = true;
          throw new Error('injected post-install failure');
        }
      },
      removeFile(path, options) {
        rmSync(path, options);
        if (!removeFailed && path.endsWith('result.json')) {
          removeFailed = true;
          throw new Error('injected post-remove failure');
        }
      },
    }),
    /injected post-install failure/u,
  );
  assert.equal(removeFailed, true);
  assert.equal(await readFile(output, 'utf8'), 'old\n');
  assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false);
});

test('product output rollback reconciles post-operation errors while restoring backup and removing stage', async (t) => {
  for (const failurePoint of ['restore', 'stage-remove']) {
    const root = await mkdtemp(resolve(tmpdir(), `llmf-output-${failurePoint}-reconcile-`));
    const output = resolve(root, 'result.json');
    t.after(() => rm(root, { recursive: true, force: true }));
    await writeFile(output, 'old\n');
    let reconciled = false;

    assert.throws(
      () => writeProductOutputsAtomically(root, [
        { requestedPath: 'result.json', content: 'new\n' },
      ], {
        transactionId: `${failurePoint}-post-throw`,
        renameFile(source, destination) {
          if (source.endsWith('.stage')) throw new Error('injected install-before-operation failure');
          renameSync(source, destination);
          if (failurePoint === 'restore' && source.endsWith('.backup')) {
            reconciled = true;
            throw new Error('injected post-restore failure');
          }
        },
        removeFile(path, options) {
          rmSync(path, options);
          if (failurePoint === 'stage-remove' && path.endsWith('.stage')) {
            reconciled = true;
            throw new Error('injected post-stage-remove failure');
          }
        },
      }),
      /injected install-before-operation failure/u,
      failurePoint,
    );
    assert.equal(reconciled, true, failurePoint);
    assert.equal(await readFile(output, 'utf8'), 'old\n', failurePoint);
    assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false, failurePoint);
  }
});

test('product output rollback preserves a newly appeared foreign target and the original backup', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-rollback-foreign-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'original\n');

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'result.json', content: 'replacement\n' },
    ], {
      transactionId: 'rollback-foreign-target',
      renameFile(source, destination) {
        if (source.endsWith('.stage')) {
          fs.writeFileSync(destination, 'foreign\n', { flag: 'wx' });
          throw new Error('injected foreign target during install');
        }
        renameSync(source, destination);
      },
    }),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(error.message, /rollback was incomplete/u);
      assert.equal(
        error.errors.some((nestedError) => (
          nestedError instanceof Error
          && /refuses to replace a newly appeared target/u.test(nestedError.message)
        )),
        true,
      );
      return true;
    },
  );

  assert.equal(await readFile(output, 'utf8'), 'foreign\n');
  const names = await readdir(root);
  const backups = names.filter((name) => name.endsWith('.backup'));
  assert.equal(backups.length, 1);
  assert.equal(await readFile(resolve(root, backups[0]), 'utf8'), 'original\n');
  assert.equal(names.some((name) => name.endsWith('.stage')), false);
});

test('product output cleanup accepts a backup removal that completes before throwing', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-cleanup-reconcile-'));
  const output = resolve(root, 'result.json');
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(output, 'old\n');
  let cleanupThrew = false;

  const [committed] = writeProductOutputsAtomically(root, [
    { requestedPath: 'result.json', content: 'new\n' },
  ], {
    transactionId: 'cleanup-post-throw',
    removeFile(path, options) {
      rmSync(path, options);
      if (path.endsWith('.backup')) {
        cleanupThrew = true;
        throw new Error('injected post-cleanup failure');
      }
    },
  });
  assert.equal(cleanupThrew, true);
  assert.equal(basename(committed), 'result.json');
  assert.equal(await readFile(output, 'utf8'), 'new\n');
  assert.deepEqual(await readdir(root), ['result.json']);
});

test('product output rollback stops when the captured parent boundary is replaced', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-output-commit-swap-'));
  const outside = await mkdtemp(resolve(tmpdir(), 'llmf-output-commit-swap-outside-'));
  const parent = resolve(root, 'parent');
  const displacedParent = resolve(root, 'parent-old');
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
  ]));
  await mkdir(parent);

  assert.throws(
    () => writeProductOutputsAtomically(root, [
      { requestedPath: 'parent/result.json', content: '{"escaped":true}\n' },
    ], {
      transactionId: 'replaced-during-commit',
      renameFile(source, target) {
        renameSync(parent, displacedParent);
        symlinkSync(outside, parent);
        renameSync(source, target);
      },
    }),
    /rollback was incomplete/u,
  );
  await assert.rejects(() => readFile(resolve(outside, 'result.json')), { code: 'ENOENT' });
  assert.deepEqual(await readdir(outside), []);
  assert.equal((await readdir(displacedParent)).some((name) => name.endsWith('.stage')), true);
});

test('llmf build uses the hardened product output transaction', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-build-transaction-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });

  const result = await runCli(['build', '--root', root, '--out', 'dist/bundle.json'], process, {
    outputTransactionOptions: {
      transactionId: 'build-injected-failure',
      renameFile() { throw new Error('injected build transaction failure'); },
    },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.output.error, /injected build transaction failure/u);
  await assert.rejects(() => readFile(resolve(root, 'dist/bundle.json')), { code: 'ENOENT' });
  const distNames = await readdir(resolve(root, 'dist')).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  assert.equal(distNames.some((name) => name.includes('.llmf-txn-')), false);
});

test('llmf build reports committed output when backup cleanup is incomplete', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-build-cleanup-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });
  const dist = resolve(root, 'dist');
  const output = resolve(dist, 'bundle.json');
  await mkdir(dist);
  await writeFile(output, 'private-old-output\n');

  const result = await runCli(['build', '--root', root, '--out', 'dist/bundle.json'], process, {
    outputTransactionOptions: {
      transactionId: 'build-cleanup-failure',
      removeFile(path, options) {
        if (path.endsWith('.backup')) throw new Error('injected backup cleanup failure');
        rmSync(path, options);
      },
    },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.output.error, /outputs were committed.*cleanup was incomplete.*injected backup cleanup failure/u);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).workflows.length > 0, true);
  const backups = (await readdir(dist)).filter((name) => name.endsWith('.backup'));
  assert.equal(backups.length, 1);
  assert.equal(await readFile(resolve(dist, backups[0]), 'utf8'), 'private-old-output\n');
});

test('llmf migrate rolls back both outputs when the second staged install fails', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-migrate-rollback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });
  const workflowOutput = resolve(root, 'workflows.v6.json');
  const behaviorOutput = resolve(root, 'behaviors.v2.json');
  await writeFile(workflowOutput, 'preserve-workflow\n');
  await writeFile(behaviorOutput, 'preserve-behavior\n');
  const originalNames = (await readdir(root)).sort();
  let stagedInstalls = 0;

  const result = await runCli(['migrate', '--root', root, '--write'], process, {
    outputTransactionOptions: {
      transactionId: 'injected-failure',
      renameFile(source, target) {
        if (source.endsWith('.stage')) {
          stagedInstalls += 1;
          if (stagedInstalls === 2) throw new Error('injected second output failure');
        }
        renameSync(source, target);
      },
    },
  });

  assert.equal(result.exitCode, 4);
  assert.match(result.output.error, /injected second output failure/u);
  assert.equal(await readFile(workflowOutput, 'utf8'), 'preserve-workflow\n');
  assert.equal(await readFile(behaviorOutput, 'utf8'), 'preserve-behavior\n');
  assert.deepEqual((await readdir(root)).sort(), originalNames);
  assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false);
});

test('llmf migrate preflights both output permissions before staging', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-migrate-readonly-'));
  const behaviorOutput = resolve(root, 'behaviors.v2.json');
  t.after(async () => {
    await chmod(behaviorOutput, 0o600).catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });
  const workflowOutput = resolve(root, 'workflows.v6.json');
  await writeFile(workflowOutput, 'preserve-workflow\n');
  await writeFile(behaviorOutput, 'preserve-behavior\n');
  await chmod(behaviorOutput, 0o444);
  const originalNames = (await readdir(root)).sort();

  const result = await invoke(['migrate', '--root', root, '--write']);

  assert.equal(result.exitCode, 4);
  assert.match(result.json.error, /target is not writable/u);
  assert.equal(await readFile(workflowOutput, 'utf8'), 'preserve-workflow\n');
  assert.equal(await readFile(behaviorOutput, 'utf8'), 'preserve-behavior\n');
  assert.deepEqual((await readdir(root)).sort(), originalNames);
  assert.equal((await readdir(root)).some((name) => name.includes('.llmf-txn-')), false);
});

test('llmf repository profiles expose bounded check and drift-only generation entrypoints', async () => {
  const quick = await invoke(['check', 'quick', '--root', repo]);
  assert.equal(quick.exitCode, 0, quick.stderr);
  assert.equal(quick.json.result.profile, 'quick');
  assert.equal(quick.json.result.passed, true);
  assert.deepEqual(quick.json.result.tasks.map((entry) => entry.id), ['schemas', 'frontmatter', 'docs', 'hooks']);

  const docs = await invoke(['generate', 'docs', '--root', repo]);
  assert.equal(docs.exitCode, 0, docs.stderr);
  assert.equal(docs.json.result.profile, 'docs');
  assert.equal(docs.json.result.write, false);
  assert.deepEqual(
    docs.json.result.tasks.map((entry) => entry.id),
    ['diagnostics-docs', 'command-docs', 'prompt-surface-report', 'platform-evidence', 'doc-governance'],
  );

  const release = await invoke(['generate', 'release', '--root', repo]);
  assert.equal(release.exitCode, 0, release.stderr);
  assert.equal(release.json.result.write, false);
  assert.deepEqual(release.json.result.tasks.map((entry) => entry.id), [
    'registry',
    'surface-inventory',
    'compatibility-evidence',
    'workflow-surfaces',
    'static-contract',
    'adapter-simulation',
    'critical-mutation',
    'quality-report',
    'project-state',
    'fact-graph',
    'release-summary',
    'task-catalog',
    'control-plane',
  ]);

  const unsafe = await invoke(['check', 'quick', '--write', '--root', repo]);
  assert.equal(unsafe.exitCode, 2);
  assert.match(unsafe.json.error, /generate/u);
});
