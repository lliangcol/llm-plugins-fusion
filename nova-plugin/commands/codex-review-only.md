---
id: codex-review-only
stage: review
title: /nova-plugin:codex-review-only
description: "Run Codex review only and write a structured review artifact without modifying code."
destructive-actions: low
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:codex-review-only

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-codex-review-only` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-review-only.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-only/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: review
- Owner agents: reviewer
- Required inputs: `REVIEW_SCOPE`
- Output contract: `codex-review-only-v2`
- Risk: low
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.
