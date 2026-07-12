---
id: codex-verify-only
stage: review
title: /nova-plugin:codex-verify-only
description: "Run Codex verification against an existing review artifact and optional checks output."
destructive-actions: low
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:codex-verify-only

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-verify-only.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-review/SKILL.md`, then execute canonical surface `nova-review` with variant preset `{"REVIEW_PROFILE":"codex-verify-only"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: review
- Owner agents: verifier
- Required inputs: `REVIEW_FILE`
- Output contract: `codex-verify-only-v2`
- Risk: low
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.
