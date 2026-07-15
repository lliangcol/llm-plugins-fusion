# ADR 0002: CLI and Extension Direction

Status: accepted
Date: 2026-07-14

## Context

The engineering-risk report suggested learning from Continue, Cline, Roo Code,
and Codex CLI. External product facts change quickly, so this decision uses the
projects' official repositories and documentation as checked on the decision
date:

- [Continue](https://github.com/continuedev/continue) documents an Apache-2.0
  `cn` CLI and source-controlled AI checks.
- [Cline](https://github.com/cline/cline) documents an Apache-2.0 CLI, SDK,
  plugin hooks, MCP, headless JSON flows, and multi-agent surfaces.
- [Roo Code](https://github.com/RooCodeInc/Roo-Code) states that its extension
  shut down on 2026-05-15; it is not treated as an active delivery benchmark.
- [Codex CLI](https://github.com/openai/codex) documents Apache-2.0 terminal,
  IDE, MCP-client, and experimental MCP-server surfaces.

This repository already contains the private workspace package
`packages/cli`, exposed locally as `llmf`. It supports `init`, `validate`,
`build`, `test`, `eval`, `doctor`, `inspect`, and `migrate`; it is not an
independently published public CLI. Claude marketplace metadata remains the
production distribution mechanism. Capability packs remain documentation and
routing context, while `runtime-dynamic-loading` is deferred.

## Decision

| Proposal | Disposition | Reason and activation condition |
| --- | --- | --- |
| Terminal-first preview, validation, build, test, and JSON output | `adopt` | Continue the existing `llmf` workspace rather than creating a parallel CLI. Keep deterministic commands and stable exit codes. |
| Source-controlled assistant checks in ordinary PR CI | `experiment` | Evaluate only as a non-required, public-safe evidence lane after an owner, cost ceiling, credential model, and false-positive policy exist. Deterministic full validation remains authoritative. |
| Multiple assistant/IDE entry points | `experiment` | Continue adapter and conformance work without claiming equal runtime enforcement. Add a production entry point only with versioned evidence and an owner. |
| Role-oriented routing and modes | `adopt` | The current route command, six core agents, workflow stages, and capability packs already provide this UX without adding runtime modules. |
| MCP client/server integration | `experiment` | Use assistant adapters or consumer configuration first. Do not embed an MCP runtime in the plugin without a threat model and compatibility evidence. |
| Public SDK | `defer` | Framework workspace packages are private. Activate only after repeated external integration demand, API stability, semantic-versioning ownership, and support capacity. |
| Independently distributed public `llmf` binary/package | `defer` | Requires installation support, signed release artifacts, cross-platform packaging, telemetry/privacy decisions, and a maintainer owner. Marketplace delivery remains primary. |
| Runtime-dynamic capability-pack loading or a plugin marketplace inside Nova | `reject` for this remediation | It expands the threat model and contradicts the deferred product lane. Reconsider only with repeated demand, an owner, version compatibility, rollback, and security review. |
| Broad multilingual documentation expansion | `defer` | Add languages only with a translation owner and generated drift strategy; do not create stale parallel documentation by default. |
| Roo Code as a current maintenance/feature benchmark | `reject` | The official repository records shutdown. Historical role/mode ideas may remain design input but not a current compatibility claim. |

## Consequences

- No production plugin layout, capability-pack runtime, command inventory, or
  release channel changes are authorized by this ADR.
- `llmf` remains a private preview CLI; documentation must not present it as a
  published binary or mature SDK.
- Experiments must be separately planned and cannot weaken full deterministic
  validation, least privilege, isolated credentials, or source-controlled
  evidence boundaries.
- Any future lane activation requires an updated product-lane decision and a
  dedicated execution plan rather than being bundled into risk remediation.
