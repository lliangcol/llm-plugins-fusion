import {
  normalizeCommitIdentity,
  normalizeGithubLogin,
  normalizeGithubTeam,
} from './github-identity.mjs';

const REVIEWER_POLICY_KEYS = new Set([
  '$schema',
  'schemaVersion',
  'status',
  'trustedUsers',
  'trustedTeams',
  'botIdentities',
  'sensitivePaths',
  'standardMinimumApprovals',
  'sensitiveMinimumApprovals',
]);

function assertUniqueStringArray(value, label, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) throw new Error(`${label} must be ${nonEmpty ? 'a non-empty' : 'an'} array`);
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(`${label} contains an invalid identity or path`);
    }
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must contain unique values`);
}

function assertCanonicalIdentityArray(value, label, normalize, normalizeOptions = undefined) {
  assertUniqueStringArray(value, label);
  for (let index = 0; index < value.length; index += 1) {
    const entry = normalize(value[index], `${label}[${index}]`, normalizeOptions);
    if (entry !== value[index]) {
      throw new Error(`${label} must use trimmed lowercase identities without an @ prefix`);
    }
  }
}

export function validateReleaseReviewerPolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) throw new Error('release reviewer policy must be an object');
  const unexpected = [];
  for (const key of Object.keys(policy)) {
    if (!REVIEWER_POLICY_KEYS.has(key)) unexpected.push(key);
  }
  if (unexpected.length > 0) throw new Error(`release reviewer policy contains unexpected fields: ${unexpected.join(', ')}`);
  if (policy.$schema !== undefined && typeof policy.$schema !== 'string') throw new Error('release reviewer policy $schema must be a string');
  if (policy.schemaVersion !== 1) throw new Error('release reviewer policy schemaVersion must be 1');
  if (!['configured', 'awaiting-owner-configuration'].includes(policy.status)) throw new Error('release reviewer policy status is invalid');
  assertCanonicalIdentityArray(policy.trustedUsers, 'release reviewer trustedUsers', normalizeGithubLogin, { allowBot: false });
  assertCanonicalIdentityArray(policy.trustedTeams, 'release reviewer trustedTeams', normalizeGithubTeam);
  assertCanonicalIdentityArray(policy.botIdentities, 'release reviewer botIdentities', normalizeGithubLogin);
  assertUniqueStringArray(policy.sensitivePaths, 'release reviewer sensitivePaths', { nonEmpty: true });
  for (const path of policy.sensitivePaths) {
    const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
    let invalidComponent = false;
    for (const component of trimmed.split('/')) {
      if (component === '' || component === '.' || component === '..') invalidComponent = true;
    }
    if (!trimmed
      || path.startsWith('/')
      || path.includes('\\')
      || /[!*?\[\]\p{Cc}]/u.test(path)
      || invalidComponent) {
      throw new Error(`release reviewer sensitivePaths contains a non-portable path: ${path}`);
    }
  }
  if (!Number.isInteger(policy.standardMinimumApprovals) || policy.standardMinimumApprovals < 1) {
    throw new Error('release reviewer standardMinimumApprovals must be an integer of at least 1');
  }
  if (!Number.isInteger(policy.sensitiveMinimumApprovals)
    || policy.sensitiveMinimumApprovals < policy.standardMinimumApprovals) {
    throw new Error('release reviewer sensitiveMinimumApprovals must be an integer at least standardMinimumApprovals');
  }
  return policy;
}

export function evaluateIndependentReview({ pullRequestAuthor, candidateActor, expectedReviewCommit = null, reviews, trustedReviewers = [], botActors = [], minimumApprovals = 1 }) {
  if (!Array.isArray(reviews) || !Array.isArray(trustedReviewers) || !Array.isArray(botActors)) {
    throw new Error('independent review inputs must use arrays for reviews and reviewer identities');
  }
  if (!Number.isInteger(minimumApprovals) || minimumApprovals < 1) {
    throw new Error('independent review minimumApprovals must be an integer of at least 1');
  }
  const author = normalizeGithubLogin(pullRequestAuthor, 'pull request author');
  const actor = normalizeGithubLogin(candidateActor, 'candidate actor');
  const reviewCommit = expectedReviewCommit === null
    ? null
    : normalizeCommitIdentity(expectedReviewCommit, 'expected review commit');
  const latest = new Map();
  for (let index = 0; index < reviews.length; index += 1) {
    const review = reviews[index];
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      throw new Error(`independent review record ${index} must be an object`);
    }
    const reviewer = normalizeGithubLogin(review.reviewer, `independent review record ${index} reviewer`);
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED', 'COMMENTED'].includes(review.state)) {
      throw new Error(`independent review record ${index} has an invalid state`);
    }
    const submittedAt = Date.parse(review.submittedAt);
    if (!Number.isFinite(submittedAt)) throw new Error(`independent review record ${index} has an invalid submittedAt`);
    const commit = review.commit === undefined || review.commit === null
      ? null
      : normalizeCommitIdentity(review.commit, `independent review record ${index} commit`);
    if (reviewCommit && !commit) throw new Error(`independent review record ${index} is missing its commit identity`);
    const normalized = { ...review, reviewer, commit, submittedAtMs: submittedAt };
    const previous = latest.get(reviewer);
    const reviewIdOrder = previous ? Number(normalized.id ?? 0) - Number(previous.id ?? 0) : 0;
    if (!previous
      || normalized.submittedAtMs > previous.submittedAtMs
      || (normalized.submittedAtMs === previous.submittedAtMs
        && (Number.isNaN(reviewIdOrder) || reviewIdOrder >= 0))) {
      latest.set(reviewer, normalized);
    }
  }
  const excluded = new Set([author, actor]);
  const trusted = new Set();
  for (let index = 0; index < trustedReviewers.length; index += 1) {
    trusted.add(normalizeGithubLogin(trustedReviewers[index], `trusted reviewer ${index}`, { allowBot: false }));
  }
  const bots = new Set();
  for (let index = 0; index < botActors.length; index += 1) {
    bots.add(normalizeGithubLogin(botActors[index], `bot actor ${index}`));
  }
  const approvals = [];
  for (const review of latest.values()) {
    if (review.state === 'APPROVED'
    && !excluded.has(review.reviewer)
    && trusted.has(review.reviewer)
    && !bots.has(review.reviewer)
    && !/\[bot\]$/u.test(review.reviewer)
    && (!reviewCommit || review.commit === reviewCommit)) approvals.push(review);
  }
  const approvalReviewers = [];
  for (const review of approvals) approvalReviewers.push(review.reviewer);
  approvalReviewers.sort();
  return {
    passed: approvals.length >= minimumApprovals,
    minimumApprovals,
    pullRequestAuthor: author,
    candidateActor: actor,
    expectedReviewCommit: reviewCommit,
    approvalReviewers,
    trustedReviewers: [...trusted].sort(),
    excludedReviewers: [...excluded].sort(),
  };
}
