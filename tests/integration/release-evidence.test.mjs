import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  buildReleaseEvidence,
  generateReleaseEvidence,
  parseArgs,
  renderReleaseEvidenceMarkdown,
} from '../../scripts/generate-release-evidence.mjs';
import {
  routeMaxTurns,
  routeOutputContract,
  routeSystemPromptSha256,
} from '../../scripts/validate-plugin-route-live.mjs';

const coverageSummary = `# tests 80
# pass 80
# fail 0
# start of coverage report
# all files | 88.05 | 70.01 | 92.89 |
`;

const digest = 'a'.repeat(64);
const commandIds = ['route', 'review', ...Array.from({ length: 19 }, (_, index) => `command-${index}`)];
const skillNames = ['nova-route', 'nova-review', ...Array.from({ length: 19 }, (_, index) => `nova-skill-${index}`)];
const installedSkills = [...commandIds, ...skillNames];
const projectFileInventory = [{ path: 'README.md', type: 'file', bytes: 1, sha256: digest }];
const projectDigest = createHash('sha256').update(JSON.stringify(projectFileInventory)).digest('hex');
const expectedRouteInventory = {
  commandIds,
  skillNames,
  agents: ['reviewer'],
  packs: ['docs'],
};

function fixtureInput() {
  return {
    plugin: { version: '2.4.1' },
    coverageSummary,
    coverageMetadata: { exitCode: 0, node: 'v22.23.1', thresholds: { lines: 85, branches: 60, functions: 90 } },
    timings: { schemaVersion: 1, runId: 'test', failed: 0, skipped: 0, gates: [{ id: 'docs.validate', label: 'validate docs', status: 'passed', durationMs: 25 }] },
    install: {
      claudeVersion: '2.1.205 (Claude Code)',
      knownGoodClaudeCli: '2.1.205',
      manifestValidation: { marketplace: true, plugin: true },
      marketplace: { source: 'owner/repo@v2.4.1', ref: 'v2.4.1' },
      plugin: { id: 'nova-plugin@marketplace', version: '2.4.1' },
      inventory: { count: 42, skills: [...installedSkills] },
      inventoryDiff: { matches: true },
      sourceTreeDigest: digest,
      installedTreeDigest: digest,
      installedTreeIgnoredPaths: ['.in_use/**'],
      validation: { passed: true, errors: [] },
    },
    route: {
      invocation: '/nova-plugin:route',
      authenticationMode: 'claude-code-oauth-token',
      configurationIsolation: 'temporary-home',
      permissionMode: 'dontAsk',
      allowedTools: ['Skill(nova-plugin:route)', 'Read', 'Glob', 'Grep'],
      disallowedTools: ['Write', 'Edit', 'NotebookEdit', 'Bash'],
      outputContract: routeOutputContract.id,
      systemPromptSha256: routeSystemPromptSha256,
      maxTurns: routeMaxTurns,
      outputStructureValid: true,
      projectChanged: false,
      gitStatus: '',
      commands: ['review'],
      skills: ['nova-review'],
      agents: ['reviewer'],
      packs: ['docs'],
      beforeProjectDigest: projectDigest,
      afterProjectDigest: projectDigest,
      projectFileInventory,
      resultSha256: 'b'.repeat(64),
    },
    checksums: 'abc  file\n',
    env: { GITHUB_SHA: 'c'.repeat(40), GITHUB_REF_NAME: 'v2.4.1' },
    now: () => new Date('2026-07-11T00:00:00Z'),
    requireLive: true,
    expectedRouteInventory,
  };
}

function fixture() {
  return buildReleaseEvidence(fixtureInput());
}

test('release evidence CLI parsing covers flags, values, and rejected arguments', () => {
  const root = resolve('/tmp', 'release-evidence-args');
  const options = parseArgs(['--help', '--require-live', '--out-dir', 'output', '--artifact-dir', 'artifacts'], root);
  assert.equal(options.help, true);
  assert.equal(options.requireLive, true);
  assert.equal(options.outDir, resolve(root, 'output'));
  assert.equal(options.artifactDir, resolve(root, 'artifacts'));
  assert.throws(() => parseArgs(['--unknown'], root), /unknown argument/);
});

test('release evidence aggregates machine facts without raw model output', () => {
  const evidence = fixture();
  assert.equal(evidence.release.pluginVersion, '2.4.1');
  assert.equal(evidence.install.skillsCount, 42);
  assert.deepEqual(evidence.install.installedTreeIgnoredPaths, ['.in_use/**']);
  assert.deepEqual(evidence.install.manifestValidation, { marketplace: true, plugin: true });
  assert.equal(evidence.route.projectChanged, false);
  assert.deepEqual(evidence.tests.coverage, { lines: 88.05, branches: 70.01, functions: 92.89 });
  assert.doesNotMatch(JSON.stringify(evidence), /Recommended Route/);
  assert.equal(evidence.route.authenticationMode, 'claude-code-oauth-token');
  assert.deepEqual(evidence.route.allowedTools, ['Skill(nova-plugin:route)', 'Read', 'Glob', 'Grep']);
  assert.deepEqual(evidence.route.disallowedTools, ['Write', 'Edit', 'NotebookEdit', 'Bash']);
  assert.equal(evidence.route.outputContract, routeOutputContract.id);
  assert.match(evidence.route.systemPromptSha256, /^[a-f0-9]{64}$/);
  assert.equal(evidence.route.maxTurns, routeMaxTurns);
  assert.match(renderReleaseEvidenceMarkdown(evidence), /OAuth route: passed with temporary-home isolation and zero project writes/);
});

test('release evidence also accepts interactive Node test summary markers', () => {
  const input = fixtureInput();
  input.coverageSummary = coverageSummary.replaceAll('# ', 'ℹ ');
  assert.equal(buildReleaseEvidence(input).tests.passed, 80);
});

test('release evidence rejects ambiguous route authentication evidence', () => {
  assert.throws(
    () => buildReleaseEvidence({
      plugin: { version: '2.4.1' },
      coverageSummary,
      coverageMetadata: { exitCode: 0, node: 'v20', thresholds: {} },
      timings: { failed: 0, skipped: 0, timings: [] },
      route: { projectChanged: false, gitStatus: '', authenticationMode: 'api-key', configurationIsolation: 'temporary-home' },
      checksums: 'abc  file\n',
    }),
    /does not prove Claude Code OAuth authentication/,
  );
});

test('release evidence rejects skipped gates and inconsistent live inputs', () => {
  const skipped = fixtureInput();
  skipped.timings.skipped = 1;
  skipped.timings.gates = [{ id: 'required.gate', label: 'required gate', status: 'skipped', durationMs: 0 }];
  assert.throws(() => buildReleaseEvidence(skipped), /unsupported skipped validation timing gates/);

  for (const mutate of [
    (input) => { input.install.marketplace.ref = 'wrong'; },
    (input) => { input.install.plugin.version = '0.0.0'; },
    (input) => { input.install.installedTreeDigest = 'd'.repeat(64); },
    (input) => { input.install.installedTreeIgnoredPaths = ['.in_use/**', 'commands/**']; },
    (input) => { input.route.invocation = '/wrong:route'; },
    (input) => { input.route.outputStructureValid = false; },
    (input) => { input.route.permissionMode = 'default'; },
    (input) => { input.route.allowedTools = ['Skill']; },
    (input) => { input.route.disallowedTools = ['Write']; },
    (input) => { input.route.outputContract = 'wrong'; },
    (input) => { input.route.systemPromptSha256 = 'd'.repeat(64); },
    (input) => { input.route.maxTurns = 3; },
    (input) => { input.route.resultSha256 = ''; },
    (input) => { input.route.afterProjectDigest = 'd'.repeat(64); },
    (input) => { input.install.inventory.skills[2] = 'invented-skill'; },
    (input) => { input.route.agents = ['invented-agent']; },
    (input) => { input.route.packs = ['invented-pack']; },
    (input) => { input.expectedRouteInventory = null; },
    (input) => { input.timings.gates = []; },
  ]) {
    const input = fixtureInput();
    mutate(input);
    assert.throws(() => buildReleaseEvidence(input));
  }
});

test('release evidence accepts only the Claude compatibility skip with exact live replacement proof', () => {
  const input = fixtureInput();
  input.timings = {
    schemaVersion: 1,
    runId: 'test',
    failed: 0,
    skipped: 1,
    gates: [
      { id: 'docs.validate', label: 'validate docs', status: 'passed', durationMs: 25 },
      { id: 'claude.manifest.static', label: 'validate Claude compatibility', status: 'skipped', durationMs: 39 },
    ],
  };
  const evidence = buildReleaseEvidence(input);
  assert.deepEqual(evidence.gates[1], {
    id: 'claude.manifest.static',
    name: 'validate Claude compatibility',
    status: 'passed',
    durationMs: 39,
    replacementGateId: 'claude.manifest.exact_tag_live',
  });
  assert.match(renderReleaseEvidenceMarkdown(evidence), /claude\.manifest\.exact_tag_live/);
});

test('release evidence rejects incomplete or ambiguous skipped timing replacement proof', () => {
  const rejected = [
    (input) => { input.install.manifestValidation.marketplace = false; },
    (input) => { input.install.manifestValidation.plugin = false; },
    (input) => { delete input.install.manifestValidation; },
    (input) => {
      input.timings.skipped = 2;
      input.timings.gates.push({ id: 'another.gate', label: 'another gate', status: 'skipped', durationMs: 1 });
    },
    (input) => { input.timings.skipped = 0; },
    (input) => { input.requireLive = false; },
    (input) => {
      input.timings.failed = 1;
      input.timings.gates.push({ id: 'failed.gate', label: 'failed gate', status: 'failed', durationMs: 1 });
    },
  ];
  for (const mutate of rejected) {
    const input = fixtureInput();
    input.timings = {
      schemaVersion: 1,
      runId: 'test',
      failed: 0,
      skipped: 1,
      gates: [{ id: 'claude.manifest.static', label: 'validate Claude compatibility', status: 'skipped', durationMs: 39 }],
    };
    mutate(input);
    assert.throws(() => buildReleaseEvidence(input));
  }
});

test('release evidence CLI requires live inputs when requested', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-release-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'nova-plugin/.claude-plugin'), { recursive: true });
  await mkdir(resolve(root, '.metrics/coverage'), { recursive: true });
  await mkdir(resolve(root, '.metrics/release-checksums'), { recursive: true });
  await writeFile(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), '{"version":"2.4.1"}\n');
  await writeFile(resolve(root, '.metrics/coverage/coverage-summary.txt'), coverageSummary);
  await writeFile(resolve(root, '.metrics/coverage/metadata.json'), '{"exitCode":0,"node":"v20","thresholds":{}}\n');
  await writeFile(resolve(root, '.metrics/validation-timings.json'), '{"failed":0,"skipped":0,"timings":[]}\n');
  await writeFile(resolve(root, '.metrics/release-checksums/SHA256SUMS.txt'), 'abc  file\n');
  assert.throws(() => generateReleaseEvidence({ root, args: ['--require-live'] }), /required evidence input is missing/);

  const result = generateReleaseEvidence({ root });
  assert.equal(JSON.parse(await readFile(result.jsonPath, 'utf8')).route, null);
});
