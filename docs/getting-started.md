# Getting Started

Status: active
Date: 2026-06-02

This is the shortest path for using `nova-plugin` without reading the agent or
capability pack internals first.

## 5-Minute Start

Prerequisites:

- Claude Code with third-party marketplace support.
- Node.js 20+ only when maintaining this repository or running local validators.
- Codex CLI and Bash only for Codex loop commands such as `/codex-review-fix`.

Minute 1: add the marketplace and install the plugin:

```text
/plugin marketplace add lliangcol/llm-plugins-fusion
/plugin install nova-plugin@llm-plugins-fusion
```

Minute 2: confirm it is installed:

```text
/plugin
```

Minute 3: run the first command after installation:

```text
/route Please choose the next nova workflow command for this task. I need to change docs, verify links, and summarize validation.
```

`/route` is read-only. It should recommend the next command, skill, core agent,
capability packs, required inputs, validation path, and fallback mode.

Minute 4: follow the recommended next command only after confirming it matches
your intent. For example, a docs-only task will usually start with `/explore` or
`/produce-plan`, while an already approved plan can move to `/implement-plan`.

Minute 5: finish with explicit validation and handoff. If validation was not
available, record it as `skipped` or `not run` with the reason.

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

## First Command After Install

Use `/route` even when you think the next command is obvious. The value of the
first route is not automation; it records intent, constraints, likely packs,
validation expectations, and fallback mode before any write-capable command runs.

Good first prompts:

```text
/route I want to review a README change before editing. Recommend the next nova workflow step and validation.

/route I have an approved backend plan and need scoped implementation with test evidence. Recommend the next command.

/route I need release notes, docs sync, and final validation for a public-safe repository change.
```

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
| Marketplace add fails | Confirm Claude Code supports third-party marketplaces in the current environment, then retry the marketplace add command. |
| Install succeeds but command output is confusing | Run `/route` with a smaller task summary and ask for the minimum next command plus validation. |
| Unsure which command to use | Run `/route` with the task summary. |
| Bash-dependent validation is skipped on Windows | Record it as skipped and rely on CI/Linux for Bash hook syntax and runtime smoke evidence. |
| Codex command cannot find Codex CLI | Use the ordinary five-command workflow, or install/fix Codex CLI before using Codex loop commands. |
| Validation was not run | State `not run` or `skipped` with the reason; do not report it as passed. |

## Public And Private Boundary

Public examples, showcase pages, and prompt templates must stay generic and
redacted. Do not publish real consumer profiles, endpoints, credentials, private
repository addresses, runtime flags, business rules, or private knowledge-base
content in this repository.
