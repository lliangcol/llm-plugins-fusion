---
id: route
stage: explore
title: /nova-plugin:route
description: "Recommend the next nova command, skill, core agent, and capability packs for a request."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-route
---

# /nova-plugin:route

Invoke `nova-route` with `$ARGUMENTS` before answering. Do not return a wrapper
summary or stop after acknowledging the delegation.

The final response must start with exactly `## Recommended Route`, followed by
these seven Markdown bullet labels in this order: `Command:`, `Skill:`,
`Core agent:`, `Capability packs:`, `Required inputs:`,
`Validation expectations:`, and `Fallback path:`. Do not add a preface, use an
alternate heading level, rename fields, or replace the fixed fields with a
table. The `nova-route` skill remains the source of truth for every field value.

This is the read-only first-stage routing entry. The skill is the source of truth for selecting the next nova command, one-to-one skill, core agent, capability packs, required inputs, validation expectations, and fallback path.

Entry semantics:

- Use when the next workflow step is unclear or the user is not using slash commands directly.
- Classify intent before routing: explore, plan, review, implement, finalize, or Codex loop.
- Return a route recommendation, not an implementation plan or project changes.
- Prefer existing nova commands and skills over inventing new workflow steps.
- Prefer one next command; return a short sequence only when the request spans multiple workflow stages.
- Routing is read-only and must not write artifacts, edit code, or run destructive commands.
