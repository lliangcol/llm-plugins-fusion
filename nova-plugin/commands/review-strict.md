---
id: review-strict
stage: review
title: /nova-plugin:review-strict
description: "Run exhaustive production-critical review without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-review-strict
---

# /nova-plugin:review-strict

Invoke `nova-review-strict` with `$ARGUMENTS`.

This is a compatibility shortcut for strict production-critical review. The skill is the source of truth for parameter resolution, execution rules, output format, agent-routing policy, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/nova-plugin:review LEVEL=strict`.
- May use strict review lanes when the invoking environment supports them.
- Read-only; no fixes or code edits.
