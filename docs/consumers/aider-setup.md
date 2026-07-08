# Aider Setup for nova-plugin Skills

Use this guide when a consumer project wants Aider to apply `nova-plugin`
workflow contracts during repository edits.

## Recommended Shape

Provide Aider with the route skill and the smallest useful workflow surface:

```text
nova-plugin/skills/nova-route/SKILL.md
nova-plugin/skills/nova-explore/SKILL.md
nova-plugin/skills/nova-produce-plan/SKILL.md
nova-plugin/skills/nova-review/SKILL.md
nova-plugin/skills/nova-implement-plan/SKILL.md
nova-plugin/skills/nova-finalize-work/SKILL.md
```

For code changes, prefer explicit task framing: selected skill, allowed files,
validation commands, and whether the work is review-only, plan-only, or
implementation. Store that framing in the consumer project, not here.

## Usage Pattern

1. Use `nova-route` to choose the correct workflow when intent is ambiguous.
2. Ask Aider to follow one selected `nova-*` skill for the current task.
3. Keep edits scoped to the selected plan or review finding.
4. Run the selected validation commands or report them as skipped or not run
   with a concrete reason.

## Public-Safe Boundaries

- Keep private repository names, local paths, endpoints, credentials, runtime
  flags, business rules, private knowledge base content, and real project
  prompts in the consumer workspace.
- Do not commit Aider chat logs, local model settings, or private patch
  transcripts to this public repository.
- Do not use public examples to encode consumer-specific validation commands
  unless they are generic placeholders.

## Fallback Notes

- Aider consumes files and instructions, not Claude Code slash commands.
- Capability packs are documentation guidance unless the consumer project
  maps them into its own Aider workflow.
- If Aider cannot run a validator, preserve the evidence boundary instead of
  treating the check as passed.
