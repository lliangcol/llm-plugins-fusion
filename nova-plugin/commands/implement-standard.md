---
id: implement-standard
stage: implement
title: /implement-standard
description: "Execute confirmed implementation steps with controlled scope and validation."
destructive-actions: medium
allowed-tools: Read Glob Grep LS Write Edit MultiEdit Bash
invokes:
  skill: nova-implement-standard
---

# /implement-standard

Invoke `nova-implement-standard` with `$ARGUMENTS`.

This is the controlled standard implementation entry. The skill is the source of truth for parameter resolution, execution rules, validation expectations, output format, and safety boundaries.

Entry semantics:

- Uses `EXECUTION_BASIS` from confirmed steps, context, or a plan excerpt.
- Allows minor corrective adjustments while preserving scope.
- `/implement-lite` remains available for smaller tasks.
