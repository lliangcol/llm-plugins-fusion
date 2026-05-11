# Cursor Setup for nova-plugin Skills

Use this guide when a consumer project wants Cursor to follow `nova-plugin`
workflows without Claude Code slash commands.

## Recommended Shape

Copy only the skills needed for the project into Cursor rules, or reference the
source files from a private project profile:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

## Usage Pattern

1. Start with `nova-route` when the right workflow step is unclear.
2. Ask Cursor to follow the selected `nova-*` skill exactly.
3. Keep project-specific rules in the consumer repository, not this public repo.
4. Run the validation command named by the selected skill or explain why it is unavailable.

## Fallback Notes

- Cursor may not understand Claude slash commands; refer to skill names directly.
- Claude Code hooks and plugin marketplace install are not part of Cursor setup.
- Do not copy private paths, endpoints, credentials, or consumer-specific commands into public templates.
