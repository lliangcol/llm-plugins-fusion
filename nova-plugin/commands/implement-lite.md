---
id: implement-lite
stage: implement
title: /nova-plugin:implement-lite
description: "Make small, bounded implementation changes quickly while respecting existing project conventions."
destructive-actions: medium
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
invokes:
  skill: nova-implement-lite
---

# /nova-plugin:implement-lite

Invoke `nova-implement-lite` with `$ARGUMENTS`.

This is the small-task implementation entry. The skill is the source of truth for parameter resolution, execution rules, validation expectations, output format, and safety boundaries.

Entry semantics:

- Uses `TASK` plus optional `CONSTRAINTS`.
- Allows bounded code edits and checks.
- Avoids unrelated refactors and scope expansion.
