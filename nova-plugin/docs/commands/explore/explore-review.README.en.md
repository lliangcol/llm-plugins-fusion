# /nova-plugin:explore-review

- Source: `nova-plugin/commands/explore-review.md`

## Command Positioning

- Raise review questions and risk signals without proposing solutions.
- Use when: reviewing requirements/approaches and surfacing ambiguity.
- Not for: design/implementation suggestions or code changes.

## Parameters

| Parameter   | Required | Description        | Example                           |
| ----------- | -------- | ------------------ | --------------------------------- |
| `ARGUMENTS` | No       | Content to review. | `Requirement or approach summary` |

## Output

- Fixed output: What is clear / Review questions / Risk signals.
- Example output structure:

```text
### What is clear
- ...

### Review questions
- ...

### Risk signals
- ...
```

## Full Examples

```text
/nova-plugin:explore-review
Here is a requirement. Output review questions.
```

```text
/nova-plugin:explore-review
Here is an approach. List risk signals.
```

```text
/nova-plugin:explore-review
Provide a concrete solution.
```

## Incorrect Usage / Anti-patterns

- Providing concrete solutions or implementation advice.
- Using should/recommend/solution/implement wording.

## Comparison with Similar Commands

- `/nova-plugin:explore-lite` is quick alignment.
- `/nova-plugin:plan-review` focuses on plan document review.
