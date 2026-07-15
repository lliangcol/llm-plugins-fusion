import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  commandDetails,
  commandExists,
  formatCommand,
  resolveExecutableInvocation,
  runProcess,
} from '../../scripts/lib/process-runner.mjs';

test('runProcess captures stdout, stderr, and exit code', async () => {
  const result = await runProcess('capture sample', process.execPath, [
    '-e',
    'console.log("out"); console.error("err");',
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /out/);
  assert.match(result.stderr, /err/);
  assert.equal(result.timedOut, false);
});

test('runProcess reports non-zero exits without throwing', async () => {
  const result = await runProcess('nonzero sample', process.execPath, [
    '-e',
    'process.exit(7);',
  ]);

  assert.equal(result.ok, false);
  assert.equal(result.code, 7);
  assert.equal(result.timedOut, false);
});

test('runProcess rejects shell execution', () => {
  assert.throws(
    () => runProcess('shell sample', 'echo ok', [], { shell: true }),
    /forbids shell execution/,
  );
});

test('runProcess caps captured output with an explicit truncation marker', async () => {
  const result = await runProcess('large output sample', process.execPath, [
    '-e',
    'process.stdout.write("x".repeat(256));',
  ], {
    maxOutputBytes: 32,
  });

  assert.equal(result.ok, true);
  assert.equal(result.stdoutTruncated, true);
  assert.match(result.stdout, /^x{32}/);
  assert.match(result.stdout, /output truncated after 32 bytes; 224 bytes omitted/);
  assert.equal(result.stderrTruncated, false);
});

test('runProcess truncates split UTF-8 output on a complete code-point boundary', async () => {
  const result = await runProcess('utf8 truncation sample', process.execPath, [
    '-e',
    'process.stdout.write(Buffer.from("A😀B"));',
  ], { maxOutputBytes: 4 });
  assert.equal(result.ok, true);
  assert.equal(result.stdoutTruncated, true);
  assert.equal(result.stdout.includes('�'), false);
  assert.match(result.stdout, /^A\n\[output truncated/);
});

test('runProcess handles a child that exits before a large stdin write completes', async () => {
  const result = await runProcess('early stdin exit', process.execPath, ['-e', 'process.exit(0)'], {
    input: 'x'.repeat(4 * 1024 * 1024),
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
  assert.equal(result.stdinError === null || /EPIPE|write/i.test(result.stdinError), true);
});

test('runProcess terminates commands that exceed the timeout', async () => {
  const result = await runProcess('timeout sample', process.execPath, [
    '-e',
    'setTimeout(() => {}, 1000);',
  ], {
    timeoutMs: 100,
  });

  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  assert.match(result.errorMessage, /timed out/);
  assert.equal(result.terminationAttempts.some((entry) => entry.signal === 'SIGTERM' && entry.requested), true);
});

test('runProcess timeout terminates spawned descendants', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-process-tree-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const marker = join(root, 'orphan.txt');
  const grandchildScript = join(root, 'grandchild.mjs');
  const parentScript = join(root, 'parent.mjs');

  await writeFile(grandchildScript, [
    'import { writeFileSync } from "node:fs";',
    'const markerPath = process.argv[2];',
    'setTimeout(() => writeFileSync(markerPath, "orphan"), 600);',
    'setInterval(() => {}, 1000);',
    '',
  ].join('\n'), 'utf8');
  await writeFile(parentScript, [
    'import { spawn } from "node:child_process";',
    'const [grandchildScript, markerPath] = process.argv.slice(2);',
    'spawn(process.execPath, [grandchildScript, markerPath], { stdio: "ignore" });',
    'setInterval(() => {}, 1000);',
    '',
  ].join('\n'), 'utf8');

  const result = await runProcess('process tree timeout', process.execPath, [parentScript, grandchildScript, marker], { timeoutMs: 100 });
  assert.equal(result.timedOut, true);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 900));
  await assert.rejects(access(marker));
});

test('runProcess redacts sensitive arguments in returned diagnostics', async () => {
  const token = `sk-proj-${'a'.repeat(24)}`;
  const result = await runProcess('redacted args', process.execPath, ['-e', 'process.exit(0)', token]);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes(token), false);
  assert.equal(formatCommand('tool', [token]).includes(token), false);
});

test('command probes report available and missing commands', async () => {
  const nodeDetails = await commandDetails(process.execPath, ['--version']);
  assert.equal(nodeDetails.available, true);
  assert.match(nodeDetails.detail, /^v\d+/);

  const missing = await commandExists('__nova_missing_command__', ['--version']);
  assert.equal(missing, false);
});

test('Windows executable resolution uses only direct executables or recognized fixed-argv shims', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-windows-executable-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { Path: root };
  const direct = join(root, 'sample.exe');
  await writeFile(direct, 'placeholder');
  assert.deepEqual(resolveExecutableInvocation('sample', { platform: 'win32', env }), { command: direct, argsPrefix: [], resolutionKind: 'windows-exe' });
  await rm(direct);

  const volta = join(root, 'volta.exe');
  const shim = join(root, 'sample.cmd');
  await writeFile(volta, 'placeholder');
  await writeFile(shim, '@echo off\r\nvolta run %~n0 %*\r\n');
  assert.deepEqual(resolveExecutableInvocation('sample', { platform: 'win32', env }), { command: volta, argsPrefix: ['run', 'sample'], resolutionKind: 'windows-volta-shim' });

  const script = join(root, 'node_modules', 'pkg', 'cli.js');
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(script, '');
  await writeFile(shim, '@ECHO off\r\nSET "_prog=node"\r\n"%_prog%" "%dp0%\\node_modules\\pkg\\cli.js" %*\r\n');
  const nodeShim = resolveExecutableInvocation(shim, { platform: 'win32', env, nodeExecutable: process.execPath });
  assert.deepEqual(nodeShim, { command: process.execPath, argsPrefix: [script], resolutionKind: 'windows-node-shim' });

  await writeFile(shim, '@echo off\r\necho unsafe %*\r\n');
  assert.throws(() => resolveExecutableInvocation(shim, { platform: 'win32', env }), /unsupported \.cmd shim/u);
});

test('Windows bare commands prefer the configured Volta shim over an injected tool-image PATH', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-volta-precedence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const imageBin = join(root, 'image-bin');
  const voltaHome = join(root, 'volta-home');
  const voltaBin = join(voltaHome, 'bin');
  await mkdir(imageBin, { recursive: true });
  await mkdir(voltaBin, { recursive: true });
  await writeFile(join(imageBin, 'sample.cmd'), '@echo off\r\necho stale %*\r\n');
  await writeFile(join(voltaBin, 'sample.cmd'), '@echo off\r\nvolta run %~n0 %*\r\n');
  await writeFile(join(voltaBin, 'volta.exe'), 'placeholder');
  const resolved = resolveExecutableInvocation('sample', { platform: 'win32', env: { Path: imageBin, VOLTA_HOME: voltaHome } });
  assert.deepEqual(resolved, { command: join(voltaBin, 'volta.exe'), argsPrefix: ['run', 'sample'], resolutionKind: 'windows-volta-shim' });
});
