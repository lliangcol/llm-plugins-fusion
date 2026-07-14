# /nova-plugin:explore-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `explore-lite`; stage: `explore`; canonical skill: `nova-explore`
- Purpose: Produce concise factual observations, uncertainties, and risks from knowledge gaps.
- Audience: `all-users`; support risk: `none`
- Inputs: `INPUT` (required)
- Output contract: `exploration-lite-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `explore`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/explore-lite.md`

## Command Positioning

- Quick understanding and alignment; list knowns, unknowns, and risks.
- Use when: quick clarity scan or meeting alignment.
- Not for: deep analysis, design, or implementation.

## Parameters

| Parameter   | Required | Description                               | Example                       |
| ----------- | -------- | ----------------------------------------- | ----------------------------- |
| `ARGUMENTS` | No       | Any input context or problem description. | `Requirement summary or logs` |

## Output

- Fixed output: Observations / Uncertainties / Potential risks.
- Example output structure:

```text
### Observations
- ...

### Uncertainties
- ...

### Potential risks
- ...
```

## Full Examples

```text
/nova-plugin:explore-lite
We are adding a refund API; quick list of unclear points.
```

```text
/nova-plugin:explore-lite
Alert: Connection pool exhausted. List uncertainties and risks.
```

```text
/nova-plugin:explore-lite
Provide a full solution and implementation steps.
```

## Incorrect Usage / Anti-patterns

- Proposing designs or refactors.
- Including implementation details or code.

## Comparison with Similar Commands

- `/nova-plugin:senior-explore` is deeper and more systematic.
- `/nova-plugin:explore-review` focuses on reviewer questions and risk signals.
