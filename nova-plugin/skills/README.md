# nova-plugin Skills Index

This directory provides six canonical runtime Skills. The 21 files in
`nova-plugin/commands` are generated wrappers. Six canonical commands select
their same-named Skill directly; 15 deprecated compatibility aliases select a
canonical Skill plus a fixed variant preset without copying behavior.

Shared policy files live in `nova-plugin/skills/_shared/` and are referenced by
the canonical Skills for parameter resolution, safety preflight, output
contracts, artifact policy, and agent-routing boundaries.

## Command to Canonical Skill Mapping

| Command | Canonical Skill | Variant preset | Status |
| --- | --- | --- | --- |
| `backend-plan` | `nova-produce-plan` | `{"PLAN_PROFILE":"java-backend"}` | deprecated compatibility alias |
| `codex-review-fix` | `nova-implement-plan` | `{"EXECUTION_PROFILE":"codex-review-fix"}` | deprecated compatibility alias |
| `codex-review-only` | `nova-review` | `{"REVIEW_PROFILE":"codex-review-only"}` | deprecated compatibility alias |
| `codex-verify-only` | `nova-review` | `{"REVIEW_PROFILE":"codex-verify-only"}` | deprecated compatibility alias |
| `explore` | `nova-explore` | `{}` | canonical |
| `explore-lite` | `nova-explore` | `{"PERSPECTIVE":"observer","DEPTH":"lite"}` | deprecated compatibility alias |
| `explore-review` | `nova-explore` | `{"PERSPECTIVE":"reviewer"}` | deprecated compatibility alias |
| `finalize-lite` | `nova-finalize-work` | `{"DEPTH":"lite"}` | deprecated compatibility alias |
| `finalize-work` | `nova-finalize-work` | `{}` | canonical |
| `implement-lite` | `nova-implement-plan` | `{"EXECUTION_PROFILE":"lite"}` | deprecated compatibility alias |
| `implement-plan` | `nova-implement-plan` | `{}` | canonical |
| `implement-standard` | `nova-implement-plan` | `{"EXECUTION_PROFILE":"standard"}` | deprecated compatibility alias |
| `plan-lite` | `nova-produce-plan` | `{"PLAN_PROFILE":"lite"}` | deprecated compatibility alias |
| `plan-review` | `nova-review` | `{"REVIEW_PROFILE":"plan"}` | deprecated compatibility alias |
| `produce-plan` | `nova-produce-plan` | `{}` | canonical |
| `review` | `nova-review` | `{}` | canonical |
| `review-lite` | `nova-review` | `{"LEVEL":"lite"}` | deprecated compatibility alias |
| `review-only` | `nova-review` | `{"LEVEL":"standard","MODE":"findings-only"}` | deprecated compatibility alias |
| `review-strict` | `nova-review` | `{"LEVEL":"strict"}` | deprecated compatibility alias |
| `route` | `nova-route` | `{}` | canonical |
| `senior-explore` | `nova-explore` | `{"DEPTH":"deep"}` | deprecated compatibility alias |

## Recommended Entrypoints

1. Use `nova-route` when the next workflow, agent, pack, or validation path is unclear.
2. Use `nova-explore` for observer, reviewer, lite, or deep exploration variants.
3. Use `nova-produce-plan` for lightweight, formal, or Java-backend planning variants.
4. Use `nova-review` for lite, standard, strict, plan, and external Codex review variants.
5. Use `nova-implement-plan` for approved-plan, lite, standard, or Codex review/fix execution variants.
6. Use `nova-finalize-work` for full or lite handoff variants.

## Troubleshooting

1. Skill not discovered: verify one of the six canonical paths at `nova-plugin/skills/<skill-name>/SKILL.md`.
2. Alias behavior mismatch: inspect its generated command wrapper and fixed variant preset in the table above.
3. Hub route mismatch: pass explicit `PERSPECTIVE` for exploration or `LEVEL` for review.
4. File-write failure: verify the selected canonical Skill permits the requested artifact or project effect.
5. Contract drift: run `node scripts/lint-frontmatter.mjs`; it checks this index against workflow ownership and the six on-disk Skills.

## Discovery Notes

- `nova-plugin/.claude-plugin/plugin.json` does not explicitly list Skills.
- By repository convention and Claude Code discovery behavior, canonical Skills live under `nova-plugin/skills/nova-*/SKILL.md`.
- Deprecated command aliases remain available for 4.x compatibility, but their historical `nova-<command>` names are not separate Skills.
