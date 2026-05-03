---
id: implement-plan
stage: implement
title: /implement-plan
description: "Implement strictly from an approved plan; requires PLAN_INPUT_PATH and PLAN_APPROVED=true."
destructive-actions: medium
allowed-tools: Read Glob Grep LS Write Edit MultiEdit Bash
invokes:
  skill: nova-implement-plan
---

# /implement-plan

Invoke `nova-implement-plan` with `$ARGUMENTS`.

This is the approved-plan implementation entry. The skill is the source of truth for parameter resolution, execution rules, validation expectations, output format, and safety boundaries.

Entry semantics:

- Requires explicit `PLAN_INPUT_PATH`.
- Requires `PLAN_APPROVED=true` before project edits.
- The approved plan is the execution authority; non-trivial deviations must stop for plan revision.
