# Post-Remediation Audit And Execution Plan

Status: implementation complete; local gates passed; external operational evidence remains required before release

Date: 2026-07-12

This document records the execution plan used to remediate the July 2026 deep
audit and then audits the resulting implementation. It is a current maintainer
record, not release evidence. No tag or release is authorized by this record.

## Execution Plan And Completion Criteria

| Phase | Risk addressed | Delivered change | Completion evidence | Status |
| --- | --- | --- | --- | --- |
| 0. Evidence baseline | Stale or overstated conclusions | Canonical rules, full tree, source state, generated outputs, and existing gates were inspected before edits | Repository validators record source digests and cleanly distinguish static, simulated, smoke, and live claims | Complete |
| 1. Behavior parity | Direct commands silently lose workflow semantics | One structured behavior IR for all 21 workflows now generates compact Skill indexes and behavior-complete runtime contracts | 21/21 surface parity; 29/29 golden cases; safety false negatives 0 | Complete |
| 2. Framework extraction | Generic kernel remains Nova/Claude-specific | Framework, product, behavior, and adapter specifications are separate; compiler consumes explicit layers | A non-Nova, non-Claude fixture compiles 3 workflows with different stages and a mock adapter | Complete |
| 3. Live evaluation v2 | Bare prompt compliance is mistaken for adapter integration | Dataset expanded to 24 hidden-label cases with three attempts; runner records adapter-load proof, digests, tool policy, derived writes, tool calls, invented surfaces, and safe process-failure categories | Dataset and runner unit gates pass; a broad clean-commit run exposed and drove fixes to evaluator input semantics and route output strictness | Complete in code; a fresh full Claude run remains external-rate-limit blocked and no compatibility upgrade is permitted |
| 4. Shell command boundary | Bash bypasses Write/Edit guards | Default-deny command broker parses argv, rejects composition/redirection/expansion, and allows only bounded base or consumer policy commands | Runtime smoke and shell-policy unit suites pass | Complete |
| 5. Schema correctness | A validator subset accepts invalid schema instances | Locked Ajv development dependencies validate draft-07 and draft 2020-12 sources; historical fail-open cases are differential tests | All schemas compile and 4/4 historical fail-open cases are rejected | Complete |
| 6. Release resilience | Candidate assets and evidence can be replaced or promoted without enough independent proof | Candidate evidence is bundled and digest-bound; promotion verifies evidence, source, signed tag, candidate attestations, deterministic rebuild, and independent review | Release candidate/promotion unit and integration suites pass | Complete in code; external GitHub proof required |
| 7. Operator resilience | Single-owner operations and unrehearsed recovery | Source-controlled label sync, independent review policy, signer inventory checks, recovery workflow, recovery/key-rotation runbook, and adoption ledger | Governance validator passes and reports the unclosed operational facts | Complete in code; second signer, rotation, and recovery drill not demonstrated |
| 8. Verification and delivery | Partial validation is reported as completion | Full validation, test coverage, mutation, dependency audit, install dry-run, distribution scan, deterministic build, diff review, and this post-remediation audit | Every command listed under Final Verification must pass before push | In progress until the final commit is pushed |

The stop condition is deliberately stricter than “files changed”: implementation
must pass the full local gate, the final diff must be reviewed, and all generated
surfaces must be current. Operational actions that require GitHub identities,
signing keys, protected environments, tags, or releases remain explicit external
gates and cannot be synthesized by local tests.

## Audit Result

The remediation materially closes the original control-plane versus behavior-
evidence gap. The repository now has a structured, testable behavior source;
adapter-loaded evaluation capability; an assistant-neutral compiler fixture; a
default-deny shell broker; standards-based schema validation; and a release
promotion chain that fails closed when required evidence is absent.

The local engineering posture is strong, but release readiness is intentionally
**not demonstrated**. Current governance truth still records one signer, no
successful recovery drill, no key-rotation evidence, and no external adoption
evidence. These are operational facts rather than missing code.

## Architecture

Risk after remediation: **Low** for specification drift; **Medium** for future
extension pressure.

- `workflow-specs/framework.json` owns assistant-neutral capabilities, risks,
  permission semantics, and behavior concepts.
- `workflow-specs/nova.product.json` owns Nova inventory and product stages.
- `workflow-specs/adapters/*.json` owns assistant installation, invocation, and
  enforcement details.
- `workflow-specs/behaviors.json` owns input resolution, decisions, invariants,
  stops, steps, deviation policy, output shape, and failure behavior.
- The minimal-product fixture proves the compiler is not dependent on `nova-`,
  Claude, Codex, the five Nova stages, or the 21-workflow count.

Residual risk: only one alternative product fixture exists. Add another fixture
only when a real product variant requires new capability semantics; do not grow
the public plugin surface merely to prove abstraction.

## Core Workflow And Behavior

Risk after remediation: **Low** for deterministic contract drift; **Medium** for
stochastic assistant quality until a complete clean-commit live run is retained.

- All 21 direct commands receive behavior-complete runtime contracts generated
  from one IR.
- Skill surfaces include generated behavior indexes and drift checks.
- Twenty-nine golden cases cover aliases, defaults, exact approval values,
  blocking conditions, route selection, outputs, and failure behavior with zero
  safety false negatives.
- The 2026-07-12 clean-commit evaluation snapshot used 24 public-safe cases
  with expected answers excluded from prompts and three attempts per case.
  This is historical evidence, not the current live dataset inventory.
- The runner derives writes, tool calls, inventory use, and invented surfaces
  from execution state instead of trusting model self-report.
- Claude loads the plugin directory; Codex receives a digest-bound adapter proof
  in its isolated sandbox.

Residual risk: diagnostic route probes do not substitute for the current full
dataset plan. No compatibility level may be upgraded from runner capability or
from a dirty working tree.

### Clean-Commit Evaluation Observation

An untracked local evaluation against clean commit `127d22e` ran all 24 cases
three times for each known-good assistant. Both initial batches passed 50/72.
Neither produced project writes, unexpected tool use, invented surfaces, or an
adapter-boundary bypass.

The result was not accepted as a compatibility upgrade:

- Codex failures exposed an evaluator contradiction: route cases were expected
  to list all downstream canonical inputs while the prompt requested unresolved
  inputs only, and direct approval cases were not locked to their target
  workflow. The prompt contract was corrected; representative route and direct
  approval diagnostics then passed 6/6.
- Claude produced twelve otherwise-correct route responses with forbidden
  preamble text before the fixed heading. The behavior IR and live invocation
  now require the heading as the first bytes with no surrounding commentary.
- Later Claude calls exited through the external CLI. The revised runner safely
  classified representative retries as `rate-limit` without retaining raw
  diagnostics. A complete rerun must wait for external capacity and remains a
  pre-release operational gate.

These observations remain local evaluation evidence. They are not checked-in
release evidence and do not raise the generated L2 compatibility declarations.

## Code Quality

Risk after remediation: **Low**.

- The workflow compiler, input resolver, schema engine, label catalog, and
  independent-review evaluator have explicit module boundaries and unit tests.
- Ajv is a development-only dependency; it does not enter the distributed
  `nova-plugin` runtime archive.
- File URL handling is centralized and a repository rule rejects non-portable
  `.pathname` conversions.
- The v3 validator path remains a compatibility entrypoint that delegates to the
  canonical v4 validator.
- Coverage source inventory fails if any maintenance module is not loaded.

Residual risk: a few broad maintenance scripts remain below preferred per-file
coverage even though global and critical-module floors pass. Raise targeted
coverage when those scripts change rather than optimizing percentages without a
risk-bearing assertion.

## Documentation And Developer Experience

Risk after remediation: **Low**.

- Architecture guidance now describes behavior-complete runtime contracts rather
  than treating a compact metadata file as the full behavior source.
- The primary-workflow transcript shows route plus Explore, Plan, Review,
  Implement, and Finalize with exact canonical inputs and before/after evidence.
- Public quality reporting separates deterministic tests, legacy bare-CLI
  observations, adapter-loaded capability, and release proof.
- Main documentation continues to emphasize six primary entrypoints; advanced
  compatibility commands remain secondary.
- Consumer guidance includes a scoped shell-policy template.

Residual risk: public examples prove contract shape, not independent product
adoption or production outcome improvement.

## Tests And CI

Risk after remediation: **Low locally**; **Medium until the branch CI run is
observed**.

- The full Node test suite covers unit, integration, and E2E layers; current
  run totals belong in observed validation output rather than this durable audit.
- Coverage gates require at least 85% lines, 70% branches, and 90% functions,
  plus critical-module floors and complete maintenance-module loading.
- The targeted mutation gate remains accurately scoped to three selected
  high-risk operators; it is not described as repository-wide mutation testing.
- GitHub workflows install locked development dependencies with
  `npm ci --ignore-scripts`.
- Windows-compatible validators include the generated and model-validation
  surfaces; Bash-only checks retain explicit platform semantics.
- Package CI builds twice and compares bytes.

Residual risk: local success cannot prove the pushed branch's GitHub Actions,
rulesets, protected environments, or dependency-review service state.

## Security

Risk after remediation: **Medium-Low**.

- The shell broker is default-deny and rejects shell composition, pipes,
  redirects, expansions, parent traversal, unsafe external working-directory
  options, and symlinked policy files.
- Write/Edit path containment, hard-link protection, secret detection, post-write
  verification, and audit-log stale-lock recovery remain covered.
- Standard schema validation fails closed on unknown formats and schema compile
  errors.
- Distribution and secret scanning include tracked, untracked, generated-looking,
  large-text, binary, and historical boundaries.

Residual risk: a user can still explicitly authorize a general external shell
outside the plugin broker in the host assistant. The plugin is a guardrail, not
an operating-system sandbox. Consumer policy should remain narrow and reviewed.

## Release And Supply Chain

Risk after remediation: **Low in local verification logic**; **High if operators
bypass the documented GitHub process**.

- Candidate bundles contain required evidence rather than merely referring to
  local files.
- Manifest records use collision-safe paths, sizes, hashes, schemas, and
  promotion-required flags.
- Stable promotion verifies candidate tag identity and signature, original
  candidate attestations with expected repository/workflow identity, all required
  evidence, and a deterministic rebuild while preserving the original RC bytes.
- Candidate generation requires a current independent approval bound to the
  pull request's final head commit by a reviewer who is neither PR author nor
  candidate actor.
- Recovery verification downloads, verifies, safely extracts, re-attests, and
  runs promotion verification without publishing a release.
- Label automation creates or updates catalog labels and never deletes labels.

Residual risk: the repository currently demonstrates only one signer and has no
recorded successful recovery drill or signing-key rotation. No tag or release
should be created until those release-specific operational gates and branch CI
are independently verified.

## Risk And ROI Roadmap

| Phase | Severity | Investment | Expected return | Executable actions | Exit condition |
| --- | --- | ---: | --- | --- | --- |
| A. Before any release | High | Medium | Prevents unsupported compatibility and supply-chain claims | Retain the full current dataset plan for each known-good assistant from a clean commit; obtain independent review; observe branch CI; add a second authorized signer; perform and record recovery plus key-rotation drills | All required evidence is digest-bound, current, independently reviewed, and externally verified |
| B. Adoption proof | Medium | Medium | Converts engineering control strength into product evidence | Run exact-commit public fixture transcripts with consenting external users; record completion, missing-input recall, approval blocking, unrelated writes, and validation honesty; keep raw private data out of the repository | Adoption ledger changes from `not-demonstrated` only when reproducible evidence exists |
| C. Targeted robustness | Medium | Low to Medium | Improves high-risk confidence without growing surface area | Add mutations for approval downgrade, evidence omission, route missing fields, Windows paths, and process timeouts; add fuzz/property tests around parsers and manifest resolution | Each newly identified high-risk failure mode has a killing assertion |
| D. Conditional product expansion | Low | High | Avoids premature ecosystem cost | Keep commands, packs, multi-plugin layout, hosted portal, and dynamic loading frozen until repeated external demand and ownership capacity are demonstrated | A reviewed product decision includes adoption evidence, maintenance owner, threat model, and rollback plan |

Priority is based on residual risk and return, not novelty. Phase A blocks a
release; phases B and C can proceed without publishing; phase D remains deferred.

## Final Verification

The following evidence must be refreshed on the final implementation state:

```bash
npm test
npm run test:coverage:check
npm run test:mutation:critical
npm audit --audit-level=high
node scripts/validate-plugin-install.mjs --dry-run
node scripts/scan-distribution-risk.mjs
node scripts/validate-all.mjs --write-timings
git diff --check
```

Deterministic release artifacts must also be built twice and compared. A full
adapter-loaded live run should be retained only from a clean commit; it is
evaluation evidence, not authorization to tag or release.
