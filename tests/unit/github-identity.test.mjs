import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCommitIdentity,
  normalizeGithubLogin,
  normalizeGithubTeam,
} from '../../scripts/lib/github-identity.mjs';
import {
  evaluateIndependentReview,
  validateReleaseReviewerPolicy,
} from '../../scripts/lib/release-review.mjs';

test('GitHub identities normalize canonical user, bot, team, and commit forms', () => {
  assert.equal(normalizeGithubLogin(' @Release-Owner '), 'release-owner');
  assert.equal(normalizeGithubLogin('Automation[bot]'), 'automation[bot]');
  assert.equal(normalizeGithubTeam(' @OpenAI/Release.Engineering '), 'openai/release.engineering');
  assert.equal(normalizeCommitIdentity('ABC_def-123.4'), 'abc_def-123.4');
  assert.equal(normalizeCommitIdentity('A'.repeat(40), 'release SHA', { fullSha: true }), 'a'.repeat(40));
});

test('GitHub identity normalization rejects ambiguous and non-canonical security identities', () => {
  for (const value of [null, '', '@', '-owner', 'owner-', 'owner/name', 'bad name']) {
    assert.throws(() => normalizeGithubLogin(value), /GitHub login/u);
  }
  assert.throws(() => normalizeGithubLogin('automation[bot]', 'reviewer', { allowBot: false }), /reviewer/u);

  for (const value of [null, '', 'owner', 'owner/', '/team', 'owner/team/name', 'owner/bad team']) {
    assert.throws(() => normalizeGithubTeam(value), /organization\/team identity/u);
  }

  assert.throws(() => normalizeCommitIdentity(null), /commit identity/u);
  assert.throws(() => normalizeCommitIdentity('abc/def'), /commit identity/u);
  assert.throws(() => normalizeCommitIdentity('a'.repeat(39), 'release SHA', { fullSha: true }), /40-character hexadecimal SHA/u);
});

test('release reviewer policy accepts canonical teams and bots while rejecting disguised identities', () => {
  const policy = {
    schemaVersion: 1,
    status: 'configured',
    trustedUsers: ['release-owner'],
    trustedTeams: ['openai/release-engineering'],
    botIdentities: ['automation[bot]'],
    sensitivePaths: ['governance/'],
    standardMinimumApprovals: 1,
    sensitiveMinimumApprovals: 2,
  };
  assert.equal(validateReleaseReviewerPolicy(policy), policy);

  for (const [field, value] of [
    ['trustedUsers', ['automation[bot]']],
    ['trustedTeams', ['OpenAI/release-engineering']],
    ['botIdentities', ['@automation[bot]']],
  ]) {
    const invalid = structuredClone(policy);
    invalid[field] = value;
    assert.throws(() => validateReleaseReviewerPolicy(invalid), /release reviewer/u);
  }
});

test('configured automation actors remain excluded even when also listed as trusted reviewers', () => {
  const result = evaluateIndependentReview({
    pullRequestAuthor: 'author',
    candidateActor: 'publisher',
    expectedReviewCommit: 'head',
    trustedReviewers: ['peer', 'automation'],
    botActors: ['automation'],
    reviews: [
      { id: 1, reviewer: 'automation', state: 'APPROVED', submittedAt: '2026-07-17T00:00:00Z', commit: 'head' },
      { id: 2, reviewer: 'peer', state: 'APPROVED', submittedAt: '2026-07-17T00:01:00Z', commit: 'head' },
    ],
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.approvalReviewers, ['peer']);
});

test('release review contracts fail closed for malformed policies and review records', () => {
  const policy = {
    $schema: '../schemas/release-reviewers.schema.json',
    schemaVersion: 1,
    status: 'awaiting-owner-configuration',
    trustedUsers: [],
    trustedTeams: [],
    botIdentities: [],
    sensitivePaths: ['README.md'],
    standardMinimumApprovals: 1,
    sensitiveMinimumApprovals: 1,
  };
  assert.equal(validateReleaseReviewerPolicy(policy), policy);

  for (const mutate of [
    (value) => { value.trustedUsers = ['']; },
    (value) => { value.trustedUsers = ['peer', 'peer']; },
    (value) => { value.$schema = 1; },
    (value) => { value.unexpected = true; },
    (value) => { value.status = 'ready'; },
  ]) {
    const invalid = structuredClone(policy);
    mutate(invalid);
    assert.throws(() => validateReleaseReviewerPolicy(invalid), /release reviewer/u);
  }
  for (const sensitivePath of ['/', '/absolute', 'dir\\file', 'dir/*', 'dir//file', './file', 'dir/../file']) {
    const invalid = structuredClone(policy);
    invalid.sensitivePaths = [sensitivePath];
    assert.throws(() => validateReleaseReviewerPolicy(invalid), /non-portable path/u);
  }
  for (const invalidPolicy of [null, []]) {
    assert.throws(() => validateReleaseReviewerPolicy(invalidPolicy), /must be an object/u);
  }

  const base = { pullRequestAuthor: 'author', candidateActor: 'actor', reviews: [] };
  for (const invalidInput of [
    { ...base, reviews: null },
    { ...base, trustedReviewers: 'peer' },
    { ...base, botActors: 'automation' },
  ]) {
    assert.throws(() => evaluateIndependentReview(invalidInput), /inputs must use arrays/u);
  }
  assert.throws(
    () => evaluateIndependentReview({ ...base, minimumApprovals: 1.5 }),
    /minimumApprovals must be an integer/u,
  );

  for (const reviews of [
    [null],
    [[]],
    ['review'],
    [{ reviewer: 'peer', state: 'UNKNOWN', submittedAt: '2026-01-01T00:00:00Z' }],
    [{ reviewer: 'peer', state: 'APPROVED', submittedAt: 'not-a-date' }],
  ]) {
    assert.throws(() => evaluateIndependentReview({ ...base, reviews }), /independent review record/u);
  }
  assert.throws(
    () => evaluateIndependentReview({
      ...base,
      expectedReviewCommit: 'head',
      reviews: [{ reviewer: 'peer', state: 'APPROVED', submittedAt: '2026-01-01T00:00:00Z' }],
    }),
    /missing its commit identity/u,
  );
});

test('independent review deterministically resolves equal-time and out-of-order records', () => {
  const evaluate = (reviews) => evaluateIndependentReview({
    pullRequestAuthor: 'author',
    candidateActor: 'actor',
    trustedReviewers: ['peer'],
    reviews,
  });
  const at = '2026-01-01T00:00:00Z';
  assert.equal(evaluate([
    { id: 2, reviewer: 'peer', state: 'APPROVED', submittedAt: at },
    { id: 1, reviewer: 'peer', state: 'CHANGES_REQUESTED', submittedAt: at },
  ]).passed, true);
  assert.equal(evaluate([
    { id: 1, reviewer: 'peer', state: 'APPROVED', submittedAt: at },
    { id: 2, reviewer: 'peer', state: 'CHANGES_REQUESTED', submittedAt: at },
  ]).passed, false);
  assert.equal(evaluate([
    { id: 'first', reviewer: 'peer', state: 'CHANGES_REQUESTED', submittedAt: at },
    { id: 'second', reviewer: 'peer', state: 'APPROVED', submittedAt: at },
  ]).passed, true);
  assert.equal(evaluate([
    { reviewer: 'peer', state: 'APPROVED', submittedAt: '2026-01-02T00:00:00Z' },
    { reviewer: 'peer', state: 'CHANGES_REQUESTED', submittedAt: at },
  ]).passed, true);
});
