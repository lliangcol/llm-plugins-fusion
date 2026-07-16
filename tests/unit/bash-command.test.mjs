import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { resolveExecutableOnPath, trustedHookBashIdentity } from '../../scripts/lib/bash-command.mjs';

test('hook bootstrap resolves a physical Bash outside the writable project', { skip: process.platform === 'win32' }, (t) => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'nova-hook-bootstrap-project-'));
  const trustedBin = mkdtempSync(resolve(tmpdir(), 'nova-hook-bootstrap-bin-'));
  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(trustedBin, { recursive: true, force: true });
  });
  const trusted = resolve(trustedBin, 'bash');
  writeFileSync(trusted, '#!/bin/sh\nexit 0\n');
  chmodSync(trusted, 0o755);
  const result = trustedHookBashIdentity(projectRoot, { PATH: trustedBin });
  assert.equal(result.trusted, true);
  assert.equal(result.identity.physical, realpathSync.native(trusted));
});

test('hook bootstrap rejects absolute, relative, and empty project PATH entries', { skip: process.platform === 'win32' }, (t) => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'nova-hook-bootstrap-shadow-'));
  const nested = resolve(projectRoot, 'packages/nested');
  const bin = resolve(projectRoot, 'bin');
  mkdirSync(nested, { recursive: true });
  mkdirSync(bin);
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  for (const target of [resolve(bin, 'bash'), resolve(nested, 'bash')]) {
    writeFileSync(target, '#!/bin/sh\nexit 0\n');
    chmodSync(target, 0o755);
  }
  for (const path of [bin, `../../bin`, '']) {
    const identity = resolveExecutableOnPath('bash', { cwd: nested, env: { PATH: path } });
    assert.ok(identity);
    const result = trustedHookBashIdentity(projectRoot, { PATH: path });
    assert.equal(result.trusted, false);
    assert.match(result.reason, /PATH.*(?:writable project|agent-writable root)/u);
  }

  const missing = trustedHookBashIdentity(projectRoot, { PATH: resolve(tmpdir(), 'nova-hook-bootstrap-missing') });
  assert.equal(missing.trusted, false);
  assert.match(missing.reason, /not resolvable/u);
});

test('hook bootstrap treats an explicit artifact root as agent-writable', { skip: process.platform === 'win32' }, (t) => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'nova-hook-bootstrap-artifact-project-'));
  const artifactRoot = mkdtempSync(resolve(tmpdir(), 'nova-hook-bootstrap-artifact-root-'));
  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(artifactRoot, { recursive: true, force: true });
  });
  const bash = resolve(artifactRoot, 'bash');
  writeFileSync(bash, '#!/bin/sh\nexit 0\n');
  chmodSync(bash, 0o755);
  const result = trustedHookBashIdentity(projectRoot, { PATH: artifactRoot }, [artifactRoot]);
  assert.equal(result.trusted, false);
  assert.match(result.reason, /agent-writable root/u);
});
