# /nova-plugin:finalize-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `finalize-lite`; stage: `finalize`; canonical skill: `nova-finalize-work`
- Purpose: Provide a short factual closure summary without making new changes or decisions.
- Audience: `all-users`; support risk: `none`
- Inputs: `WORK_SUMMARY` (required)
- Output contract: `finalize-lite-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `finalize-work`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/finalize-lite.md`

## Command Positioning

- Quick three-part summary of completed work.
- Use when: brief summary without full delivery artifacts.
- Not for: commit/PR packaging or full handoff docs.

## Parameters

| Parameter   | Required | Description         | Example          |
| ----------- | -------- | ------------------- | ---------------- |
| `ARGUMENTS` | No       | Scope to summarize. | `Change summary` |

## Output

- Output contains What changed / Why / Limitations.
- Example output structure:

```text
What changed: ...
Why: ...
Limitations: ...
```

## Full Examples

```text
/nova-plugin:finalize-lite
Summarize this fix.
```

```text
/nova-plugin:finalize-lite
Three-line summary of changes and limitations.
```

```text
/nova-plugin:finalize-lite
Keep optimizing and change code.
```

## Incorrect Usage / Anti-patterns

- Introducing new decisions or changes.
- Missing one of the three parts.

## Comparison with Similar Commands

- `/nova-plugin:finalize-work` outputs full delivery artifacts.
