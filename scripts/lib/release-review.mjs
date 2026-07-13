export function evaluateIndependentReview({ pullRequestAuthor, candidateActor, expectedReviewCommit = null, reviews, trustedReviewers = [], botActors = [], minimumApprovals = 1 }) {
  const latest = new Map();
  for (const review of [...reviews].sort((left, right) => String(left.submittedAt).localeCompare(String(right.submittedAt)))) {
    if (review.reviewer) latest.set(review.reviewer, review);
  }
  const excluded = new Set([pullRequestAuthor, candidateActor].filter(Boolean));
  const trusted = new Set(trustedReviewers);
  const bots = new Set(botActors);
  const approvals = [...latest.values()].filter((review) => review.state === 'APPROVED'
    && !excluded.has(review.reviewer)
    && trusted.has(review.reviewer)
    && !bots.has(review.reviewer)
    && !/\[bot\]$/u.test(review.reviewer)
    && (!expectedReviewCommit || review.commit === expectedReviewCommit));
  return {
    passed: approvals.length >= minimumApprovals,
    minimumApprovals,
    pullRequestAuthor,
    candidateActor,
    expectedReviewCommit,
    approvalReviewers: approvals.map((review) => review.reviewer).sort(),
    trustedReviewers: [...trusted].sort(),
    excludedReviewers: [...excluded].sort(),
  };
}
