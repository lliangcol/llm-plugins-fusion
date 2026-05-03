# Project Status Audit - 2026-04-28

> Historical archived report. This file records the repository state observed on
> 2026-04-28 and is not a current health report. Current validation state should
> be checked with `node scripts/validate-all.mjs`.

## Scope

This report records the current repository state for `D:\Projects\claude-plugins-fusion`.

Audit coverage:

- Git working tree status
- Repository validation scripts
- Command / skill / active-agent inventory
- Documentation freshness and broken local links
- Temporary or intermediate files
- Gaps that should be completed before the next release

## Remediation Status

Status after the follow-up fix pass on 2026-04-28:

- Broken Markdown links: fixed; current local link scan reports `broken_count=0`.
- Outdated `1.0.7` / `1.0.0` user-facing version references: fixed for `README.md` and `nova-plugin/docs/*`.
- Missing standalone `/explore` and `/review` docs: fixed.
- Missing Codex command English READMEs: fixed.
- Hook validation: added `scripts/validate-hooks.mjs` and wired it into CI / release workflows.
- Line-ending policy: added `.gitattributes`.
- Archive count wording: `verify-agents` scripts now distinguish archive Markdown files from legacy agent files.

Remaining environment limitation:

- `bash -n` hook syntax checks are configured for Bash-capable environments, but they were not run locally because this Windows environment does not expose native Bash and WSL has no usable distribution.

## Validation Summary

Passed:

```text
node scripts/validate-schemas.mjs
node scripts/lint-frontmatter.mjs
node scripts/validate-hooks.mjs
.\scripts\verify-agents.ps1
node -e "JSON.parse(require('fs').readFileSync('nova-plugin/hooks/hooks.json','utf8')); console.log('hooks json valid')"
```

Current inventory:

```text
commands: 20
skills: 20
active agents: 14
command/skill pairing: no missing pairs found
```

Not completed in the current local environment:

```text
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

Reason: native `bash` is not available in the current PowerShell PATH, and WSL is present but has no usable distribution / access for this workspace.

## Findings

### P1 - Broken Local Documentation Links

The local Markdown link scan found 6 broken relative links.

| File | Line | Broken target | Notes |
| --- | ---: | --- | --- |
| `README.md` | 27 | `./nova-plugin/docs/README.md` | `nova-plugin/docs/README.md` does not exist. The available file is `nova-plugin/docs/README.en.md`. |
| `nova-plugin/docs/README.en.md` | 149 | `nova-plugin/docs/commands-reference-guide.md` | Path is written as if the file were at repo root; from `nova-plugin/docs/README.en.md`, this resolves incorrectly. |
| `nova-plugin/docs/README.en.md` | 150 | `nova-plugin/docs/claude-code-commands-handbook.md` | Same relative-path issue. |
| `nova-plugin/docs/README.en.md` | 151 | `nova-plugin/docs/codex-review-fix.README.md` | Same relative-path issue. |
| `nova-plugin/docs/README.en.md` | 152 | `docs/agents/ROUTING.md` | From `nova-plugin/docs/`, this should point back to repo-root `docs/agents/ROUTING.md`. |
| `nova-plugin/docs/README.en.md` | 153 | `nova-plugin/docs/agents-summary.en.md` | Same relative-path issue. |

Recommended fix:

- Correct `README.md` line 27 to an existing target, or add the missing Chinese `nova-plugin/docs/README.md`.
- In `nova-plugin/docs/README.en.md`, rewrite links relative to `nova-plugin/docs/`, for example `commands-reference-guide.md` or `../../docs/agents/ROUTING.md`.

### P1 - Outdated Version References In User-Facing Docs

The source of truth is `nova-plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; both currently report version `1.0.8`.

Outdated references found:

| File | Line | Current text |
| --- | ---: | --- |
| `README.md` | 147 | `<td>1.0.7</td>` |
| `nova-plugin/docs/README.en.md` | 9 | badge version `1.0.7` |
| `nova-plugin/docs/README.en.md` | 106 | `<td>1.0.7</td>` |
| `nova-plugin/docs/commands-reference-guide.md` | 3 | `版本: 1.0.7` |
| `nova-plugin/docs/commands-reference-guide.en.md` | 3 | `Version: 1.0.0` |

Recommended fix:

- Update these references to `1.0.8` if they represent the current plugin release.
- If a document has its own independent doc version, rename the label to avoid confusion with plugin version.

### P1 - Working Tree Contains Uncommitted Changes

Current `git status --short`:

```text
 M CLAUDE.md
 M nova-plugin/hooks/hooks.json
 M scripts/lint-frontmatter.mjs
```

These appear to be recent maintenance changes:

- `CLAUDE.md`: clearer quality gates, hook guidance, `.codex/` artifact guidance, command write-boundary guidance.
- `nova-plugin/hooks/hooks.json`: hook scripts now invoked through `bash`.
- `scripts/lint-frontmatter.mjs`: skill `license` and `allowed-tools` are enforced as errors; `license` must be `MIT`.

Recommended fix:

- Review and commit these changes before release, or continue editing them deliberately.
- Be aware that Git reports line-ending warnings because `core.autocrlf=true` and the repo has no `.gitattributes`.

### P2 - Hook Quality Gate Exists In CLAUDE.md But Is Not In CI / Release Workflows

`CLAUDE.md` now lists a hook-specific gate:

```text
node -e "JSON.parse(require('fs').readFileSync('nova-plugin/hooks/hooks.json','utf8'))"
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

However, `.github/workflows/ci.yml` and `.github/workflows/release.yml` still run only:

- `bash scripts/verify-agents.sh`
- `node scripts/validate-schemas.mjs`
- `node scripts/lint-frontmatter.mjs`

Recommended fix:

- Add a `validate-hooks` job or step to CI and release validation.
- Alternatively, create `scripts/validate-hooks.mjs` / `.sh` and reference it from docs and workflows.

### P2 - Unified Commands Are Missing Standalone Command Docs

The repository has command definitions for unified entry points:

- `nova-plugin/commands/explore.md`
- `nova-plugin/commands/review.md`

But these standalone docs are missing:

```text
nova-plugin/docs/explore.md
nova-plugin/docs/explore.README.md
nova-plugin/docs/explore.README.en.md
nova-plugin/docs/review.md
nova-plugin/docs/review.README.md
nova-plugin/docs/review.README.en.md
```

The unified commands are covered inside `commands-reference-guide.md`, but they do not have the same per-command documentation coverage as most other commands.

Recommended fix:

- Add standalone docs for `/explore` and `/review`, or explicitly document that unified commands are documented only in the command reference guide.

### P2 - Codex Command English README Coverage Is Incomplete

The following Codex commands have Chinese README docs but no `.README.en.md` counterpart:

```text
codex-review-fix
codex-review-only
codex-verify-only
```

Recommended fix:

- Add English README files for these commands if the project intends to keep bilingual command docs.
- Or document that Codex command docs are Chinese-only for now.

### P2 - `.codex/` Runtime / Skill Cache Exists In The Workspace

Ignored runtime/intermediate directory detected:

```text
.codex/
files: 32
size: 585396 bytes
```

Contents include:

- `.codex/skills/ui-ux-pro-max/`
- Python cache files under `.codex/skills/ui-ux-pro-max/scripts/__pycache__/`

`.gitignore` already ignores `.codex/`, so these files are not staged by default.

Recommended fix:

- No commit action is needed.
- Clean `.codex/` before packaging/release if producing a clean source snapshot outside Git.
- Keep `CLAUDE.md` guidance that `.codex/` runtime artifacts must not be committed.

### P2 - Line Ending Policy Is Not Explicit

Current state:

```text
.gitattributes: absent
git config core.autocrlf: true
```

Git reports warnings such as:

```text
LF will be replaced by CRLF the next time Git touches it
```

Recommended fix:

- Add `.gitattributes` to pin expected line endings for Markdown, JSON, JS/MJS, PowerShell, and shell scripts.
- Shell scripts should generally remain LF.

### P3 - Archive Count Wording Can Be Misread

`scripts/verify-agents.ps1` reports:

```text
Archive md files: 70
```

User-facing docs report:

```text
Legacy agents: 69
```

Both can be true because `.claude/agents/archive/NOTICE.md` is also a Markdown file, while `.claude/agents/archive/nova-plugin/agents/` contains 69 legacy agent files.

Recommended fix:

- Adjust verify script output to distinguish `archive md files` from `legacy agent files`.
- Or update docs with a note that the archive also contains `NOTICE.md`.

### P3 - TODO / Placeholder Scan

No actionable TODO/FIXME/HACK items were found in active project docs or scripts.

Matches found were either:

- Normal prose in `CODE_OF_CONDUCT.md`
- Explanatory text in archived agents
- Operational descriptions in Codex scripts/docs

No immediate cleanup required.

## Suggested Next Actions

1. Fix broken Markdown links in `README.md` and `nova-plugin/docs/README.en.md`.
2. Synchronize all visible version references to `1.0.8`, or clarify which docs have independent document versions.
3. Decide whether to commit the current maintenance changes in `CLAUDE.md`, `hooks.json`, and `lint-frontmatter.mjs`.
4. Add hook validation to CI/release workflows or centralize it in a script.
5. Add standalone `/explore` and `/review` docs, or mark their coverage as command-reference-only.
6. Add `.gitattributes` to prevent accidental CRLF conversion in shell scripts and generated diffs.
