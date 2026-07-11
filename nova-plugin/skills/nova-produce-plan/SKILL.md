---
name: nova-produce-plan
description: Write a formal plan document to file using general or java-backend profile; design checkpoint only.
license: MIT
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "false"
  nova-subagent-safe: "true"
  nova-destructive-actions: "low"
argument-hint: "Example: produce-plan PLAN_OUTPUT_PATH=docs/plans/refund.md PLAN_INTENT=Fix idempotency PLAN_PROFILE=general"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:produce-plan` and the deprecated `/nova-plugin:nova-produce-plan` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

- Resolve natural-language and explicit `KEY=value` inputs using `../_shared/parameter-resolution.md`; explicit non-conflicting values take precedence.
- Apply `../_shared/safety-preflight.md` before side effects. Never infer approval, destructive scope, credentials, or output destinations.
- Follow `../_shared/output-contracts.md` and `../_shared/artifact-policy.md`; report completed, skipped, and blocked validation truthfully.
- Respect the frontmatter tool boundary. Missing inputs, unavailable dependencies, overlapping user changes, or repository-policy conflicts are blockers rather than permission to broaden scope.

## Execution

1. Parse `$ARGUMENTS` against the workflow-specific inputs below.
2. Read only the context required for the requested scope.
3. Apply the workflow contract and its strict output format.
4. Stop before unauthorized side effects; otherwise validate in proportion to risk and report residual risk.

## Workflow Contract

### Purpose

Generate review-ready design/plan documentation based on intent and constraints.

### Inputs

| Parameter          | Required    | Default   | Notes                       | Example                     |
| ------------------ | ----------- | --------- | --------------------------- | --------------------------- |
| `PLAN_OUTPUT_PATH` | Yes         | N/A       | Output file path            | `docs/plans/refund.md`      |
| `PLAN_INTENT`      | Yes         | N/A       | Goal of this plan           | `Fix callback idempotency`  |
| `PLAN_PROFILE`     | No          | `general` | `general` or `java-backend` | `java-backend`              |
| `ANALYSIS_INPUTS`  | Recommended | N/A       | Prior analysis references   | `docs/analysis/callback.md` |
| `CONSTRAINTS`      | No          | N/A       | Boundaries                  | `Backward compatible`       |

### Outputs

- Writes full plan document to path (overwrite allowed, create parent dirs).
- Chat output only path + executive summary bullets.

### Workflow

1. Validate required fields.
2. Select profile template.
3. Produce complete plan with explicit trade-offs.
4. Write file and return constrained chat summary.

### Examples

- Natural trigger: `Use produce-plan to draft a formal plan for payment retry flow.`
- Explicit trigger: `produce-plan PLAN_OUTPUT_PATH=docs/plans/auth.md PLAN_INTENT=Unify auth chain PLAN_PROFILE=general`.

### Safety

- Design only, no code change.
- Stop when required fields are missing.

## Detailed Contract

### DESIGN CHECKPOINT

You are Claude Code acting as a **senior engineer / tech lead**.

This command produces a **written planning & design document**
based on prior analysis and explicit intent.

---

#### TASK MODE

PRODUCE A WRITTEN PLAN DOCUMENT

This is a **DESIGN CHECKPOINT**, not an exploration step.

- The output represents a considered technical decision
- The document is expected to be reviewed by humans
- Clarity, explicit trade-offs, and traceability matter more than brevity

---

#### REQUIRED INPUT EXTRACTION

From `$ARGUMENTS`, extract the following:

#### 1. Plan Output Path (Required)

PLAN_OUTPUT_PATH:
<PLAN_OUTPUT_PATH>

If `PLAN_OUTPUT_PATH` is missing:

- STOP immediately
- Ask the user to explicitly provide it
- Do NOT infer or guess a path

---

#### 2. Plan Profile (Optional)

Choose the plan document profile/template:

- `general` (default) → Standard 9-section design document
- `java-backend` → Java/Spring backend with 12 sections (transactions, concurrency, idempotency, observability)

If not specified, use `general` profile.

PLAN_PROFILE:
<PLAN_PROFILE>

---

#### 3. Plan Intent (Required)

Describe what this plan is intended to achieve.

Examples:

- Implement a specific feature
- Fix a production issue
- Refactor or restructure part of the system
- Introduce a new technical capability

PLAN_INTENT:
<PLAN_INTENT>

---

#### 4. Input Analysis Artifacts (Strongly Recommended)

Reference one or more prior analysis artifacts
(e.g. produced by `/nova-plugin:senior-explore`).

ANALYSIS_INPUTS:
<ANALYSIS_INPUTS>

If no analysis is provided:

- Proceed cautiously
- Explicitly call out missing analysis as a risk

---

#### 5. Constraints & Decision Boundaries (Optional but Important)

Explicitly list constraints that shape this plan.

Examples:

- Timeline or release constraints
- Technology stack constraints
- Backward compatibility requirements
- Operational or compliance constraints

CONSTRAINTS:
<CONSTRAINTS>

---

#### PLAN AUTHORING RULES

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

---

#### REQUIRED PLAN DOCUMENT STRUCTURE

The structure depends on the `PLAN_PROFILE`:

---

##### Profile: general (default)

The plan document MUST include these 9 sections in order:

1. **Background & Problem Statement**
   - Context leading to this plan
   - Summary of the problem being addressed
   - Pointers to relevant analysis artifacts

2. **Goals & Non-Goals**
   - Explicit success criteria
   - Clearly stated non-goals to prevent scope creep

3. **Constraints & Assumptions**
   - Technical, organizational, or temporal constraints
   - Assumptions inherited from analysis or business context

4. **Alternatives Considered**
   - Meaningful alternatives that were evaluated
   - High-level pros and cons of each
   - Clear reasons for rejection

5. **Final Approach & Rationale**
   - Chosen approach
   - Why this approach best satisfies goals and constraints
   - Key trade-offs being accepted

6. **Step-by-Step Implementation Plan**
   - Ordered implementation phases
   - Key milestones or checkpoints
   - Ownership or responsibility boundaries if relevant

7. **Risks & Mitigations**
   - Technical, operational, and delivery risks
   - Concrete mitigation strategies (not just acknowledgements)

8. **Test & Validation Strategy**
   - How correctness will be validated
   - Types of tests required (unit, integration, manual, etc.)
   - Rollout validation signals

9. **Rollback Strategy**
   - Conditions under which rollback is required
   - High-level rollback steps
   - Expected impact and limitations

---

##### Profile: java-backend

For Java/Spring backend designs, include these 12 sections:

1. **Background & Problem Statement**
2. **Scope Definition** (what is in/out of scope)
3. **Business Rules & Invariants** (domain constraints, validation rules)
4. **Architecture Overview** (layers, modules, boundaries)
5. **Data Model & Persistence** (entities, repositories, schema considerations)
6. **Transaction & Consistency Design** (transaction boundaries, isolation levels, distributed transactions)
7. **Concurrency & Idempotency** (thread-safety, race conditions, retry handling)
8. **Error Handling & Observability** (exception strategy, logging, metrics, tracing)
9. **Implementation Plan (Step-by-Step)**
10. **Testing Strategy** (unit, integration, contract tests)
11. **Rollback & Safety Plan**
12. **Risks & Open Questions**

---

#### OUTPUT RULES

Chat output MUST include ONLY:

1. The absolute or relative file path written
2. A 3–5 bullet **executive summary**:
   - What is being done
   - Why this approach was chosen
   - Major risks or trade-offs

Do NOT:

- Paste the plan content into chat
- Add commentary outside the required output

---

#### END OF COMMAND
