# GitHub Security Settings

Status: active
Date: 2026-06-24

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
| Pull requests | Require pull request before merge, require at least one approval, and dismiss stale approvals when new commits are pushed. |
| Status checks | Require the CI workflow checks, dependency review, and CodeQL before merge. |
| History safety | Block force pushes and branch deletion for `main`. |
| Code scanning | Enable CodeQL alerts and fail open PRs only through documented triage. |
| Secret scanning | Enable secret scanning and push protection where available. |
| Dependency graph | Enable Dependency graph, Dependabot alerts, and Dependabot security updates. |
| Workflow permissions | Default Actions token permission should be read-only unless a workflow explicitly needs write permission. |
| Issue intake | Issues are enabled, blank issues are disabled, and public issue forms are scoped to public-safe bug, feature, and showcase feedback. |

## Suggested Required Checks

Use the live GitHub check names if they differ, but keep the coverage equivalent:

```text
Verify Agents
Validate Schemas
Validate Registry Fixtures
Validate Generated Drift
Validate Capability Packs
Validate Claude Compatibility
NPM Test
Plugin Install Dry Run
Lint Frontmatter
Validate Hooks
ShellCheck
Validate GitHub Workflows
Validate Runtime Smoke
Validate Surface Budget
Validate Surface Inventory
Scan Distribution Risk
Secret Scan
Validate Regression
Validate Workflow Fixtures
Validate Docs
Windows Node Smoke
PSScriptAnalyzer
Windows Bash Smoke
macOS Smoke
Dependency Review
CodeQL / Analyze JavaScript
```

The mutating `Plugin Install Smoke` workflow is not a default required check.
It is release or promotion evidence for disposable CI runners or isolated
test-user environments.

`Dependency Review` is fail-closed for same-repository pull requests when the
dependency graph preflight returns 403 or 404. Fork pull requests may emit a
warning skip when GitHub cannot expose dependency graph comparison data to the
workflow token; maintainers must confirm equivalent dependency review coverage
before merge instead of treating that warning as a passed security check.

## Maintainer Audit

Before a release:

1. Confirm `main` protection exists and references the current check names.
2. Confirm code scanning, secret scanning, Dependabot alerts, and dependency
   graph are enabled.
3. Confirm release validation uses `npm run validate:maintainer` and install
   smoke dry-run.
4. Confirm issue creation is enabled, blank issues are disabled, and the
   tracked issue forms remain public-safe.
5. Record any unavailable GitHub platform checks in the release evidence.

For a local read-only checklist printout:

```bash
node scripts/print-github-security-settings.mjs
```
