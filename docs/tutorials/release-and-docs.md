<!-- migrated-from: docs/showcase/release-and-docs.md -->
# Release And Docs Showcase

Status: active
Date: 2026-06-02

## Problem

Release and documentation work is easy to treat as copy editing, but public
repositories need stronger evidence: version wording, changelog accuracy, link
health, generated-file boundaries, security language, skipped checks, and
manual promotion tasks must stay consistent.

## Recommended nova workflow

```text
/nova-plugin:route -> /nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

- Use `/nova-plugin:route` to classify the task as docs, release, growth, verification, or
  mixed repository work.
- Use `/nova-plugin:explore` to inspect current version facts, generated files, docs
  indexes, and validation gates.
- Use `/nova-plugin:produce-plan` for multi-file public docs changes.
- Use `/nova-plugin:review` to catch stale release language, broken links, private context
  leaks, and over-claimed validation.
- Use `/nova-plugin:implement-plan` for scoped edits.
- Use `/nova-plugin:finalize-work` to capture validation output, skipped checks, manual
  GitHub UI actions, and residual risk.

## Example command

```text
/nova-plugin:route I need to update README, getting-started docs, showcase pages, changelog wording, and growth metrics guidance without changing generated marketplace outputs. Recommend the next nova workflow step and validation.
```

If `/nova-plugin:route` recommends review before promotion:

```text
/nova-plugin:review LEVEL=standard Review the docs and release wording for stale version claims, broken local links, private context leaks, generated-file edits, and validation over-claims.
```

## Expected output evidence

- Version facts tied to `nova-plugin/.claude-plugin/plugin.json`, release tags,
  `CHANGELOG.md`, and generated marketplace source boundaries.
- Link and anchor health from `node scripts/validate-docs.mjs`.
- `git diff --check` evidence for whitespace hygiene.
- Explicit distinction between local repo deliverables and manual GitHub UI or
  external promotion tasks.
- Final handoff with changed files, validation results, skipped checks, and
  residual risk.

## Validation

For this repository, use:

```bash
node scripts/validate-docs.mjs
node scripts/validate-all.mjs
.\scripts\verify-agents.ps1
git diff --check
```

If Windows cannot run Bash-dependent checks in `validate-all`, report those
checks as skipped instead of passed.

## Private context boundary

Public release and docs work must not include private consumer names, local
machine paths, endpoints, credentials, repository addresses, runtime flags,
business rules, private knowledge-base content, unpublished screenshots, or
non-public metrics. GitHub Topics, Discussions, social preview upload, issue
creation, and external social posting are manual UI/account actions unless
explicitly performed by a maintainer.
