import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { main as buildCandidateMain } from '../../scripts/build-candidate-bundle.mjs';
import { main as extractBundleMain } from '../../scripts/extract-release-bundle.mjs';
import { migrate, migrateBehaviors } from '../../scripts/migrate-v5-surfaces.mjs';
import { main as reconcileMain, reconcileGithubRelease } from '../../scripts/reconcile-github-release.mjs';
import { main as orchestratorMain, orchestrateRelease, parseReleaseOrchestratorArgs } from '../../scripts/release-orchestrator.mjs';
import { buildStableInstallProof, main as stableInstallMain } from '../../scripts/verify-stable-install.mjs';
import { treeDigest } from '../../scripts/validate-plugin-install.mjs';
import { distributionRiskSarif } from '../../scripts/scan-distribution-risk.mjs';

const root = resolve(import.meta.dirname, '../..');

test('hardening CLI entrypoints fail closed on missing explicit identity', () => {
  assert.equal(buildCandidateMain([]), 1);
  assert.equal(extractBundleMain([]), 1);
  assert.equal(reconcileMain([]), 1);
  assert.equal(orchestratorMain([]), 1);
  assert.equal(stableInstallMain([]), 1);
});

test('candidate bundle build and safe extraction entrypoints complete with explicit paths', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-bundle-entrypoints-'));
  try {
    const source = resolve(directory, 'source');
    const archive = resolve(directory, 'candidate.tar.gz');
    const output = resolve(directory, 'output');
    mkdirSync(source);
    writeFileSync(resolve(source, 'evidence.txt'), 'bound\n');
    assert.equal(buildCandidateMain(['--bundle-root', source, '--out', archive]), 0);
    assert.equal(extractBundleMain(['--archive', archive, '--out', output]), 0);
    assert.equal(readFileSync(resolve(output, 'evidence.txt'), 'utf8'), 'bound\n');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('v5 migration remains deterministic and stable-install proof rejects an unbound tree', () => {
  const workflows = JSON.parse(readFileSync(resolve(root, 'workflow-specs/workflows.json'), 'utf8'));
  const behaviors = JSON.parse(readFileSync(resolve(root, 'workflow-specs/behaviors.json'), 'utf8'));
  const migrated = migrate(workflows);
  assert.deepEqual(migrated, workflows);
  assert.equal(migrated.workflows.find(({ id }) => id === 'review').permissionProfile, 'read-only');
  assert.equal(migrated.workflows.find(({ id }) => id === 'implement-plan').permissionProfile, 'implementation');
  assert.deepEqual(migrateBehaviors(behaviors), behaviors);
  const tree = mkdtempSync(resolve(tmpdir(), 'nova-unbound-tree-'));
  try {
    writeFileSync(resolve(tree, 'file.txt'), 'not stable\n');
    assert.throws(() => buildStableInstallProof({ candidateRoot: tree, installedRoot: tree, claudeVersion: 'test' }), /stable release channel/u);
  } finally { rmSync(tree, { recursive: true, force: true }); }
});

test('release orchestrator consumes exact local intent and control identities in dry-run mode', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-orchestrator-'));
  try {
    const control = resolve(directory, 'control.json');
    const intent = resolve(directory, 'intent.json');
    const sourceCommit = 'a'.repeat(40);
    const bundleSha256 = 'b'.repeat(64);
    const correctionSource = { document: { schemaVersion: 2, corrections: [] }, sha256: 'd'.repeat(64) };
    writeFileSync(control, `${JSON.stringify({ bundleSha256 })}\n`);
    writeFileSync(intent, `${JSON.stringify({ stableTag: 'v4.0.0', candidateTag: 'v4.0.0-rc.1', sourceCommit, candidateCoreSha256: 'c'.repeat(64), controlBundleSha256: bundleSha256, correctionsSha256: correctionSource.sha256 })}\n`);
    const result = orchestrateRelease({ mode: 'drill', state: 'DRAFT', targetState: 'CANDIDATE_VERIFIED', stableTag: 'v4.0.0', candidateTag: 'v4.0.0-rc.1', sourceCommit, promotionIntent: intent, controlBundle: control, eventDir: resolve(directory, 'events'), runId: 'unit', dryRun: true }, () => new Date(0), correctionSource);
    assert.deepEqual(result.transitions.map((entry) => entry.transition), ['DRAFT->CANDIDATE_TAGGED', 'CANDIDATE_TAGGED->CANDIDATE_VERIFIED']);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('release orchestrator parser covers explicit flags and rejects invalid identities', () => {
  const base = ['--mode', 'drill', '--state', 'DRAFT', '--target-state', 'PROMOTION_READY', '--stable-tag', 'v4.1.0', '--candidate-tag', 'v4.1.0-rc.1', '--source-commit', 'a'.repeat(40), '--promotion-intent', 'intent.json', '--control-bundle', 'control.json', '--event-dir', 'events', '--run-id', '1'];
  const parsed = parseReleaseOrchestratorArgs([...base, '--dry-run', '--protected-publication-approved']);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.protectedPublicationApproved, true);
  assert.throws(() => parseReleaseOrchestratorArgs(base.with(1, 'candidate')), /mode must/u);
  assert.throws(() => parseReleaseOrchestratorArgs(base.with(11, 'short')), /full Git SHA/u);
  assert.throws(() => parseReleaseOrchestratorArgs(['--unknown', 'x']), /unknown argument/u);
});

test('GitHub draft reconciliation uploads, verifies, and publishes exact bytes through an injected boundary', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-reconcile-'));
  try {
    const assets = resolve(directory, 'assets');
    const notes = resolve(directory, 'notes.md');
    mkdirSync(assets);
    writeFileSync(resolve(assets, 'asset.txt'), 'exact\n');
    writeFileSync(notes, 'notes\n');
    let downloads = 0;
    const calls = [];
    const result = reconcileGithubRelease({ tag: 'v4.0.0', assetsDir: assets, notes }, {
      ghRun(args) {
        calls.push(args);
        if (args[1] === 'view') return { status: 1, stdout: '', stderr: 'release not found' };
        if (args[1] === 'download') {
          downloads += 1;
          if (downloads === 2) copyFileSync(resolve(assets, 'asset.txt'), resolve(args[args.indexOf('--dir') + 1], 'asset.txt'));
          if (downloads === 1) return { status: 1, stdout: '', stderr: 'no assets found' };
        }
        return { status: 0, stdout: '{}', stderr: '' };
      },
    });
    assert.deepEqual(result, { uploaded: ['asset.txt'], reused: [], published: true });
    assert.equal(calls.some((args) => args[1] === 'edit'), true);
    assert.equal(calls.find((args) => args[1] === 'create').includes('--prerelease=false'), true);
    assert.equal(calls.find((args) => args[1] === 'create').includes('--verify-tag'), true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('candidate reconciliation preserves prerelease state and refuses a published existing release', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-reconcile-prerelease-'));
  try {
    const assets = resolve(directory, 'assets');
    const notes = resolve(directory, 'notes.md');
    mkdirSync(assets);
    writeFileSync(resolve(assets, 'asset.txt'), 'exact\n');
    writeFileSync(notes, 'notes\n');
    const calls = [];
    reconcileGithubRelease({ tag: 'v4.0.0-rc.1', assetsDir: assets, notes, prerelease: true }, {
      ghRun(args) {
        calls.push(args);
        if (args[1] === 'view') return { status: 1, stdout: '', stderr: 'release not found' };
        if (args[1] === 'download') copyFileSync(resolve(assets, 'asset.txt'), resolve(args[args.indexOf('--dir') + 1], 'asset.txt'));
        return { status: 0, stdout: '{}', stderr: '' };
      },
    });
    assert.equal(calls.find((args) => args[1] === 'create').includes('--prerelease=true'), true);
    assert.equal(calls.find((args) => args[1] === 'create').includes('--verify-tag'), true);
    assert.equal(calls.find((args) => args[1] === 'edit').includes('--prerelease=true'), true);
    assert.throws(() => reconcileGithubRelease({ tag: 'v4.0.0-rc.1', assetsDir: assets, notes, prerelease: true }, {
      ghRun(args) {
        if (args[1] === 'view') return { status: 0, stdout: '{"isDraft":false}', stderr: '' };
        return { status: 0, stdout: '{}', stderr: '' };
      },
    }), /not a draft/u);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('GitHub draft reconciliation fails closed on lookup and asset-download errors', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-reconcile-errors-'));
  try {
    const assets = resolve(directory, 'assets');
    const notes = resolve(directory, 'notes.md');
    mkdirSync(assets);
    writeFileSync(resolve(assets, 'asset.txt'), 'exact\n');
    writeFileSync(notes, 'notes\n');
    let createAttempted = false;
    assert.throws(() => reconcileGithubRelease({ tag: 'v4.0.0', assetsDir: assets, notes }, {
      ghRun(args) {
        if (args[1] === 'view') return { status: 1, stdout: '', stderr: 'authentication failed: network unavailable' };
        if (args[1] === 'create') createAttempted = true;
        return { status: 0, stdout: '{}', stderr: '' };
      },
    }), /authentication failed/u);
    assert.equal(createAttempted, false);
    assert.throws(() => reconcileGithubRelease({ tag: 'v4.0.0', assetsDir: assets, notes }, {
      ghRun(args) {
        if (args[1] === 'view') return { status: 0, stdout: '{"isDraft":true}', stderr: '' };
        if (args[1] === 'download') return { status: 1, stdout: '', stderr: 'network unavailable' };
        return { status: 0, stdout: '{}', stderr: '' };
      },
    }), /network unavailable/u);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('stable install proof compares exact manifest digests and records channel identity', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-proof-tree-'));
  try {
    writeFileSync(resolve(directory, 'file.txt'), 'exact\n');
    const digest = treeDigest(directory);
    const channelText = JSON.stringify({ stable: { version: '4.0.0', tag: 'v4.0.0', commit: 'a'.repeat(40), pluginTreeSha256: digest } });
    const proof = buildStableInstallProof({ candidateRoot: directory, installedRoot: directory, claudeVersion: 'test', now: () => new Date(0), channelText });
    assert.equal(proof.matches, true);
    assert.equal(proof.candidateTreeDigest, proof.installedTreeDigest);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('distribution risk SARIF preserves locations and never embeds matched source text', () => {
  const sarif = distributionRiskSarif({
    errors: [{ path: 'active.md', line: 4, label: 'private key block', scope: 'active', redacted: '<redacted>' }],
    warnings: [{ path: 'history.md', line: 2, label: 'machine-local absolute path', scope: 'allowlisted historical', redacted: '<redacted>' }],
  });
  assert.equal(sarif.version, '2.1.0');
  assert.deepEqual(sarif.runs[0].results.map((result) => result.level), ['error', 'warning']);
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'active.md');
  assert.equal(JSON.stringify(sarif).includes('<redacted>'), false);
});
