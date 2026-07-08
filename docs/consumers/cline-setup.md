# Cline Setup for nova-plugin Skills

Use this guide when a consumer project wants Cline to follow `nova-plugin`
workflow contracts through project-local instructions.

## Recommended Shape

Reference the route skill first, then expose only the workflow skills the
project expects Cline to use:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

Keep Cline rules in the consumer repository, such as project-local assistant
instructions or private docs. Treat the skill Markdown as the portable contract;
do not depend on Claude Code slash-command behavior.

## Usage Pattern

1. Ask Cline to start with `nova-route` when the next workflow step is unclear.
2. Have Cline follow the selected `nova-*` skill, including scope boundaries,
   evidence expectations, and validation commands.
3. Keep project-specific routing hints in the consumer workspace.
4. Record checks as passed, skipped, or not run with reasons in the final
   handoff.

## Public-Safe Boundaries

- Do not copy private paths, repository addresses, endpoints, credentials,
  runtime flags, business rules, private knowledge base content, or
  consumer-specific commands into this public repository.
- Do not paste private Cline task transcripts into public examples.
- If Cline cannot run a selected validator, report the missing prerequisite
  instead of broadening permissions or sandbox settings to hide the gap.

## Fallback Notes

- Cline may not execute Claude slash commands; use skill names and Markdown
  contracts directly.
- Claude Code marketplace install, hooks, and active agents are outside the
  Cline fallback path unless the consumer project separately documents them.
