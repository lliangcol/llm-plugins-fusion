export function evaluateIndependentReview({ pullRequestAuthor, candidateActor, expectedReviewCommit = null, reviews, minimumApprovals = 1 }) {
  const latest = new Map();
  for (const review of [...reviews].sort((left, right) => String(left.submittedAt).localeCompare(String(right.submittedAt)))) {
    if (review.reviewer) latest.set(review.reviewer, review);
  }
  const excluded = new Set([pullRequestAuthor, candidateActor].filter(Boolean));
  const approvals = [...latest.values()].filter((review) => review.state === 'APPROVED'
    && !excluded.has(review.reviewer)
    && (!expectedReviewCommit || review.commit === expectedReviewCommit));
  return {
    passed: approvals.length >= minimumApprovals,
    minimumApprovals,
    pullRequestAuthor,
    candidateActor,
    expectedReviewCommit,
    approvalReviewers: approvals.map((review) => review.reviewer).sort(),
    excludedReviewers: [...excluded].sort(),
  };
}
