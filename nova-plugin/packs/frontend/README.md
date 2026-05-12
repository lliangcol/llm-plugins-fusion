# Frontend Capability Pack

## Purpose

Support frontend work in host projects, including portal or registry UI work
when such a frontend exists, plus accessibility, interaction quality, and
frontend validation.

## When to Use

Use this pack for UI screens, host-project registry portals, navigation,
responsive behavior, accessibility review, and frontend build/test tasks in
projects that include a frontend.

## Related Plugins

Optional enhancement: any frontend tooling already present in the host project. It is not a hard dependency of `nova-plugin`.

## Inputs

- Existing frontend stack and package metadata.
- Target user workflow and supported viewports.
- Accessibility requirements.
- Build, lint, test, and preview commands.

## Agent Routing

- `architect`: UI information architecture and interaction boundaries.
- `builder`: component or frontend implementation.
- `reviewer`: UX, accessibility, and maintainability review.
- `verifier`: build, lint, tests, and manual QA evidence.

## Workflow

1. Identify the existing frontend framework and design conventions.
2. Reuse established components and patterns.
3. Implement accessible, responsive behavior.
4. Verify with available build/test tools and manual QA notes.

## Key Checkpoints

- Design system consistency: reuse existing components, tokens, spacing, and
  interaction patterns.
- Responsive layout: verify supported desktop and mobile viewports for overflow,
  overlap, and layout shifts.
- State management: keep local, shared, cached, and server state boundaries
  explicit.
- Forms and validation: cover valid input, invalid input, submission, reset,
  and disabled states.
- Loading / error / empty states: make each asynchronous state visible and
  recoverable.
- Accessibility: check semantic structure, labels, focus order, keyboard
  operation, and contrast-sensitive states.
- Routing boundaries: keep route ownership, guards, and navigation side effects
  clear.
- Component structure: keep reusable components generic and feature-specific
  components scoped.
- Playwright or screenshot verification: capture browser evidence when tooling
  is available, especially for visual or responsive changes.

## Verification

- Run existing frontend lint, typecheck, build, or test commands.
- Check keyboard navigation and accessible names where relevant.
- Inspect responsive layouts for overflow and overlap.
- Record unavailable browser or visual QA tooling.

## Enhanced Mode

If the host project has frontend tools, use its existing stack, test runner, preview server, and accessibility tooling.

## Fallback Mode

Use existing project files, manual QA checklists, responsive reasoning, and documentation constraints.

## Failure Modes

- No frontend project exists in the workspace.
- Visual verification may require a browser or dev server.
- Design system conventions may be undocumented.
- Generated or external assets may be unavailable.
