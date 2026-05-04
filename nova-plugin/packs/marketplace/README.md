# Marketplace Capability Pack

## Purpose

Support plugin metadata, marketplace schemas, registry entries, and repository-local marketplace metadata.

## When to Use

Use this pack for `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, `plugin.json`, schema changes, registry documentation, and Claude compatibility checks.

## Related Plugins

Enhanced capability comes from nova repository scripts and schemas. No external plugin is required by `nova-plugin`.

## Inputs

- Marketplace and plugin metadata files.
- Schema files and compatibility constraints.
- Version and last-updated source-of-truth requirements.
- Claude CLI validation output, if available.

## Agent Routing

- `architect`: metadata contract and compatibility decisions.
- `builder`: schema or metadata edits.
- `reviewer`: compatibility and public contract review.
- `verifier`: schema and Claude compatibility validators.
- `publisher`: documentation and changelog updates.

## Workflow

1. Identify the metadata source of truth.
2. Validate official marketplace compatibility separately from repository-local metadata.
3. Keep version fields synchronized only when a version bump is explicitly selected.
4. Document compatibility risks and validation results.

## Verification

- Run `node scripts/validate-schemas.mjs`.
- Run `node scripts/validate-claude-compat.mjs`.
- Run docs validation when user-facing metadata docs change.
- Confirm marketplace-only custom fields stay in repository-local metadata.

## Enhanced Mode

Use nova's own scripts and schemas for stronger validation of plugin manifests, marketplace metadata, and Claude compatibility.

## Fallback Mode

Use schema validators, documented metadata rules, and manual review of JSON source files.

## Failure Modes

- Claude CLI may be unavailable locally.
- Official marketplace fields and repository-local metadata can be confused.
- Version fields can drift across files.
- Schema relaxations can accidentally allow invalid public metadata.
