import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePullRequestGovernance } from '../../scripts/validate-pr-governance.mjs';

const BODY = `## Summary
Protect sensitive paths.
## Why
Ordinary PRs need independent review.
## Maintainer Owner
@owner
## Risk
False negatives could permit an unreviewed governance change.
## Validation Results
- focused tests: passed
## Large Change Exception
- Status: not-required
- Reason:
- Owner:
`;

test('PR governance integrates event facts with paginated GitHub files and reviews', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/files?')) {
      return new Response(JSON.stringify([{ filename: '.github/workflows/ci.yml' }]), { status: 200 });
    }
    if (url.includes('/reviews?')) {
      return new Response(JSON.stringify([{ id: 7, state: 'APPROVED', commit_id: 'head-sha', author_association: 'MEMBER', user: { login: 'reviewer', type: 'User' } }]), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const result = await validatePullRequestGovernance({
    event: {
      pull_request: {
        number: 42,
        body: BODY,
        additions: 10,
        deletions: 2,
        changed_files: 1,
        user: { login: 'author' },
        head: { sha: 'head-sha' },
      },
    },
    repository: 'owner/repo',
    token: 'test-token',
    apiBase: 'https://github.invalid',
    sensitivePaths: ['.github/'],
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.sensitiveFiles[0], '.github/workflows/ci.yml');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /pulls\/42\/files\?per_page=100&page=1/u);
  assert.match(calls[1], /pulls\/42\/reviews\?per_page=100&page=1/u);
});
