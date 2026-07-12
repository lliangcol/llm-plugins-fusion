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

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-review-only.json` as the compiled runtime contract, then apply it directly. The full compatibility skill is a maintainer reference and is not required for ordinary direct execution.

- Stage: review
- Owner agents: reviewer
- Required inputs: `REVIEW_SCOPE`
- Output contract: `codex-review-only-v2`
- Risk: low
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in the compiled contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.
