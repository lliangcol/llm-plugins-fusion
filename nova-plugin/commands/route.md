---
id: route
stage: explore
title: /route
description: "Recommend the next nova command, skill, core agent, and capability packs for a request."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-route
---

# /route

Invoke `nova-route` with `$ARGUMENTS`.

This is the read-only first-stage routing entry. The skill is the source of truth for selecting the next nova command, one-to-one skill, core agent, capability packs, required inputs, validation expectations, and fallback path.

Entry semantics:

- Use when the next workflow step is unclear or the user is not using slash commands directly.
- Classify intent before routing: explore, plan, review, implement, finalize, or Codex loop.
- Return a route recommendation, not an implementation plan or project changes.
- Prefer existing nova commands and skills over inventing new workflow steps.
- Prefer one next command; return a short sequence only when the request spans multiple workflow stages.
- Routing is read-only and must not write artifacts, edit code, or run destructive commands.
