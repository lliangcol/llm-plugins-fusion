---
id: explore-review
stage: explore
title: /nova-plugin:explore-review
description: "Review-oriented exploration that surfaces questions and risks without proposing fixes."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-explore-review
---

# /nova-plugin:explore-review

Invoke `nova-explore-review` with `$ARGUMENTS`.

This is a compatibility shortcut for reviewer-style exploration. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/nova-plugin:explore PERSPECTIVE=reviewer`.
- Surfaces questions, risks, and uncertainty without proposing fixes.
- Read-only; no project modifications.
