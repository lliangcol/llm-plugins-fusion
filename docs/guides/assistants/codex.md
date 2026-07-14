<!-- migrated-from: docs/consumers/codex-setup.md -->
# Codex Setup for nova-plugin Skills

Use this guide when a consumer project wants Codex or another coding agent to
follow `nova-plugin` workflow contracts without relying on Claude Code slash
commands.

## Recommended Shape

Provide the route skill and the primary workflow skills as local instruction
files or project references:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

Use Codex-specific review commands only when the consumer project has the
required Codex CLI, Bash 3.2+ runtime, and artifact policy:

```text
nova-plugin/skills/nova-codex-review-fix/SKILL.md
nova-plugin/skills/nova-codex-review-only/SKILL.md
nova-plugin/skills/nova-codex-verify-only/SKILL.md
```

## Usage Pattern

1. Start with `nova-route` when the next step is unclear.
2. Follow the selected `nova-*` skill and its safety boundary.
3. For Codex loop work, keep `.codex/` runtime artifacts out of this public
   repository and out of public handoff examples. In private consumer projects,
   treat `.codex/` as disposable local evidence unless the project-local source
   of truth defines a stricter artifact policy.
4. Report validation evidence or skipped checks in the final handoff.

## Public-Safe Boundaries

- Keep consumer-specific rules, private paths, endpoints, credentials,
  repository addresses, runtime flags, business rules, and private knowledge
  base content in the consumer project.
- Do not copy Codex runtime artifacts, environment summaries, local CLI paths,
  or private review outputs back into this public repository.
- If Codex CLI or Bash is unavailable, use the ordinary `nova-review` ->
  `nova-implement-plan` skill path or report the missing prerequisite; do not
  relax global permissions to hide the missing runtime.

## Fallback Notes

- Codex can consume Markdown instructions, but Claude Code slash command syntax is not portable by itself.
- Claude plugin install and Claude hooks remain Claude-specific.
- Codex loop scripts require Bash 3.2+ and a working Codex CLI; ordinary five-stage workflow skills do not.
