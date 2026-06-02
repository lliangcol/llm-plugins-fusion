# Showcase

Status: active
Date: 2026-06-02

These showcase pages turn the `nova-plugin` workflow into concrete public-safe
entry points. They are intentionally scenario-based: visitors should understand
the problem, the recommended nova workflow, expected evidence, validation, and
private context boundary without reading the whole architecture first.

## Scenarios

| Scenario | Use when | Entry |
| --- | --- | --- |
| Java backend | A backend change needs scoped exploration, plan review, implementation, and test evidence. | [java-backend.md](java-backend.md) |
| Frontend | A UI change needs component, state, accessibility, and screenshot validation boundaries. | [frontend.md](frontend.md) |
| Release and docs | A release, changelog, or documentation update needs evidence and public-safe wording. | [release-and-docs.md](release-and-docs.md) |

## Maintenance Rules

- Keep examples generic and redacted.
- Do not publish real consumer profiles, endpoints, credentials, private
  repository addresses, runtime flags, business rules, or private
  knowledge-base content.
- Keep every page in the same structure: Problem, Recommended nova workflow,
  Example command, Expected output evidence, Validation, Private context
  boundary.
- Link only to files that exist in this repository.
