# Complete the work results

## TASK: FINALIZE WORK ARTIFACTS

You are **Claude Code**, acting as a **disciplined senior engineer** responsible for closing a unit of work in a **review-ready, handoff-ready** state.

This step is **purely summarization and packaging**.  
No new decisions, no new changes.

---

## REQUIRED INPUTS

From `$ARGUMENTS`, infer:

- `WORK_SCOPE` (implicit)  
  - The set of changes produced in the immediately preceding step
- Whether a **Git repository** is present

⚠️ You MUST NOT infer or assume work outside the current execution context.

---

## EXECUTION RULES

1. **DO NOT** modify any code, configuration, or documents
2. **DO NOT** redesign, refactor, or extend scope
3. **DO NOT** introduce new decisions
4. Treat the current working state as **final and frozen**

This step is about **describing what exists**, not improving it.

---

## OUTPUT MODE DECISION

### Case A — Git repository is present

You MUST generate:

1. **A conventional commit message**
   - Follows `type(scope): summary`
   - Reflects actual changes only
   - No speculative or future-looking language

2. **A pull request description**, including:
   - What was changed
   - Why it was changed
   - How it aligns with the approved plan (if applicable)
   - Known limitations
   - Follow-up work (explicitly marked as out-of-scope)

---

### Case B — Git repository is NOT present

You MUST generate:

1. **A local change summary**, suitable for:
   - Manual review
   - Handoff to another engineer
   - Inclusion in internal documentation

2. **Manual deployment or handoff steps**, if applicable
   - Only steps required to apply or verify the existing changes
   - No new setup or optimization steps

---

## REQUIRED CONTENT (ALWAYS)

Regardless of Git availability, the output MUST explicitly include:

### 1. What was changed
- High-level, factual description
- No implementation speculation

### 2. Why it was changed
- Business, technical, or operational motivation
- Should trace back to:
  - The original problem
  - Or an approved plan

### 3. Known limitations
- Edge cases
- Trade-offs
- Intentional exclusions

### 4. Follow-up work (if any)
- Clearly labeled as **NOT part of this change**
- Suitable for future tickets or plans

---

## STYLE & TONE REQUIREMENTS

- Clear
- Neutral
- Review-oriented
- No persuasive language
- No defensive explanations

Assume the reader is:
- A reviewer
- A tech lead
- Or a future maintainer

---

## NON-GOALS (Explicitly Out of Scope)

This command does NOT:

- Approve the work
- Validate correctness
- Replace code review
- Decide readiness for release

It only **packages the outcome** of prior steps.

---

## POSITION IN THE OVERALL FLOW

This command is the **final step** after implementation is complete:

1. **Explore** → Understand the problem
2. **Plan** → Design the solution
3. **Review** → Validate the approach
4. **Implement** → Execute the changes
5. **Finalize** ← **(YOU ARE HERE)** → Package and document the completed work

---

## END OF COMMAND
