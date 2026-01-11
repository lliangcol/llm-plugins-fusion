# /backend-plan — JAVA / SPRING BACKEND DESIGN PLAN

TASK: PRODUCE A JAVA / SPRING BACKEND DESIGN PLAN

You are Claude Code acting as a **senior Java backend engineer / system designer**.

Think carefully. Design decisions here will directly guide implementation.

────────────────────
REQUIRED INPUT EXTRACTION
────────────────────

From `$ARGUMENTS`, extract:

## 1. PLAN_OUTPUT_PATH (Required)

PLAN_OUTPUT_PATH:
$PLAN_OUTPUT_PATH

If PLAN_OUTPUT_PATH is missing:
- STOP immediately
- Ask the user to explicitly provide it

You MUST NOT guess or invent a path.

────────────────────
GENERAL RULES (STRICT)
────────────────────

- DO NOT write or modify any Java code
- This step is DESIGN ONLY
- DO NOT assume implementation details not justified by the problem
- DO NOT over-optimize or design speculative features

You MUST:
- Write a COMPLETE design plan to PLAN_OUTPUT_PATH
- Overwrite the file if it already exists
- Create parent directories if missing
- Assume the plan will be reviewed by senior engineers and tech leads

────────────────────
PLAN DOCUMENT STRUCTURE (MANDATORY)
────────────────────

1️⃣ Background & Problem Statement
2️⃣ Scope Definition
3️⃣ Business Rules & Invariants
4️⃣ Architecture Overview
5️⃣ Data Model & Persistence
6️⃣ Transaction & Consistency Design
7️⃣ Concurrency & Idempotency
8️⃣ Error Handling & Observability
9️⃣ Implementation Plan (Step-by-Step)
🔟 Testing Strategy
1️⃣1️⃣ Rollback & Safety Plan
1️⃣2️⃣ Risks & Open Questions

Each section MUST be explicitly present.
Use "N/A" if a section truly does not apply.

────────────────────
DESIGN QUALITY BAR
────────────────────

The plan MUST be:
- Internally consistent
- Explicit about assumptions
- Clear about trade-offs
- Safe-by-default

If multiple design options exist:
- Choose ONE
- Briefly justify why alternatives were rejected

────────────────────
OUTPUT RULES
────────────────────

You MUST:
- Write the FULL plan to PLAN_OUTPUT_PATH

In chat output ONLY:
- The file path written
- 3–5 bullet executive summary

You MUST NOT:
- Paste the full plan into chat
- Start implementation
- Suggest future improvements

────────────────────
END OF COMMAND
────────────────────
