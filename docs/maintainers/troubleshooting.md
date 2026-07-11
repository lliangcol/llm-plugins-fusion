# Maintainer Troubleshooting

Status: active
Date: 2026-06-24

This page covers common maintainer failures without relying on private machine
details. If a check is skipped, report the exact skip reason rather than
claiming it passed.

## Boundary Rules

- Do not loosen global permissions, agent sandbox settings, or workflow token
  scope to hide a missing local tool or unavailable platform check.
- Do not paste private machine paths, repository addresses, endpoints,
  credentials, tokens, consumer names, business rules, or private alert details
  into public troubleshooting notes.
- Record unavailable checks as `skipped`, `not run`, or `pending` with the
  reason and the replacement CI/Linux or owner-verified evidence.

## Fast Failure Map

Use the smallest focused check that matches the failure before running the full
maintainer gate again.

| Signal | First command | Boundary |
| --- | --- | --- |
| Markdown link, anchor, inventory, positioning, or release wording failure | `npm run validate:docs` | Fix active public docs only; do not patch generated marketplace outputs by hand. |
| Command or skill frontmatter failure | `node scripts/lint-frontmatter.mjs` | Preserve command/skill one-to-one mapping and existing tool permission intent. |
| GitHub workflow permission, inventory, or required-check drift | `npm run validate:github-workflows` | Do not broaden default token scope or move mutating plugin install smoke into default PR/push checks. |
| `generated registry drift check` or generated marketplace drift | `node scripts/generate-registry.mjs --write` | Edit registry or plugin metadata sources first, then regenerate outputs. |
| Distribution risk scan secret, private path, or `.codex/` artifact finding | `npm run scan:distribution` | Remove or redact the active public content; use allowlists only for intentional historical warnings. |
| Capability pack documentation-only, enhanced, or fallback boundary failure | `node scripts/validate-packs.mjs` | Keep packs as documentation guidance; do not introduce runtime dynamic loading as a fix. |
| `validate surface budget` warning or failure | `npm run validate:surface` | Split bloated shipped surfaces or update the allowlist only with a rationale and split plan. |
| Bash hook syntax failure | `bash -n nova-plugin/hooks/scripts/pre-write-check.sh` and `bash -n nova-plugin/hooks/scripts/post-audit-log.sh` | Run only where Bash is available; treat Windows no-Bash skips as skipped, not passed. |
| Codex runtime helper smoke failure | `node scripts/validate-runtime-smoke.mjs` | Use CI/Linux for replacement evidence when local Bash is unavailable. |

## Windows Without Bash

`node scripts/validate-all.mjs` may warning-skip Bash-dependent hook syntax or
runtime smoke checks on Windows when Bash is unavailable. That is a local skip,
not proof that the checks passed.

Use a Bash-capable shell or CI/Linux to verify:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
node scripts/validate-runtime-smoke.mjs
```

## Claude CLI Missing

The default local checks do not require Claude CLI. `doctor` and compatibility
checks may warn that Claude CLI is missing.

Use dry-run install smoke for unattended validation:

```bash
node scripts/validate-plugin-install.mjs --dry-run
```

Use real install smoke only in CI or an isolated test-user environment:

```bash
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation --isolated-home
```

`--isolated-home` sets temporary `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`,
`XDG_DATA_HOME`, and `XDG_STATE_HOME` for Claude CLI commands, then removes the
temporary profile when the script exits. Without it, the mutation path must run
only in a disposable CI runner or test OS user.

## Hooks Fail Before Writing

`pre-write-check.sh` is the thin launcher for the Node.js 20+ write guard. It
blocks malformed payloads, unavailable Node, likely hardcoded secrets, unsafe
Edit reconstruction, and invalid proposed `hooks.json` content. Exit 0 means
no blocking decision, not permission approval.

Run:

```bash
node scripts/validate-hooks.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
```

For hook schema failures, compare against `nova-plugin/hooks/hooks.json`.

If Node.js 20+ is unavailable, Write/Edit fails closed. An operator may set
`NOVA_WRITE_GUARD_DISABLED=1` for an explicit temporary bypass, but must record
that the guard was disabled; such a run is not release evidence. Bash file
redirection is outside the PreToolUse matcher and remains governed by normal
permissions, sandboxing, secret scans, and release gates.

## GitHub Workflow Permissions

When CI workflow edits fail permission review or token-scope checks, run:

```bash
npm run validate:github-workflows
```

This verifies read-only default token scope, forbids `pull_request_target`,
keeps release write permission scoped to the release job, keeps the workflow
file inventory synchronized with `CLAUDE.md`, keeps required-check docs and the
read-only print script synchronized with CI labels, and keeps mutating plugin
install smoke off default PR and push triggers. Do not broaden workflow token
scope to hide missing local tools or unavailable GitHub platform checks.

## Audit Log Location

`post-audit-log.sh` writes to:

```text
${CLAUDE_PLUGIN_DATA:-${XDG_STATE_HOME:-$HOME/.local/state}/nova-plugin}/audit.log
```

The directory is created with `700`, the log file with `600`, and logs rotate
to `audit.log.1` after 5 MB. Set `NOVA_AUDIT_DISABLED=1` to disable local audit
logging for an environment.

The public data handling and best-effort redaction boundary is documented in
[../privacy/data-handling.md](../privacy/data-handling.md). Do not commit local
audit logs or treat redaction as a guarantee that private data is safe to paste
into public artifacts.

## CodeQL And Dependency Graph

CodeQL runs from `.github/workflows/codeql.yml`. Dependency review may skip when
the repository dependency graph is unavailable. Enable GitHub Dependency graph,
Dependabot alerts, secret scanning, and code scanning in repository security
settings before treating platform checks as complete.

## Generated Registry Drift

Generated marketplace files must not be hand-edited. If drift appears, update
the source files and regenerate:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
```
