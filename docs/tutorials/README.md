<!-- migrated-from: docs/examples/README.md -->
# Redacted Examples

This directory contains public-safe examples for applying `nova-plugin` to
consumer projects. Examples must use fictional or generic scenarios only.

Do not add examples that reveal a closed-source consumer's real name, private
project names, private paths, private identifiers, private repository addresses,
configuration values, network endpoints, credentials, runtime flags, private
knowledge base content, or real project workflow details.

## Examples

| Example | Purpose |
| --- | --- |
| [workflow-evaluation.md](workflow-evaluation.md) | Five-stage workflow evaluation examples and review rubrics. |
| [workflow-evaluation-record-template.md](../templates/evidence/workflow-evaluation.md) | Manual record template for release or promotion workflow-quality evidence. |
| [java-backend/redacted-feature.md](java-backend.md) | Generic Java/Spring backend workflow example. |
| [frontend/basic-feature.md](frontend.md) | Generic frontend feature workflow example. |

## Headless Demo Fixtures

The deterministic demo path uses [fixtures/demo/](../../fixtures/demo) and can
be run without Claude Code, Codex CLI, marketplace installation, network access,
or private consumer context:

```bash
npm run demo:route
npm run demo:review
```

The output shows expected route, review, and verification signals. It is a
public-safe fixture demonstration, not an LLM execution or golden-output test.

<!-- merged-from: docs/showcase/README.md -->
<details>
<summary>Migrated source: docs/showcase/README.md</summary>

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

</details>
