---
id: senior-explore
stage: explore
title: /senior-explore
description: "Run deep exploration for complex requirements or incidents, optionally writing an analysis artifact."
destructive-actions: low
allowed-tools: Read Glob Grep LS Write
invokes:
  skill: nova-senior-explore
---

# /senior-explore

Invoke `nova-senior-explore` with `$ARGUMENTS`.

This is the deep exploration entry for complex requirements, incidents, or cross-cutting codebase analysis. The skill is the source of truth for parameter resolution, execution rules, output format, artifact policy, and safety boundaries.

Entry semantics:

- Use `INTENT`, `CONTEXT`, `CONSTRAINTS`, and `DEPTH` to shape analysis.
- `EXPORT_PATH` is optional but must be explicit when writing an analysis artifact.
- Exploration remains analysis-only; it must not implement or redesign.
