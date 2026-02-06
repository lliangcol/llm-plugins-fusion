# /plan-review

- Source: `nova-plugin/commands/plan-review.md`

## Command Positioning

- Review plan decision clarity and execution risks without proposing solutions.
- Use when: reviewing plan clarity, assumptions, and risks.
- Not for: rewriting plans, proposing alternatives, or code review.

## Parameters

| Parameter   | Required | Description                        | Example        |
| ----------- | -------- | ---------------------------------- | -------------- |
| `ARGUMENTS` | No       | Plan content or summary to review. | `Plan summary` |

## Output

- Fixed output: Decision clarity check / Assumptions & gaps / Risk signals / Review questions.
- Example output structure:

```text
### Decision clarity check
- ...

### Assumptions & gaps
- ...

### Risk signals
- ...

### Review questions
- ...
```

## Full Examples

```text
/plan-review
Review this plan summary: ...
```

```text
/plan-review
Paste plan content here.
```

```text
/plan-review
Provide an alternative plan.
```

## Incorrect Usage / Anti-patterns

- Proposing alternatives or new requirements.
- Using should/recommend/solution wording.

## Comparison with Similar Commands

- `/explore-review` is for general input review.
- `/review-only` targets code review, not plans.
