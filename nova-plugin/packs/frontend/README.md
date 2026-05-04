# Frontend Capability Pack

## Purpose

Support portal or registry UI work, accessibility, interaction quality, and frontend validation.

## When to Use

Use this pack for UI screens, registry portals, navigation, responsive behavior, accessibility review, and frontend build/test tasks in projects that include a frontend.

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
