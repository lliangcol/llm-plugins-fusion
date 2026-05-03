---
id: explore
stage: explore
title: /explore
description: "Unified exploration entry that routes observer or reviewer perspectives without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-explore
---

# /explore

Invoke `nova-explore` with `$ARGUMENTS`.

This is the unified exploration slash entry. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Use `PERSPECTIVE=observer|reviewer` to route the exploration style.
- Use `DEPTH=normal|deep` when depth needs to be explicit.
- Compatibility entries remain available: `/explore-lite`, `/explore-review`, and `/senior-explore`.
- Exploration is read-only and must not design or implement fixes.
