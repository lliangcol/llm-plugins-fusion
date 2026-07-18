import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { main as generateAdaptersMain } from '../../scripts/generate-adapters.mjs';
import { main as generateFactGraphMain } from '../../scripts/generate-fact-graph.mjs';
import { main as generateProjectStateMain } from '../../scripts/generate-project-state.mjs';
import { main as generateTimingTrendMain } from '../../scripts/generate-validation-timing-trend.mjs';
import { main as generateWorkflowPermissionsMain } from '../../scripts/generate-workflow-permissions.mjs';
import { main as evaluateWorkflowSurfacesMain } from '../../scripts/evaluate-workflow-surfaces.mjs';
import {
  checkOrWrite as checkNormalizedSkills,
  main as normalizeMain,
  normalizeSkill,
} from '../../scripts/normalize-workflow-surfaces.mjs';
import { main as migrateV6Main } from '../../scripts/migrate-v6-contracts.mjs';
import {
  committedSource,
  compareStableVersions,
  inboundCompatibilityLinks,
  main as migrateDocumentationMain,
  repositoryPath,
  rewriteInboundCompatibilityLinks,
  rewriteLinks,
  rewriteRedirectLinks,
  writeEntry,
} from '../../scripts/migrate-documentation-layout.mjs';
import {
  main as migrateV5Main,
  migrate,
  migrateBehaviors,
} from '../../scripts/migrate-v5-surfaces.mjs';

const root = resolve(import.meta.dirname, '../..');

function runScript(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
}

test('skill normalization rebuilds the shared contract without losing specific guidance', () => {
  const source = [
    '---',
    'name: nova-review',
    'description: Review changes.',
    '---',
    '',
    'Discarded legacy preamble.',
    '',
    '## Skill-Specific Guidance',
    '',
    'Inspect $REVIEW_SCOPE while preserving $ARGUMENTS.',
  ].join('\n');
  const normalized = normalizeSkill(source, 'review');
  assert.match(normalized, /supporting behavioral contract for `\/nova-plugin:review`/u);
  assert.match(normalized, /Inspect <REVIEW_SCOPE> while preserving \$ARGUMENTS\./u);
  assert.doesNotMatch(normalized, /Discarded legacy preamble/u);
  assert.equal(normalized.endsWith('\n'), true);

  const migratedHeading = normalizeSkill('\n## Migrated Slash Command Contract\n\nMigrated from an old command.\n\nUse $REQUEST.', 'route');
  assert.match(migratedHeading, /## Detailed Contract\n\nUse <REQUEST>\./u);
  assert.throws(
    () => normalizeSkill('Legacy preamble.\n## Skill-Specific Guidance\nNo frontmatter.', 'review'),
    /missing frontmatter/u,
  );
});

test('normalization and v6 migration check current projections and reject unsupported CLI arguments', () => {
  assert.equal(checkNormalizedSkills(), 9);
  assert.equal(normalizeMain([]), 0);
  assert.equal(normalizeMain(['--help']), 0);
  assert.equal(normalizeMain(['--definitely-invalid']), 1);

  assert.equal(migrateV6Main([]), undefined);
  assert.throws(() => migrateV6Main(['--definitely-invalid']), /Usage:/u);
});

test('v5 migration maps canonical and compatibility surfaces and fails closed before writes', () => {
  const migrated = migrate({
    schemaVersion: 4,
    workflows: [
      { id: 'review', permissionProfile: 'legacy', risk: 'high' },
      { id: 'review-only' },
    ],
  });
  assert.equal(migrated.schemaVersion, 5);
  assert.deepEqual(migrated.contractVersions, { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' });
  assert.deepEqual(migrated.workflows[0], {
    id: 'review',
    permissionProfile: 'read-only',
    risk: 'none',
    canonicalSurfaceId: 'review',
    variantPreset: {},
    compatibilityAlias: false,
    contractPath: 'skills/nova-review/SKILL.md',
  });
  assert.deepEqual(migrated.workflows[1], {
    id: 'review-only',
    canonicalSurfaceId: 'review',
    variantPreset: { LEVEL: 'standard', MODE: 'findings-only' },
    compatibilityAlias: true,
    contractPath: 'skills/nova-review/SKILL.md',
  });
  assert.throws(() => migrate({ workflows: [{ id: 'invented' }] }), /missing v5 surface mapping/u);

  const behaviors = migrateBehaviors({
    behaviors: [
      { id: 'review', untouched: true },
      {
        id: 'route',
        invariants: ['commands, skills, agents, and packs must exist'],
        output: {
          fields: [{ name: 'Command' }, { name: 'Fallback path' }],
          order: ['Command', 'Fallback path'],
        },
        validation: ['commands and skills exist one-to-one'],
      },
    ],
  });
  assert.deepEqual(behaviors.behaviors[0], { id: 'review', untouched: true });
  assert.deepEqual(behaviors.behaviors[1].output.fields.map((field) => field.name), [
    'Canonical skill',
    'Command entrypoint',
    'Variant parameters',
    'Fallback path',
  ]);
  assert.match(behaviors.behaviors[1].invariants[0], /canonical skills, compatibility command aliases/u);
  assert.match(behaviors.behaviors[1].validation[0], /canonical skill, compatibility alias, and preset/u);
  assert.equal(migrateV5Main([]), 1);
  assert.equal(migrateV5Main(['--definitely-invalid']), 1);
});

test('exported projection entrypoints reject unknown arguments before mutation', () => {
  for (const [label, main] of [
    ['generate-adapters', generateAdaptersMain],
    ['generate-fact-graph', generateFactGraphMain],
    ['generate-project-state', generateProjectStateMain],
    ['generate-workflow-permissions', generateWorkflowPermissionsMain],
  ]) assert.equal(main(['--definitely-invalid']), 1, label);
});

test('validation timing migration reads one record and writes its normalized projection', (t) => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-validation-trend-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = resolve(directory, 'timing.json');
  const output = resolve(directory, 'trend.json');
  writeFileSync(input, `${JSON.stringify({
    runId: 'run-1',
    generatedAt: '2026-07-17T00:00:00Z',
    failed: 0,
    skipped: 1,
    gates: [{ id: 'validate', status: 'passed', durationMs: 12 }],
  })}\n`);
  assert.equal(generateTimingTrendMain(['--input', input, '--output', output]), undefined);
  const trend = JSON.parse(readFileSync(output, 'utf8'));
  assert.equal(trend.runCount, 1);
  assert.deepEqual(trend.gateIds, ['validate']);
  assert.equal(trend.runs[0].totalDurationMs, 12);
  assert.throws(() => generateTimingTrendMain([]), /Usage:/u);
});

test('documentation migration helpers preserve targets and rewrite compatibility links', () => {
  assert.equal(migrateDocumentationMain([]), 0);
  assert.throws(() => migrateDocumentationMain(['--definitely-invalid']), /Usage:/u);
  assert.equal(compareStableVersions({ major: 5, minor: 0, patch: 0 }, { major: 4, minor: 9, patch: 9 }), 1);
  assert.equal(compareStableVersions({ major: 4, minor: 1, patch: 0 }, { major: 4, minor: 1, patch: 0 }), 0);
  assert.throws(() => repositoryPath('../outside.md', 'fixture'), /must stay inside/u);
  assert.throws(() => repositoryPath('./README.md', 'fixture'), /normalized repository-relative/u);

  const moved = rewriteLinks('[guide](../shared/guide.md#start) [web](https://example.com)', 'docs/old/source.md', 'docs/new/target.md');
  assert.equal(moved, '[guide](../shared/guide.md#start) [web](https://example.com)');

  const migrationRegistry = JSON.parse(readFileSync(resolve(root, 'governance/docs-migrations.json'), 'utf8'));
  const redirects = new Map(migrationRegistry.mappings.map((entry) => [entry.from, entry.to]));
  const first = migrationRegistry.mappings[0];
  let finalTarget = first.to;
  const seen = new Set();
  while (redirects.has(finalTarget) && !seen.has(finalTarget)) {
    seen.add(finalTarget);
    finalTarget = redirects.get(finalTarget);
  }
  const documentPath = 'README.md';
  const compatibilityHref = relative(dirname(resolve(root, documentPath)), resolve(root, first.from)).split(sep).join('/');
  const redirected = rewriteRedirectLinks(`[legacy](${compatibilityHref}?view=1#top)`, documentPath);
  const expectedHref = relative(dirname(resolve(root, documentPath)), resolve(root, finalTarget)).split(sep).join('/');
  assert.equal(redirected, `[legacy](${expectedHref}?view=1#top)`);

  assert.match(committedSource('README.md'), /LLM Plugins Fusion/u);
  assert.deepEqual(inboundCompatibilityLinks(), []);
  rewriteInboundCompatibilityLinks();
  assert.deepEqual(inboundCompatibilityLinks(), []);
  assert.equal(writeEntry({ from: 'README.md', to: 'README.md', disposition: 'retain' }), undefined);
});

test('workflow surface projection rejects unsupported arguments before evaluation', () => {
  assert.equal(evaluateWorkflowSurfacesMain(['--definitely-invalid']), 1);
});

const rejectedArgumentProjectionScripts = [
  'scripts/generate-behavior-surfaces.mjs',
  'scripts/generate-command-docs.mjs',
  'scripts/generate-compatibility-evidence.mjs',
  'scripts/generate-diagnostics-docs.mjs',
  'scripts/generate-doc-governance.mjs',
  'scripts/generate-eval-corpus.mjs',
  'scripts/generate-quality-report.mjs',
  'scripts/generate-registry.mjs',
  'scripts/generate-runtime-contracts.mjs',
  'scripts/generate-surface-inventory.mjs',
];

test('maintenance projection CLI wrappers reject unknown arguments without writing', () => {
  for (const script of rejectedArgumentProjectionScripts) {
    const result = runScript(script, ['--definitely-invalid']);
    assert.notEqual(result.status, 0, script);
    assert.match(`${result.stdout}\n${result.stderr}`, /(?:Usage:|unknown argument)/u, script);
  }
});
