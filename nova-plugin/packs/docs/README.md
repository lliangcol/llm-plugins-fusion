# Docs Capability Pack

## Purpose

Support README, CLAUDE.md, AGENTS.md, command docs, technical documentation structure, and documentation validation.

## When to Use

Use this pack for docs reorganization, current-fact updates, link maintenance, contributor guidance, and documentation handoff artifacts.

## Related Plugins

Optional enhancements: `claude-md-management`, `document-skills`. They are not hard dependencies of `nova-plugin`.

## Inputs

- Target audience and affected docs.
- Current source-of-truth files.
- Links, anchors, version references, and generated artifacts.
- Required documentation validators.

## Agent Routing

- `publisher`: documentation changes and changelog notes.
- `reviewer`: clarity, correctness, and stale-fact review.
- `verifier`: Markdown links, anchors, and docs validators.
- `orchestrator`: multi-doc routing when ownership is unclear.

## Workflow

1. Identify source-of-truth files and derived docs.
2. Update only current-fact sections unless historical context is requested.
3. Keep AGENTS.md and CLAUDE.md synchronized.
4. Run docs validation and fix broken links or stale anchors.

## Verification

- Run `node scripts/validate-docs.mjs`.
- Search active docs for stale current-fact wording.
- Confirm local links and anchors resolve.
- Note historical archive references separately.

## Enhanced Mode

When `claude-md-management` or `document-skills` is available, use it for structured guidance, document review, and documentation consistency checks.

## Fallback Mode

Use Markdown link validation, structural review, local source-of-truth files, and repository docs validators.

## Failure Modes

- Historical docs intentionally preserve old facts.
- Link anchors differ by renderer.
- Version or date fields are controlled by marketplace metadata.
- Dirty docs may contain unrelated user edits that must be preserved.
