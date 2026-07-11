---
id: codex-verify-only
stage: review
title: /nova-plugin:codex-verify-only
description: "Run Codex verification against an existing review artifact and optional checks output."
destructive-actions: low
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: true
invokes:
  skill: nova-codex-verify-only
---

# /nova-plugin:codex-verify-only

Invoke `nova-codex-verify-only` with `$ARGUMENTS`.

This is the Codex verify-only slash entry. The skill is the source of truth for parameter resolution, script invocation, artifact policy, output format, and safety boundaries.

Entry semantics:

- Requires explicit `REVIEW_FILE` before verification.
- Accepts optional `CHECKS_FILE`, `BASE`, `OUTPUT_DIR`, and explicit `INCLUDE_UNTRACKED_CONTENT=true` when untracked file content should be included after guards.
- Must not perform new implementation work.
- Declares low artifact risk because it runs Bash and writes `.codex` verification artifacts.
