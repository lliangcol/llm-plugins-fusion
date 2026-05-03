---
id: finalize-lite
stage: finalize
title: /finalize-lite
description: "Produce a minimal close-out summary of completed work, rationale, and limitations."
destructive-actions: none
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-finalize-lite
---

# /finalize-lite

Invoke `nova-finalize-lite` with `$ARGUMENTS`.

This is the compact finalization entry. The skill is the source of truth for parameter resolution, output format, and safety boundaries.

Entry semantics:

- Summarizes completed work, rationale, and limitations.
- Does not run release, Git, or deployment actions.
- `/finalize-work` remains available for full handoff packaging.
