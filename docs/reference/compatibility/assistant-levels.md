<!-- migrated-from: docs/compatibility/assistant-levels.md -->
# Assistant Compatibility Levels

Status: active

Compatibility claims are evidence-scoped:

| Level | Meaning | Required evidence |
| --- | --- | --- |
| L1 Parseable | The assistant can read the workflow Markdown or manifest. | Valid contract paths and schema. |
| L2 Invocable | The workflow has a stable assistant-specific invocation. | Adapter inventory and invocation test. |
| L3 Enforced | Inputs, safety preflight, capability limits, and output contracts are enforced or failures are explicit. | Adapter conformance suite and unsupported-capability fallback. |
| L4 Verified | A clean end-to-end run exists for an exact assistant version and repository commit. | Public-safe live record covering load, route, zero-write, approval blocking, output structure, and cleanup. |

The static declarations in `adapters/` contain only a declared baseline,
maximum supported level, and the levels that require evidence. Live records
belong in `evals/evidence/`; the generated current registry is
`governance/compatibility-evidence.generated.json`. Digest drift automatically
moves an observation to historical status and removes its L3/L4 current claim.

Claude marketplace metadata, hooks, and permission prompts are Claude-specific.
Codex and generic consumers must never imply that those controls are active.
Likewise, a local live run does not replace the exact-tag release gate.
