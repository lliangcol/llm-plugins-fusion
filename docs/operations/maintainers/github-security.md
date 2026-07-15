<!-- migrated-from: docs/maintainers/github-security-settings.md -->
# GitHub Security Settings

Status: active
Date: 2026-07-15

This checklist covers repository settings that cannot be fully enforced from
tracked source files. Maintainers should verify these settings in GitHub before
promoting a release.

## Manual Settings Boundary

- This document is an owner-verified checklist, not a public portal, automated
  settings auditor, or substitute for GitHub UI evidence.
- Keep raw CodeQL alerts, secret scanning hits, dependency advisory details,
  repository rule screenshots, tokens, and owner-only security settings out of
  public docs and issue threads.
- Do not raise default Actions token permissions or make mutating install smoke
  a default required check just to satisfy this checklist; use least-privilege
  workflow permissions and isolated release evidence.

## Required Repository Settings

| Area | Required setting |
| --- | --- |
| Default branch | `main` is protected by a ruleset or branch protection rule. |
| Pull requests | Require pull request before merge, require at least one approval, dismiss stale approvals when new commits are pushed, and require review from Code Owners. Do not allow an author or bypass actor to satisfy the independent-review rule. |
| Status checks | Require the CI aggregate, PR Governance, dependency review, and CodeQL before merge. |
| History safety | Block force pushes and branch deletion for `main`. |
| Code scanning | Enable CodeQL alerts and fail open PRs only through documented triage. |
| Secret scanning | Enable secret scanning and push protection where available. |
| Dependency graph | Enable Dependency graph, Dependabot alerts, and Dependabot security updates. |
| Workflow permissions | Default Actions token permission should be read-only unless a workflow explicitly needs write permission. |
| Claude release credential | Store the inference-only `claude setup-token` result as `CLAUDE_CODE_OAUTH_TOKEN`; do not configure a competing API-key or cloud-provider credential for the release route gate. |
| Issue intake | Issues are enabled, blank issues are disabled, and public issue forms are scoped to public-safe bug, feature, and showcase feedback. |

## Suggested Required Checks

Use the live GitHub check names if they differ, but keep the coverage equivalent:

```text
Required / Aggregate
PR Governance
Dependency Review
CodeQL / Analyze JavaScript
```

`Required / Aggregate` fails unless Contracts, Tests, Security, the full
platform matrix, and Package all succeed. The conditional live-evidence lane
may be skipped on pull requests but may not fail on `main`. This keeps branch
protection stable while retaining structured evidence within each consolidated
lane.

`PR Governance` is a separate lightweight pull-request check. It rejects a PR
description when `Summary`, `Why`, `Maintainer Owner`, `Risk`, or `Validation
Results` is missing, blank, or still contains only template placeholder text.
It treats a PR as large when it changes more than 50 files or more than 1,000
added plus deleted lines. Such a PR must be split below that budget or set
`Large Change Exception` to `Status: exception` with a concrete reason and an
accountable GitHub-handle owner.

The same check requires an eligible human repository reviewer (`OWNER`,
`MEMBER`, or `COLLABORATOR`) other than the PR author to approve the current
head commit when the PR changes a sensitive path. The tracked
set is derived from the explicit entries in `.github/CODEOWNERS` rather than
duplicated in a second policy. It covers `.github/`, `SECURITY.md`, schemas, workflow contracts,
framework code, hook/runtime guardrails, release-reviewer governance, release
artifact/evidence scripts, and the PR-governance validator itself. The workflow
reruns when a review is submitted, edited, or dismissed. Keep "Dismiss stale
pull request approvals when new commits are pushed" and "Require review from
Code Owners" enabled: the source check and GitHub ruleset are complementary,
especially when a PR changes the governance workflow or validator.

Bootstrap the check in this order: merge the workflow and validator under the
existing protections, wait until `PR Governance` has run on the default branch
or a subsequent PR, and only then add that exact observed check name to the
`main` ruleset. Before enabling required code-owner review, make sure every
sensitive surface resolves to at least one eligible reviewer other than the
likely PR author. A single-owner mapping is expected to block that owner's own
PRs; do not weaken the rule or add a fictitious identity to bypass the block.

The mutating `Plugin Install Smoke` workflow is not a default required check.
It is release or promotion evidence for disposable CI runners or isolated
test-user environments.

`Dependency Review` is fail-closed for same-repository pull requests when the
dependency graph preflight returns 403 or 404. For fork pull requests, the
fallback reports `not_applicable` only when no dependency-bearing surface
changed; otherwise the check is blocked and requires maintainer security
approval. An unavailable control is never reported as passed.

The review action blocks high and critical vulnerabilities and denies the
legacy, `-only`, and `-or-later` SPDX identifiers for GPL-2.0, GPL-3.0, and
AGPL-3.0 additions. It does not post PR comments, so the workflow retains
read-only pull-request permissions.

## Maintainer Audit

Before a release:

1. Confirm `main` protection exists and references the current check names.
2. Confirm code-owner review and stale-approval dismissal are enabled and that
   sensitive-path PRs cannot use repository-rule bypass to avoid independent
   review.
3. Confirm code scanning, secret scanning, Dependabot alerts, and dependency
   graph are enabled.
4. Confirm release validation uses `npm run validate:maintainer` and install
   smoke dry-run.
5. Confirm `CLAUDE_CODE_OAUTH_TOKEN` is present and current before pushing a
   release tag; never paste its value into evidence or logs.
6. Confirm issue creation is enabled, blank issues are disabled, and the
   tracked issue forms remain public-safe.
7. Record any unavailable GitHub platform checks in the release evidence.

For a local read-only checklist printout:

```bash
node scripts/print-github-security-settings.mjs
```
