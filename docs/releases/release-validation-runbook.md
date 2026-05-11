# Release Validation Runbook

Status: active
Date: 2026-05-12

Use this runbook when a release-ready `nova-plugin` snapshot needs to become
promotable release evidence. It turns the release hygiene rules and evidence
templates into an operator sequence.

This document is procedural. Record the final evidence in
[release-evidence-template.md](release-evidence-template.md) and attach the
manual workflow result from
[../examples/workflow-evaluation-record-template.md](../examples/workflow-evaluation-record-template.md).

## Decision Model

A snapshot is promotable only when all required evidence exists.

| Gate | Automated or manual | Required evidence |
| --- | --- | --- |
| Repository structure and docs | Automated | `node scripts/validate-all.mjs` passes with skipped checks explained. |
| Generated marketplace outputs | Automated | `node scripts/generate-registry.mjs` reports no drift, or `--write` was run before validation. |
| Formatting | Automated | `git diff --check` passes. |
| Distribution risk | Automated | `node scripts/scan-distribution-risk.mjs` passes with no active findings. |
| Exact release target | Manual | `git describe --tags --exact-match HEAD` returns `v<plugin-version>`. |
| Plugin install path | Manual / CI | `node scripts/validate-plugin-install.mjs` passes in CI or an isolated test-user environment. |
| Workflow output quality | Manual | Five primary commands are evaluated and recorded, or an explicit not-applicable reason is accepted. |
| Release publication | Manual / CI | GitHub release workflow completes for the pushed `v<plugin-version>` tag. |

If any required manual gate is missing, describe the target as an unreleased
development snapshot, not a stable release.

## Preflight

Run these checks before any tag or release operation:

```bash
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
git status --short
"$NODE_BIN" scripts/generate-registry.mjs </dev/null
"$NODE_BIN" scripts/validate-all.mjs </dev/null
git diff --check
```

Expected conditions:

- `git status --short` is empty, or every change is intentionally part of the
  release commit.
- `node scripts/generate-registry.mjs` reports current generated outputs.
- `node scripts/validate-all.mjs` reports `failed=0`.
- If `skipped` is non-zero, each skipped check has replacement CI/Linux
  evidence before promotion.
- `git diff --check` reports no whitespace errors.

For a release branch or final candidate, also run the focused checks directly
so their outputs can be pasted into release evidence:

```bash
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
"$NODE_BIN" scripts/validate-runtime-smoke.mjs </dev/null
"$NODE_BIN" scripts/scan-distribution-risk.mjs </dev/null
"$NODE_BIN" scripts/validate-regression.mjs </dev/null
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

On Windows without Bash, record Bash-dependent checks as skipped locally and
use CI/Linux evidence before promotion.

## Version And Generated Output Check

Confirm that the maintainer-visible version fields agree:

```bash
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
"$NODE_BIN" -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('nova-plugin/.claude-plugin/plugin.json','utf8')); const m=JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json','utf8')); const meta=JSON.parse(fs.readFileSync('.claude-plugin/marketplace.metadata.json','utf8')); console.log({plugin:p.version, marketplace:m.plugins[0].version, metadata:meta.plugins[0].version, lastUpdated:meta.plugins[0]['last-updated']});" </dev/null
```

Required result:

- `plugin`, `marketplace`, and `metadata` versions are identical.
- `lastUpdated` matches the release date recorded in `CHANGELOG.md`.
- `docs/marketplace/catalog.md` was generated from registry source, not hand
  edited.

## Exact Tag Operation

Do not create, overwrite, delete, or push public tags without explicit
maintainer approval.

Before creating a release tag, verify that no exact tag already points at the
current commit:

```bash
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
PLUGIN_VERSION="$("$NODE_BIN" -p 'require("./nova-plugin/.claude-plugin/plugin.json").version' </dev/null)"
PLUGIN_VERSION="${PLUGIN_VERSION%$'\r'}"
git describe --tags --exact-match HEAD
git tag --list "v${PLUGIN_VERSION}"
```

If the exact tag is missing and the maintainer approves release publication,
create the repository release tag:

```bash
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
PLUGIN_VERSION="$("$NODE_BIN" -p 'require("./nova-plugin/.claude-plugin/plugin.json").version' </dev/null)"
PLUGIN_VERSION="${PLUGIN_VERSION%$'\r'}"
git tag -a "v${PLUGIN_VERSION}" -m "nova-plugin v${PLUGIN_VERSION}"
git describe --tags --exact-match HEAD
```

Push only after the local tag, changelog, generated marketplace outputs, and
validation evidence are correct:

```bash
git push origin "v${PLUGIN_VERSION}"
```

The release workflow listens for `v*.*.*` tags. Do not use `claude plugin tag`
for this repository release unless the release policy changes, because that CLI
creates plugin-scoped tags that do not match the current GitHub release trigger.

After pushing, record:

- Tag name.
- Commit SHA.
- GitHub Actions release workflow URL or run id.
- Whether the workflow reached the release creation step.
- The published GitHub Release URL when available.

## Isolated Plugin Install Smoke

`node scripts/validate-plugin-install.mjs` mutates Claude Code user-scope plugin
state. Run it only in CI or in an isolated test-user environment, not in an
operator's everyday Claude profile.

Recommended setup:

1. Use GitHub Actions, a disposable OS user, a VM, or a container-like test
   environment with a separate Claude Code configuration directory.
2. Install or verify Claude CLI availability.
3. Check out the exact release tag, not moving `main`.
4. Run the script from the repository root.

```bash
claude --version
git describe --tags --exact-match HEAD
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
"$NODE_BIN" scripts/validate-plugin-install.mjs </dev/null
```

Expected script behavior:

- Runs `claude plugin validate .`.
- Runs `claude plugin validate nova-plugin`.
- Adds the local marketplace source.
- Installs `nova-plugin@llm-plugins-fusion` with `--scope user`.
- Updates the installed plugin.
- Reads `claude plugin list --json`.
- Confirms the installed user-scope version equals
  `nova-plugin/.claude-plugin/plugin.json`.

Record the final success line and the installed version in release evidence.

Optional cleanup in the isolated environment:

```bash
claude plugin uninstall nova-plugin@llm-plugins-fusion --scope user
claude plugin marketplace remove llm-plugins-fusion
```

If cleanup fails in an isolated environment, record it as an environment cleanup
issue, not as release validation failure, unless it affects installation or
update correctness.

## Manual Workflow Evaluation

Use this gate for minor releases, onboarding changes, command/skill behavior
changes, consumer profile changes, or release guidance changes.

Scenario source:

- [../examples/workflow-evaluation.md](../examples/workflow-evaluation.md)
- [../../fixtures/workflow/invoice-sync/README.md](../../fixtures/workflow/invoice-sync/README.md)

Record template:

- [../examples/workflow-evaluation-record-template.md](../examples/workflow-evaluation-record-template.md)

Safety rules:

- Run implementation steps only in a disposable fixture copy or throwaway
  branch.
- Do not run `/implement-plan` against a production consumer workspace.
- Do not paste private consumer names, paths, endpoints, credentials, runtime
  flags, repository addresses, or business rules into the record.
- Keep generated outputs under a disposable output directory or remove them
  after recording evidence.

Suggested command sequence:

```text
/explore INPUT=fixtures/workflow/invoice-sync/inputs/product-note.md
/produce-plan PLAN_OUTPUT_PATH=fixtures/workflow/invoice-sync/out/plan.md PLAN_INTENT="Plan idempotent invoice sync with no schema migration" ANALYSIS_INPUTS=fixtures/workflow/invoice-sync/inputs/planning-brief.md
/review LEVEL=standard INPUT=fixtures/workflow/invoice-sync/inputs/review-diff.patch
/implement-plan PLAN_INPUT_PATH=fixtures/workflow/invoice-sync/plans/approved-implementation-plan.md PLAN_APPROVED=true
/finalize-work Summarize the completed fixture run, validation, skipped checks, risks, and follow-ups.
```

Evaluate each command against the rubric:

- Boundary control: read-only commands stay read-only; implementation stays
  scoped to the approved plan.
- Evidence quality: facts, assumptions, unknowns, risks, and validation status
  are distinguishable.
- User value: each output helps the next workflow stage proceed.
- Safety: no private details are introduced, and skipped checks are reported
  honestly.

The workflow evaluation proves output usefulness, not exact wording. Do not
turn the record into a golden-output snapshot test.

## Release Evidence Assembly

Create or update a release evidence record from
[release-evidence-template.md](release-evidence-template.md). The record must
include:

- Release target, commit, exact tag, plugin version, registry `last-updated`,
  operator, and date.
- Environment summary from `node scripts/validate-all.mjs`.
- Outputs or summaries for all required checks.
- Skipped checks and replacement evidence.
- Plugin install smoke result from CI or isolated test-user execution.
- Manual workflow evaluation record path or an accepted not-applicable reason.
- Promotion decision and known limitations.

If the target has no exact tag, set `Promote / do not promote` to
`do not promote` and state that it is an unreleased development snapshot.

## Promotion Decision

Use this final decision table:

| Condition | Decision |
| --- | --- |
| Any required validation failed | Do not promote. |
| Exact tag is missing | Do not promote as stable; describe as development snapshot. |
| Plugin install smoke is missing | Do not promote; record pending isolated/CI evidence. |
| Manual workflow evidence is missing for a release that changes workflow behavior or onboarding | Do not promote until recorded, or document an accepted not-applicable reason. |
| All required gates passed | Promote the exact tag and publish release notes. |

Never fill missing evidence with assumptions. Record `not run`, `skipped`, or
`pending` with a concrete reason.

## Current Snapshot Verification Pattern

For an unattended verification pass that must not mutate user-scope plugin
state, run:

```bash
NODE_BIN="${NODE_BIN:-node}"
command -v "$NODE_BIN" >/dev/null 2>&1 || NODE_BIN=node.exe
PLUGIN_VERSION="$("$NODE_BIN" -p 'require("./nova-plugin/.claude-plugin/plugin.json").version' </dev/null)"
PLUGIN_VERSION="${PLUGIN_VERSION%$'\r'}"
"$NODE_BIN" scripts/validate-all.mjs </dev/null
git diff --check
"$NODE_BIN" scripts/generate-registry.mjs </dev/null
"$NODE_BIN" scripts/scaffold-consumer-profile.mjs --type java-backend --out ../consumer-smoke </dev/null
git describe --tags --exact-match HEAD || true
git tag --list "v${PLUGIN_VERSION}"
git ls-remote --tags origin "refs/tags/v${PLUGIN_VERSION}" "refs/tags/v${PLUGIN_VERSION}^{}"
"$NODE_BIN" scripts/scan-distribution-risk.mjs </dev/null
```

Interpretation:

- Passing validation and scan results support repository readiness.
- `git describe` failure or missing remote tag means the target is not stable
  release evidence.
- The scaffold command is dry-run by default and should not create consumer
  files unless `--write` is explicitly used in a consumer-owned workspace.
- Install smoke remains pending unless it ran in CI or an isolated test-user
  environment.
