---
id: backend-plan
stage: plan
title: /backend-plan
description: "Generate a Java/Spring backend design plan and write it to an explicit PLAN_OUTPUT_PATH."
destructive-actions: low
allowed-tools: Read Glob Grep LS Write Edit
invokes:
  skill: nova-backend-plan
---

# /backend-plan

Invoke `nova-backend-plan` with `$ARGUMENTS`.

This is the Java/Spring backend planning shortcut. The skill is the source of truth for parameter resolution, execution rules, output format, artifact policy, and safety boundaries.

Entry semantics:

- Equivalent in intent to `/produce-plan PLAN_PROFILE=java-backend`.
- Requires explicit `PLAN_OUTPUT_PATH` before writing.
- Keeps the legacy backend-focused slash entry available.
