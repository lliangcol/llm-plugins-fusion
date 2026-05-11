# Security Review Route

Status: active
Date: 2026-05-11

Use this route for marketplace or plugin changes that affect execution risk,
data exposure, credentials, dependency behavior, hooks, Bash scripts, or
write-capable commands.

## Trigger Conditions

Run the security review path when a change touches any of these areas:

- `allowed-tools` or `destructive-actions` in command or skill frontmatter.
- Hook configuration or hook scripts under `nova-plugin/hooks/`.
- Bash, PowerShell, Node.js, Codex, or Claude CLI automation.
- Registry metadata that changes `risk-level`, `trust-level`, maintainer
  ownership, deprecation, or compatibility evidence.
- Dependency installation, generated artifacts consumed by users, or external
  network behavior.
- Documentation that changes security guidance, disclosure flow, or release
  failure handling.

## Route

1. Use the `reviewer` and `verifier` responsibilities from
   [Core agent routing](../agents/ROUTING.md).
2. Apply the [security capability pack](../../nova-plugin/packs/security/) for
   domain-specific checks.
3. Validate structural contracts with the repository scripts that match the
   change.
4. Escalate private vulnerability reports through [SECURITY.md](../../SECURITY.md)
   instead of a public issue or PR comment.

## Minimum Checks

| Change area | Checks |
| --- | --- |
| Registry metadata | `node scripts/generate-registry.mjs --write`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs`, `node scripts/validate-claude-compat.mjs` |
| Command or skill risk | `node scripts/lint-frontmatter.mjs`, command docs review, shared safety preflight review |
| Distributed Bash/Codex scripts | `node scripts/validate-runtime-smoke.mjs`, runtime environment artifact review, no committed `.codex/` artifacts |
| Hooks | `node scripts/validate-hooks.mjs`, `bash -n` for both hook scripts when Bash is available |
| Documentation | `node scripts/validate-docs.mjs` |
| Broad workflow changes | `node scripts/validate-all.mjs`, `node scripts/scan-distribution-risk.mjs`, `git diff --check` |

## Reviewer Output

Security review notes should state:

- The affected plugin entry and maintainer.
- The risk-level rationale and whether it changed.
- Sensitive tool, hook, script, network, credential, or dependency behavior.
- Distribution risk scan result for active private paths, credentials, private
  network addresses, and internal endpoints.
- Validation run and any skipped checks, including Bash availability.
- Residual risk or explicit reason no additional security action is needed.
