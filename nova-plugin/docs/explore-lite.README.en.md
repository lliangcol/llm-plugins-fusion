# /explore-lite

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
/explore-lite
We are adding a refund API; quick list of unclear points.
```

```text
/explore-lite
Alert: Connection pool exhausted. List uncertainties and risks.
```

```text
/explore-lite
Provide a full solution and implementation steps.
```

## Incorrect Usage / Anti-patterns

- Proposing designs or refactors.
- Including implementation details or code.

## Comparison with Similar Commands

- `/senior-explore` is deeper and more systematic.
- `/explore-review` focuses on reviewer questions and risk signals.
