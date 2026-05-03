---
id: review-strict
stage: review
title: /review-strict
description: "Run exhaustive production-critical review without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-review-strict
---

# /review-strict

Invoke `nova-review-strict` with `$ARGUMENTS`.

This is a compatibility shortcut for strict production-critical review. The skill is the source of truth for parameter resolution, execution rules, output format, agent-routing policy, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/review LEVEL=strict`.
- May use strict review lanes when the invoking environment supports them.
- Read-only; no fixes or code edits.
