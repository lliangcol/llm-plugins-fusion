# Claude Code Custom Commands — Detailed Handbook (By Category)

> This handbook is derived from the command definitions under the `commands` directory. It organizes commands into five categories — **Explore / Plan / Review / Implement / Finalize** — and provides:
>
> - Practical templates that cover common scenarios
> - Comparison tables to help choose between similar commands
>
> Intended readers: engineering teams, tech leads, reviewers
>
> Typical use cases: requirement discovery, incident investigation, design review, execution planning, implementation, PR review, and delivery wrap-up.

---

## 0. Command layers and the “workflow” mental model

This command set decomposes an engineering activity into five phases:

1. **Explore**: understand and expose risks; no decisions or solutions
2. **Plan**: turn choices and boundaries into an executable plan (lightweight or formal)
3. **Review**: review existing code/description/plan; no coding
4. **Implement**: implement according to a plan or explicit steps
5. **Finalize**: freeze state and generate delivery artifacts (PR description, commit message, summary)

---

## 1. Fast decision: which command should I use right now?

Start with the five primary entries by default. If the right entry point is
unclear, use read-only `/route` first. Use advanced commands only for
compatibility shortcuts, backend-specific planning, or the Codex loop:

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

| Current goal | Default command | Output or action |
| --- | --- | --- |
| Unsure where to start | `/route` | Next command, skill, agent, pack, inputs, and validation path |
| Understand the problem, no solutions | `/explore` | Facts, uncertainties, risk signals |
| Produce a reviewable plan | `/produce-plan` | Formal plan document |
| Review plans, code, or risk | `/review` | Findings by `LEVEL=lite|standard|strict` |
| Implement an approved plan | `/implement-plan` | Project edits based on the plan |
| Summarize delivery and follow-ups | `/finalize-work` | Delivery notes, risks, validation, follow-up |

### 1.1 Minimal templates for the five primary entries

| Command | Minimal template |
| --- | --- |
| `/explore` | `/explore summarize facts, uncertainties, and risks for this requirement; no solutions` |
| `/produce-plan` | `/produce-plan PLAN_OUTPUT_PATH=docs/plans/example.md PLAN_INTENT="write a reviewable plan for the confirmed requirement"` |
| `/review` | `/review LEVEL=standard review this plan or diff and return severity-ranked findings` |
| `/implement-plan` | `/implement-plan PLAN_INPUT_PATH=docs/plans/example.md PLAN_APPROVED=true` |
| `/finalize-work` | `/finalize-work summarize completed changes, validation, limitations, and follow-ups` |

### 1.2 One-line decision table (most used)

| What you need right now                                             | Recommended command                  | Why                                                                                         |
| ------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Unsure which nova command or skill should handle the request        | `/route`                             | Read-only route selection for command / skill / agent / pack and validation path             |
| Understand the current problem/requirements with **no solutions**   | `/explore`                           | Primary entry for facts, uncertainties, and risk signals only                               |
| Deeper analysis or an exported exploration artifact                 | `/senior-explore`                    | Advanced entry with fuller intent/context/depth parameters                                  |
| Quickly align understanding (short exploration)                     | `/explore` or `/explore-lite`        | Unified command defaults to observer perspective; shorter structure: Observations / Uncertainties / Risks |
| Think like a reviewer to generate questions, still **no solutions** | `/explore PERSPECTIVE=reviewer` or `/explore-review` | Unified command switches to reviewer perspective; outputs: clear / questions / risk signals |
| A **lightweight execution plan** (no code)                          | `/plan-lite`                         | Goals, non-goals, approach, trade-offs, outline, key risks                                  |
| A **formal design/plan doc** written to a file                      | `/produce-plan` or `/backend-plan`   | Strong structure + forced file output; `/backend-plan` emphasizes Java/Spring concerns      |
| Review decision quality of a plan (don’t change the plan)           | `/plan-review`                       | Clarity, assumptions, risk signals, review questions                                        |
| Quick PR feedback for day-to-day changes                            | `/review LEVEL=lite` or `/review-lite` | Unified command lite level; fast and high signal-to-noise                                  |
| Standard strict review of core logic (no implementation)            | `/review` or `/review-only`          | Unified command defaults to standard review; severity levels + directional guidance          |
| Audit-style review for high-risk modules                            | `/review LEVEL=strict` or `/review-strict` | Unified command switches to strict review; suitable for “gate” reviews                       |
| Review then fix the current branch with Codex verification          | `/codex-review-fix`                  | Runs review -> Claude Code fix -> local checks -> Codex verify                              |
| Generate a Codex review report only                                 | `/codex-review-only`                 | Writes a structured review artifact without modifying project code                          |
| Verify an existing Codex review artifact                            | `/codex-verify-only`                 | Performs directed verification against a previous review artifact                            |
| Implement strictly from an **approved plan file**                   | `/implement-plan`                    | Requires `PLAN_APPROVED=true`; deviations must be justified                                 |
| Implement with explicit steps, allow small corrections              | `/implement-standard`                | Controlled; stop and ask if blocked                                                         |
| Implement quickly for low-risk tasks                                | `/implement-lite`                    | Speed-first; small refactors allowed                                                        |
| Wrap up deliverables (commit/PR/summary), **no more code changes**  | `/finalize-work` or `/finalize-lite` | Full delivery vs minimal 3-point summary                                                    |

The three Codex commands are advanced paths. They require a locally callable
Codex CLI and Bash for the skill scripts. The ordinary five-stage workflow does
not require Codex CLI.

---

## 2. Category 1: Explore (Understand only)

> Core principle: **Understand, don’t decide**. Output facts, questions, risks.

### 2.1 `/senior-explore` — EXPLORE ONLY (strong constraints)

**Positioning**

- Analysis and understanding only
- Explicitly forbids: design proposals, refactor suggestions, implementation details, writing code, architecture recommendations
- Fixed output sections: Key findings / Open questions / Potential risks

**When to use**

- New requirements: clarify scope and unknowns
- Production incidents: reconstruct facts before prescribing changes
- Complex domain logic: align mental model and assumptions
- Feasibility checks: list evidence and risks without a “recommended solution”

**Input template (fill `$ARGUMENTS`)**

- Intent (required), Context (recommended), Constraints (optional), Depth (optional), Export path (optional)

**What you get**

- A stable analysis artifact you can feed into `/plan-lite` or `/produce-plan` as `ANALYSIS_INPUTS`

**Examples**

1. Incident investigation (deep)

```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- Error logs: (paste)
- Timeline: (paste)
- Suspected modules: com.xxx.payment.*, com.xxx.order.*
- Recent changes: PR#1234 (link)
CONSTRAINTS:
- Only analyze current behavior, no future redesign
DEPTH: deep
EXPORT_PATH: docs/analysis/2026-01-10-payment-timeout.md
```

2. New feature requirement understanding

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- Requirement: (paste)
- Existing API: /v1/subscription/...
CONSTRAINTS:
- Focus on correctness, not performance
DEPTH: normal
```

---

### 2.2 `/explore-lite` — QUICK UNDERSTANDING (lightweight exploration)

**Positioning**

- Fast understanding alignment
- Still forbids: coding and proposing solutions

**Output structure**

- Observations / Uncertainties / Risks

---

### 2.3 `/explore-review` — REVIEWER MINDSET (question-driven exploration)

**Positioning**

- Think like a reviewer
- Output questions and risk signals; no solutions

**Output structure**

- Clear / Questions / Risk signals

---

## 3. Category 2: Plan (Write plans, not code)

### 3.1 `/plan-lite` — lightweight plan in chat

Typical structure:

- Goal / Non-goals / Approach / Trade-offs / Execution outline / Key risks

---

### 3.2 `/produce-plan` — formal plan doc (writes to file)

Use when:

- Medium/large change
- Multiple stakeholders
- Review + traceability required

---

### 3.3 `/backend-plan` — Java/Spring backend-focused design doc (writes to file)

Use when:

- Core backend flows
- Transactions, idempotency, observability need to be explicit

---

### 3.4 `/plan-review` — review plan decision quality

Only output:

- Decision clarity / Assumptions & gaps / Risk signals / Review questions

---

## 4. Category 3: Review (Review only, no code)

### 4.1 `/review LEVEL=lite` vs `/review LEVEL=standard` vs `/review LEVEL=strict`

| Dimension | `/review LEVEL=lite` | `/review LEVEL=standard`               | `/review LEVEL=strict`                            |
| --------- | -------------------- | -------------------------------------- | ------------------------------------------------- |
| Shortcut  | `/review-lite`       | `/review-only`                         | `/review-strict`                                  |
| Depth     | light, high signal   | systematic, severity-based             | exhaustive, harsh “audit” style                   |
| Output    | bullet findings      | Critical/Major/Minor + why + direction | same, but covers more dimensions                  |
| Best for  | day-to-day PRs       | core paths, mid/high risk              | finance/concurrency/large refactors/release gates |

---

## 5. Category 4: Implement (Write code)

### 5.1 `/implement-plan` vs `/implement-standard` vs `/implement-lite`

| Dimension  | `/implement-plan`                                | `/implement-standard`                          | `/implement-lite`                           |
| ---------- | ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------- |
| Constraint | strongest: must have plan + `PLAN_APPROVED=true` | medium: follow plan/steps, small fixes allowed | weak: speed-first, small refactors allowed  |
| Deviations | must explain; large deviations should stop       | stop when blocked; request clarification       | more flexible, still avoid over-engineering |
| Best for   | high risk / traceability                         | typical engineering tasks                      | low risk / small fixes                      |

---

## 6. Category 5: Finalize (Freeze state, deliver artifacts)

`/finalize-work`:

- Full delivery artifacts (commit message(s), PR description, summary, next steps)

`/finalize-lite`:

- Minimal 3-point summary

---

## 7. Common comparison tables

### 7.1 Explore: `/senior-explore` vs `/explore-lite` vs `/explore-review`

| Dimension | `/senior-explore`                           | `/explore-lite`                      | `/explore-review`                   |
| --------- | ------------------------------------------- | ------------------------------------ | ----------------------------------- |
| Goal      | most rigorous understanding + risk exposure | fastest alignment                    | question list with reviewer mindset |
| Output    | Findings / Questions / Risks                | Observations / Uncertainties / Risks | Clear / Questions / Risk signals    |
| Best for  | complex problems, incidents, traceability   | lightweight sync, meeting prep       | review prep                         |

---

## 8. Recommended “combo” workflows for common scenarios

### Scenario A: New feature (requirements unclear)

1. `/senior-explore` (known/unknown/risks; no solutions)
2. `/plan-lite` (goals, boundaries, approach)
3. If formal review needed: `/produce-plan` (write file)
4. `/plan-review` (expose review questions early)
5. Implement: `/implement-plan` (if approved) or `/implement-standard`
6. Wrap up: `/finalize-work`

### Scenario B: Production incident / bug

1. `/senior-explore` (deep) (facts + hypotheses)
2. If rollback doc needed: `/plan-lite` or `/produce-plan`
3. Implement: `/implement-standard` or `/implement-lite` (depending on risk)
4. Wrap up: `/finalize-work`

### Scenario C: PR review

- Small change: `/review LEVEL=lite` or `/review-lite`
- Core path: `/review LEVEL=standard` or `/review-only`
- Concurrency/finance/large refactor: `/review LEVEL=strict` or `/review-strict`

---

## 9. Command list (by category)

### Explore

- `/senior-explore`
- `/explore`
- `/explore-lite`
- `/explore-review`

### Plan

- `/plan-lite`
- `/produce-plan`
- `/backend-plan`
- `/plan-review`

### Review

- `/review`
- `/review-lite`
- `/review-only`
- `/review-strict`
- `/codex-review-only`
- `/codex-verify-only`

### Implement

- `/implement-plan`
- `/implement-standard`
- `/implement-lite`
- `/codex-review-fix`

### Finalize

- `/finalize-work`
- `/finalize-lite`

---

## 10. Copy-paste templates

### 10.1 Requirement understanding (strong constraints)

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- Requirement:
- Existing endpoints/data:
CONSTRAINTS:
- Based only on provided info
DEPTH: normal
```

### 10.2 Incident investigation (deep)

```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- Logs:
- Timeline:
- Suspected modules:
CONSTRAINTS:
- Only analyze current behavior, no redesign
DEPTH: deep
```

### 10.3 Lightweight plan

```text
/plan-lite
Goal:
Non-goals:
Constraints:
(Optional: a summary from senior-explore)
```

### 10.4 Formal plan (writes file)

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/<topic>.md
PLAN_INTENT: <what>
ANALYSIS_INPUTS: <links/paths>
CONSTRAINTS: <list>
```

### 10.5 Plan review

```text
/plan-review
(Paste plan full text or summary)
Only output: Decision clarity / Assumptions & gaps / Risk signals / Review questions
```

### 10.6 Fast PR review

```text
/review-lite
PR goal:
Diff / key code:
```

### 10.7 Implement by approved plan

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/<topic>.md
PLAN_APPROVED: true
```

### 10.8 Full finalize delivery

```text
/finalize-work
(Run directly; summarize current workspace and generate commit message & PR description.)
```
