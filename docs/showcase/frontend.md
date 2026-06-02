# Frontend Showcase

Status: active
Date: 2026-06-02

## Problem

A frontend task can look small while still touching routing, state, loading
behavior, empty states, accessibility, responsive layout, and screenshot
validation. A direct edit can create regressions that static review misses.

## Recommended nova workflow

```text
/route -> /explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

- Use `/route` to decide whether the task starts as exploration, plan, review,
  or implementation.
- Use `/explore` to inspect component structure, state ownership, API contracts,
  design-system conventions, and validation gates.
- Use `/produce-plan` to define UI states and screenshot/browser checks before
  editing.
- Use `/review` to catch behavior, accessibility, layout, and validation gaps.
- Use `/implement-plan` after approval.
- Use `/finalize-work` to record screenshots, checks, limitations, and follow-up
  UI risks.

## Example command

```text
/route A frontend task needs a new table action, disabled states, empty/loading/error handling, and screenshot validation. Recommend the next nova workflow step and validation.
```

If `/route` recommends planning after facts are known:

```text
/produce-plan PLAN_INTENT="Plan a scoped frontend change with component, state, accessibility, responsive layout, and screenshot validation evidence."
```

## Expected output evidence

- Component and route facts, including where state and API calls are owned.
- UI state matrix for default, loading, empty, error, disabled, and success
  states.
- Accessibility and keyboard/focus considerations when actions or controls are
  added.
- Validation plan covering static checks plus browser or screenshot evidence
  when the UI can run locally.
- Final handoff with changed files, screenshots or reasons screenshots were
  skipped, checks run, and residual risk.

## Validation

Use the consumer project's real frontend gates, such as targeted lint, type
checks, unit tests, component tests, Playwright/browser screenshots, or visual
regression checks. If a browser cannot run, report screenshot validation as
skipped and explain the environment blocker.

## Private context boundary

Do not publish real product names, routes, API hosts, customer data, feature
flags, analytics keys, business rules, private design tokens, or screenshots
that expose non-public product state. Public examples should use generic
component and route names.
