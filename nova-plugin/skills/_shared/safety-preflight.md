# Shared Safety Preflight

Use this policy before any skill performs side effects through `Write`, `Edit`,
`MultiEdit`, or `Bash`. Read-only skills do not need an interrupting preflight
unless they invoke external tools or write explicit artifacts.

## When Preflight Is Required

Run safety preflight when a workflow may:

- Create, overwrite, or edit files.
- Modify project code.
- Run Bash scripts or project checks.
- Call external CLIs.
- Use `.codex/` runtime artifacts as inputs or outputs.
- Depend on safety-boundary parameters.

## Preflight Card

Before side effects, resolve and present:

```text
Preflight
- Command:
- Resolved parameters:
- Files/artifacts that may be written:
- Scripts/commands that may run:
- Disallowed operations:
- Missing safety-boundary parameters:
- Proceed condition:
```

For interactive use, proceed only when all required safety-boundary parameters
are explicit or confirmed. For non-interactive use, fail if any required
safety-boundary parameter is missing.

## Safety Boundary Parameters

These parameters cannot be silently inferred:

- `PLAN_OUTPUT_PATH`
- `PLAN_INPUT_PATH`
- `PLAN_APPROVED`
- `REVIEW_FILE`
- `EXPORT_PATH`

Other skill-specific parameters may also be safety boundaries when they affect
write scope, execution scope, or artifact selection.

## Write Scope Rules

- Artifact-writing skills may create parent directories and overwrite the
  documented output file only after the output path is explicit or confirmed.
- Code-writing skills must identify the intended work scope before editing.
- Implementation skills must respect existing repository conventions and avoid
  unrelated refactors.
- Review and explore skills must not modify project code.
- `codex-review-only` and `codex-verify-only` may run scripts that write review
  or verification artifacts, but they must not modify project code.
- Within the Codex set, only `codex-review-fix` may modify project files.

## Bash and External Commands

Before running Bash or external scripts:

- Confirm the script path exists.
- Show the effective arguments.
- Confirm required environment, such as `CLAUDE_PLUGIN_ROOT`, Git repository,
  Bash, Codex CLI, or Node.js, as applicable.
- Treat missing runtime dependencies as a blocker, not as a reason to guess.

## Disallowed Operations

Skills must not perform these operations unless a human explicitly asks for
them in the current turn:

- `git reset --hard`
- `git clean -fd` or stronger variants
- deleting branches
- rebasing, merging, pushing, or publishing
- bulk deletion outside an explicit target path
- editing `.codex/` runtime artifacts as release source files
- modifying archived agents as active agents

## Stop Conditions

Stop before side effects when:

- A required safety-boundary parameter is missing.
- The resolved write scope conflicts with the user's request.
- The worktree has relevant user changes that cannot be merged safely.
- The operation depends on external credentials or accounts that are not
  available.
- A requested action conflicts with repository policy.
