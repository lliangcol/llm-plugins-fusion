<!-- migrated-from: docs/examples/frontend/basic-feature.md -->
# Basic Frontend Feature Example

This example uses a fictional frontend feature. It is safe for the public
repository and does not describe a real consumer, private route, private
component, real path, configuration values, or private product workflow.

## User Request

Add a generic settings panel to a private frontend application. The panel should
display a redacted preference value, allow editing through a validated form, and
show loading, error, and empty states.

## Recommended Nova Workflow

```text
/nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

Use screenshot or Playwright verification when the private project already has
browser tooling available.

## Project Rules to Read

- Project-local `AGENTS.md` / `CLAUDE.md`.
- Private design system and component guidelines, if present in the workspace.
- Existing route, state, form, and test patterns in the affected area.
- Local validation commands from the consumer profile.

## Expected Artifacts

- Exploration notes identifying the existing component and routing patterns.
- Implementation plan with state, form validation, accessibility, and visual QA
  coverage.
- Code changes in the private consumer repository only.
- Test, build, screenshot, or Playwright evidence when available.
- Final handoff with skipped checks and residual risks.

## Suggested Validation Commands

Use the private consumer profile first. Generic examples:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Do not publish private package scripts, network endpoints, environment values,
repository addresses, or product-specific route names in public docs.

## High-Risk Checks

- Design system consistency: reuse established components and tokens.
- Responsive layout: confirm no overflow or overlap across supported viewports.
- State management: keep local, shared, cached, or server state boundaries clear.
- Forms and validation: cover valid input, invalid input, submit, and reset
  behavior.
- Loading / error / empty states: make every async state explicit.
- Accessibility: check labels, focus order, keyboard operation, and semantic
  structure.
- Routing boundaries: avoid leaking private route assumptions into shared code.
- Component structure: keep shared components generic and feature components
  scoped.
- Playwright or screenshot verification: capture evidence when available.

## Handoff Format

```markdown
Status:
Summary:
Files:
Validation:
Visual verification:
Skipped:
High-risk checks:
Risks:
Next steps:
```

<!-- merged-from: docs/showcase/frontend.md -->
<details>
<summary>Migrated source: docs/showcase/frontend.md</summary>

# Frontend Showcase

Status: active
Date: 2026-06-02

## Problem

A frontend task can look small while still touching routing, state, loading
behavior, empty states, accessibility, responsive layout, and screenshot
validation. A direct edit can create regressions that static review misses.

## Recommended nova workflow

```text
/nova-plugin:route -> /nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

- Use `/nova-plugin:route` to decide whether the task starts as exploration, plan, review,
  or implementation.
- Use `/nova-plugin:explore` to inspect component structure, state ownership, API contracts,
  design-system conventions, and validation gates.
- Use `/nova-plugin:produce-plan` to define UI states and screenshot/browser checks before
  editing.
- Use `/nova-plugin:review` to catch behavior, accessibility, layout, and validation gaps.
- Use `/nova-plugin:implement-plan` after approval.
- Use `/nova-plugin:finalize-work` to record screenshots, checks, limitations, and follow-up
  UI risks.

## Example command

```text
/nova-plugin:route A frontend task needs a new table action, disabled states, empty/loading/error handling, and screenshot validation. Recommend the next nova workflow step and validation.
```

If `/nova-plugin:route` recommends planning after facts are known:

```text
/nova-plugin:produce-plan PLAN_INTENT="Plan a scoped frontend change with component, state, accessibility, responsive layout, and screenshot validation evidence."
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

</details>
