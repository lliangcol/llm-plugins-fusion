# /nova-plugin:plan-review

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
/nova-plugin:plan-review
Review this plan summary: ...
```

```text
/nova-plugin:plan-review
Paste plan content here.
```

```text
/nova-plugin:plan-review
Provide an alternative plan.
```

## Incorrect Usage / Anti-patterns

- Proposing alternatives or new requirements.
- Using should/recommend/solution wording.

## Comparison with Similar Commands

- `/nova-plugin:explore-review` is for general input review.
- `/nova-plugin:review-only` targets code review, not plans.
