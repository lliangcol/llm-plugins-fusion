---
id: review
stage: review
title: /review
description: "Unified review entry that routes by LEVEL for lite, standard, or strict review without fixes."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-review
---

# /review

Invoke `nova-review` with `$ARGUMENTS`.

This is the unified review slash entry. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Use `LEVEL=lite|standard|strict` to select review depth.
- Compatibility entries remain available: `/review-lite`, `/review-only`, and `/review-strict`.
- Review is read-only and must not implement fixes.
