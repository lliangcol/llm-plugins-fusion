# Shared Output Contracts

This file defines common response and artifact expectations for nova-plugin
skills. Individual skills may use stricter output formats.

## Chat Output

Chat output should be concise, structured, and scoped to the command purpose.
Do not paste large generated artifacts into chat when the skill writes them to
disk.

Common patterns:

- Exploration: observations, unknowns, risks, and next information needed.
- Planning: goal, non-goals, implementation outline, risks, validation.
- Review: findings first, grouped by severity, with evidence and assumptions.
- Implementation: changed files, verification performed, deviations, residual
  risk.
- Finalization: what changed, validation, handoff notes, next steps.

## Review Findings

Review skills should:

- Prioritize correctness, security, data integrity, production risk, and tests.
- Lead with findings before summaries.
- Use concrete evidence or clearly label inference.
- Avoid full code implementations in review-only workflows.
- State when no findings were found and note residual test gaps.

## Artifact Output

When a skill writes an artifact:

- Report the path written.
- Provide a short executive summary.
- Do not duplicate the full artifact in chat.
- Keep artifact content review-ready and self-contained.
- Use repository-relative paths in the artifact when that improves portability.

When a skill or prompt writes an HTML artifact:

- Report the HTML path and the source artifact or evidence used.
- State that the HTML is a derived reading artifact unless explicitly approved
  as source.
- Provide a concise Markdown summary in chat.
- Do not paste the full HTML into chat.
- State skipped validation, unsupported browser assumptions, or unavailable
  source evidence.
- Prefer an adjacent Markdown summary or source note when the HTML artifact is
  meant to be retained.

## Verification Output

Verification summaries should include:

- Commands or checks run.
- Pass/fail result for each check.
- The acceptance behavior, repository fact, review finding, or change goal each
  check supports.
- Any skipped checks and why.
- Behavior, repository facts, findings, or edge cases that remain unverified.
- Residual risk or blockers.

Never claim checks passed unless their result was observed.
Never treat "tests pass" alone as completion evidence; state what intended
behavior, repository fact, or change goal the tests or checks actually cover.
Never mark a review finding as resolved without mapping evidence and validation
back to the finding's expected behavior.
Never omit known unverified behavior, repository facts, skipped checks, or edge
cases from the verification summary.

## Failure Output

When blocked, output:

- The blocking condition.
- The missing or conflicting parameter names.
- The files, commands, or environment facts checked.
- A minimal next action that would unblock the workflow.

Do not continue with partial side effects after a safety-boundary failure.
