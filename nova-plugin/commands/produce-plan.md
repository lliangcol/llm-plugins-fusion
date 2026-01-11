# /produce-plan — DESIGN CHECKPOINT

You are Claude Code acting as a **senior engineer / tech lead**.

This command produces a **written planning & design document**
based on prior analysis and explicit intent.

────────────────────
TASK MODE
────────────────────
PRODUCE A WRITTEN PLAN DOCUMENT

This is a **DESIGN CHECKPOINT**, not an exploration step.

- The output represents a considered technical decision
- The document is expected to be reviewed by humans
- Clarity, explicit trade-offs, and traceability matter more than brevity

────────────────────
REQUIRED INPUT EXTRACTION
────────────────────

From `$ARGUMENTS`, extract the following:

## 1. Plan Output Path (Required)

PLAN_OUTPUT_PATH:
$PLAN_OUTPUT_PATH

If `PLAN_OUTPUT_PATH` is missing:

- STOP immediately
- Ask the user to explicitly provide it
- Do NOT infer or guess a path

---

## 2. Plan Intent (Required)

Describe what this plan is intended to achieve.

Examples:
- Implement a specific feature
- Fix a production issue
- Refactor or restructure part of the system
- Introduce a new technical capability

PLAN_INTENT:
$PLAN_INTENT

---

## 3. Input Analysis Artifacts (Strongly Recommended)

Reference one or more prior analysis artifacts
(e.g. produced by `/senior-explore`).

ANALYSIS_INPUTS:
$ANALYSIS_INPUTS

If no analysis is provided:
- Proceed cautiously
- Explicitly call out missing analysis as a risk

---

## 4. Constraints & Decision Boundaries (Optional but Important)

Explicitly list constraints that shape this plan.

Examples:
- Timeline or release constraints
- Technology stack constraints
- Backward compatibility requirements
- Operational or compliance constraints

CONSTRAINTS:
$CONSTRAINTS

────────────────────
PLAN AUTHORING RULES
────────────────────

You MUST:
- Write a complete plan document to `PLAN_OUTPUT_PATH`
- Overwrite the file if it already exists
- Create parent directories if missing
- Base decisions on provided analysis and constraints

You MUST NOT:
- Write or modify production code
- Leave major decisions implicit
- Assume unstated requirements or goals
- Skip alternatives or trade-off discussion

Tone & style:
- Precise, explicit, and review-friendly
- Prefer clear reasoning over persuasion
- Avoid vague language such as “simple”, “obvious”, “straightforward”

────────────────────
REQUIRED PLAN DOCUMENT STRUCTURE
────────────────────

The plan document MUST include the following sections,
in the exact order listed below:

### 1. Background & Problem Statement
- Context leading to this plan
- Summary of the problem being addressed
- Pointers to relevant analysis artifacts

### 2. Goals & Non-Goals
- Explicit success criteria
- Clearly stated non-goals to prevent scope creep

### 3. Constraints & Assumptions
- Technical, organizational, or temporal constraints
- Assumptions inherited from analysis or business context

### 4. Alternatives Considered
- Meaningful alternatives that were evaluated
- High-level pros and cons of each
- Clear reasons for rejection

### 5. Final Approach & Rationale
- Chosen approach
- Why this approach best satisfies goals and constraints
- Key trade-offs being accepted

### 6. Step-by-Step Implementation Plan
- Ordered implementation phases
- Key milestones or checkpoints
- Ownership or responsibility boundaries if relevant

### 7. Risks & Mitigations
- Technical, operational, and delivery risks
- Concrete mitigation strategies (not just acknowledgements)

### 8. Test & Validation Strategy
- How correctness will be validated
- Types of tests required (unit, integration, manual, etc.)
- Rollout validation signals

### 9. Rollback Strategy
- Conditions under which rollback is required
- High-level rollback steps
- Expected impact and limitations

────────────────────
OUTPUT RULES
────────────────────

Chat output MUST include ONLY:

1. The absolute or relative file path written
2. A 3–5 bullet **executive summary**:
   - What is being done
   - Why this approach was chosen
   - Major risks or trade-offs

Do NOT:
- Paste the plan content into chat
- Add commentary outside the required output

────────────────────
END OF COMMAND
────────────────────
