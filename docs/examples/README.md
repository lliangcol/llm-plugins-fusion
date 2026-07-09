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
| [workflow-evaluation-record-template.md](workflow-evaluation-record-template.md) | Manual record template for release or promotion workflow-quality evidence. |
| [java-backend/redacted-feature.md](java-backend/redacted-feature.md) | Generic Java/Spring backend workflow example. |
| [frontend/basic-feature.md](frontend/basic-feature.md) | Generic frontend feature workflow example. |

## Headless Demo Fixtures

The deterministic demo path uses [fixtures/demo/](../../fixtures/demo/) and can
be run without Claude Code, Codex CLI, marketplace installation, network access,
or private consumer context:

```bash
npm run demo:route
npm run demo:review
```

The output shows expected route, review, and verification signals. It is a
public-safe fixture demonstration, not an LLM execution or golden-output test.
