<!-- migrated-from: docs/consumers/openhands-setup.md -->
# OpenHands Setup for nova-plugin Skills

Use this guide when a consumer project wants OpenHands to follow
`nova-plugin` workflow contracts in a repository workspace.

## Recommended Shape

Expose the route skill and primary workflow skills as project-local references:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

The consumer project should own any OpenHands workspace setup, sandbox policy,
tool allowlist, and validation command mapping. This repository should only
document the public-safe skill contract.

## Usage Pattern

1. Route ambiguous work through `nova-route`.
2. Select one `nova-*` skill and keep OpenHands focused on that workflow step.
3. Preserve review-only, plan-only, implementation, and finalization
   boundaries from the selected skill.
4. Capture validation evidence in the final handoff, including unavailable
   checks and reasons.

## Public-Safe Boundaries

- Keep consumer-specific repository addresses, paths, endpoints, credentials,
  runtime flags, business rules, private knowledge base content, and local
  OpenHands configuration in the consumer repository.
- Do not copy OpenHands workspace state, logs, environment dumps, or private
  task traces into public docs or examples.
- Do not broaden sandbox or workflow permissions merely to convert a missing
  tool into a passing check.

## Fallback Notes

- OpenHands may not support Claude Code slash commands or hooks. Skill
  Markdown is the portable interface.
- Claude marketplace install and active Claude agents are Claude-specific.
- Capability packs remain documentation guidance unless the consumer project
  maps them to OpenHands-specific routing.
