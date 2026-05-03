---
id: produce-plan
stage: plan
title: /produce-plan
description: "Write a formal review-ready plan document to an explicit PLAN_OUTPUT_PATH."
destructive-actions: low
allowed-tools: Read Glob Grep LS Write Edit
invokes:
  skill: nova-produce-plan
---

# /produce-plan

Invoke `nova-produce-plan` with `$ARGUMENTS`.

This is the formal plan artifact entry. The skill is the source of truth for parameter resolution, execution rules, output format, artifact policy, and safety boundaries.

Entry semantics:

- Requires explicit `PLAN_OUTPUT_PATH` before writing.
- Uses `PLAN_PROFILE=general` by default; `PLAN_PROFILE=java-backend` selects the backend profile.
- `/backend-plan` remains the Java/Spring compatibility shortcut.
