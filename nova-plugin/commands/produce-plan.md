---
id: produce-plan
stage: plan
title: /nova-plugin:produce-plan
description: "Write a formal review-ready plan document to an explicit PLAN_OUTPUT_PATH."
destructive-actions: low
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
invokes:
  skill: nova-produce-plan
---

# /nova-plugin:produce-plan

Invoke `nova-produce-plan` with `$ARGUMENTS`.

This is the formal plan artifact entry. The skill is the source of truth for parameter resolution, execution rules, output format, artifact policy, and safety boundaries.

Entry semantics:

- Requires explicit `PLAN_OUTPUT_PATH` before writing.
- Uses `PLAN_PROFILE=general` by default; `PLAN_PROFILE=java-backend` selects the backend profile.
- `/nova-plugin:backend-plan` remains the Java/Spring compatibility shortcut.
