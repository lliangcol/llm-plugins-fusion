# GitHub Copilot Setup for nova-plugin Skills

Use this guide when a consumer project wants GitHub Copilot instructions or
agent personas to follow `nova-plugin` workflow contracts.

## Recommended Shape

Add a private Copilot instruction that points to `nova-route` as the routing
entry and names the primary workflow skills:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

Consumer projects can also map Copilot personas to the core-agent model:
`orchestrator`, `architect`, `builder`, `reviewer`, `verifier`, and `publisher`.

## Usage Pattern

1. Ask Copilot to route with `nova-route` before broad or ambiguous work.
2. Use the recommended skill as the instruction source for the next step.
3. Keep consumer-specific repository rules, checks, and branch policy private.
4. Confirm validation with command output or state why Copilot could not run it.

## Fallback Notes

- Copilot instructions are not Claude Code commands; invoke skills by name.
- Claude hooks and marketplace installation are not portable to Copilot.
- Do not publish private `.github/copilot-instructions.md` content in this repository.
