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
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
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
