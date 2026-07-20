import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { diagnosticHookEnvironment, projectFreeExecutablePath, projectFreeProbeEnvironment, resolveExecutableOnPath, trustedHookBashIdentity } from '../../scripts/lib/bash-command.mjs';

test('runtime validation PATH removes lexical and physical project entries', { skip: process.platform === 'win32' }, (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-runtime-path-'));
  const projectRoot = resolve(fixture, 'project');
  const projectBin = resolve(projectRoot, 'node_modules/.bin');
  const externalBin = resolve(fixture, 'external-bin');
  const linkedProjectBin = resolve(fixture, 'linked-project-bin');
  mkdirSync(projectBin, { recursive: true });
  mkdirSync(externalBin);
  symlinkSync(projectBin, linkedProjectBin);
  const nodeExecutable = resolve(externalBin, 'node');
  writeFileSync(nodeExecutable, '#!/bin/sh\nexit 0\n');
  chmodSync(nodeExecutable, 0o755);
  t.after(() => rmSync(fixture, { recursive: true, force: true }));

  const path = projectFreeExecutablePath(projectRoot, {
    env: { PATH: [projectBin, linkedProjectBin, 'relative-bin', externalBin, externalBin].join(delimiter) },
    nodeExecutable,
  });

  assert.deepEqual(path.split(delimiter), [realpathSync.native(externalBin)]);
});

test('probe environment removes executable preload and helper injection controls', { skip: process.platform === 'win32' }, (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-probe-env-'));
  const projectRoot = resolve(fixture, 'project');
  const externalBin = resolve(fixture, 'bin');
  mkdirSync(projectRoot);
  mkdirSync(externalBin);
  const nodeExecutable = resolve(externalBin, 'node');
  writeFileSync(nodeExecutable, '#!/bin/sh\nexit 0\n');
  chmodSync(nodeExecutable, 0o755);
  t.after(() => rmSync(fixture, { recursive: true, force: true }));

  const environment = projectFreeProbeEnvironment(projectRoot, {
    nodeExecutable,
    env: {
      PATH: externalBin,
      Path: projectRoot,
      HOME: fixture,
      BASH_ENV: 'startup.sh',
      ENV: 'startup.sh',
      NODE_OPTIONS: '--require injected.js',
      NODE_PATH: projectRoot,
      GIT_CONFIG_PARAMETERS: "'diff.external'='helper'",
      RIPGREP_CONFIG_PATH: 'rg.conf',
      DYLD_INSERT_LIBRARIES: 'library.dylib',
      LD_PRELOAD: 'library.so',
      'BASH_FUNC_node%%': '() { echo shadow; }',
    },
  });
  assert.equal(environment.HOME, fixture);
  assert.equal(environment.PATH, realpathSync.native(externalBin));
  assert.equal(Object.hasOwn(environment, 'Path'), false);
  for (const key of ['BASH_ENV', 'ENV', 'NODE_OPTIONS', 'NODE_PATH', 'GIT_CONFIG_PARAMETERS', 'RIPGREP_CONFIG_PATH', 'DYLD_INSERT_LIBRARIES', 'LD_PRELOAD', 'BASH_FUNC_node%%']) {
    assert.equal(Object.hasOwn(environment, key), false, key);
  }
});

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

test('diagnostic hook trust removes only the exact npm lifecycle project bin', { skip: process.platform === 'win32' }, (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-diagnostic-path-'));
  const projectRoot = resolve(fixture, 'project');
  const npmBin = resolve(projectRoot, 'node_modules/.bin');
  const otherProjectBin = resolve(projectRoot, 'other-bin');
  const trustedBin = resolve(fixture, 'trusted-bin');
  mkdirSync(npmBin, { recursive: true });
  mkdirSync(otherProjectBin);
  mkdirSync(trustedBin);
  writeFileSync(resolve(projectRoot, 'package.json'), '{}\n');
  for (const bin of [npmBin, otherProjectBin, trustedBin]) {
    writeFileSync(resolve(bin, 'bash'), '#!/bin/sh\nexit 0\n');
    chmodSync(resolve(bin, 'bash'), 0o755);
  }
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const lifecycle = {
    npm_command: 'run',
    npm_package_json: resolve(projectRoot, 'package.json'),
    npm_lifecycle_event: 'doctor',
    npm_lifecycle_script: 'node scripts/doctor.mjs',
  };

  const normalized = diagnosticHookEnvironment(projectRoot, {
    env: { ...lifecycle, PATH: `${npmBin}${delimiter}${trustedBin}` },
    lifecycleEvent: 'doctor',
    lifecycleScript: 'node scripts/doctor.mjs',
  });
  assert.equal(normalized.normalized, true);
  assert.equal(normalized.trust.trusted, true);
  assert.deepEqual(normalized.removedEntries, [npmBin]);
  assert.equal(normalized.trust.identity.physical, realpathSync.native(resolve(trustedBin, 'bash')));
  assert.equal(Object.hasOwn(normalized.env, 'Path'), false);

  const mismatched = diagnosticHookEnvironment(projectRoot, {
    env: { ...lifecycle, npm_lifecycle_event: 'other', PATH: `${npmBin}${delimiter}${trustedBin}` },
    lifecycleEvent: 'doctor',
    lifecycleScript: 'node scripts/doctor.mjs',
  });
  assert.equal(mismatched.normalized, false);
  assert.equal(mismatched.trust.trusted, false);

  for (const unsafePath of [
    `${npmBin}${delimiter}${otherProjectBin}${delimiter}${trustedBin}`,
    `${npmBin}${delimiter}.${delimiter}${trustedBin}`,
  ]) {
    const unsafe = diagnosticHookEnvironment(projectRoot, {
      env: { ...lifecycle, PATH: unsafePath },
      lifecycleEvent: 'doctor',
      lifecycleScript: 'node scripts/doctor.mjs',
    });
    assert.equal(unsafe.normalized, true);
    assert.equal(unsafe.trust.trusted, false);
  }
});
