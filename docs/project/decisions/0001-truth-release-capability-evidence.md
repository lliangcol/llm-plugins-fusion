<!-- migrated-from: docs/adr/0001-truth-release-capability-evidence.md -->
# ADR 0001: Derive Public Claims From Machine Evidence

Status: accepted
Date: 2026-07-12

## Context

Repository validators could remain green while protecting stale prose; stable
tags also carried the first complete release orchestration run. Capability
booleans conflated runtime need with authorization, and static adapter manifests
could overstate compatibility after source drift.

## Decision

- Aggregate version, runtime, inventory, workflow, lane, hook, and release facts
  into generated project state and generated Markdown blocks.
- Build immutable release candidates first, then promote the same commit and
  artifact digests to stable without rebuilding.
- Separate runtime requirements, permission policy, and assistant enforcement.
- Treat static adapter levels as baselines/maxima; derive effective L3/L4 claims
  only from digest-bound evidence.
- Keep `nova-plugin/` stable in 3.x while extracting an assistant-neutral kernel.

## Consequences

Generated state and evidence must be refreshed after source changes. Historical
live runs remain useful but automatically lose current-claim status. Branch
protection can bind one aggregate check while retaining structured lane evidence.
A production multi-plugin layout remains deferred until a second independent
plugin instance proves the generic contracts.
