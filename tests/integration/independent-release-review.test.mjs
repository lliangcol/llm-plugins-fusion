import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { verifyIndependentReview } from '../../scripts/verify-independent-release-review.mjs';

test('configured release review accepts only the trusted collaborator on the final PR head', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'release-review-configured-'));
  const mergeCommit = 'a'.repeat(40);
  const reviewedHead = 'b'.repeat(40);
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => url.includes('/reviews?')
      ? [{ id: 15, user: { login: 'lliang', type: 'User' }, state: 'APPROVED', author_association: 'MEMBER', submitted_at: '2026-07-16T00:01:00Z', commit_id: reviewedHead }]
      : url.includes('/files?')
        ? [{ filename: 'docs/reviewer-policy.json', previous_filename: 'governance/release-reviewers.json' }]
        : url.endsWith('/pulls/97')
          ? { number: 97, merged_at: '2026-07-16T00:00:00Z', merge_commit_sha: mergeCommit, changed_files: 1, head: { sha: reviewedHead }, user: { login: 'lliangcol' } }
        : [{ number: 97, merged_at: '2026-07-16T00:00:00Z', merge_commit_sha: mergeCommit, head: { sha: reviewedHead }, user: { login: 'lliangcol' } }],
  });
  try {
    const evidence = await verifyIndependentReview({
      args: ['--repository', 'owner/repo', '--commit', mergeCommit, '--candidate-actor', 'release-actor', '--out', resolve(directory, 'review.json')],
      env: { GH_TOKEN: 'token' },
      fetchImpl,
    });
    assert.equal(evidence.sensitive, true);
    assert.equal(evidence.minimumApprovals, 1);
    assert.deepEqual(evidence.approvalReviewers, ['lliang']);
    assert.equal(evidence.expectedReviewCommit, reviewedHead);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('independent release review rejects a truncated merged-PR files response', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'release-review-truncated-'));
  const mergeCommit = 'a'.repeat(40);
  const reviewedHead = 'b'.repeat(40);
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => url.includes('/reviews?')
      ? [{ id: 16, user: { login: 'lliang', type: 'User' }, state: 'APPROVED', author_association: 'MEMBER', submitted_at: '2026-07-16T00:01:00Z', commit_id: reviewedHead }]
      : url.includes('/files?')
        ? [{ filename: 'docs/README.md' }]
        : url.endsWith('/pulls/97')
          ? { number: 97, merged_at: '2026-07-16T00:00:00Z', merge_commit_sha: mergeCommit, changed_files: 2, head: { sha: reviewedHead }, user: { login: 'lliangcol' } }
          : [{ number: 97, merged_at: '2026-07-16T00:00:00Z', merge_commit_sha: mergeCommit }],
  });
  try {
    await assert.rejects(
      verifyIndependentReview({
        args: ['--repository', 'owner/repo', '--commit', mergeCommit, '--candidate-actor', 'release-actor', '--out', resolve(directory, 'review.json')],
        env: { GH_TOKEN: 'token' },
        fetchImpl,
      }),
      /merged pull request files response is incomplete or ambiguous: received 1 records for changed_files=2/u,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('independent release review treats GitHub login casing as one identity', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'release-review-identity-'));
  const mergeCommit = 'c'.repeat(40);
  const reviewedHead = 'd'.repeat(40);
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    json: async () => url.includes('/reviews?')
      ? [{ id: 17, user: { login: 'lliang', type: 'User' }, state: 'APPROVED', author_association: 'MEMBER', submitted_at: '2026-07-16T00:01:00Z', commit_id: reviewedHead }]
      : url.includes('/files?')
        ? [{ filename: 'README.md' }]
        : url.endsWith('/pulls/98')
          ? { number: 98, merged_at: '2026-07-16T00:00:00Z', merge_commit_sha: mergeCommit, changed_files: 1, head: { sha: reviewedHead }, user: { login: 'Lliang' } }
          : [{ number: 98, merged_at: '2026-07-16T00:00:00Z', merge_commit_sha: mergeCommit }],
  });
  try {
    await assert.rejects(
      verifyIndependentReview({
        args: ['--repository', 'owner/repo', '--commit', mergeCommit, '--candidate-actor', 'release-actor', '--out', resolve(directory, 'review.json')],
        env: { GH_TOKEN: 'token' },
        fetchImpl,
      }),
      /requires 1 independent approval; found 0/u,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('independent release review resolves trusted team members and verifies fallback PR association details', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'release-review-team-'));
  const mergeCommit = 'e'.repeat(40);
  const reviewedHead = 'f'.repeat(40);
  const reviewers = resolve(directory, 'reviewers.json');
  writeFileSync(reviewers, `${JSON.stringify({
    schemaVersion: 1,
    status: 'configured',
    trustedUsers: [],
    trustedTeams: ['owner/release-engineering'],
    botIdentities: ['automation[bot]'],
    sensitivePaths: ['governance/'],
    standardMinimumApprovals: 1,
    sensitiveMinimumApprovals: 2,
  })}\n`, 'utf8');
  const fetchImpl = async (url) => {
    let payload;
    if (url.includes('/commits/') && url.includes('/pulls?')) {
      payload = [{ number: 99, merged_at: '2026-07-17T00:00:00Z', merge_commit_sha: null }];
    } else if (url.endsWith('/pulls/99')) {
      payload = { number: 99, merged_at: '2026-07-17T00:00:00Z', merge_commit_sha: mergeCommit, changed_files: 1, head: { sha: reviewedHead }, user: { login: 'author' } };
    } else if (url.includes('/reviews?')) {
      payload = [{ id: 19, user: { login: 'Peer', type: 'User' }, state: 'APPROVED', author_association: 'MEMBER', submitted_at: '2026-07-17T00:01:00Z', commit_id: reviewedHead }];
    } else if (url.includes('/orgs/owner/teams/release-engineering/members?')) {
      payload = [{ login: 'Peer' }];
    } else if (url.includes('/files?')) {
      payload = [{ filename: 'README.md' }];
    } else {
      throw new Error(`unexpected request: ${url}`);
    }
    return { ok: true, status: 200, json: async () => payload };
  };
  try {
    const evidence = await verifyIndependentReview({
      args: ['--repository', 'owner/repo', '--commit', mergeCommit, '--candidate-actor', 'publisher', '--reviewers', reviewers, '--out', resolve(directory, 'review.json')],
      env: { GH_TOKEN: 'token' },
      fetchImpl,
      now: () => new Date('2026-07-17T00:02:00Z'),
    });
    assert.equal(evidence.passed, true);
    assert.deepEqual(evidence.approvalReviewers, ['peer']);
    assert.equal(evidence.pullRequest, 99);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
