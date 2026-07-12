---
id: explore-review
stage: explore
title: /nova-plugin:explore-review
description: "Review-oriented exploration that surfaces questions and risks without proposing fixes."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:explore-review

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-explore-review` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/explore-review.json` as the compiled runtime contract, then apply it directly. The full compatibility skill is a maintainer reference and is not required for ordinary direct execution.

- Stage: explore
- Owner agents: reviewer
- Required inputs: `INPUT`
- Output contract: `exploration-review-v2`
- Risk: none
- Recommended packs: security, dependency

Preserve all safety, approval, output, failure, and validation requirements in the compiled contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.
