---
id: review-lite
stage: review
title: /review-lite
description: "Run a lightweight review focused on high-signal issues without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-review-lite
---

# /review-lite

Invoke `nova-review-lite` with `$ARGUMENTS`.

This is a compatibility shortcut for lightweight review. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/review LEVEL=lite`.
- Focuses on high-signal issues only.
- Read-only; no fixes or code edits.
