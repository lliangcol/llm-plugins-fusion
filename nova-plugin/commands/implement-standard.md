---
id: implement-standard
stage: implement
title: /nova-plugin:implement-standard
description: "Execute confirmed implementation steps with controlled scope and validation."
destructive-actions: medium
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
invokes:
  skill: nova-implement-standard
---

# /nova-plugin:implement-standard

Invoke `nova-implement-standard` with `$ARGUMENTS`.

This is the controlled standard implementation entry. The skill is the source of truth for parameter resolution, execution rules, validation expectations, output format, and safety boundaries.

Entry semantics:

- Uses `EXECUTION_BASIS` from confirmed steps, context, or a plan excerpt.
- Allows minor corrective adjustments while preserving scope.
- `/nova-plugin:implement-lite` remains available for smaller tasks.
