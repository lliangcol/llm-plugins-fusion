# Shared Artifact Policy

Use this policy for analysis, plan, review, verification, and handoff artifacts.

## Artifact Classes

| Class | Typical location | Notes |
| --- | --- | --- |
| Analysis | User-provided path or docs/analysis | Written only when explicitly requested or when the skill documents an export path. |
| Plan | User-provided `PLAN_OUTPUT_PATH` | Must be explicit or confirmed before writing. |
| Review | `.codex/codex-review-fix/...` or user-provided path | Runtime review artifacts are not release source files. |
| Verify | `.codex/codex-review-fix/...` or user-provided path | May reference checks output. |
| Handoff | Chat output unless a path is explicit | Should summarize state and validation. |

## Write Rules

- Do not silently choose safety-boundary output paths.
- Create parent directories only for the explicit target artifact.
- Overwrite only when the skill explicitly allows overwrite or the user confirms.
- Keep generated artifacts deterministic enough for review.
- Do not write artifacts outside the repository unless the user provides the
  absolute path.

## Runtime Artifacts

`.codex/` contains runtime artifacts. Do not commit, release, or treat these
files as source-of-truth repository files. Skills may read or write `.codex/`
only for Codex review/fix/verify runtime flow.

## Artifact Metadata

Formal documents should include useful frontmatter when the target document
format already uses it or the workflow asks for registry metadata:

```yaml
---
title: "..."
status: "draft"
project: "..."
artifact_type: "..."
source_repo: "..."
created: "..."
updated: "..."
---
```

Do not invent metadata values that cannot be inferred from the request or local
context.

## Latest Artifact Selection

When a skill can consume a latest artifact:

- Use an explicitly provided file first.
- If exactly one obvious latest artifact exists, ask for confirmation unless
  the skill documents that latest is safe.
- In non-interactive mode, do not guess latest artifacts for safety-boundary
  parameters.
