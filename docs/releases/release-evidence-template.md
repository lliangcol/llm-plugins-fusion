# Release Evidence Template

Status: active
Date: 2026-05-10

Use this template before promoting a release tag or describing a branch as
stable. It records whether validation ran against an exact tag or against
unreleased `main`, and whether any local checks were skipped.

## Release Target

```text
Release or promotion target:
Commit:
Exact tag:
Plugin version:
Registry last-updated:
Operator:
Date:
```

## Environment

```text
Node.js:
Git:
Claude CLI:
Codex CLI:
Bash:
Operating system:
```

## Validation Results

```text
node scripts/generate-registry.mjs --write:
node scripts/validate-all.mjs:
git diff --check:
bash -n nova-plugin/hooks/scripts/pre-write-check.sh:
bash -n nova-plugin/hooks/scripts/post-audit-log.sh:
```

## Skipped Checks

```text
Skipped count:
Skipped checks:
Reason:
CI/Linux replacement evidence:
```

If Windows local validation reports `skipped=1` because Bash is unavailable,
do not describe hook shell syntax as locally passed. Promotion requires CI/Linux
evidence that both hook `bash -n` checks passed.

## Release Notes Evidence

```text
CHANGELOG section:
Generated marketplace outputs current:
README badge/version current:
Catalog current:
Deferred v3/public portal wording checked:
```

## Decision

```text
Promote / do not promote:
Reason:
Known limitations:
Follow-up:
```
