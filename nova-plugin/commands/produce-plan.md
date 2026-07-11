---
id: produce-plan
stage: plan
title: /nova-plugin:produce-plan
description: "Write a formal review-ready plan document to an explicit PLAN_OUTPUT_PATH."
destructive-actions: low
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:produce-plan

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-produce-plan` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/skills/nova-produce-plan/SKILL.md` as the supporting behavioral contract, then apply it directly.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`, `PLAN_OUTPUT_PATH`
- Output contract: `produce-plan-v2`
- Risk: low
- Recommended packs: docs

Preserve all safety, approval, output, failure, and validation requirements in the supporting contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.
