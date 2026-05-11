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
required Codex CLI, Bash runtime, and artifact policy:

```text
nova-plugin/skills/nova-codex-review-fix/SKILL.md
nova-plugin/skills/nova-codex-review-only/SKILL.md
nova-plugin/skills/nova-codex-verify-only/SKILL.md
```

## Usage Pattern

1. Start with `nova-route` when the next step is unclear.
2. Follow the selected `nova-*` skill and its safety boundary.
3. For Codex loop work, keep `.codex/` runtime artifacts out of commits unless the consumer project explicitly tracks them.
4. Report validation evidence or skipped checks in the final handoff.

## Fallback Notes

- Codex can consume Markdown instructions, but Claude Code slash command syntax is not portable by itself.
- Claude plugin install and Claude hooks remain Claude-specific.
- Codex loop scripts require Bash and a working Codex CLI; ordinary five-stage workflow skills do not.
