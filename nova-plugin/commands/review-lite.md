---
id: review-lite
stage: review
title: /nova-plugin:review-lite
description: "Run a lightweight review focused on high-signal issues without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-review-lite
---

# /nova-plugin:review-lite

Invoke `nova-review-lite` with `$ARGUMENTS`.

This is a compatibility shortcut for lightweight review. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/nova-plugin:review LEVEL=lite`.
- Focuses on high-signal issues only.
- Read-only; no fixes or code edits.
