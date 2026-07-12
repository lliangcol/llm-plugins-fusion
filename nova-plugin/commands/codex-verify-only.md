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

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-codex-verify-only` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-verify-only.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-verify-only/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: review
- Owner agents: verifier
- Required inputs: `REVIEW_FILE`
- Output contract: `codex-verify-only-v2`
- Risk: low
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.
