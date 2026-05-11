# Archive Context Measurement Record - 2026-05-12

Status: pending measurement; keep archive in place
Date: 2026-05-12

This record applies the procedure in
[archive-context-measurement.md](archive-context-measurement.md) to the current
unattended optimization pass. Claude Code `/context` was not run, so no token
reduction claim is made.

## Measurement Record

```text
Date: 2026-05-12
Evaluator: pending manual Claude Code evaluator
Claude Code version: pending
Target commit: pending; record `git rev-parse HEAD` when measurement is actually run
Exact tag: none; local v2.2.0 tag not present
Before path: .claude/agents/archive/
After path tested: not tested
Before custom agent tokens: pending
After custom agent tokens: pending
Token reduction: pending
Validation commands: pending; required only after a proposed move
Broken references found: not measured
Decision: keep
Reason: no `/context` measurement exists; archive movement is not justified by suspicion alone
Follow-up: run the documented before/after measurement in a disposable branch before proposing any archive move
```

## Current Decision

```text
Archive movement: deferred
Active agent set: exactly six files under nova-plugin/agents/
Archive policy: keep .claude/agents/archive/ in place
Release impact: none unless a measured archive movement is proposed
```

Do not move `.claude/agents/archive/` until a completed measurement shows
material token reduction and all references are updated in the same change.
