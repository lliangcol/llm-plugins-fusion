import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { buildStableInstallProof, main, parseStableInstallArgs } from '../../scripts/verify-stable-install.mjs';
import { treeDigest } from '../../scripts/validate-plugin-install.mjs';

test('stable install CLI parser and main fail closed for incomplete identity', () => {
  assert.throws(() => parseStableInstallArgs(['--unknown', 'x']), /unknown argument/u);
  assert.throws(() => parseStableInstallArgs(['--candidate-root', '.']), /missing required/u);
  assert.equal(main([]), 1);
});

test('stable install proof binds exact candidate and installed trees', () => {
  const candidate = mkdtempSync(resolve(tmpdir(), 'stable-candidate-'));
  const installed = mkdtempSync(resolve(tmpdir(), 'stable-installed-'));
  try {
    writeFileSync(resolve(candidate, 'file.txt'), 'exact\n');
    cpSync(candidate, installed, { recursive: true });
    const digest = treeDigest(candidate);
    const channelText = `${JSON.stringify({ stable: { version: '4.1.0', tag: 'v4.1.0', commit: 'a'.repeat(40), pluginTreeSha256: digest } })}\n`;
    const proof = buildStableInstallProof({ candidateRoot: candidate, installedRoot: installed, claudeVersion: 'test', channelText, now: () => new Date(0) });
    assert.equal(proof.matches, true);
    assert.equal(proof.generatedAt, '1970-01-01T00:00:00.000Z');
    writeFileSync(resolve(installed, 'changed.txt'), 'changed\n');
    assert.throws(() => buildStableInstallProof({ candidateRoot: candidate, installedRoot: installed, claudeVersion: 'test', channelText }), /installed tree digest differs/u);
    const wrongChannel = `${JSON.stringify({ stable: { pluginTreeSha256: '0'.repeat(64) } })}\n`;
    assert.throws(() => buildStableInstallProof({ candidateRoot: candidate, installedRoot: candidate, claudeVersion: 'test', channelText: wrongChannel }), /candidate tree digest/u);
  } finally {
    rmSync(candidate, { recursive: true, force: true });
    rmSync(installed, { recursive: true, force: true });
  }
});

test('stable install main writes a proof for the source-controlled stable tree', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'stable-proof-'));
  const out = resolve(directory, 'proof.json');
  try {
    const archive = resolve(directory, 'stable.tar');
    const plugin = resolve(directory, 'plugin');
    assert.equal(spawnSync('git', ['archive', '--format=tar', `--output=${archive}`, 'v4.0.0:nova-plugin'], { cwd: resolve(import.meta.dirname, '../..'), shell: false }).status, 0);
    mkdirSync(plugin);
    assert.equal(spawnSync('tar', ['-xf', archive, '-C', plugin], { shell: false }).status, 0);
    const args = ['--candidate-root', plugin, '--installed-root', plugin, '--claude-version', 'test', '--out', out];
    assert.equal(main(args), 0);
    assert.equal(JSON.parse(readFileSync(out, 'utf8')).matches, true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
