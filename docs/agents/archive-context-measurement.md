# Archive Context Measurement

Status: active template
Date: 2026-05-10

Legacy agents are archived under `.claude/agents/archive/`. They are not active
agents, but they may still create token pressure if a Claude Code environment
loads `.claude/**` broadly.

Do not move the archive based on suspicion alone. Archive movement is justified
only after `/context` measurement shows material token reduction and the
repository references are updated safely.

## Measurement Procedure

1. Start from a clean worktree.
2. In Claude Code, run `/context` and record the custom agent token count.
3. In a throwaway branch or local test copy, move:

```text
.claude/agents/archive/
```

to a less-scanned path such as:

```text
.claude/agents-archive/
```

4. Restart or refresh Claude Code if it caches agent inventory, then run
   `/context` again in the same environment.
5. Record the before and after token counts.
6. Run repository validation after any proposed permanent move.

## Decision Rules

- If custom agent tokens drop by at least 50 percent and no active routing
  reference breaks, archive movement may be proposed.
- If the token drop is below 50 percent, keep the archive where it is and record
  the result.
- If any active doc, script, or migration manifest would point to stale paths,
  update those references in the same change.
- Never treat archived agents as part of the active `nova-plugin/agents/` set.

## Record Template

```text
Date:
Evaluator:
Claude Code version:
Target commit:
Exact tag:
Before path:
After path tested:
Before custom agent tokens:
After custom agent tokens:
Token reduction:
Validation commands:
Broken references found:
Decision: move / keep / retest
Reason:
Follow-up:
```

## Current Policy

Until a completed measurement record exists, keep the archive in place. The
active agent set remains exactly the six files under `nova-plugin/agents/`.
