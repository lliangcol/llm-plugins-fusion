# Gemini CLI Setup for nova-plugin Skills

Use this guide when a consumer project wants Gemini CLI to consume
`nova-plugin` workflows as plain Markdown skills or persistent project context.

## Recommended Shape

Expose the route skill first, then add the five primary workflow skills:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

Consumer projects may copy those files into their private Gemini skill
location or reference them from project-local instructions.

## Usage Pattern

1. Ask Gemini to apply `nova-route` before non-trivial work.
2. Follow the route output to select the next `nova-*` skill.
3. Keep consumer-specific commands and validation in the private project profile.
4. Record skipped checks honestly when Gemini cannot run the selected validator.

## Fallback Notes

- Gemini CLI command names may differ from Claude slash commands; use skill names as the stable contract.
- Claude marketplace install, Claude hooks, and Codex loop scripts remain Claude/Codex-specific unless the consumer project wires them explicitly.
- Keep public examples generic and redacted.
