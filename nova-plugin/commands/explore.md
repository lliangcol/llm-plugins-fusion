---
id: explore
stage: explore
title: /nova-plugin:explore
description: "Unified exploration entry that routes observer or reviewer perspectives without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
invokes:
  skill: nova-explore
---

# /nova-plugin:explore

Invoke `nova-explore` with `$ARGUMENTS`.

This is the unified exploration slash entry. The skill is the source of truth for parameter resolution, execution rules, output format, and safety boundaries.

Entry semantics:

- Use `PERSPECTIVE=observer|reviewer` to route the exploration style.
- Use `DEPTH=normal|deep` when depth needs to be explicit.
- Compatibility entries remain available: `/nova-plugin:explore-lite`, `/nova-plugin:explore-review`, and `/nova-plugin:senior-explore`.
- Exploration is read-only and must not design or implement fixes.
