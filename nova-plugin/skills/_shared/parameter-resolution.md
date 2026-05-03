# Shared Parameter Resolution

This file is the common parameter policy for nova-plugin skills. Individual
skills may narrow the accepted parameters, but they should not contradict this
policy.

## Input Forms

Accept these equivalent forms when a skill exposes the same parameter:

```text
/review strict src/payment
/review LEVEL=strict INPUT=src/payment
/review --level strict --input src/payment
```

## Resolution Order

1. Parse explicit `KEY=value` tokens first. Keys are case-insensitive on input
   and normalized to the uppercase names documented by the skill.
2. Parse `--flag value` and `--flag=value` tokens next. Normalize dash-case
   flag names to uppercase snake case, for example `--plan-output-path` becomes
   `PLAN_OUTPUT_PATH`.
3. Parse known mode words and aliases, such as `lite`, `standard`, `strict`,
   `deep`, `staged`, `full`, `approved`, `general`, and `java-backend`.
4. Treat remaining natural-language text as the primary payload parameter for
   the skill, such as `INPUT`, `TASK`, `PLAN_INTENT`, `EXECUTION_BASIS`, or
   `WORK_SCOPE`.
5. Apply documented defaults only when they are unambiguous.
6. Probe environment context only for context parameters, such as Git base
   branch, current status, unique latest artifacts, or existing plan/review
   files.
7. Classify unresolved parameters as optional, required payload, or safety
   boundary before executing.

## Parameter Classes

| Class | Policy | Examples |
| --- | --- | --- |
| Payload | Infer from remaining natural language when clear. | `INPUT`, `TASK`, `PLAN_INTENT`, `WORK_SCOPE` |
| Mode | Infer from known mode words or apply documented defaults. | `LEVEL`, `DEPTH`, `PLAN_PROFILE`, `REVIEW_MODE` |
| Context | Detect from environment when safe; otherwise leave unset. | `BASE`, `CHECKS_FILE`, `ANALYSIS_INPUTS` |
| Safety boundary | Require explicit value or confirmation before side effects. | `PLAN_OUTPUT_PATH`, `PLAN_INPUT_PATH`, `PLAN_APPROVED`, `REVIEW_FILE`, `EXPORT_PATH` |

## Defaults

Use defaults only when the skill documents them. Common defaults:

- `LEVEL=standard`
- `PERSPECTIVE=observer`
- `DEPTH=normal`
- `PLAN_PROFILE=general`
- `REVIEW_MODE=branch`
- `MODE=standard` or `MODE=full`, when documented by the skill
- `FIX_SCOPE=high-confidence`

Never invent output paths, approval flags, review files, or plan input files as
silent defaults.

## Non-Interactive Mode

If `NON_INTERACTIVE=true` or `--non-interactive` is present:

- Do not ask follow-up questions.
- Do not infer safety-boundary values.
- Fail before side effects if required or safety-boundary parameters are
  missing.
- Report the missing parameter names and the accepted input forms.

## Conflict Handling

When explicit values conflict, prefer the most explicit later value only if it
is in the same input form and clearly intentional. Otherwise stop before side
effects and report the conflict.

Examples:

- `LEVEL=strict --level lite` is a conflict unless the skill says flag values
  override `KEY=value`.
- `PLAN_PROFILE=general java-backend` is a conflict.
- `PLAN_APPROVED=true approved` is not a conflict.
