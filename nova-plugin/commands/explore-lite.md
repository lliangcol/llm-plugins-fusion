---
id: explore-lite
stage: explore
title: /explore-lite
description: "Quick observer-style exploration for fast understanding alignment without design or implementation."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-explore-lite
---

# /explore-lite

Invoke `nova-explore-lite` with `$ARGUMENTS`.

This is a compatibility shortcut for lightweight observer-style exploration. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/explore PERSPECTIVE=observer` for quick understanding alignment.
- Keeps the legacy slash entry available.
- Read-only; no design or implementation work.
