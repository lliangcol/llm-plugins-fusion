---
id: codex-review-fix
stage: implement
title: /codex-review-fix
description: "Run the Codex review -> fix -> local checks -> verify loop for the current branch."
destructive-actions: medium
allowed-tools: Bash Read Glob Grep LS Edit Write
invokes:
  skill: nova-codex-review-fix
---

# /codex-review-fix

Invoke `nova-codex-review-fix` with `$ARGUMENTS`.

This is the Codex review -> Claude Code fix -> local checks -> Codex verify loop. The skill is the source of truth for parameter resolution, script invocation, artifact policy, output format, and safety boundaries.

Entry semantics:

- Runs a bounded closure loop for high-confidence review findings.
- Supports `REVIEW_MODE=branch|staged|full`, optional `BASE`, optional `OUTPUT_DIR`, optional `GOAL`, and `FIX_SCOPE` policy.
- Only this Codex command may modify project files, and only within the selected fix scope.
