---
id: finalize-work
stage: finalize
title: /finalize-work
description: "Finalize completed work with handoff, validation, and commit or PR-ready summary text."
destructive-actions: none
allowed-tools: Read Glob Grep LS Bash
invokes:
  skill: nova-finalize-work
---

# /finalize-work

Invoke `nova-finalize-work` with `$ARGUMENTS`.

This is the full finalization and handoff entry. The skill is the source of truth for parameter resolution, Git/environment probing, output format, and safety boundaries.

Entry semantics:

- Produces validation-aware handoff, commit text, and PR/MR-ready summary content when applicable.
- May inspect Git state, but must not commit, push, merge, rebase, or delete branches unless the user explicitly asks in the current turn.
- `/finalize-lite` remains the compact compatibility entry.
