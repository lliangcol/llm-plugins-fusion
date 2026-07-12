---
id: codex-review-fix
stage: implement
title: /nova-plugin:codex-review-fix
description: "Run the Codex review -> fix -> local checks -> verify loop for the current branch."
destructive-actions: medium
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:codex-review-fix

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-codex-review-fix` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-review-fix.json` as the compiled runtime contract, then apply it directly. The full compatibility skill is a maintainer reference and is not required for ordinary direct execution.

- Stage: implement
- Owner agents: reviewer, builder, verifier
- Required inputs: `REVIEW_SCOPE`
- Output contract: `codex-review-fix-v2`
- Risk: medium
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in the compiled contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.
