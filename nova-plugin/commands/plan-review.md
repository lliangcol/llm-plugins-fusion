---
id: plan-review
stage: plan
title: /nova-plugin:plan-review
description: "Critically review an existing plan for decision clarity, assumptions, and execution risk."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-plan-review
---

# /nova-plugin:plan-review

Invoke `nova-plan-review` with `$ARGUMENTS`.

This is the read-only plan review entry. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Reviews an existing plan for clarity, assumptions, risks, and missing decisions.
- Does not rewrite the plan or implement changes.
