# /explore-review

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
/explore-review
Here is a requirement. Output review questions.
```

```text
/explore-review
Here is an approach. List risk signals.
```

```text
/explore-review
Provide a concrete solution.
```

## Incorrect Usage / Anti-patterns

- Providing concrete solutions or implementation advice.
- Using should/recommend/solution/implement wording.

## Comparison with Similar Commands

- `/explore-lite` is quick alignment.
- `/plan-review` focuses on plan document review.
