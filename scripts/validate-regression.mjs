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
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, relative, resolve } from 'node:path';
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
const COPY_SKIP_ROOTS = new Set([
  '.git',
  '.codex',
  '.cache',
  '.idea',
  '.vite',
  '.vscode',
  'node_modules',
  'coverage',
  'logs',
  'dist',
  'build',
  'target',
  '.next',
  '.nuxt',
  'out',
  'tmp',
  'temp',
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

function copyRepositoryFixture(destination) {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'buffer',
    shell: false,
  });
  assert.equal(listed.status, 0, listed.stderr?.toString('utf8') || 'git ls-files failed');

  for (const relPath of listed.stdout.toString('utf8').split('\0').filter(Boolean)) {
    if (COPY_SKIP_ROOTS.has(relPath.split('/')[0])) continue;
    const source = resolve(root, relPath);
    const target = resolve(destination, relPath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
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

test('package maintainer shortcuts include the GitHub workflow validator', () => {
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  assert.equal(
    packageJson.scripts['validate:github-workflows'],
    'node scripts/validate-github-workflows.mjs',
  );
  assert.equal(
    packageJson.scripts['validate:workflow'],
    'node scripts/validate-workflow-fixtures.mjs',
  );
  assert.equal(Object.hasOwn(packageJson.scripts, 'check'), false, 'package scripts must not define check');
  assert.equal(Object.hasOwn(packageJson.scripts, 'build'), false, 'package scripts must not define build');
});

test('GitHub security settings printout includes workflow permission checks', () => {
  const printed = spawnSync(process.execPath, [
    'scripts/print-github-security-settings.mjs',
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(printed.status, 0, printed.stderr || printed.stdout);
  assert.match(printed.stdout, /Validate Hooks[\s\S]*Validate GitHub Workflows[\s\S]*Validate Runtime Smoke/);
});

test('distribution risk scan detects expanded active secret signals and redacts output', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-risk-regression-'));
  const jwt = [`eyJ${'A'.repeat(12)}`, 'B'.repeat(12), 'C'.repeat(12)].join('.');
  const npmToken = `npm_${'a'.repeat(36)}`;
  const azureSecret = `${'Account'}${'Key'}=${'A'.repeat(44)}`;
  const gcpKey = `${'AI'}${'za'}${'A'.repeat(35)}`;
  const sshRepo = ['git', '@github.com:example/private-repo.git'].join('');
  const envValue = `SERVICE_TOKEN=${'s'.repeat(12)}`;
  const unquotedSecret = `${['API', 'KEY'].join('_')}=${'k'.repeat(12)}`;
  const windowsPath = ['D:', 'Documents', 'GitHub', 'private-project'].join('\\');
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
      unquotedSecret,
      windowsPath,
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
      'hard-coded secret assignment',
      'machine-local absolute path',
      'high-risk blanket permission advice',
      'real .env value',
    ]) {
      assert.ok(labels.has(expected), `missing ${expected}`);
    }
    const rendered = result.errors.map(formatFinding).join('\n');
    for (const secret of [jwt, npmToken, azureSecret, gcpKey, sshRepo, envValue, unquotedSecret, windowsPath]) {
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

test('distribution risk scan does not skip tracked files under generated-name directories', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-risk-tracked-out-'));
  try {
    const gitInit = spawnSync('git', ['init'], {
      cwd: tempRoot,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(gitInit.status, 0, gitInit.stderr || gitInit.stdout);

    mkdirSync(resolve(tempRoot, 'out'), { recursive: true });
    writeFileSync(resolve(tempRoot, 'out/secret.md'), `npm_${'a'.repeat(36)}\n`, 'utf8');
    const gitAdd = spawnSync('git', ['add', 'out/secret.md'], {
      cwd: tempRoot,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(gitAdd.status, 0, gitAdd.stderr || gitAdd.stdout);

    const result = scanDistributionRisk({ rootDir: tempRoot });
    assert.equal(
      result.errors.some((finding) => (
        finding.path === 'out/secret.md' && finding.label === 'npm token'
      )),
      true,
      'tracked files under out/ must remain in the distribution-risk scan',
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

test('validate-packs enforces documentation-only enhanced and fallback boundaries', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-pack-contract-'));
  const fixtureRoot = resolve(tempRoot, 'repo');
  try {
    copyRepositoryFixture(fixtureRoot);

    const clean = spawnSync(process.execPath, [
      resolve(fixtureRoot, 'scripts/validate-packs.mjs'),
    ], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    const packsIndexPath = resolve(fixtureRoot, 'nova-plugin/packs/README.md');
    const packsIndex = readFileSync(packsIndexPath, 'utf8');
    assert.match(packsIndex, /They do not implement runtime dynamic loading/);
    writeFileSync(
      packsIndexPath,
      packsIndex.replace(
        /They do not implement runtime dynamic loading; agents use them as optional guidance when a task matches the domain\./,
        'They dynamically load pack runtimes during routing.',
      ),
      'utf8',
    );

    const agentRoutingPath = resolve(fixtureRoot, 'docs/agents/ROUTING.md');
    const agentRouting = readFileSync(agentRoutingPath, 'utf8');
    assert.match(agentRouting, /documentation-only capability packs/);
    writeFileSync(
      agentRoutingPath,
      agentRouting.replace('documentation-only capability packs', 'runtime-loaded capability packs'),
      'utf8',
    );

    const pluginRoutingPath = resolve(fixtureRoot, 'docs/agents/PLUGIN_AWARE_ROUTING.md');
    const pluginRouting = readFileSync(pluginRoutingPath, 'utf8');
    assert.match(pluginRouting, /documentation and validation guidance only/);
    writeFileSync(
      pluginRoutingPath,
      pluginRouting.replace(
        /Packs are documentation and validation guidance only; first-phase routing does not dynamically load pack runtimes\./,
        'Packs are runtime modules that first-phase routing dynamically loads.',
      ),
      'utf8',
    );

    const javaPackPath = resolve(fixtureRoot, 'nova-plugin/packs/java/README.md');
    const javaPack = readFileSync(javaPackPath, 'utf8');
    assert.match(javaPack, /## Fallback Mode[\s\S]*Use source files/);
    writeFileSync(
      javaPackPath,
      javaPack.replace(
        /\r?\nUse source files, build files, local tests, compiler output, and repository conventions to infer behavior manually\.\r?\n/,
        '\n\n',
      ),
      'utf8',
    );

    const drifted = spawnSync(process.execPath, [
      resolve(fixtureRoot, 'scripts/validate-packs.mjs'),
    ], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      shell: false,
    });
    assert.notEqual(drifted.status, 0, 'validate-packs should reject drifted pack contracts');
    const output = `${drifted.stdout}${drifted.stderr}`;
    assert.match(output, /packs index documentation-only runtime boundary/);
    assert.match(output, /agent routing documentation-only pack boundary/);
    assert.match(output, /plugin-aware routing documentation-only boundary/);
    assert.match(output, /Fallback Mode.*must describe the mode/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('verify-agents scripts reject retired active-agent surfaces consistently', () => {
  const bashScript = readFileSync(resolve(root, 'scripts/verify-agents.sh'), 'utf8');
  const psScript = readFileSync(resolve(root, 'scripts/verify-agents.ps1'), 'utf8');
  for (const retiredPath of [
    '.claude/agents',
    'docs/reports',
    'nova-plugin/docs/history',
  ]) {
    assert.match(bashScript, new RegExp(retiredPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(psScript, new RegExp(retiredPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const script of [bashScript, psScript]) {
    assert.match(script, /Retired active-agent path must not exist/);
    assert.match(script, /Active agents live only in nova-plugin\/agents/);
  }
});

test('validate-github-workflows enforces least-privilege workflow contracts', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-workflow-contract-'));
  const fixtureRoot = resolve(tempRoot, 'repo');
  try {
    copyRepositoryFixture(fixtureRoot);

    const clean = spawnSync(process.execPath, [
      'scripts/validate-github-workflows.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    const ciWorkflowPath = resolve(fixtureRoot, '.github/workflows/ci.yml');
    const ciWorkflow = readFileSync(ciWorkflowPath, 'utf8');
    assert.match(ciWorkflow, /permissions:\r?\n  contents: read/);
    writeFileSync(
      ciWorkflowPath,
      ciWorkflow
        .replace(/permissions:\r?\n  contents: read/, 'permissions:\n  contents: write')
        .replace('pull_request:', 'pull_request_target:'),
      'utf8',
    );

    const releaseWorkflowPath = resolve(fixtureRoot, '.github/workflows/release.yml');
    const releaseWorkflow = readFileSync(releaseWorkflowPath, 'utf8');
    assert.match(releaseWorkflow, /  release:\r?\n[\s\S]*?    permissions:\r?\n      contents: write/);
    writeFileSync(
      releaseWorkflowPath,
      releaseWorkflow.replace(/    permissions:\r?\n      contents: write\r?\n/, ''),
      'utf8',
    );

    const pluginInstallSmokePath = resolve(fixtureRoot, '.github/workflows/plugin-install-smoke.yml');
    const pluginInstallSmoke = readFileSync(pluginInstallSmokePath, 'utf8');
    assert.match(pluginInstallSmoke, /workflow_dispatch:/);
    writeFileSync(
      pluginInstallSmokePath,
      pluginInstallSmoke.replace('workflow_dispatch:', 'pull_request:'),
      'utf8',
    );

    const drifted = spawnSync(process.execPath, [
      'scripts/validate-github-workflows.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.notEqual(drifted.status, 0, 'validate-github-workflows should reject unsafe workflow drift');
    const output = `${drifted.stdout}${drifted.stderr}`;
    assert.match(output, /workflow trigger safety contract forbids pull_request_target/);
    assert.match(output, /CI workflow top-level permissions/);
    assert.match(output, /release job scoped write permission/);
    assert.match(output, /plugin install smoke isolation contract/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('validate-github-workflows syncs required-check docs and print output with CI labels', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-workflow-checks-'));
  const fixtureRoot = resolve(tempRoot, 'repo');
  try {
    copyRepositoryFixture(fixtureRoot);

    const clean = spawnSync(process.execPath, [
      'scripts/validate-github-workflows.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    const githubSecuritySettingsPath = resolve(
      fixtureRoot,
      'docs/maintainers/github-security-settings.md',
    );
    const githubSecuritySettings = readFileSync(githubSecuritySettingsPath, 'utf8');
    assert.match(githubSecuritySettings, /Validate GitHub Workflows\r?\n/);
    writeFileSync(
      githubSecuritySettingsPath,
      githubSecuritySettings.replace(/Validate GitHub Workflows\r?\n/, ''),
      'utf8',
    );

    const printSettingsPath = resolve(fixtureRoot, 'scripts/print-github-security-settings.mjs');
    const printSettings = readFileSync(printSettingsPath, 'utf8');
    assert.match(printSettings, /  'Validate GitHub Workflows',\r?\n/);
    writeFileSync(
      printSettingsPath,
      printSettings.replace(/  'Validate GitHub Workflows',\r?\n/, ''),
      'utf8',
    );

    const drifted = spawnSync(process.execPath, [
      'scripts/validate-github-workflows.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.notEqual(drifted.status, 0, 'validate-github-workflows should reject required-check list drift');
    const output = `${drifted.stdout}${drifted.stderr}`;
    assert.match(output, /GitHub security settings required checks must match CI workflow coverage/);
    assert.match(output, /print GitHub security settings required checks must match CI workflow coverage/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('validate-github-workflows rejects workflow inventory and CLAUDE layout drift', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-workflow-inventory-'));
  const fixtureRoot = resolve(tempRoot, 'repo');
  try {
    copyRepositoryFixture(fixtureRoot);

    const clean = spawnSync(process.execPath, [
      'scripts/validate-github-workflows.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    writeFileSync(
      resolve(fixtureRoot, '.github/workflows/unreviewed.yml'),
      [
        'name: Unreviewed',
        '',
        'on:',
        '  workflow_dispatch:',
        '',
        'permissions:',
        '  contents: read',
        '',
        'jobs:',
        '  noop:',
        '    name: Noop',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - run: true',
        '',
      ].join('\n'),
      'utf8',
    );

    const claudePath = resolve(fixtureRoot, 'CLAUDE.md');
    const claude = readFileSync(claudePath, 'utf8');
    assert.match(claude, /\|   \|-- codeql\.yml\r?\n/);
    writeFileSync(
      claudePath,
      claude.replace(/\|   \|-- codeql\.yml\r?\n/, ''),
      'utf8',
    );

    const drifted = spawnSync(process.execPath, [
      'scripts/validate-github-workflows.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.notEqual(drifted.status, 0, 'validate-github-workflows should reject workflow inventory drift');
    const output = `${drifted.stdout}${drifted.stderr}`;
    assert.match(output, /GitHub workflow file inventory must match validate-github-workflows contracts/);
    assert.match(output, /CLAUDE repository workflow layout must match validate-github-workflows contracts/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('validate-docs enforces positioning, maintenance status, release, maintainer, public API, marketplace, contribution/issue intake, docs-index, consumer setup, prompt template, workflow evidence, showcase, growth, assets, portal, and v3 contracts', () => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), 'nova-docs-contract-'));
  const fixtureRoot = resolve(tempRoot, 'repo');
  try {
    copyRepositoryFixture(fixtureRoot);

    const clean = spawnSync(process.execPath, [
      'scripts/validate-docs.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);

    const claudePath = resolve(fixtureRoot, 'CLAUDE.md');
    const claude = readFileSync(claudePath, 'utf8');
    assert.match(claude, /mature multi-plugin ecosystem or a public\r?\nportal/);
    assert.match(claude, /GitHub workflow permission, inventory, and\s+required-check validation/);
    writeFileSync(
      claudePath,
      claude.replace(
        /mature multi-plugin ecosystem or a public\r?\nportal/,
        'mature multi-plugin ecosystem',
      ).replace(
        /GitHub workflow permission, inventory, and\s+required-check validation/,
        'GitHub workflow permission validation',
      ).replace(
        /maintainer diagnostic and security setting semantics, /,
        '',
      ).replace(
        /public API compatibility\r?\ncontracts, /,
        '',
      ).replace(
        /marketplace trust, author workflow, compatibility, and security\r?\nreview contracts, /,
        '',
      ).replace(
        /contribution and issue intake contracts, /,
        '',
      ).replace(
        /docs index navigation contracts,[\s\S]*?v3 readiness evidence\s+contracts, /,
        '',
      ),
      'utf8',
    );

    const maintenanceStatusPath = resolve(
      fixtureRoot,
      'docs/llm-plugins-fusion-maintenance-status.md',
    );
    const maintenanceStatus = readFileSync(maintenanceStatusPath, 'utf8');
    assert.match(maintenanceStatus, /public AI engineering workflow framework centered on\r?\n`nova-plugin`/);
    assert.match(maintenanceStatus, /- Commands: \d+ files under `nova-plugin\/commands\/\*\.md`\./);
    writeFileSync(
      maintenanceStatusPath,
      maintenanceStatus
        .replace(
          /public AI engineering workflow framework centered on\r?\n`nova-plugin`/,
          'public AI engineering workflow framework',
        )
        .replace(
          /- Commands: \d+ files under `nova-plugin\/commands\/\*\.md`\./,
          '- Commands: 999 files under `nova-plugin/commands/*.md`.',
        )
        .replace(
          /`nova-plugin` is the only production plugin\./,
          '`nova-plugin` is one production plugin.',
        )
        .replace(
          /mature multi-plugin ecosystem, public portal, paid marketplace,\r?\nruntime dynamic plugin platform, or enterprise private knowledge base/,
          'mature multi-plugin ecosystem',
        ),
      'utf8',
    );

    const readmePath = resolve(fixtureRoot, 'README.md');
    const readme = readFileSync(readmePath, 'utf8');
    assert.match(readme, /当前稳定推广基线是 `v\d+\.\d+\.\d+`/);
    assert.match(readme, /GitHub workflow 权限、库存和 required-check 合约/);
    writeFileSync(
      readmePath,
      readme
        .replace(/当前稳定推广基线是 `v\d+\.\d+\.\d+`/, '当前稳定推广基线是 `main`')
        .replace(/GitHub workflow 权限、库存和 required-check 合约/, 'GitHub workflow 权限合约'),
      'utf8',
    );

    const releaseEvidencePath = resolve(fixtureRoot, 'docs/releases/release-evidence-template.md');
    const releaseEvidence = readFileSync(releaseEvidencePath, 'utf8');
    assert.match(releaseEvidence, /replacement CI\/Linux evidence/);
    assert.match(releaseEvidence, /node scripts\/validate-github-workflows\.mjs:/);
    writeFileSync(
      releaseEvidencePath,
      releaseEvidence
        .replace(/node scripts\/validate-github-workflows\.mjs:\r?\n/, '')
        .replace(
          /- If local validation reports skipped checks,[\s\S]*?replacement CI\/Linux evidence\.\r?\n/,
          '',
        )
        .replace(
          /- Treat `node scripts\/validate-plugin-install\.mjs` as a separate CI or isolated[\s\S]*?state\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const releaseRunbookPath = resolve(fixtureRoot, 'docs/releases/release-validation-runbook.md');
    const releaseRunbook = readFileSync(releaseRunbookPath, 'utf8');
    assert.match(releaseRunbook, /not slash-command output quality/);
    assert.match(releaseRunbook, /GitHub workflow contracts/);
    assert.match(releaseRunbook, /scripts\/validate-github-workflows\.mjs/);
    writeFileSync(
      releaseRunbookPath,
      releaseRunbook
        .replace(
          /\| GitHub workflow contracts \| Automated \| `node scripts\/validate-github-workflows\.mjs` passes;[\s\S]*?required-check list synchronization\. \|\r?\n/,
          '',
        )
        .replace(/"?\$NODE_BIN"? scripts\/validate-github-workflows\.mjs <\/dev\/null\r?\n/g, '')
        .replace(
          /\| Workflow fixture contract \| Automated \| `node scripts\/validate-workflow-fixtures\.mjs` passes;[\s\S]*?not slash-command output quality\. \|\r?\n/,
          '',
        )
        .replace(
          /If any required manual gate is missing,[\s\S]*?development snapshot, not a stable release\.\r?\n/,
          '',
        )
        .replace(
          /`node scripts\/validate-plugin-install\.mjs --accept-user-scope-mutation` mutates[\s\S]*?test-user environment, not in an operator's everyday Claude profile\.\r?\n/,
          '',
        )
        .replace(
          /\| Plugin install smoke is missing \| Do not promote; record pending isolated\/CI evidence\. \|\r?\n\| Manual workflow evidence is missing[\s\S]*?not-applicable reason\. \|\r?\n/,
          '',
        )
        .replace(
          /Never fill missing evidence with assumptions\.[\s\S]*?`pending` with a concrete reason\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const releaseHygienePath = resolve(fixtureRoot, 'docs/releases/release-hygiene.md');
    const releaseHygiene = readFileSync(releaseHygienePath, 'utf8');
    assert.match(releaseHygiene, /unattended local release evidence should record it as pending/);
    assert.match(releaseHygiene, /node scripts\/validate-github-workflows\.mjs/);
    writeFileSync(
      releaseHygienePath,
      releaseHygiene
        .replace(/node scripts\/validate-github-workflows\.mjs\r?\n/, '')
        .replace(
          /Run `node scripts\/validate-plugin-install\.mjs` only in CI or an isolated[\s\S]*?running it by default\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const quickstartPath = resolve(fixtureRoot, 'docs/maintainers/quickstart.md');
    const quickstart = readFileSync(quickstartPath, 'utf8');
    assert.match(quickstart, /`Bash: WARN` or `skipped>0`/);
    assert.match(quickstart, /workflow trigger, permissions, workflow inventory, and required-check list/);
    writeFileSync(
      quickstartPath,
      quickstart
        .replace(
          /workflow trigger, permissions, workflow inventory, and required-check list/,
          'workflow trigger and permissions',
        )
        .replace(
          /\| CI or release workflow \|[^\n]+\n/,
          '',
        )
        .replace(
          /\| `Bash: WARN` or `skipped>0` \|[^\n]+\n/,
          '',
        ),
      'utf8',
    );

    const troubleshootingPath = resolve(fixtureRoot, 'docs/maintainers/troubleshooting.md');
    const troubleshooting = readFileSync(troubleshootingPath, 'utf8');
    assert.match(troubleshooting, /Do not loosen global permissions/);
    assert.match(troubleshooting, /## Fast Failure Map/);
    assert.match(troubleshooting, /workflow\r?\nfile inventory synchronized with `CLAUDE\.md`/);
    assert.match(troubleshooting, /required-check docs and the\r?\nread-only print script synchronized with CI labels/);
    writeFileSync(
      troubleshootingPath,
      troubleshooting
        .replace(
          /keeps the workflow\r?\nfile inventory synchronized with `CLAUDE\.md`, keeps required-check docs and the\r?\nread-only print script synchronized with CI labels, and /,
          '',
        )
        .replace(
          /## Boundary Rules[\s\S]*?## Windows Without Bash\r?\n/,
          '## Windows Without Bash\n',
        )
        .replace(
          /## Fast Failure Map[\s\S]*?## Windows Without Bash\r?\n/,
          '## Windows Without Bash\n',
        )
        .replace(
          /## GitHub Workflow Permissions[\s\S]*?## Audit Log Location\r?\n/,
          '## Audit Log Location\n',
        ),
      'utf8',
    );

    const githubSecuritySettingsPath = resolve(
      fixtureRoot,
      'docs/maintainers/github-security-settings.md',
    );
    const githubSecuritySettings = readFileSync(githubSecuritySettingsPath, 'utf8');
    assert.match(githubSecuritySettings, /owner-verified checklist/);
    writeFileSync(
      githubSecuritySettingsPath,
      githubSecuritySettings
        .replace(
          /## Manual Settings Boundary[\s\S]*?## Required Repository Settings\r?\n/,
          '## Required Repository Settings\n',
        )
        .replace(/Validate GitHub Workflows\r?\n/, ''),
      'utf8',
    );

    const contributingPath = resolve(fixtureRoot, 'CONTRIBUTING.md');
    const contributing = readFileSync(contributingPath, 'utf8');
    assert.match(contributing, /公开贡献边界/);
    writeFileSync(
      contributingPath,
      contributing.replace(
        /## 公开贡献边界[\s\S]*?## 提交 Pull Request\r?\n/,
        '## 提交 Pull Request\n',
      ).replace(
        /`package\.json` 包含 dependency-free 的\s+`lint` 和 `test` 入口，仍不声明 `check` \/ `build` 脚本名。/,
        '`package.json` 不声明 `check` / `lint` /\n   `test` / `build` 脚本名，避免被 Codex 项目检查脚本重复自动发现。',
      ),
      'utf8',
    );

    const pullRequestTemplatePath = resolve(fixtureRoot, '.github/pull_request_template.md');
    const pullRequestTemplate = readFileSync(pullRequestTemplatePath, 'utf8');
    assert.match(pullRequestTemplate, /Public PR content is free of private consumer names/);
    writeFileSync(
      pullRequestTemplatePath,
      pullRequestTemplate
        .replace(
          /- \[ \] Public PR content is free of private consumer names,[\s\S]*?private knowledge-base content\.\r?\n/,
          '',
        )
        .replace(
          /- \[ \] This PR does not present public portal,[\s\S]*?explicitly activate it\.\r?\n/,
          '',
        )
        .replace(
          /- \[ \] Skipped or unavailable checks are recorded as skipped,[\s\S]*?hide missing tools\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const bugReportTemplatePath = resolve(fixtureRoot, '.github/ISSUE_TEMPLATE/bug_report.yml');
    const bugReportTemplate = readFileSync(bugReportTemplatePath, 'utf8');
    assert.match(bugReportTemplate, /Security issues must be reported privately/);
    writeFileSync(
      bugReportTemplatePath,
      bugReportTemplate
        .replace(
          /Use this form for public,[\s\S]*?public issue\.\r?\n/,
          '',
        )
        .replace(
          /If a tool,[\s\S]*?hide the missing check\.\r?\n/,
          '',
        )
        .replace(
          /        - label: I have removed credentials,[\s\S]*?required: true\r?\n/,
          '',
        ),
      'utf8',
    );

    const featureRequestTemplatePath = resolve(fixtureRoot, '.github/ISSUE_TEMPLATE/feature_request.yml');
    const featureRequestTemplate = readFileSync(featureRequestTemplatePath, 'utf8');
    assert.match(featureRequestTemplate, /Do not present public portal/);
    writeFileSync(
      featureRequestTemplatePath,
      featureRequestTemplate
        .replace(
          /Use this form for feature proposals[\s\S]*?private knowledge-base content\.\r?\n/,
          '',
        )
        .replace(
          /Do not present public portal,[\s\S]*?missing tools or validators\.\r?\n/,
          '',
        )
        .replace(
          /        - label: I have not framed deferred portal,[\s\S]*?required: true\r?\n/,
          '',
        ),
      'utf8',
    );

    const showcaseFeedbackTemplatePath = resolve(
      fixtureRoot,
      '.github/ISSUE_TEMPLATE/showcase_feedback.yml',
    );
    const showcaseFeedbackTemplate = readFileSync(showcaseFeedbackTemplatePath, 'utf8');
    assert.match(showcaseFeedbackTemplate, /Do not submit real consumer case studies/);
    writeFileSync(
      showcaseFeedbackTemplatePath,
      showcaseFeedbackTemplate
        .replace(
          /Use this form for public-safe showcase[\s\S]*?private knowledge-base content\.\r?\n/,
          '',
        )
        .replace(
          /Do not submit real consumer case studies,[\s\S]*?sanitized and generic\.\r?\n/,
          '',
        )
        .replace(
          /        - label: I have not included real consumer case-study details,[\s\S]*?required: true\r?\n/,
          '',
        ),
      'utf8',
    );

    const issueTemplateConfigPath = resolve(fixtureRoot, '.github/ISSUE_TEMPLATE/config.yml');
    const issueTemplateConfig = readFileSync(issueTemplateConfigPath, 'utf8');
    assert.match(issueTemplateConfig, /Report vulnerabilities privately/);
    writeFileSync(
      issueTemplateConfigPath,
      issueTemplateConfig.replace(
        /  - name: Security reports[\s\S]*?public issue\.\r?\n/,
        '',
      ),
      'utf8',
    );

    const publicApiPath = resolve(fixtureRoot, 'docs/compatibility/public-api.md');
    const publicApi = readFileSync(publicApiPath, 'utf8');
    assert.match(publicApi, /The public API is intentionally narrow/);
    writeFileSync(
      publicApiPath,
      publicApi.replace(
        /## Non-API Boundaries[\s\S]*?## Stable Install And Plugin Identifiers\r?\n/,
        '## Stable Install And Plugin Identifiers\n',
      ),
      'utf8',
    );

    const trustPolicyPath = resolve(fixtureRoot, 'docs/marketplace/trust-policy.md');
    const trustPolicy = readFileSync(trustPolicyPath, 'utf8');
    assert.match(trustPolicy, /repository-local marketplace metadata/);
    assert.match(trustPolicy, /validate-github-workflows/);
    writeFileSync(
      trustPolicyPath,
      trustPolicy.replace(
        /This policy defines repository-local marketplace metadata[\s\S]*?## Field Semantics\r?\n/,
        '## Field Semantics\n',
      ).replace(
        /## Permission Posture[\s\S]*?## Review Requirements\r?\n/,
        '## Review Requirements\n',
      ).replace(
        /- Reviewers must verify that Claude-incompatible fields remain only in[\s\S]*?repository-local metadata\.\r?\n/,
        '',
      ).replace(
        /- Public docs and prompts must keep high-risk permission guidance scoped,[\s\S]*?local-only procedure\.\r?\n/,
        '',
      ),
      'utf8',
    );

    const securityReviewRoutePath = resolve(fixtureRoot, 'docs/marketplace/security-review-route.md');
    const securityReviewRoute = readFileSync(securityReviewRoutePath, 'utf8');
    assert.match(securityReviewRoute, /Public Review Boundary/);
    assert.match(securityReviewRoute, /validate-github-workflows/);
    writeFileSync(
      securityReviewRoutePath,
      securityReviewRoute.replace(
        /## Public Review Boundary[\s\S]*?## Trigger Conditions\r?\n/,
        '## Trigger Conditions\n',
      ).replace(
        /4\. Escalate private vulnerability reports through[\s\S]*?instead of a public issue or PR comment\.\r?\n/,
        '',
      ).replace(
        /- Distribution risk scan result for active private paths,[\s\S]*?and tracked `\.codex\/` runtime artifacts\.\r?\n/,
        '',
      ).replace(
        /\| Broad workflow changes \| `node scripts\/validate-github-workflows\.mjs`, `node scripts\/validate-all\.mjs`, `node scripts\/scan-distribution-risk\.mjs`, `git diff --check` \|\r?\n\r?\nChanges under `\.github\/workflows\/\*\*` must include[\s\S]*?smoke boundaries\.\r?\n/,
        '| Broad workflow changes | `node scripts/validate-all.mjs`, `node scripts/scan-distribution-risk.mjs`, `git diff --check` |\n',
      ),
      'utf8',
    );

    const registryAuthorWorkflowPath = resolve(
      fixtureRoot,
      'docs/marketplace/registry-author-workflow.md',
    );
    const registryAuthorWorkflow = readFileSync(registryAuthorWorkflowPath, 'utf8');
    assert.match(registryAuthorWorkflow, /Current Scope Boundary/);
    assert.match(registryAuthorWorkflow, /validate-github-workflows/);
    writeFileSync(
      registryAuthorWorkflowPath,
      registryAuthorWorkflow.replace(
        /## Current Scope Boundary[\s\S]*?## Source Files\r?\n/,
        '## Source Files\n',
      ).replace(
        /Marketplace PRs that change CI\/release workflows[\s\S]*?unavailable validators\.\r?\n\r?\n/,
        '',
      ),
      'utf8',
    );

    const compatibilityMatrixPath = resolve(fixtureRoot, 'docs/marketplace/compatibility-matrix.md');
    const compatibilityMatrix = readFileSync(compatibilityMatrixPath, 'utf8');
    assert.match(compatibilityMatrix, /Evidence Scope Boundary/);
    assert.match(compatibilityMatrix, /validate-github-workflows/);
    writeFileSync(
      compatibilityMatrixPath,
      compatibilityMatrix.replace(
        /## Evidence Scope Boundary[\s\S]*?## Tooling Prerequisites\r?\n/,
        '## Tooling Prerequisites\n',
      ).replace(
        /\| GitHub workflow contracts \| Node\.js 20\+ \| `node scripts\/validate-github-workflows\.mjs` \|[\s\S]*?isolated mutating install smoke boundaries\. \|\r?\n/,
        '',
      ).replace(
        /- GitHub workflow evidence should include `node scripts\/validate-github-workflows\.mjs`\r?\n  when CI\/release workflows,[\s\S]*?required-check guidance\r?\n  changes\.\r?\n/,
        '',
      ),
      'utf8',
    );

    const optimizationPlanPath = resolve(fixtureRoot, 'docs/project-optimization-plan.md');
    const optimizationPlan = readFileSync(optimizationPlanPath, 'utf8');
    assert.match(optimizationPlan, /docs\s+index navigation contracts/);
    assert.match(optimizationPlan, /GitHub workflow permission, inventory, and required-check\s+contracts/);
    assert.match(optimizationPlan, /workflow file\r?\n  inventory, required-check docs and print output/);
    writeFileSync(
      optimizationPlanPath,
      optimizationPlan.replace(
        /GitHub workflow permission, inventory, and required-check\s+contracts/g,
        'GitHub workflow permission contracts',
      ).replace(
        /workflow file\r?\n  inventory, required-check docs and print output, /g,
        '',
      ).replace(
        /maintainer diagnostic and security setting\s+semantics, /g,
        '',
      ).replace(
        /public API\s+compatibility contracts, /g,
        '',
      ).replace(
        /marketplace trust, author\s+workflow, compatibility, and security review\s+contracts, /g,
        '',
      ).replace(
        /contribution and\s+issue intake contracts, /g,
        '',
      ).replace(
        /, docs\r?\n  index navigation contracts, consumer profile privacy contracts, prompt\r?\n  template privacy contracts, workflow evidence contracts, showcase\r?\n  public-safety contracts, growth metrics privacy contracts, assets capture\r?\n  privacy contracts, deferred portal IA contracts, and v3 readiness evidence\r?\n  contracts/,
        '',
      ),
      'utf8',
    );

    const consumerReadmePath = resolve(fixtureRoot, 'docs/consumers/README.md');
    const consumerReadme = readFileSync(consumerReadmePath, 'utf8');
    assert.match(consumerReadme, /Real consumer profiles must live in the consumer project itself/);
    writeFileSync(
      consumerReadmePath,
      consumerReadme
        .replace(
          /Real consumer profiles must live in the consumer project itself,[\s\S]*?workflow details into this public repository\.\r?\n/,
          '',
        )
        .replace(
          /Add `--write` only when the output directory[\s\S]*?not in this public repository\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const javaTemplatePath = resolve(fixtureRoot, 'docs/consumers/private-java-backend-template.md');
    const javaTemplate = readFileSync(javaTemplatePath, 'utf8');
    assert.match(javaTemplate, /Do not replace placeholders with real private values/);
    writeFileSync(
      javaTemplatePath,
      javaTemplate
        .replace(
          /This is a redacted template for a private Java\/Spring backend consumer,[\s\S]*?Do not replace placeholders with real private values in this public repository\.\r?\n/,
          '',
        )
        .replace(
          /Keep public examples at the family level\.[\s\S]*?configuration values\.\r?\n/,
          '',
        )
        .replace(
          /- Do not run destructive data,[\s\S]*?- Do not change command or skill behavior from this template; it only guides\r?\n  project-local profile authoring\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const frontendTemplatePath = resolve(fixtureRoot, 'docs/consumers/frontend-project-template.md');
    const frontendTemplate = readFileSync(frontendTemplatePath, 'utf8');
    assert.match(frontendTemplate, /Do not replace placeholders with real private values/);
    writeFileSync(
      frontendTemplatePath,
      frontendTemplate
        .replace(
          /This is a redacted template for a private frontend application\.[\s\S]*?Do not replace placeholders with real private values in this public repository\.\r?\n/,
          '',
        )
        .replace(
          /Keep public examples at the family level\.[\s\S]*?configuration values\.\r?\n/,
          '',
        )
        .replace(
          /- Do not introduce new frontend stacks,[\s\S]*?- Do not change command or skill behavior from this template; it only guides\r?\n  project-local profile authoring\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const promptReadmePath = resolve(fixtureRoot, 'docs/prompts/README.md');
    const promptReadme = readFileSync(promptReadmePath, 'utf8');
    assert.match(promptReadme, /public-safe prompt templates/);
    writeFileSync(
      promptReadmePath,
      promptReadme
        .replace(
          /This directory contains public-safe prompt templates[\s\S]*?rules out of this public repository\.\r?\n/,
          '',
        )
        .replace(
          /- Do not paste full files,[\s\S]*?when an artifact path or summary is enough\.\r?\n/,
          '',
        )
        .replace(
          /- Treat HTML outputs as derived reading artifacts;[\s\S]*?as the source of truth\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const checkpointPromptPath = resolve(fixtureRoot, 'docs/prompts/common/checkpoint-artifact.md');
    const checkpointPrompt = readFileSync(checkpointPromptPath, 'utf8');
    assert.match(checkpointPrompt, /private consumer workbench/);
    writeFileSync(
      checkpointPromptPath,
      checkpointPrompt
        .replace(
          /Use this prompt when a long-running task[\s\S]*?consumer project only\.\r?\n/,
          '',
        )
        .replace(
          /- Do not include private credentials,[\s\S]*?consumer workspace\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const htmlPromptPath = resolve(fixtureRoot, 'docs/prompts/common/html-artifact.md');
    const htmlPrompt = readFileSync(htmlPromptPath, 'utf8');
    assert.match(htmlPrompt, /derived reading artifacts/);
    writeFileSync(
      htmlPromptPath,
      htmlPrompt
        .replace(
          /Use this prompt when a plan,[\s\S]*?not the source of truth\.\r?\n/,
          '',
        )
        .replace(
          /- 默认不使用外部 CDN、远程 JavaScript、远程字体或远程图片。[\s\S]*?- 长期保留的 HTML 必须配套 Markdown 摘要或来源说明。\r?\n/,
          '',
        ),
      'utf8',
    );

    const workbenchTidyPromptPath = resolve(fixtureRoot, 'docs/prompts/common/workbench-tidy.md');
    const workbenchTidyPrompt = readFileSync(workbenchTidyPromptPath, 'utf8');
    assert.match(workbenchTidyPrompt, /private consumer workspace/);
    writeFileSync(
      workbenchTidyPromptPath,
      workbenchTidyPrompt
        .replace(
          /Use this prompt inside a private consumer workspace[\s\S]*?organized\.\r?\n/,
          '',
        )
        .replace(
          /- 不删除文件，除非用户明确要求。[\s\S]*?- 不把私有文档复制到公开仓库。\r?\n/,
          '',
        ),
      'utf8',
    );

    const sourceControlledChecksPath = resolve(
      fixtureRoot,
      'docs/workflows/source-controlled-checks.md',
    );
    const sourceControlledChecks = readFileSync(sourceControlledChecksPath, 'utf8');
    assert.match(sourceControlledChecks, /not a new\r?\nruntime/);
    writeFileSync(
      sourceControlledChecksPath,
      sourceControlledChecks
        .replace(
          /This note defines how `llm-plugins-fusion` can adopt source-controlled AI[\s\S]*?custom CI product\.\r?\n/,
          '',
        )
        .replace(
          /For this repository, the useful part is not a new\r?\nruntime\.[\s\S]*?public-safe\.\r?\n/,
          '',
        )
        .replace(
          /A future `\.nova\/checks\/` or `nova-plugin\/checks\/` directory is appropriate only\r?\nafter at least two checks repeat across releases or consumer projects\.\r?\n/,
          '',
        )
        .replace(
          /Checks must not include private consumer names,[\s\S]*?knowledge-base content\.\r?\n/,
          '',
        )
        .replace(
          /Do not add a new runtime or CI layer when a deterministic script plus rubric is\r?\nenough\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const verificationEvidencePath = resolve(
      fixtureRoot,
      'docs/workflows/verification-evidence-contract.md',
    );
    const verificationEvidence = readFileSync(verificationEvidencePath, 'utf8');
    assert.match(verificationEvidence, /Do not claim completion from tool success alone/);
    writeFileSync(
      verificationEvidencePath,
      verificationEvidence
        .replace(
          /This document explains[\s\S]*?private knowledge-base content\.\r?\n/,
          '',
        )
        .replace(
          /Do not claim completion from tool success alone\.[\s\S]*?being verified\.\r?\n/,
          '',
        )
        .replace(
          /\| Check skipped \| Environment or tool reason plus residual risk[\s\S]*?reporting the check as passed\. \|\r?\n/,
          '',
        )
        .replace(
          /- skipped or unavailable checks with reasons;\r?\n- known unverified behavior,[\s\S]*?residual risk;\r?\n/,
          '',
        ),
      'utf8',
    );

    const routingGuardrailsPath = resolve(
      fixtureRoot,
      'docs/workflows/routing-validation-guardrails.md',
    );
    const routingGuardrails = readFileSync(routingGuardrailsPath, 'utf8');
    assert.match(routingGuardrails, /not evidence that validation has passed/);
    writeFileSync(
      routingGuardrailsPath,
      routingGuardrails
        .replace(
          /The route output is a recommendation,[\s\S]*?validation has passed\.\r?\n/,
          '',
        )
        .replace(
          /- `Skipped or Unverified` records skipped checks,[\s\S]*?residual risk\.\r?\n/,
          '',
        )
        .replace(
          /Public `nova-plugin` guidance should not recommend blanket permission bypasses[\s\S]*?distribution-risk scanning\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const codexSetupPath = resolve(fixtureRoot, 'docs/consumers/codex-setup.md');
    const codexSetup = readFileSync(codexSetupPath, 'utf8');
    assert.match(codexSetup, /do not\s+relax global permissions/);
    writeFileSync(
      codexSetupPath,
      codexSetup.replace(
        /- If Codex CLI or Bash is unavailable,[\s\S]*?missing runtime\.\r?\n/,
        '',
      ),
      'utf8',
    );

    const cursorSetupPath = resolve(fixtureRoot, 'docs/consumers/cursor-setup.md');
    const cursorSetup = readFileSync(cursorSetupPath, 'utf8');
    assert.match(cursorSetup, /agent sandbox settings/);
    writeFileSync(
      cursorSetupPath,
      cursorSetup.replace(
        /## Public-Safe Boundaries[\s\S]*?## Fallback Notes\r?\n/,
        '## Fallback Notes\n',
      ),
      'utf8',
    );

    const geminiSetupPath = resolve(fixtureRoot, 'docs/consumers/gemini-cli-setup.md');
    const geminiSetup = readFileSync(geminiSetupPath, 'utf8');
    assert.match(geminiSetup, /global tool permissions/);
    writeFileSync(
      geminiSetupPath,
      geminiSetup.replace(
        /## Public-Safe Boundaries[\s\S]*?## Fallback Notes\r?\n/,
        '## Fallback Notes\n',
      ),
      'utf8',
    );

    const openCodeSetupPath = resolve(fixtureRoot, 'docs/consumers/opencode-setup.md');
    const openCodeSetup = readFileSync(openCodeSetupPath, 'utf8');
    assert.match(openCodeSetup, /Store OpenCode-specific configuration in the consumer project/);
    writeFileSync(
      openCodeSetupPath,
      openCodeSetup
        .replace(/4\. Store OpenCode-specific configuration in the consumer project\.\r?\n/, '')
        .replace(
          /- If a selected safety check or validator is unavailable,[\s\S]*?missing tool\.\r?\n/,
          '',
        ),
      'utf8',
    );

    const portalIaPath = resolve(fixtureRoot, 'docs/marketplace/portal-information-architecture.md');
    const portalIa = readFileSync(portalIaPath, 'utf8');
    assert.match(portalIa, /not an implemented public portal/);
    writeFileSync(
      portalIaPath,
      portalIa.replace(
        / It is not an implemented public portal,[\s\S]*?activation evidence for `v3\.0\.0`\./,
        '',
      ),
      'utf8',
    );

    const copilotSetupPath = resolve(fixtureRoot, 'docs/consumers/copilot-setup.md');
    const copilotSetup = readFileSync(copilotSetupPath, 'utf8');
    assert.match(copilotSetup, /agent permissions/);
    writeFileSync(
      copilotSetupPath,
      copilotSetup.replace(
        /## Public-Safe Boundaries[\s\S]*?## Fallback Notes\r?\n/,
        '## Fallback Notes\n',
      ),
      'utf8',
    );

    const v3ReadinessPath = resolve(fixtureRoot, 'docs/marketplace/v3-readiness-evidence.md');
    const v3Readiness = readFileSync(v3ReadinessPath, 'utf8');
    assert.match(v3Readiness, /Registry fixtures may prove generator behavior/);
    writeFileSync(
      v3ReadinessPath,
      v3Readiness.replace(
        /Registry fixtures may prove generator behavior,[\s\S]*?paths\.\r?\n\r?\n/,
        '',
      ),
      'utf8',
    );

    const assetsPath = resolve(fixtureRoot, 'docs/assets/README.md');
    const assets = readFileSync(assetsPath, 'utf8');
    assert.match(assets, /Visual assets are not a public portal/);
    writeFileSync(
      assetsPath,
      assets.replace(
        /Visual assets are not a public portal,[\s\S]*?authenticated workflow\.\r?\n\r?\n/,
        '',
      ),
      'utf8',
    );

    const growthPath = resolve(fixtureRoot, 'docs/growth/README.md');
    const growth = readFileSync(growthPath, 'utf8');
    assert.match(growth, /not a public portal/);
    writeFileSync(
      growthPath,
      growth.replace(
        / It is not a public portal,[\s\S]*?analytics publication surface\./,
        '',
      ),
      'utf8',
    );

    const docsIndexPath = resolve(fixtureRoot, 'docs/README.md');
    const docsIndex = readFileSync(docsIndexPath, 'utf8');
    assert.match(docsIndex, /not a\s+public portal or real consumer case-study library/);
    writeFileSync(
      docsIndexPath,
      docsIndex.replace(
        /## Public Navigation Boundary[\s\S]*?## Start Here\r?\n/,
        '## Start Here\n',
      ),
      'utf8',
    );

    const showcasePath = resolve(fixtureRoot, 'docs/showcase/README.md');
    const showcase = readFileSync(showcasePath, 'utf8');
    assert.match(showcase, /real consumer profiles/);
    writeFileSync(
      showcasePath,
      showcase.replace(
        /- Do not publish real consumer profiles,[\s\S]*?knowledge-base content\.\r?\n/,
        '',
      ),
      'utf8',
    );

    const drifted = spawnSync(process.execPath, [
      'scripts/validate-docs.mjs',
      '--root',
      fixtureRoot,
    ], {
      cwd: root,
      encoding: 'utf8',
      shell: false,
    });
    assert.notEqual(drifted.status, 0, 'validate-docs should reject drifted contract docs');
    const output = `${drifted.stdout}${drifted.stderr}`;
    assert.match(output, /CLAUDE mature ecosystem and public portal boundary/);
    assert.match(output, /CLAUDE validate-docs coverage narrative/);
    assert.match(output, /CLAUDE CI GitHub workflow coverage narrative/);
    assert.match(output, /README exact release tag promotion boundary/);
    assert.match(output, /README validate-all GitHub workflow coverage narrative/);
    assert.match(output, /release evidence skipped checks replacement boundary/);
    assert.match(output, /release evidence plugin install isolation boundary/);
    assert.match(output, /release evidence GitHub workflow validation result slot/);
    assert.match(output, /release runbook missing manual gate snapshot boundary/);
    assert.match(output, /release runbook GitHub workflow contract gate/);
    assert.match(output, /release runbook focused GitHub workflow validation command/);
    assert.match(output, /release runbook fixture quality boundary/);
    assert.match(output, /release runbook plugin install mutation boundary/);
    assert.match(output, /release runbook promotion missing evidence boundary/);
    assert.match(output, /release runbook no assumed evidence boundary/);
    assert.match(output, /release hygiene unattended install smoke pending boundary/);
    assert.match(output, /release hygiene GitHub workflow validation command/);
    assert.match(output, /maintainer quickstart Bash skipped-check boundary/);
    assert.match(output, /maintainer quickstart GitHub workflow shortcut/);
    assert.match(output, /maintainer troubleshooting no permission bypass boundary/);
    assert.match(output, /maintainer troubleshooting private details boundary/);
    assert.match(output, /maintainer troubleshooting unavailable checks boundary/);
    assert.match(output, /maintainer troubleshooting fast failure map purpose/);
    assert.match(output, /maintainer troubleshooting docs failure shortcut/);
    assert.match(output, /maintainer troubleshooting GitHub workflow failure shortcut/);
    assert.match(output, /maintainer troubleshooting pack boundary shortcut/);
    assert.match(output, /maintainer troubleshooting surface budget shortcut/);
    assert.match(output, /maintainer troubleshooting runtime smoke failure shortcut/);
    assert.match(output, /maintainer troubleshooting GitHub workflow validator/);
    assert.match(output, /GitHub security settings manual evidence boundary/);
    assert.match(output, /GitHub security settings private alert boundary/);
    assert.match(output, /GitHub security settings least privilege boundary/);
    assert.match(output, /GitHub security settings required workflow checks/);
    assert.match(output, /public API single production plugin boundary/);
    assert.match(output, /public API no portal marketplace app boundary/);
    assert.match(output, /public API no runtime dynamic loading boundary/);
    assert.match(output, /public API private consumer boundary/);
    assert.match(output, /marketplace trust repo-local metadata boundary/);
    assert.match(output, /marketplace trust permission posture boundary/);
    assert.match(output, /marketplace trust GitHub workflow contract boundary/);
    assert.match(output, /marketplace trust incompatible fields boundary/);
    assert.match(output, /security review public-safe disclosure boundary/);
    assert.match(output, /security review private report route boundary/);
    assert.match(output, /security review permission bypass boundary/);
    assert.match(output, /security review disclosure escalation boundary/);
    assert.match(output, /security review distribution risk output boundary/);
    assert.match(output, /security review GitHub workflow validation route/);
    assert.match(output, /registry author workflow current scope boundary/);
    assert.match(output, /registry author workflow public-safe metadata boundary/);
    assert.match(output, /registry author workflow GitHub workflow validation route/);
    assert.match(output, /compatibility matrix evidence scope boundary/);
    assert.match(output, /compatibility matrix optional tools boundary/);
    assert.match(output, /compatibility matrix GitHub workflow evidence boundary/);
    assert.match(output, /compatibility matrix private evidence boundary/);
    assert.match(output, /contributing public contribution scope boundary/);
    assert.match(output, /contributing private details boundary/);
    assert.match(output, /contributing deferred capability boundary/);
    assert.match(output, /contributing no permission bypass boundary/);
    assert.match(output, /contributing npm shortcut facts/);
    assert.match(output, /PR template private details boundary/);
    assert.match(output, /PR template deferred capability boundary/);
    assert.match(output, /PR template no permission bypass boundary/);
    assert.match(output, /bug report public-safe disclosure boundary/);
    assert.match(output, /bug report unavailable check boundary/);
    assert.match(output, /bug report required public safety checkbox/);
    assert.match(output, /feature request public-safe disclosure boundary/);
    assert.match(output, /feature request deferred capability boundary/);
    assert.match(output, /feature request no permission bypass boundary/);
    assert.match(output, /feature request deferred capability checkbox/);
    assert.match(output, /showcase feedback public-safe disclosure boundary/);
    assert.match(output, /showcase feedback no portal private evidence boundary/);
    assert.match(output, /showcase feedback deferred claim checkbox/);
    assert.match(output, /issue template config private security route/);
    assert.match(output, /optimization plan validate-docs coverage narrative/);
    assert.match(output, /optimization plan GitHub workflow coverage narrative/);
    assert.match(output, /optimization plan validate-github-workflows scope narrative/);
    assert.match(output, /consumer README private profile boundary/);
    assert.match(output, /consumer README scaffold write boundary/);
    assert.match(output, /consumer Java template private profile boundary/);
    assert.match(output, /consumer Java template private facts boundary/);
    assert.match(output, /consumer Java template destructive boundary/);
    assert.match(output, /consumer frontend template private profile boundary/);
    assert.match(output, /consumer frontend template private facts boundary/);
    assert.match(output, /consumer frontend template public portal boundary/);
    assert.match(output, /prompt README public-safe private facts boundary/);
    assert.match(output, /prompt README evidence summary boundary/);
    assert.match(output, /checkpoint prompt private workspace boundary/);
    assert.match(output, /HTML prompt source-of-truth privacy boundary/);
    assert.match(output, /HTML prompt offline derived artifact boundary/);
    assert.match(output, /workbench tidy prompt private workspace boundary/);
    assert.match(output, /source-controlled checks no platform boundary/);
    assert.match(output, /source-controlled checks no runtime positioning/);
    assert.match(output, /source-controlled checks future checks threshold/);
    assert.match(output, /source-controlled checks private facts boundary/);
    assert.match(output, /source-controlled checks no runtime CI layer/);
    assert.match(output, /verification evidence private facts boundary/);
    assert.match(output, /verification evidence maps tool success to behavior/);
    assert.match(output, /verification evidence skipped-check honesty/);
    assert.match(output, /verification summary skipped residual risk/);
    assert.match(output, /routing guardrail route output not evidence/);
    assert.match(output, /routing guardrail skipped unverified boundary/);
    assert.match(output, /routing guardrail no blanket bypass boundary/);
    assert.match(output, /consumer Codex setup no permission bypass boundary/);
    assert.match(output, /consumer Cursor setup private config boundary/);
    assert.match(output, /consumer Cursor setup no permission bypass boundary/);
    assert.match(output, /consumer Gemini setup private config boundary/);
    assert.match(output, /consumer Gemini setup no permission bypass boundary/);
    assert.match(output, /consumer OpenCode setup private config boundary/);
    assert.match(output, /consumer OpenCode setup no permission bypass boundary/);
    assert.match(output, /consumer Copilot setup private config boundary/);
    assert.match(output, /consumer Copilot setup no permission bypass boundary/);
    assert.match(output, /docs index public navigation boundary/);
    assert.match(output, /showcase README private consumer boundary/);
    assert.match(output, /growth metrics no portal automation boundary/);
    assert.match(output, /assets no portal automation boundary/);
    assert.match(output, /portal IA no implemented portal boundary/);
    assert.match(output, /v3 readiness fixture-only evidence boundary/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
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

test('consumer profile scaffold refuses writes inside public repository', () => {
  const preview = spawnSync(process.execPath, [
    'scripts/scaffold-consumer-profile.mjs',
    '--type',
    'workbench',
    '--out',
    '.',
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  assert.match(preview.stdout, /Dry run/);

  const writeAttempt = spawnSync(process.execPath, [
    'scripts/scaffold-consumer-profile.mjs',
    '--type',
    'workbench',
    '--out',
    '.',
    '--write',
  ], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  assert.notEqual(writeAttempt.status, 0, 'write inside repository should fail');
  assert.match(
    `${writeAttempt.stdout}${writeAttempt.stderr}`,
    /refusing to write a consumer profile inside the public llm-plugins-fusion repository/,
  );
});

console.log(`Summary: failed=${failed}`);
if (failed > 0) process.exit(1);
