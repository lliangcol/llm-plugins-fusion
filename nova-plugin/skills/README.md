# nova-plugin Skills Index

This directory provides one-to-one Skill mappings for all commands in `nova-plugin/commands`.

Shared policy files live in `nova-plugin/skills/_shared/` and are referenced by
the command-specific skills for parameter resolution, safety preflight, output
contracts, artifact policy, and agent routing boundaries.

## Commands to Skills Mapping

| Command              | Skill name                | Summary                                   | user-invocable | destructive-actions |
| -------------------- | ------------------------- | ----------------------------------------- | -------------- | ------------------- |
| `codex-review-fix`   | `nova-codex-review-fix`   | Codex review/fix/verify semi-auto loop    | true           | medium              |
| `codex-review-only`  | `nova-codex-review-only`  | Codex-driven branch review only           | true           | low                 |
| `codex-verify-only`  | `nova-codex-verify-only`  | Codex verify against existing review file | true           | low                 |
| `backend-plan`       | `nova-backend-plan`       | Java/Spring 12-section design plan output | true           | low                 |
| `explore`            | `nova-explore`            | Unified exploration Hub                   | true           | none                |
| `explore-lite`       | `nova-explore-lite`       | Observer-mode quick exploration           | true           | none                |
| `explore-review`     | `nova-explore-review`     | Reviewer-mode exploration                 | true           | none                |
| `finalize-lite`      | `nova-finalize-lite`      | Minimal close-out summary                 | true           | none                |
| `finalize-work`      | `nova-finalize-work`      | Full handoff packaging output             | true           | none                |
| `implement-lite`     | `nova-implement-lite`     | Fast pragmatic implementation             | true           | medium              |
| `implement-plan`     | `nova-implement-plan`     | Strict approved-plan execution            | true           | medium              |
| `implement-standard` | `nova-implement-standard` | Controlled standard execution             | true           | medium              |
| `plan-lite`          | `nova-plan-lite`          | Lightweight planning                      | true           | none                |
| `plan-review`        | `nova-plan-review`        | Plan critical review                      | true           | none                |
| `produce-plan`       | `nova-produce-plan`       | Formal plan document generation           | true           | low                 |
| `review`             | `nova-review`             | Unified review Hub                        | true           | none                |
| `review-lite`        | `nova-review-lite`        | Lightweight review                        | true           | none                |
| `review-only`        | `nova-review-only`        | Standard-depth review                     | true           | none                |
| `review-strict`      | `nova-review-strict`      | Strict exhaustive review                  | true           | none                |
| `route`              | `nova-route`              | Read-only workflow route selection        | true           | none                |
| `senior-explore`     | `nova-senior-explore`     | Deep exploration + optional export        | true           | low                 |

## Recommended Entrypoints

1. Use `nova-codex-review-fix` when you need a review -> fix -> verify closed loop with external Codex scripts.
2. Use `nova-route` as the read-only first-stage router when the next command, skill, agent, pack, or validation path is unclear.
3. Use `nova-explore` for unified exploration routing; use `nova-senior-explore` for deep analysis.
4. Use `nova-review` for unified severity-based routing; use `nova-review-lite` for daily quick checks.
5. Use `nova-produce-plan` for formal docs; use `nova-backend-plan` for Java/Spring-specific design.

## Troubleshooting

1. Skills not discovered: verify path `nova-plugin/skills/<skill-name>/SKILL.md` and kebab-case folder names.
2. Skill not triggered: ensure prompt semantics align with `description` and `argument-hint`.
3. Hub route mismatch: pass explicit `PERSPECTIVE` for `nova-explore` and `LEVEL` for `nova-review`.
4. File write failures: ensure output path is valid and writable.
5. Contract drift: run `node scripts/lint-frontmatter.mjs`; it checks command descriptions, command-to-skill mappings, required skill sections, side-effect safety references, and tool/destructive-action consistency.

## Discovery Notes

- `nova-plugin/.claude-plugin/plugin.json` does not explicitly list skills.
- By repository convention and Claude Code discovery pattern, skills are placed under `nova-plugin/skills/*/SKILL.md`.
