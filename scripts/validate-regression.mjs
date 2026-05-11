#!/usr/bin/env node
/**
 * Minimal regression checks for validation logic that is easy to drift.
 *
 * These checks intentionally use only Node.js built-ins. They complement the
 * broader validators by asserting a few high-risk contracts directly.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRegistryFiles } from './generate-registry.mjs';
import { formatFinding, scanDistributionRisk } from './scan-distribution-risk.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const CODEX_COMMAND_IDS = new Set([
  'codex-review-fix',
  'codex-review-only',
  'codex-verify-only',
]);

let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`OK ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`ERROR ${label}`);
    console.error(`  ${error.message}`);
  }
}

function readGeneratedJson(relPath) {
  const generated = generateRegistryFiles(root).find((file) => file.relPath === relPath);
  assert.ok(generated, `missing generated output ${relPath}`);
  return JSON.parse(generated.content);
}

function commandStage(commandFile) {
  const src = readFileSync(commandFile, 'utf8');
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, `${commandFile} missing frontmatter`);
  const stage = match[1].match(/^stage:\s*([a-z-]+)\s*$/m)?.[1];
  assert.ok(stage, `${commandFile} missing stage`);
  return stage;
}

test('registry generation keeps repository-local metadata out of marketplace', () => {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const pluginJson = JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8'));
  const marketplace = readGeneratedJson('.claude-plugin/marketplace.json');
  const metadata = readGeneratedJson('.claude-plugin/marketplace.metadata.json');
  const plugin = marketplace.plugins.find((entry) => entry.name === 'nova-plugin');
  const metadataPlugin = metadata.plugins.find((entry) => entry.name === 'nova-plugin');

  assert.ok(plugin, 'marketplace missing nova-plugin');
  assert.ok(metadataPlugin, 'metadata missing nova-plugin');
  assert.equal(packageJson.version, pluginJson.version, 'package.json version must match plugin version');
  for (const localField of [
    'trust-level',
    'risk-level',
    'deprecated',
    'last-updated',
    'maintainer',
    'compatibility',
    'review',
  ]) {
    assert.equal(Object.hasOwn(plugin, localField), false, `${localField} leaked into marketplace`);
  }
  assert.equal(metadataPlugin['trust-level'], 'author-verified');
  assert.equal(metadataPlugin['risk-level'], 'medium');
});

test('distribution risk scan detects expanded active secret signals and redacts output', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-risk-regression-'));
  const jwt = [`eyJ${'A'.repeat(12)}`, 'B'.repeat(12), 'C'.repeat(12)].join('.');
  const npmToken = `npm_${'a'.repeat(36)}`;
  const azureSecret = `${'Account'}${'Key'}=${'A'.repeat(44)}`;
  const gcpKey = `${'AI'}${'za'}${'A'.repeat(35)}`;
  const sshRepo = ['git', '@github.com:example/private-repo.git'].join('');
  const envValue = `SERVICE_TOKEN=${'s'.repeat(12)}`;
  const riskyFlag = ['dangerously', 'skip', 'permissions'].join('-');
  const riskyPermissionAdvice = `Recommended: run claude --${riskyFlag} for faster automation.`;
  const safePermissionWarning = `Do not run claude --${riskyFlag} in this repository.`;

  try {
    writeFileSync(resolve(tempRoot, 'README.md'), [
      jwt,
      npmToken,
      azureSecret,
      gcpKey,
      sshRepo,
      riskyPermissionAdvice,
      safePermissionWarning,
    ].join('\n'), 'utf8');
    writeFileSync(resolve(tempRoot, '.env'), `${envValue}\n`, 'utf8');

    const result = scanDistributionRisk({ rootDir: tempRoot });
    const labels = new Set(result.errors.map((finding) => finding.label));
    for (const expected of [
      'JWT',
      'npm token',
      'Azure storage secret',
      'GCP API key',
      'private SSH repository URL',
      'high-risk blanket permission advice',
      'real .env value',
    ]) {
      assert.ok(labels.has(expected), `missing ${expected}`);
    }
    const rendered = result.errors.map(formatFinding).join('\n');
    for (const secret of [jwt, npmToken, azureSecret, gcpKey, sshRepo, envValue]) {
      assert.equal(rendered.includes(secret), false, `rendered output leaked ${secret}`);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('distribution risk scan detects tracked Codex runtime artifacts', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-risk-codex-'));
  try {
    const gitInit = spawnSync('git', ['init'], {
      cwd: tempRoot,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(gitInit.status, 0, gitInit.stderr || gitInit.stdout);

    mkdirSync(resolve(tempRoot, '.codex'), { recursive: true });
    writeFileSync(resolve(tempRoot, '.codex/review.md'), 'runtime artifact\n', 'utf8');
    const gitAdd = spawnSync('git', ['add', '.codex/review.md'], {
      cwd: tempRoot,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(gitAdd.status, 0, gitAdd.stderr || gitAdd.stdout);

    const result = scanDistributionRisk({ rootDir: tempRoot });
    assert.equal(
      result.errors.some((finding) => finding.label === 'tracked Codex runtime artifact'),
      true,
      'tracked .codex artifacts must be distribution-risk errors',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('distribution risk allowlist only annotates historical warnings', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-risk-allowlist-'));
  try {
    const archiveDir = resolve(tempRoot, 'docs/reports/archive');
    mkdirSync(archiveDir, { recursive: true });
    mkdirSync(resolve(tempRoot, 'scripts'), { recursive: true });
    writeFileSync(
      resolve(archiveDir, 'old.md'),
      `${'C:'}\\Users\\Example\\repo\\note.md\n`,
      'utf8',
    );
    writeFileSync(
      resolve(tempRoot, 'scripts/distribution-risk.allowlist.json'),
      JSON.stringify({
        warnings: [
          {
            path: 'docs/reports/archive/old.md',
            label: 'machine-local absolute path',
            reason: 'historical regression fixture',
          },
        ],
      }, null, 2),
      'utf8',
    );

    const result = scanDistributionRisk({ rootDir: tempRoot });
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].scope, 'allowlisted historical');
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('command, skill, and command-doc surfaces stay one-to-one', () => {
  const commandsDir = resolve(root, 'nova-plugin/commands');
  const skillsDir = resolve(root, 'nova-plugin/skills');
  const docsDir = resolve(root, 'nova-plugin/docs/commands');
  const commandIds = readdirSync(commandsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'))
    .sort();
  const skillIds = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('nova-'))
    .map((entry) => entry.name.replace(/^nova-/, ''))
    .sort();

  assert.deepEqual(skillIds, commandIds);

  for (const id of commandIds) {
    const stage = commandStage(resolve(commandsDir, `${id}.md`));
    const docDir = CODEX_COMMAND_IDS.has(id) ? 'codex' : stage;
    for (const suffix of ['.md', '.README.md', '.README.en.md']) {
      assert.equal(
        existsSync(resolve(docsDir, docDir, `${id}${suffix}`)),
        true,
        `missing docs for ${id}${suffix}`,
      );
    }
  }
});

test('scaffold dry-run routes Codex command docs to codex directory', () => {
  const result = spawnSync(process.execPath, [
    'scripts/scaffold.mjs',
    'command',
    '/codex-smoke',
    '--stage',
    'review',
    '--profile',
    'artifact',
    '--docs-dir',
    'codex',
    '--description',
    'Write a bounded Codex smoke artifact.',
    '--dry-run',
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /nova-plugin\/docs\/commands\/codex\/codex-smoke\.md/);
  assert.doesNotMatch(result.stdout, /nova-plugin\/docs\/commands\/review\/codex-smoke\.md/);
});

console.log(`Summary: failed=${failed}`);
if (failed > 0) process.exit(1);
