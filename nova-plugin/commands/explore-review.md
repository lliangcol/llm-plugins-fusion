---
id: explore-review
stage: explore
title: /explore-review
description: "Review-oriented exploration that surfaces questions and risks without proposing fixes."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-explore-review
---

# /explore-review

Invoke `nova-explore-review` with `$ARGUMENTS`.

This is a compatibility shortcut for reviewer-style exploration. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/explore PERSPECTIVE=reviewer`.
- Surfaces questions, risks, and uncertainty without proposing fixes.
- Read-only; no project modifications.
