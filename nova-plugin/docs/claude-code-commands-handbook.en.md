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

### 1.1 One-line decision table (most used)

| What you need right now | Recommended command | Why |
|---|---|---|
| Understand the current problem/requirements with **no solutions** | `/senior-explore` | Explicitly forbids “recommendations/implementation/design”; outputs facts, questions, risks |
| Quickly align understanding (short exploration) | `/explore-lite` | Shorter structure: Observations / Uncertainties / Risks |
| Think like a reviewer to generate questions, still **no solutions** | `/explore-review` | Outputs: clear / questions / risk signals |
| A **lightweight execution plan** (no code) | `/plan-lite` | Goals, non-goals, approach, trade-offs, outline, key risks |
| A **formal design/plan doc** written to a file | `/produce-plan` or `/backend-plan` | Strong structure + forced file output; `/backend-plan` emphasizes Java/Spring concerns |
| Review decision quality of a plan (don’t change the plan) | `/plan-review` | Clarity, assumptions, risk signals, review questions |
| Quick PR feedback for day-to-day changes | `/review-lite` | Fast and high signal-to-noise |
| Standard strict review of core logic (no implementation) | `/review-only` | Severity levels + directional guidance |
| Audit-style review for high-risk modules | `/review-strict` | Exhaustive coverage; suitable for “gate” reviews |
| Implement strictly from an **approved plan file** | `/implement-plan` | Requires `PLAN_APPROVED=true`; deviations must be justified |
| Implement with explicit steps, allow small corrections | `/implement-standard` | Controlled; stop and ask if blocked |
| Implement quickly for low-risk tasks | `/implement-lite` | Speed-first; small refactors allowed |
| Wrap up deliverables (commit/PR/summary), **no more code changes** | `/finalize-work` or `/finalize-lite` | Full delivery vs minimal 3-point summary |

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

1) Incident investigation (deep)
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

2) New feature requirement understanding
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

### 4.1 `/review-lite` vs `/review-only` vs `/review-strict`

| Dimension | `/review-lite` | `/review-only` | `/review-strict` |
|---|---|---|---|
| Depth | light, high signal | systematic, severity-based | exhaustive, harsh “audit” style |
| Output | bullet findings | Critical/Major/Minor + why + direction | same, but covers more dimensions |
| Best for | day-to-day PRs | core paths, mid/high risk | finance/concurrency/large refactors/release gates |

---

## 5. Category 4: Implement (Write code)

### 5.1 `/implement-plan` vs `/implement-standard` vs `/implement-lite`

| Dimension | `/implement-plan` | `/implement-standard` | `/implement-lite` |
|---|---|---|---|
| Constraint | strongest: must have plan + `PLAN_APPROVED=true` | medium: follow plan/steps, small fixes allowed | weak: speed-first, small refactors allowed |
| Deviations | must explain; large deviations should stop | stop when blocked; request clarification | more flexible, still avoid over-engineering |
| Best for | high risk / traceability | typical engineering tasks | low risk / small fixes |

---

## 6. Category 5: Finalize (Freeze state, deliver artifacts)

`/finalize-work`:
- Full delivery artifacts (commit message(s), PR description, summary, next steps)

`/finalize-lite`:
- Minimal 3-point summary

---

## 7. Common comparison tables

### 7.1 Explore: `/senior-explore` vs `/explore-lite` vs `/explore-review`

| Dimension | `/senior-explore` | `/explore-lite` | `/explore-review` |
|---|---|---|---|
| Goal | most rigorous understanding + risk exposure | fastest alignment | question list with reviewer mindset |
| Output | Findings / Questions / Risks | Observations / Uncertainties / Risks | Clear / Questions / Risk signals |
| Best for | complex problems, incidents, traceability | lightweight sync, meeting prep | review prep |

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
- Small change: `/review-lite`
- Core path: `/review-only`
- Concurrency/finance/large refactor: `/review-strict`

---

## 9. Command list (by category)

### Explore
- `/senior-explore`
- `/explore-lite`
- `/explore-review`

### Plan
- `/plan-lite`
- `/produce-plan`
- `/backend-plan`
- `/plan-review`

### Review
- `/review-lite`
- `/review-only`
- `/review-strict`

### Implement
- `/implement-plan`
- `/implement-standard`
- `/implement-lite`

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

