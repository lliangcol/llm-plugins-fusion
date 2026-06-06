# Assets

Status: active
Date: 2026-06-02

This directory holds public-safe visual assets and capture guidance for
`llm-plugins-fusion`. Assets should help a first-time visitor understand the
workflow quickly without exposing private consumer context.

## Current Assets

| Asset | Purpose |
| --- | --- |
| [social-preview-1280x640.png](social-preview-1280x640.png) | GitHub social preview candidate for repository settings upload. |

No demo GIF is currently tracked. Do not link GIFs from README or release notes
until the actual files exist.

Before adding a demo GIF or short video to public docs, the captured run must
have matching command evidence from `npm run doctor`, `npm run
validate:workflow`, or an equivalent release record. Do not present a mock
terminal session as product evidence.

## Social Preview Requirements

- Size: `1280x640`.
- Format: PNG.
- Target file size: below 1 MB.
- Text: `LLM Plugins Fusion`, `nova-plugin`, and `Explore -> Plan -> Review -> Implement -> Finalize`.
- Layout: large product name, one-line value proposition, five-stage workflow
  ribbon, small trust line for validation-aware public workflow guidance.
- Colors: dark neutral background, white primary text, blue workflow accent,
  green validation accent. Avoid a single-hue palette.
- Upload: GitHub repository `Settings` -> `General` -> `Social preview` -> upload
  `docs/assets/social-preview-1280x640.png`.

## Demo Capture Storyboard

Use real terminal output from a public-safe environment. Do not create fake GIFs
or mock command results.

### Install And Route

1. Show `/plugin marketplace add lliangcol/llm-plugins-fusion`.
2. Show `/plugin install nova-plugin@llm-plugins-fusion`.
3. Show `/plugin` listing enough context to confirm installation.
4. Show `/route` with a redacted task and the recommended next workflow step.

### Review Workflow

1. Start from a redacted diff, fixture, or public example.
2. Run `/review LEVEL=standard`.
3. Show severity-ranked findings.
4. Show validation expectations and skipped-check wording when applicable.

### Release And Docs

1. Show a docs/release task summary.
2. Run `/route`, then the recommended command.
3. Show docs validation output and `git diff --check`.
4. Close on final handoff with changed files, validation, skipped checks, and
   manual GitHub UI actions.

## Capture Acceptance Checklist

- Use an exact release tag for installation demos, or label the capture as a
  development snapshot.
- Run `npm run doctor` in the repository before capture and record warnings.
- Use `fixtures/workflow/invoice-sync/` or another public-safe fixture for
  workflow demonstrations.
- If Bash checks are skipped on Windows, show the skipped status explicitly and
  cite CI/Linux evidence for release promotion.
- Keep the final GIF, source recording notes, and transcript reviewable before
  linking from README or release notes.

## Privacy Boundary

Do not capture private consumer project names, local paths, endpoints,
credentials, repository addresses, runtime flags, business rules, customer data,
private screenshots, or private knowledge-base content. Use public fixtures,
redacted examples, or a clean demo repository.
