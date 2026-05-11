# Prompt Template Library

Status: active
Date: 2026-05-12

This directory contains public-safe prompt templates for repeatable
`nova-plugin` workflows. They are templates, not consumer profiles. Replace
placeholders inside the private consumer project and keep private names, local
paths, endpoints, credentials, configuration values, and business-specific
rules out of this public repository.

## Template Rules

- Prefer short inputs, explicit scope, and artifact paths over long chat history.
- Use Git facts and project-local docs to define the task boundary.
- Do not request full repository scans unless the task genuinely requires them.
- Do not paste full files, full diffs, or long generated output into final
  answers when an artifact path or summary is enough.
- Write checkpoints for long tasks so another agent can resume without reading
  the whole conversation.
- Separate facts, assumptions, validation, skipped checks, and residual risk.
- Treat HTML outputs as derived reading artifacts; keep Markdown, code, review,
  and validation evidence as the source of truth.

## Templates

| Template | Use when |
| --- | --- |
| [codex/context-safe-review.md](codex/context-safe-review.md) | A branch or working tree needs high-confidence review without context blow-up. |
| [codex/final-verification.md](codex/final-verification.md) | Fixes exist and Codex should verify them against a previous review artifact. |
| [claude-code/fix-from-review.md](claude-code/fix-from-review.md) | Claude Code should fix confirmed review findings in scoped batches. |
| [claude-code/subagent-execution.md](claude-code/subagent-execution.md) | A task can be split across independent subagents or workers. |
| [claude-code/serial-checkpoint.md](claude-code/serial-checkpoint.md) | Subagents are not available or should not be used, so one agent must proceed by checkpoints. |
| [common/checkpoint-artifact.md](common/checkpoint-artifact.md) | A long-running task needs a resumable Markdown checkpoint in a private consumer workbench. |
| [common/delivery-docs.md](common/delivery-docs.md) | A completed change needs API, test, implementation, deployment, and handoff docs. |
| [common/html-artifact.md](common/html-artifact.md) | A plan, review, report, or handoff needs a visual, shareable HTML artifact without making HTML the source of truth. |
| [common/skill-harness-audit.md](common/skill-harness-audit.md) | A repeated agent workflow needs placement as a script, skill, prompt, pack, or consumer profile. |
| [common/workbench-tidy.md](common/workbench-tidy.md) | A consumer workspace needs private artifacts organized without leaking them into public docs. |

## Related Guidance

- [Context-Safe Agent Workflows](../workflows/context-safe-agent-workflows.md)
- [Thin Harness, Fat Skills Workflow Doctrine](../workflows/thin-harness-fat-skills.md)
- [Consumer Profile Contract](../consumers/profile-contract.md)
- [Workbench Consumer Template](../consumers/workbench-template.md)
- [Codex review/fix/verify command docs](../../nova-plugin/docs/commands/codex/codex-review-fix.README.md)
