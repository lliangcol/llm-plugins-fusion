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

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-review-fix.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-plan/SKILL.md`, then execute canonical surface `nova-implement-plan` with variant preset `{"EXECUTION_PROFILE":"codex-review-fix"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: implement
- Owner agents: reviewer, builder, verifier
- Required inputs: `REVIEW_SCOPE`
- Output contract: `codex-review-fix-v2`
- Risk: medium
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.
