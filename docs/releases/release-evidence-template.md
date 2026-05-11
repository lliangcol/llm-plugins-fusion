# Release Evidence Template

Status: active
Date: 2026-05-11

Use this template before promoting a release tag or describing a branch as
stable. It records whether validation ran against an exact tag or against
unreleased `main`, and whether any local checks were skipped.

## Target Rules

- Promote exact release tags such as `v2.2.0`; do not promote moving `main` as stable.
- If `Exact tag` is `none`, the target is an unreleased development snapshot.
- If local validation reports skipped checks, name each skipped check and the replacement CI/Linux evidence.
- For minor releases, attach the manual five-command workflow evaluation record or explain why it is not applicable.
- Treat `node scripts/validate-plugin-install.mjs` as a separate CI or isolated
  test-user check because it may install or update user-scope Claude plugin
  state.

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
node scripts/validate-runtime-smoke.mjs:
node scripts/scan-distribution-risk.mjs:
node scripts/validate-regression.mjs:
node scripts/validate-plugin-install.mjs:
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

If Windows local validation reports skipped checks because Bash is unavailable,
do not describe hook shell syntax or runtime smoke as locally passed. Promotion
requires CI/Linux evidence that both hook `bash -n` checks and runtime smoke
passed.

## Release Notes Evidence

```text
CHANGELOG section:
Generated marketplace outputs current:
README badge/version current:
Catalog current:
Deferred v3/public portal wording checked:
```

## Workflow Evaluation Evidence

```text
Manual evaluation source:
Workflow evaluation record:
Commands evaluated:
Boundary control result:
Facts vs assumptions result:
Skipped validation reporting result:
Next-stage handoff result:
Not applicable reason:
```

## Decision

```text
Promote / do not promote:
Reason:
Known limitations:
Follow-up:
```
