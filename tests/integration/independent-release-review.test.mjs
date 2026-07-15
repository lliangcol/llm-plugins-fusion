import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
      ? [{ user: { login: 'lliang' }, state: 'APPROVED', submitted_at: '2026-07-16T00:01:00Z', commit_id: reviewedHead }]
      : url.includes('/files?')
        ? [{ filename: 'governance/release-reviewers.json' }]
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
