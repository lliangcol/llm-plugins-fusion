# GitHub Security Settings

Status: active
Date: 2026-06-24

This checklist covers repository settings that cannot be fully enforced from
tracked source files. Maintainers should verify these settings in GitHub before
promoting a release.

## Required Repository Settings

| Area | Required setting |
| --- | --- |
| Default branch | `main` is protected by a ruleset or branch protection rule. |
| Pull requests | Require pull request before merge, require at least one approval, and dismiss stale approvals when new commits are pushed. |
| Status checks | Require the CI workflow checks, dependency review, and CodeQL before merge. |
| History safety | Block force pushes and branch deletion for `main`. |
| Code scanning | Enable CodeQL alerts and fail open PRs only through documented triage. |
| Secret scanning | Enable secret scanning and push protection where available. |
| Dependency graph | Enable Dependency graph, Dependabot alerts, and Dependabot security updates. |
| Workflow permissions | Default Actions token permission should be read-only unless a workflow explicitly needs write permission. |

## Suggested Required Checks

Use the live GitHub check names if they differ, but keep the coverage equivalent:

```text
Verify Agents
Validate Schemas
Validate Registry Fixtures
Validate Capability Packs
Validate Claude Compatibility
Plugin Install Dry Run
Lint Frontmatter
Validate Hooks
Validate Runtime Smoke
Validate Surface Budget
Scan Distribution Risk
Validate Regression
Validate Workflow Fixtures
Validate Docs
Windows Node Smoke
Dependency Review
CodeQL / Analyze JavaScript
```

The mutating `Plugin Install Smoke` workflow is not a default required check.
It is release or promotion evidence for disposable CI runners or isolated
test-user environments.

## Maintainer Audit

Before a release:

1. Confirm `main` protection exists and references the current check names.
2. Confirm code scanning, secret scanning, Dependabot alerts, and dependency
   graph are enabled.
3. Confirm release validation uses `npm run ci:full` and install smoke dry-run.
4. Record any unavailable GitHub platform checks in the release evidence.

For a local read-only checklist printout:

```bash
node scripts/print-github-security-settings.mjs
```
