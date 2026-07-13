import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { diffLabels, parseLabelCatalog } from '../../scripts/lib/label-catalog.mjs';
import { evaluateIndependentReview } from '../../scripts/lib/release-review.mjs';
import { syncLabels } from '../../scripts/sync-github-labels.mjs';
import { main as validateWorkflowContractV5 } from '../../scripts/validate-workflow-contract-v5.mjs';
import { verifyIndependentReview } from '../../scripts/verify-independent-release-review.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));

test('independent release review excludes untrusted, bot, author, actor, and superseded approvals', () => {
  const result = evaluateIndependentReview({ pullRequestAuthor: 'author', candidateActor: 'actor', expectedReviewCommit: 'head', trustedReviewers: ['other'], reviews: [
    { reviewer: 'author', state: 'APPROVED', submittedAt: '2026-01-01T00:00:00Z', commit: 'head' },
    { reviewer: 'peer', state: 'APPROVED', submittedAt: '2026-01-01T00:00:01Z', commit: 'head' },
    { reviewer: 'peer', state: 'CHANGES_REQUESTED', submittedAt: '2026-01-01T00:00:02Z', commit: 'head' },
    { reviewer: 'stale', state: 'APPROVED', submittedAt: '2026-01-01T00:00:03Z', commit: 'old-head' },
    { reviewer: 'other', state: 'APPROVED', submittedAt: '2026-01-01T00:00:04Z', commit: 'head' },
    { reviewer: 'automation[bot]', state: 'APPROVED', submittedAt: '2026-01-01T00:00:05Z', commit: 'head' },
  ] });
  assert.equal(result.passed, true);
  assert.deepEqual(result.approvalReviewers, ['other']);
  assert.equal(evaluateIndependentReview({ pullRequestAuthor: 'author', candidateActor: 'actor', trustedReviewers: ['peer'], minimumApprovals: 2, reviews: [{ reviewer: 'peer', state: 'APPROVED', submittedAt: '2026-01-01T00:00:00Z' }] }).passed, false);
  assert.equal(evaluateIndependentReview({ pullRequestAuthor: 'author', candidateActor: 'actor', reviews: [] }).passed, false);
});

test('label catalog computes create/update without deletion', () => {
  const desired = parseLabelCatalog('labels:\n  - { name: "one", color: "abcdef", description: "One" }\n  - { name: "two", color: "123456", description: "Two" }\n');
  const diff = diffLabels(desired, [{ name: 'one', color: '000000', description: 'Old' }, { name: 'legacy', color: 'ffffff', description: 'Keep' }]);
  assert.deepEqual(diff.create.map((entry) => entry.name), ['two']);
  assert.deepEqual(diff.update.map((entry) => entry.name), ['one']);
  assert.equal(Object.hasOwn(diff, 'delete'), false);
});

test('label sync supports dry-run and create/update without deletion', async () => {
  const desired = parseLabelCatalog(readFileSync(join(root, '.github/labels.yml'), 'utf8'));
  const unchangedFetch = async () => ({ ok: true, status: 200, json: async () => desired });
  const checked = await syncLabels({ env: { GITHUB_REPOSITORY: 'owner/repo', GH_TOKEN: 'token' }, fetchImpl: unchangedFetch, sourceRoot: root });
  assert.deepEqual(checked.diff, { create: [], update: [], unchanged: desired.length });

  const requests = [];
  const actual = desired.slice(0, -1).map((label, index) => index === 0 ? { ...label, description: 'outdated' } : label);
  const applyFetch = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET' });
    return { ok: true, status: options.method === 'POST' ? 201 : 200, json: async () => options.method === 'GET' ? actual : {} };
  };
  const applied = await syncLabels({ args: ['--apply'], env: { GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'token' }, fetchImpl: applyFetch, sourceRoot: root });
  assert.equal(applied.diff.create.length, 1);
  assert.equal(applied.diff.update.length, 1);
  assert.deepEqual(requests.map((entry) => entry.method), ['GET', 'POST', 'PATCH']);
  assert.equal(requests.some((entry) => entry.method === 'DELETE'), false);
  await assert.rejects(syncLabels({ args: ['--delete'], env: {}, fetchImpl: applyFetch, sourceRoot: root }), /Usage/u);
});

test('independent review verifier writes current merged-PR evidence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nova-release-review-'));
  const output = join(directory, 'independent-review.json');
  const reviewers = join(directory, 'reviewers.json');
  await import('node:fs/promises').then(({ writeFile }) => writeFile(reviewers, `${JSON.stringify({ schemaVersion: 1, status: 'configured', trustedUsers: ['peer'], trustedTeams: [], botIdentities: [], sensitivePaths: ['schemas/'], standardMinimumApprovals: 1, sensitiveMinimumApprovals: 2 })}\n`));
  const fetchImpl = async (url) => {
    const records = url.includes('/reviews?')
      ? [{ user: { login: 'peer' }, state: 'APPROVED', submitted_at: '2026-07-12T00:01:00Z', commit_id: '1234567890123456789012345678901234567890' }]
      : url.includes('/files?') ? [{ filename: 'README.md' }]
        : [{ number: 42, merged_at: '2026-07-12T00:00:00Z', merge_commit_sha: 'abc123', head: { sha: '1234567890123456789012345678901234567890' }, user: { login: 'author' } }];
    return { ok: true, status: 200, json: async () => records };
  };
  try {
    const evidence = await verifyIndependentReview({
      args: ['--repository', 'owner/repo', '--commit', 'abc123', '--candidate-actor', 'release-bot', '--reviewers', reviewers, '--out', output],
      env: { GH_TOKEN: 'token' },
      fetchImpl,
      now: () => new Date('2026-07-12T00:02:00Z'),
    });
    assert.equal(evidence.passed, true);
    assert.deepEqual(evidence.approvalReviewers, ['peer']);
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), evidence);
    await assert.rejects(verifyIndependentReview({ args: [], env: {}, fetchImpl }), /required/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('workflow contract v5 entrypoint validates the canonical six-skill surface', () => {
  const result = validateWorkflowContractV5();
  assert.equal(result.workflows, 21);
  assert.equal(result.adapters, 3);
});
