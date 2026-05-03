---
id: codex-review-only
stage: review
title: /codex-review-only
description: "Run Codex review only and write a structured review artifact without modifying code."
destructive-actions: none
allowed-tools: Bash Read Glob Grep LS
invokes:
  skill: nova-codex-review-only
---

# /codex-review-only

Invoke `nova-codex-review-only` with `$ARGUMENTS`.

This is the Codex review-only slash entry. The skill is the source of truth for parameter resolution, script invocation, artifact policy, output format, and safety boundaries.

Entry semantics:

- Runs the review script only and writes review artifacts.
- Supports `REVIEW_MODE=branch|staged|full`, optional `BASE`, and optional `OUTPUT_DIR`.
- Must not modify project code or enter the fix loop.
