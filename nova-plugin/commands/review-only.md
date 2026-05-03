---
id: review-only
stage: review
title: /review-only
description: "Run a standard-depth review for correctness, failure modes, tests, and maintainability without fixes."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-review-only
---

# /review-only

Invoke `nova-review-only` with `$ARGUMENTS`.

This is a compatibility shortcut for standard-depth review. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/review LEVEL=standard`.
- Reviews correctness, failure modes, tests, and maintainability.
- Read-only; no fixes or code edits.
