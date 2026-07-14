# Minimal consumer profile walkthrough

This tutorial reads the existing `fixtures/consumer/minimal` fixture; it does not create a second consumer fixture or write user-scoped configuration.

1. Inspect `fixtures/consumer/minimal/AGENTS.md` for the public-safe profile boundary.
2. Inspect the assistant manifest consumed by the fixture and compare enhanced versus fallback routing.
3. Run `node scripts/validate-adapter-conformance.mjs`.
4. Confirm the result reports the consumer fixture separately from Claude, Codex, and generic adapters.

Acceptance is semantic: the fixture remains public-safe, the manifest is reused, and unavailable assistant runtimes are not reported as live evidence. Cleanup is unnecessary because this path is read-only.
