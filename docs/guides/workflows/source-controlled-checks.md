<!-- migrated-from: docs/workflows/source-controlled-checks.md -->
# Source-Controlled Workflow Checks

Status: active design note
Date: 2026-06-07

This note defines how `llm-plugins-fusion` can adopt source-controlled AI
workflow checks without turning the public repository into a mature multi-plugin
platform or a custom CI product.

The near-term implementation is the workflow fixture validator:

```bash
node scripts/validate-workflow-fixtures.mjs
```

That validator checks public-safe fixture contracts and expected failure
signals. It does not execute Claude Code slash commands and does not replace
manual workflow-quality records.

For a no-credential demonstration of the same public-safe boundaries, use:

```bash
npm run demo:route
npm run demo:review
```

These scripts read `fixtures/demo/*.json` and print expected route, review, and
verification signals. They do not call Claude Code, Codex, network tools,
marketplace installation, or private consumer workspaces.

## Why This Exists

High-signal AI engineering projects increasingly keep review rules, workflow
expectations, and quality checks in source control so CI and local agents can
inspect the same contract. For this repository, the useful part is not a new
runtime. The useful part is making workflow expectations reviewable, repeatable,
and public-safe.

## Current Contract

| Surface | Role |
| --- | --- |
| `fixtures/demo/` | Public-safe headless demo inputs for route, review, and verification signals. |
| `fixtures/workflow/invoice-sync/` | Public-safe scenario inputs and approved plan. |
| `docs/examples/workflow-evaluation.md` | Manual rubric for five primary commands. |
| `docs/examples/workflow-evaluation-record-template.md` | Human record for output-quality evidence. |
| `scripts/demo-route.mjs`, `scripts/demo-review.mjs` | Deterministic local demos that print expected fixture signals without LLM execution. |
| `scripts/validate-workflow-fixtures.mjs` | Deterministic fixture integrity and expected-signal check. |
| `docs/releases/release-validation-runbook.md` | Promotion rule that separates automated fixture checks from manual quality evidence. |

## Future `.nova/checks` Boundary

A future `.nova/checks/` or `nova-plugin/checks/` directory is appropriate only
after at least two checks repeat across releases or consumer projects.

If introduced, each check should be plain text or JSON/YAML with:

- `id`
- `scope`
- `applies_to`
- `inputs`
- `expected_signals`
- `failure_signals`
- `validation_command`
- `manual_evidence_required`
- `privacy_boundary`

Checks must not include private consumer names, local paths, endpoints,
credentials, repository addresses, runtime flags, business rules, or private
knowledge-base content.

## Placement Rule

| Need | Put it here |
| --- | --- |
| Exact schema, file presence, fixture signal, generated-output drift | Script or validator |
| Review judgment, planning quality, handoff quality, skipped-check honesty | Rubric or skill text |
| Consumer-specific commands, project paths, dashboards, business rules | Consumer project profile or private workbench |
| Public example inputs and fictional defects | `fixtures/` and `docs/examples/` |

Do not add a new runtime or CI layer when a deterministic script plus rubric is
enough.

## Validation

For changes to public workflow checks or fixtures:

```bash
node scripts/validate-workflow-fixtures.mjs
npm run demo:route
npm run demo:review
node scripts/validate-docs.mjs
git diff --check
```

For release-facing changes, use:

```bash
npm run validate:maintainer
```
