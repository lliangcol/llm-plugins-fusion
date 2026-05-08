# 📚 Nova Plugin Command Reference (Full)

> **Version**: 2.1.0 | **Last updated**: 2026-05-09
>
> This guide is a complete technical reference for all `nova-plugin` commands, including parameter notes, scenario examples, and workflow templates.
>
> Design goal: **Find a scenario → Copy the example → Adapt it**

---

<a id="-目录"></a>

## 📋 Table of Contents

- [Quick Scenario Index](#-快速场景索引)
- [Command Overview](#-命令总览)
- [Explore Commands](#-探索类命令详解)
- [Plan Commands](#-规划类命令详解)
- [Review Commands](#-评审类命令详解)
- [Implement Commands](#-实现类命令详解)
- [Finalize Commands](#-收尾类命令详解)
- [Workflow Templates](#-工作流模板库)
- [Quick Reference Cards](#-快速参考卡片)
- [Appendix](#-附录)

---

<a id="-快速场景索引"></a>

## 🔍 Quick Scenario Index

> 💡 Use this to quickly pick a command for a situation. Click “Example” to jump to a ready-to-copy template.

### 📊 Scenario → Command Cheat Sheet

| Category                 | Scenario                               | Recommended command   | Jump                              |
| ------------------------ | -------------------------------------- | --------------------- | --------------------------------- |
| **Requirement analysis** | Understand a new feature request       | `/senior-explore`     | [Example](#场景-新功能需求分析)   |
| **Requirement analysis** | Quick alignment / shared understanding | `/explore-lite`       | [Example](#场景-快速认知对齐)     |
| **Requirement analysis** | Review a requirements doc              | `/explore-review`     | [Example](#场景-需求文档评审)     |
| **Incident / debugging** | Investigate a production issue         | `/senior-explore`     | [Example](#场景-生产问题深度排查) |
| **Incident / debugging** | Quick issue triage                     | `/explore-lite`       | [Example](#场景-快速问题定位)     |
| **Design / planning**    | Small task planning                    | `/plan-lite`          | [Example](#场景-小型任务规划)     |
| **Design / planning**    | Formal design doc                      | `/produce-plan`       | [Example](#场景-正式设计文档)     |
| **Design / planning**    | Java backend design (Spring)           | `/backend-plan`       | [Example](#场景-java后端设计)     |
| **Plan review**          | Review a plan document                 | `/plan-review`        | [Example](#场景-计划文档评审)     |
| **Code review**          | Day-to-day PR review                   | `/review LEVEL=lite` or `/review-lite` | [Example](#场景-日常pr评审)       |
| **Code review**          | Core logic review                      | `/review LEVEL=standard` or `/review-only` | [Example](#场景-核心逻辑评审)     |
| **Code review**          | High-risk audit-style review           | `/review LEVEL=strict` or `/review-strict` | [Example](#场景-高风险代码审计)   |
| **Codex loop**           | Review then fix current branch         | `/codex-review-fix`   | [Workflow](#workflow-c2-codex-loop) |
| **Codex loop**           | Generate Codex review only             | `/codex-review-only`  | [Workflow](#workflow-c2-codex-loop) |
| **Codex loop**           | Verify an existing Codex review        | `/codex-verify-only`  | [Workflow](#workflow-c2-codex-loop) |
| **Implementation**       | Implement strictly by an approved plan | `/implement-plan`     | [Example](#场景-按计划实现)       |
| **Implementation**       | Standard, controlled implementation    | `/implement-standard` | [Example](#场景-标准开发任务)     |
| **Implementation**       | Fast, low-risk implementation          | `/implement-lite`     | [Example](#场景-快速修复)         |
| **Delivery**             | Full delivery output (commit/PR)       | `/finalize-work`      | [Example](#场景-完整工作交付)     |
| **Delivery**             | Minimal summary                        | `/finalize-lite`      | [Example](#场景-快速工作总结)     |

---

<a id="-命令总览"></a>

## 📦 Command Overview

### Command taxonomy diagram

The diagram shows the core Explore -> Plan -> Review -> Implement -> Finalize flow. The three Codex loop commands are listed in the comparison table below.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Nova Plugin Commands                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│  │ Explore │ → │  Plan   │ → │ Review  │ → │Implement│ → │Finalize │   │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   │
│       │             │             │             │             │        │
│  ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   │
│  │ senior  │   │  lite   │   │  lite   │   │  plan   │   │  work   │   │
│  │ explore │   │         │   │         │   │         │   │         │   │
│  ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤   │
│  │⭐explore│   │ produce │   │⭐review │   │standard │   │  lite   │   │
│  │         │   │  plan   │   │         │   │         │   │         │   │
│  ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤   └─────────┘   │
│  │ explore │   │ backend │   │  only   │   │  lite   │                 │
│  │  lite   │   │  plan   │   │         │   │         │                 │
│  ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤                 │
│  │ explore │   │  plan   │   │ strict  │   │         │                 │
│  │ review  │   │ review  │   │         │   │         │                 │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘                 │
│                                                                        │
│  ⭐ = Recommended unified commands                                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Constraint strength comparison

| Stage     | Command               | Constraint | Output                | Writes code? | Notes                                       |
| --------- | --------------------- | :--------: | --------------------- | :----------: | ------------------------------------------- |
| Explore   | `/senior-explore`     | 🔴 Strong  | Analysis output       |      ❌      | Deep analysis                               |
| Explore   | ⭐`/explore`          | 🟡 Medium  | Perspective-based     |      ❌      | **Unified command, recommended**            |
| Explore   | `/explore-lite`       |  🟢 Weak   | Short analysis        |      ❌      | = `/explore PERSPECTIVE=observer`           |
| Explore   | `/explore-review`     | 🟡 Medium  | Reviewer-style        |      ❌      | = `/explore PERSPECTIVE=reviewer`           |
| Plan      | `/plan-lite`          | 🟡 Medium  | Plan summary          |      ❌      | -                                           |
| Plan      | `/produce-plan`       | 🔴 Strong  | Plan doc (file)       |      ❌      | Supports profile param                      |
| Plan      | `/backend-plan`       | 🔴 Strong  | Backend design (file) |      ❌      | = `/produce-plan PLAN_PROFILE=java-backend` |
| Plan      | `/plan-review`        | 🟡 Medium  | Review output         |      ❌      | -                                           |
| Review    | `/review-lite`        |  🟢 Weak   | Findings bullets      |      ❌      | = `/review LEVEL=lite`                     |
| Review    | ⭐`/review`           |   🟡-🔴    | Critical/Major/Minor  |      ❌      | **Unified command, recommended**            |
| Review    | `/review-only`        | 🟡 Medium  | Critical/Major/Minor  |      ❌      | = `/review LEVEL=standard`                  |
| Review    | `/review-strict`      | 🔴 Strong  | Exhaustive review     |      ❌      | = `/review LEVEL=strict`                    |
| Review    | `/codex-review-only`  | 🟡 Medium  | Review artifact       |      ❌      | Runs Codex review script only               |
| Review    | `/codex-verify-only`  | 🟡 Medium  | Verify artifact       |      ❌      | Requires `REVIEW_FILE`                      |
| Implement | `/implement-plan`     | 🔴 Strong  | Implementation output |      ✅      | -                                           |
| Implement | `/implement-standard` | 🟡 Medium  | Implementation output |      ✅      | -                                           |
| Implement | `/implement-lite`     |  🟢 Weak   | Implementation output |      ✅      | -                                           |
| Implement | `/codex-review-fix`   | 🔴 Strong  | Review/fix/verify loop |     ✅      | Bounded high-confidence fixes only          |
| Finalize | `/finalize-work` | 🔴 Strong | Delivery artifacts | ❌ |
| Finalize | `/finalize-lite` | 🟢 Weak | Minimal summary | ❌ |

**Total commands**: 20 (17 existing + 3 Codex loop commands)
**Recommended**: Use ⭐ marked unified commands for simplified workflow

---

<a id="-探索类命令详解"></a>

## 🧭 Explore Commands (Deep understanding, no solutions)

### `/senior-explore` — Deep exploration & analysis

#### 🎯 Positioning

```
Role: Senior engineer / investigator
Goal: clarify the current reality and risks
Forbidden: design proposals, refactors, implementation details, code, architecture recommendations
```

#### 🧾 Parameters

| Field         | Required | Description                 | Example                               |
| ------------- | :------: | --------------------------- | ------------------------------------- |
| `INTENT`      |    ✅    | What you want to analyze    | `Analyze a new feature requirement`   |
| `CONTEXT`     |    ⚪    | Relevant inputs             | requirements, API drafts, logs, links |
| `CONSTRAINTS` |    ⚪    | Boundaries                  | `Only analyze current behavior`       |
| `DEPTH`       |    ⚪    | `quick` / `normal` / `deep` | `deep`                                |
| `EXPORT_PATH` |    ⚪    | Optional export file path   | `docs/analysis/xxx.md`                |

#### 🧩 Output format

```markdown
### Key findings

- [Fact] Evidence-backed observations
- [Inference] Clearly labeled hypotheses
- [Missing] Explicitly list what information is missing

### Open questions

- The questions that must be answered to proceed
- What information is needed to answer them

### Potential risks

- Unknowns and edge cases
- System/architecture risks
- Operability/maintenance risks
```

#### 🧪 Scenario examples

<a id="场景-新功能需求分析"></a>

##### Scenario: New feature requirement analysis

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- Requirements doc: add a "Reorder" button on the order details page
- Existing API: POST /api/orders (create order)
- Existing API: GET /api/orders/{id} (get details)
- Business constraints: must allow reordering items already purchased
CONSTRAINTS:
- Only analyze feasibility and risks; do not propose an implementation
- Do not redesign the whole architecture
DEPTH: normal
```

<a id="场景-生产问题深度排查"></a>

##### Scenario: Production issue deep investigation

```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- Symptom: payment callback sometimes double-charges
- Logs:
  2026-01-10 14:32:15 [WARN] PaymentCallback: duplicate orderId=123456
  2026-01-10 14:32:15 [INFO] PaymentCallback: processing orderId=123456
- Suspected modules: com.xxx.payment.callback.*
- Recent changes: PR#4567 (optimize callback handler)
- Frequency: ~0.1% of callbacks
CONSTRAINTS:
- Only analyze current behavior; do not propose future redesign
- Assume the current constraints are real
DEPTH: deep
EXPORT_PATH: docs/analysis/2026-01-10-payment-duplicate.md
```

### `/explore-lite` — Quick understanding

#### 🎯 Positioning

- Faster, shorter exploration to align understanding
- Still **no solutions** and **no code**

#### 🧩 Output format

```markdown
### Observations

### Uncertainties

### Potential risks
```

#### 🧪 Scenario examples

<a id="场景-快速认知对齐"></a>

##### Scenario: Quick alignment

```text
/explore-lite
Context:
- We need to add a "draft" status to orders
- Current statuses: created/paid/shipped/refunded
Constraints:
- Keep backward compatibility for existing clients
```

<a id="场景-快速问题定位"></a>

##### Scenario: Quick issue triage

```text
/explore-lite
Context:
- 500 errors after deployment
- Error spike started at 10:15
- Suspect: cache config changes
Constraints:
- Only identify likely causes and what to check next
```

### `/explore-review` — Reviewer mindset exploration

#### 🎯 Positioning

- Use a reviewer mindset to generate a question list
- Still **no solution**, **no code**

#### 🧩 Output format

```markdown
### What is clear

### Review questions

### Risk signals
```

#### 🧪 Scenario examples

<a id="场景-需求文档评审"></a>

##### Scenario: Requirements doc review

```text
/explore-review
Context:
- Paste or link the requirements doc
Constraints:
- Only ask questions and highlight risk signals; do not propose solutions
```

---

<a id="-规划类命令详解"></a>

## 🗺️ Plan Commands (Define boundaries, no code)

### `/plan-lite` — Lightweight execution plan

#### 🎯 Positioning

- Produce a lightweight plan in chat output
- Focus on goals, boundaries, approach, and risks

#### 🧩 Output format

```markdown
### Goal

### Non-Goals

### Chosen Approach

### Key Trade-offs

### Execution Outline

### Key Risks
```

#### 🧪 Scenario examples

<a id="场景-小型任务规划"></a>

##### Scenario: Small task planning

```text
/plan-lite
Goal: Add pagination to the admin order list
Non-goals: Redesign UI, change backend data model
Constraints:
- Must ship today
- No database migrations
```

### `/produce-plan` — Formal design document (write to file)

#### 🎯 Positioning

- Generates a formal plan/design doc and writes it to a file
- Suitable for medium/large changes that need review and traceability

#### 🧾 Parameters

| Field              | Required | Description              | Example                     |
| ------------------ | :------: | ------------------------ | --------------------------- |
| `PLAN_OUTPUT_PATH` |    ✅    | Output file path         | `docs/plans/<topic>.md`     |
| `PLAN_INTENT`      |    ✅    | What you plan to achieve | `Implement points transfer` |
| `ANALYSIS_INPUTS`  |    ⚪    | Inputs/links used        | `docs/analysis/xxx.md`      |
| `CONSTRAINTS`      |    ⚪    | Boundaries               | `No downtime`               |

#### 🧩 Must-have sections (typical)

- Background / Problem statement
- Goals / Non-goals
- Options considered
- Chosen approach
- Data model / API changes (if any)
- Rollout / rollback
- Observability
- Risks and mitigations

#### 🧪 Scenario examples

<a id="场景-正式设计文档"></a>

##### Scenario: Formal design doc

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/order-drafts.md
PLAN_INTENT: Add "draft" status to orders
ANALYSIS_INPUTS:
- docs/analysis/2026-01-10-order-statuses.md
CONSTRAINTS:
- Backward compatible for clients
- Must be easy to roll back
```

### `/backend-plan` — Java/Spring backend design (write to file)

#### 🎯 Positioning

- Similar to `/produce-plan`, but optimized for Java/Spring backend concerns
- Typically emphasizes transactions, idempotency, observability, and consistency

#### 🧩 Must-have sections (typical)

- Domain model & invariants
- Transaction boundaries
- Idempotency strategy
- Concurrency and locking
- Observability (logs/metrics/traces)
- Rollout / rollback

#### 🧪 Scenario examples

<a id="场景-java后端设计"></a>

##### Scenario: Java backend design

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/payment-callback-idempotency.md
PLAN_INTENT: Make payment callback handling idempotent and observable
CONSTRAINTS:
- No double charge
- Support retries and out-of-order callbacks
```

### `/plan-review` — Plan review (decision quality)

#### 🎯 Positioning

- Review the decision quality of an existing plan doc
- Do not modify the plan; output review questions and risks

#### 🧩 Output format

```markdown
### Decision clarity check

### Assumptions & gaps

### Risk signals

### Review questions
```

#### 🧪 Scenario examples

<a id="场景-计划文档评审"></a>

##### Scenario: Plan document review

```text
/plan-review
(Paste the full plan or a summary)
Only output: Decision clarity / Assumptions & gaps / Risk signals / Review questions
```

---

<a id="-评审类命令详解"></a>

## 🔎 Review Commands (No coding)

### `/review LEVEL=lite` / `/review-lite` — Lightweight PR review

#### 🎯 Positioning

- Quick feedback with high signal-to-noise
- Good for small changes, configuration, docs, or low-risk PRs

#### 🧩 Output format

```markdown
### Findings

- ...
```

#### 🧪 Scenario examples

<a id="场景-日常pr评审"></a>

##### Scenario: Day-to-day PR review

```text
/review LEVEL=lite
PR goal:
Diff / key files:
Constraints:
- No redesign suggestions
```

### `/review-only` — Standard strict review (Critical/Major/Minor)

#### 🎯 Positioning

- Systematic review with severity levels
- Still no implementation; point out issues and directions only

#### 🧩 Output format

```markdown
### Critical

### Major

### Minor
```

#### 🧪 Scenario examples

<a id="场景-核心逻辑评审"></a>

##### Scenario: Core logic review

```text
/review-only
Context:
- This change affects payment settlement
Diff:
- (paste or link)
```

### `/review-strict` — Exhaustive high-risk audit review

#### 🎯 Positioning

- Use for high-risk modules: concurrency, finance, critical state machines, large refactors
- Be exhaustive; use clear severity and risk framing

#### 🧪 Scenario examples

<a id="场景-高风险代码审计"></a>

##### Scenario: High-risk code audit

```text
/review-strict
Context:
- This PR changes order state transitions
Diff:
- (paste or link)
Constraints:
- Treat as pre-release gate review
```

---

<a id="-实现类命令详解"></a>

## ⚙️ Implement Commands (Write code)

### `/implement-plan` — Implement strictly by an approved plan

#### 🎯 Positioning

- Requires a plan file and explicit approval
- Deviations must be explained; large deviations should stop for re-approval

#### 🧾 Parameters

| Field             | Required | Description         | Example                 |
| ----------------- | :------: | ------------------- | ----------------------- |
| `PLAN_INPUT_PATH` |    ✅    | Plan file to follow | `docs/plans/<topic>.md` |
| `PLAN_APPROVED`   |    ✅    | Must be `true`      | `true`                  |

#### 🧪 Scenario examples

<a id="场景-按计划实现"></a>

##### Scenario: Implement by plan

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/order-drafts.md
PLAN_APPROVED: true
```

### `/implement-standard` — Standard controlled implementation

#### 🎯 Positioning

- Use when you have steps or a plan outline, but allow small corrections
- If blocked, stop and ask clarifying questions

#### 🧪 Scenario examples

<a id="场景-标准开发任务"></a>

##### Scenario: Standard development task

```text
/implement-standard
Implement the following steps:
1. Add a new status enum value: DRAFT
2. Update API validation to allow saving drafts
3. Add tests for transitions
If blocked, stop and explain what’s missing.
```

### `/implement-lite` — Fast implementation

#### 🎯 Positioning

- Prioritize speed for low-risk tasks
- Small refactors allowed; avoid over-engineering

#### 🧪 Scenario examples

<a id="场景-快速修复"></a>

##### Scenario: Quick fix

```text
/implement-lite
Fix the null pointer in OrderMapper when items is empty.
Constraints:
- Keep changes minimal
- Add a regression test
```

---

<a id="-收尾类命令详解"></a>

## 📦 Finalize Commands (Deliverables, no code changes)

### `/finalize-work` — Full delivery output (commit + PR)

#### 🎯 Positioning

- Freeze the current state and generate delivery artifacts
- Typically includes: summary, commit message(s), PR description, and next steps

#### 🧪 Scenario examples

<a id="场景-完整工作交付"></a>

##### Scenario: Full work delivery

```text
/finalize-work
```

### `/finalize-lite` — Minimal summary

#### 🎯 Positioning

- Very short wrap-up: 3 key points

#### 🧪 Scenario examples

<a id="场景-快速工作总结"></a>

##### Scenario: Quick work summary

```text
/finalize-lite
```

---

<a id="-工作流模板库"></a>

## 🔁 Workflow Templates

### Workflow A: New feature development (unclear requirements)

```text
1) /senior-explore  (clarify facts, unknowns, risks)
2) /plan-lite       (align on a lightweight plan)
3) /produce-plan    (if a formal doc is needed)
4) /plan-review     (review decision quality)
5) /implement-plan  (if approved) or /implement-standard
6) /finalize-work
```

### Workflow B: Production issue fix

```text
1) /senior-explore (deep) (reconstruct facts + hypotheses)
2) /plan-lite (optional) (rollback and risk notes)
3) /implement-standard or /implement-lite (depending on risk)
4) /review-strict (if needed)
5) /finalize-work
```

### Workflow C: PR code review

```text
Small change   → /review LEVEL=lite
Core logic     → /review LEVEL=standard
High risk      → /review LEVEL=strict
```

<a id="workflow-c2-codex-loop"></a>

### Workflow C2: Codex review/fix/verify loop

```text
1) /codex-review-only or /codex-review-fix
2) Claude Code fixes high-confidence findings when using the full loop
3) Run local checks
4) /codex-verify-only against the review artifact
5) Continue only if verify reports unresolved high-confidence issues
```

Examples:

```text
/codex-review-fix BASE=main GOAL="fix current branch until mergeable"
```

```text
/codex-review-only REVIEW_MODE=full
```

```text
/codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt BASE=main
```

### Workflow D: Java backend end-to-end

```text
1) /senior-explore
2) /backend-plan
3) /plan-review
4) /implement-plan
5) /review-strict
6) /finalize-work
```

---

<a id="-快速参考卡片"></a>

## 🎯 Quick Reference Cards

### Explore commands

| Command           | One-liner                   | Output                               |
| ----------------- | --------------------------- | ------------------------------------ |
| `/senior-explore` | Deep analysis, expose risks | Findings / Questions / Risks         |
| `/explore-lite`   | Quick alignment             | Observations / Uncertainties / Risks |
| `/explore-review` | Reviewer-style questioning  | Clear / Questions / Risk signals     |

### Plan commands

| Command         | One-liner           | Output location |
| --------------- | ------------------- | --------------- |
| `/plan-lite`    | Lightweight plan    | Chat output     |
| `/produce-plan` | Formal plan doc     | Writes a file   |
| `/backend-plan` | Java backend design | Writes a file   |
| `/plan-review`  | Plan quality review | Chat output     |

### Review commands

| Command          | Use case         | Depth     |
| ---------------- | ---------------- | --------- |
| `/review LEVEL=lite` / `/review-lite` | Day-to-day PRs   | 🟢 Light  |
| `/review LEVEL=standard` / `/review-only` | Core paths       | 🟡 Medium |
| `/review LEVEL=strict` / `/review-strict` | High-risk audits | 🔴 Deep   |
| `/codex-review-only` | Branch review artifact | 🟡 Medium |
| `/codex-verify-only` | Directed verification | 🟡 Medium |

### Implement commands

| Command               | Use case                               | Constraint |
| --------------------- | -------------------------------------- | ---------- |
| `/implement-plan`     | Approved plan exists                   | 🔴 Strong  |
| `/implement-standard` | Clear steps, small corrections allowed | 🟡 Medium  |
| `/implement-lite`     | Fast low-risk tasks                    | 🟢 Weak    |
| `/codex-review-fix`   | Review/fix/verify closure loop         | 🔴 Strong  |

### Finalize commands

| Command          | Use case        | Output       |
| ---------------- | --------------- | ------------ |
| `/finalize-work` | Full delivery   | commit + PR  |
| `/finalize-lite` | Minimal summary | 3 key points |

---

<a id="-附录"></a>

## 🧾 Appendix

### Banned wording (for explore/review)

Avoid these in explore/review outputs:

| Category            | Avoid                      | Prefer                |
| ------------------- | -------------------------- | --------------------- |
| Recommendation tone | should, recommend, suggest | may, could, appears   |
| Solution framing    | solution, fix, implement   | observation, finding  |
| Over-certainty      | will, must, definitely     | potentially, possibly |

### Common mistakes

| Mistake                                              | Why it’s a problem                  | Correct usage                        |
| ---------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| Using `/senior-explore` and then proposing solutions | Breaks the “explore only” principle | Explore first, then use `/plan-lite` |
| Running `/implement-plan` without `PLAN_APPROVED`    | The command will be blocked         | Always set `PLAN_APPROVED: true`     |
| Using `/review-lite` for payment/finance code        | Not enough depth                    | Use `/review-strict`                 |
| Editing code while using `/finalize-work`            | Breaks the “freeze state” principle | Finish changes first, then finalize  |

> 📌 Maintenance note: keep this document updated as commands evolve.
