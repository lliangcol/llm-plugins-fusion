---
id: codex-verify-only
stage: review
title: /codex-verify-only
description: "Run Codex verification against an existing review artifact and optional checks output."
destructive-actions: none
allowed-tools: Bash Read Glob Grep LS
invokes:
  skill: nova-codex-verify-only
---

# /codex-verify-only

Invoke `nova-codex-verify-only` with `$ARGUMENTS`.

This is the Codex verify-only slash entry. The skill is the source of truth for parameter resolution, script invocation, artifact policy, output format, and safety boundaries.

Entry semantics:

- Requires explicit `REVIEW_FILE` before verification.
- Accepts optional `CHECKS_FILE`, `BASE`, and `OUTPUT_DIR` when supported by the verify script.
- Must not perform new implementation work.
