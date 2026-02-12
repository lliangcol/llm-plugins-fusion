# nova-plugin Skills Index

This directory provides one-to-one Skill mappings for all commands in `nova-plugin/commands`.

## Commands to Skills Mapping

| Command              | Skill name                | Summary                                   | user-invocable | destructive-actions |
| -------------------- | ------------------------- | ----------------------------------------- | -------------- | ------------------- |
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
| `senior-explore`     | `nova-senior-explore`     | Deep exploration + optional export        | true           | low                 |

## Recommended Entrypoints

1. Use `nova-explore` for unified exploration routing; use `nova-senior-explore` for deep analysis.
2. Use `nova-review` for unified severity-based routing; use `nova-review-lite` for daily quick checks.
3. Use `nova-produce-plan` for formal docs; use `nova-backend-plan` for Java/Spring-specific design.

## Troubleshooting

1. Skills not discovered: verify path `nova-plugin/skills/<skill-name>/SKILL.md` and kebab-case folder names.
2. Skill not triggered: ensure prompt semantics align with `description` and `argument-hint`.
3. Hub route mismatch: pass explicit `PERSPECTIVE` for `nova-explore` and `LEVEL` for `nova-review`.
4. File write failures: ensure output path is valid and writable.

## Discovery Notes

- `nova-plugin/.claude-plugin/plugin.json` does not explicitly list skills.
- By repository convention and Claude Code discovery pattern, skills are placed under `nova-plugin/skills/*/SKILL.md`.
