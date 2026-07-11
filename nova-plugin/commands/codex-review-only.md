---
id: codex-review-only
stage: review
title: /nova-plugin:codex-review-only
description: "Run Codex review only and write a structured review artifact without modifying code."
destructive-actions: low
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: true
invokes:
  skill: nova-codex-review-only
---

# /nova-plugin:codex-review-only

Invoke `nova-codex-review-only` with `$ARGUMENTS`.

This is the Codex review-only slash entry. The skill is the source of truth for parameter resolution, script invocation, artifact policy, output format, and safety boundaries.

Entry semantics:

- Runs the review script only and writes review artifacts.
- Supports `REVIEW_MODE=branch|staged|full`, optional `BASE`, and optional `OUTPUT_DIR`.
- Must not modify project code or enter the fix loop.
- Declares low artifact risk because it runs Bash and writes `.codex` review artifacts.
