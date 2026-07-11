---
id: plan-lite
stage: plan
title: /nova-plugin:plan-lite
description: "Create a lightweight execution plan without writing code or formal artifacts."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-plan-lite
---

# /nova-plugin:plan-lite

Invoke `nova-plan-lite` with `$ARGUMENTS`.

This is the lightweight planning slash entry. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Produces quick execution alignment from `INPUT` and optional `CONSTRAINTS`.
- Does not write formal artifacts or project code.
