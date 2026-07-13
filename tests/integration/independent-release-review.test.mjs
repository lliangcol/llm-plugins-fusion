import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyIndependentReview } from '../../scripts/verify-independent-release-review.mjs';

test('release review fails closed while trusted identities remain externally unconfigured', async () => {
  await assert.rejects(verifyIndependentReview({
    args: ['--repository', 'owner/repo', '--commit', 'abc', '--candidate-actor', 'actor'],
    env: { GH_TOKEN: 'token' },
    fetchImpl: async () => { throw new Error('network must not be reached'); },
  }), /trusted reviewer identity or team is not configured/u);
});
