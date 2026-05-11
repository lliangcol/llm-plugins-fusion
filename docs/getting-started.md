# Getting Started

Status: active
Date: 2026-05-12

This is the shortest path for using `nova-plugin` without reading the agent or
capability pack internals first.

## Install

Prerequisites:

- Claude Code with third-party marketplace support.
- Node.js 20+ only when maintaining this repository or running local validators.
- Codex CLI and Bash only for Codex loop commands such as `/codex-review-fix`.

Add the marketplace and install the plugin:

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion
/plugin install nova-plugin@llm-plugins-fusion
```

Confirm it is installed:

```bash
/plugin
```

## Start With `/route`

When the next step is unclear, start with:

```text
/route Please choose the next nova workflow command for this task.
```

`/route` is read-only. It should recommend the next command, skill, core agent,
capability packs, required inputs, validation path, and fallback mode.

## Five Main Commands

Use the primary workflow path for routine work:

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

| Command | Use when |
| --- | --- |
| `/explore` | You need facts, unknowns, and risks before planning. |
| `/produce-plan` | You need a reviewable implementation plan. |
| `/review` | You need prioritized findings on a plan, diff, or design. |
| `/implement-plan` | You have an approved plan and want scoped edits. |
| `/finalize-work` | You need a handoff with changed files, validation, limits, and next steps. |

## Codex Preconditions

Only Codex loop commands require Codex-specific setup:

- Codex CLI must be available in the shell used by Claude Code.
- Bash must be available for distributed helper scripts.
- Codex review-only and verify-only commands may write `.codex/` artifacts, but
  should not modify project code.
- `codex-review-fix` is the Codex command that may drive project fixes through
  the defined review -> fix -> verify loop.

## Common Failures

| Symptom | Handling |
| --- | --- |
| Plugin command is missing | Re-run `/plugin`, confirm the marketplace was added, then reinstall `nova-plugin@llm-plugins-fusion`. |
| Unsure which command to use | Run `/route` with the task summary. |
| Bash-dependent validation is skipped on Windows | Record it as skipped and rely on CI/Linux for Bash hook syntax and runtime smoke evidence. |
| Codex command cannot find Codex CLI | Use the ordinary five-command workflow, or install/fix Codex CLI before using Codex loop commands. |
| Validation was not run | State `not run` or `skipped` with the reason; do not report it as passed. |
