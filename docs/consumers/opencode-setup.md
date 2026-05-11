# OpenCode Setup for nova-plugin Skills

Use this guide when a consumer project wants OpenCode to select and follow
`nova-plugin` skills through project-local agent instructions.

## Recommended Shape

Reference `nova-route` as the first-hop skill for ambiguous work:

```text
nova-plugin/skills/nova-route/SKILL.md
```

Then expose the primary workflow skills needed by the project:

```text
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

## Usage Pattern

1. Map user intent to `nova-route` when no direct workflow step is obvious.
2. Let `nova-route` choose the command, skill, core agent, packs, inputs, and validation path.
3. Apply the selected skill without skipping safety preflight or verification expectations.
4. Store OpenCode-specific configuration in the consumer project.

## Fallback Notes

- OpenCode may not execute Claude slash commands; skill names are the portable interface.
- Capability packs are documentation guidance, not runtime-loaded agents.
- Claude Code plugin installation and hooks are outside the OpenCode fallback path.
