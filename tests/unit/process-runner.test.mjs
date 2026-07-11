import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commandDetails,
  commandExists,
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
});

test('command probes report available and missing commands', async () => {
  const nodeDetails = await commandDetails(process.execPath, ['--version']);
  assert.equal(nodeDetails.available, true);
  assert.match(nodeDetails.detail, /^v\d+/);

  const missing = await commandExists('__nova_missing_command__', ['--version']);
  assert.equal(missing, false);
});
