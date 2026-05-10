# Frontend Consumer Template

This is a redacted template for a private frontend application. Copy the shape
into the consumer's private `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private
documentation, then fill in local details there.

Do not replace placeholders with real private values in this public repository.

## Project Type

- Private frontend application.
- Uses `nova-plugin` as a workflow framework for exploration, planning, review,
  implementation, and handoff.
- Keeps product-specific UI rules in the consumer project.

## Rules Source

- Treat project-local `AGENTS.md` / `CLAUDE.md` as the source of truth.
- Treat private design system docs, product rules, screenshots, and QA notes as
  authoritative only when they are present in the consumer workspace.
- Public `nova-plugin` docs provide generic workflow and pack guidance only.

## Tech Stack

Fill this in privately:

- Frontend framework:
- Language and type system:
- Package manager:
- Build and preview commands:
- Test runner:
- Component library or design system:
- Routing and state management approach:

Keep public examples at the family level. Do not publish private route names,
feature names, environment names, network endpoints, repository addresses,
credentials, or configuration values.

## Default Workflow

Routine frontend changes should prefer:

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

Use stricter review or verification when a change affects shared components,
routing, forms, state management, accessibility, visual regressions, or release
flows.

## Default Validation Commands

Define concrete commands in the private consumer profile. Generic examples:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

If the project uses a different package manager, preview server, browser setup,
or private test environment, document that privately and do not publish the
concrete invocation here.

## High-Risk Change Categories

- Design system or shared component changes.
- Routing boundaries, guards, or navigation state.
- Form validation, submit behavior, or error handling.
- State management, caching, or optimistic updates.
- Loading, error, and empty states.
- Accessibility, keyboard navigation, focus management, or labels.
- Responsive layouts, overflow, and visual regressions.
- Build, dependency, or environment-sensitive configuration.

## Capability Packs

Recommended packs:

- `frontend`
- `security`
- `dependency`
- `docs`
- `release`

Use project-local rules to decide whether Java, marketplace, or MCP packs also
apply.

## Out-of-Scope Boundaries

- Do not infer private product workflows from public examples.
- Do not copy private route names, feature names, local paths, repository
  addresses, network endpoints, environment values, credentials, or private
  design docs into public artifacts.
- Do not introduce new frontend stacks, dependencies, or public portal work
  unless the private project source of truth explicitly asks for them.
- Do not change command or skill behavior from this template; it only guides
  project-local profile authoring.

## Handoff Expectations

Frontend handoff should include:

- Files changed and why.
- Validation commands run and exact skipped reasons.
- Design system, responsive layout, state management, forms, loading/error/empty
  states, accessibility, routing, component structure, and visual verification
  checks that apply.
- Screenshots or Playwright evidence when available in the private project.
- Remaining risks and owner decisions needed before merge.
