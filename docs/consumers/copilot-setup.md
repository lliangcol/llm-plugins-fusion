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

## Public-Safe Boundaries

- Keep `.github/copilot-instructions.md` and persona mappings private unless
  they are fully generic and redacted.
- Do not copy private paths, repository addresses, endpoints, credentials,
  runtime flags, branch policies, business rules, or private knowledge base
  content into public templates or examples.
- If Copilot cannot run a check, report it as skipped or not run with the
  reason; do not loosen repository or agent permissions to bypass the missing
  tool.

## Fallback Notes

- Copilot instructions are not Claude Code commands; invoke skills by name.
- Claude hooks and marketplace installation are not portable to Copilot.
- Do not publish private `.github/copilot-instructions.md` content in this repository.
