# Release Capability Pack

## Purpose

Support CHANGELOG entries, version strategy, session reports, release notes, and delivery handoffs.

## When to Use

Use this pack for release readiness, version impact analysis, changelog maintenance, tag or hotfix planning, and final delivery summaries.

## Related Plugins

Optional enhancement: `session-report`. It is not a hard dependency of `nova-plugin`.

## Inputs

- Change summary and compatibility impact.
- Version source files and marketplace metadata.
- Validation results and known skips.
- Release workflow requirements.

## Agent Routing

- `publisher`: changelog, release notes, handoff, and compatibility wording.
- `verifier`: release validation commands and local/CI gate status.
- `orchestrator`: coordinate release tasks across implementation, docs, and verification.

## Workflow

1. Determine whether the change affects public contracts.
2. Update Unreleased notes unless an explicit version bump is requested.
3. Keep version files unchanged until a human selects the version.
4. Summarize validation and environment limits.

## Verification

- Run release-related validators selected by the repository.
- Confirm CHANGELOG has an Unreleased entry.
- Check version/date sync only when a release version is changed.
- Confirm no generated runtime artifacts are included.

## Enhanced Mode

When `session-report` is available, use it to assemble structured session reports and handoff summaries.

## Fallback Mode

Use the repository changelog, release workflow, validation results, and final summary to produce handoff notes.

## Failure Modes

- Version bump policy requires human decision.
- Release metadata and changelog dates can drift if only one source changes.
- CI-only checks may be unavailable locally.
- Hotfix scope may require explicit branch or tag policy.
