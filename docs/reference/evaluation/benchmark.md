<!-- migrated-from: docs/quality/benchmark.md -->
# Public Workflow Quality Benchmark

Status: generated
Date: 2026-07-12

## Claim Boundary

Static results prove dataset/spec integrity and simulation proves deterministic adapter state transitions. The checked-in live files below are legacy bare-CLI observations covering only two public-safe prompts; they do not load an adapter, prove broad model quality, establish production latency, or prove release publication. The current `live-paired` runner derives 168 cases and 2016 planned invocations from the dataset and paired-plan parameters. The separate `real-task-benchmark` derives 24 tasks and 432 planned invocations. Neither plan upgrades claims until complete digest-bound records are retained.

## Staged Live Execution Safety

The bounded `pilot` is 12 invocations: one canonical review case, 2 assistants, 2 conditions, and 3 attempts. The governed `critical` profile is 96 invocations. The full v5 release profile is 2016 invocations. The profile registry is the source of truth. Preview each of the four pilot assistant/condition slices with a hard three-call cap before authorizing any authenticated invocation:

```bash
node scripts/run-live-assistant-evals.mjs --assistant codex --profile pilot --condition plugin-enabled --max-invocations 3 --output .metrics/live-eval/pilot-codex-enabled.json --plan
```

Remove `--plan` only after verifying the case list, assistant, condition, attempts, planned calls, cap, output location, and estimated evidence level. All four pilot slices must pass from clean commits with current source digests before the runner authorizes `critical`; both pilot and critical evidence are prerequisites for `full`. Prerequisite paths are supplied through `--prerequisite-evidence`, and stale, incomplete, duplicate, unsafe, or semantically failing evidence is rejected before assistant discovery. The runner also records a per-invocation timeout (maximum 240000 ms) and a total runtime cap (maximum 900000 ms); lower values may be supplied explicitly with `--timeout-ms` and `--max-total-runtime-ms`. Unknown arguments, an attempts override that differs from governance, unsafe output paths, unsafe timeout values, and planned calls above `--max-invocations` fail before assistant discovery or execution. Raw stdout, stderr, model responses, CLI debug logs, and last-message files exist only inside a disposable OS temporary directory and are removed after each attempt. Codex additionally uses a disposable `CODEX_HOME`, copies only the existing authentication record into it for the invocation, and disables configured MCP, plugin, shell, web-search, browser, computer-use, image, and workspace-dependency surfaces. Public or committable records retain normalized results, counts, timings, reported usage, bounded summaries, and SHA-256 digests; credentials, raw prompts, and local absolute paths are rejected. Token and cost values remain `null` when the CLI does not report them, with `usageStatus` and a stable `usageReasonCode` explaining availability; the runner never estimates them.

Tool evidence separates allowed read-only orchestration, dangerous attempts, completed dangerous execution, denied or failed dangerous attempts, and fail-closed unknown use. Claude `Skill` is allowed read-only orchestration and canonical adapter-load evidence only for `plugin-enabled`; any `Skill` signal in `plugin-disabled` fails evidence classification. Denied `Write`, `Edit`, `NotebookEdit`, `Bash`, or unauthorized network tools remain visible but do not count as executed unsafe tool use. Codex JSONL items are deduplicated by item id and retain the final normalized lifecycle state: only completed dangerous calls count as executed, failed or denied calls remain behavioral evidence, and started-only or unknown lifecycles fail closed. Public records retain only tool type, normalized status, hashed item identity, and public-safe or hashed MCP server/tool identifiers; parameters, responses, paths, credentials, and raw events are discarded.

`adapterStaged`, `adapterLoadObserved`, and `contractValid` are independent facts. A matching staged Codex `AGENTS.md` digest does not prove that the runtime loaded it, and a route failure does not negate staging or load evidence. Claude `Skill` supplies an observed load signal. Codex JSONL currently has no explicit `AGENTS.md` load event, so the load state is `unavailable` with a stable reason code rather than inferred from contract success. Windows executable lookup prefers direct `.exe` files and recognizes only fixed-argv Volta or Node `.cmd` shims; generic shell execution and command-string interpretation are forbidden.

## Deterministic Gates

| Layer | Passed | Safety result |
| --- | ---: | --- |
| Static contract | 12/12 | Invented surface rate 0 |
| Adapter simulation | 24/24 | Unsafe continuation 0 |
| Targeted critical mutants | 7/7 | Three manually selected operators; not a repository-wide mutation score |

## Historical Bare-CLI Exact-Version Observations

| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | Median ms | Min–max ms | n | Workflow digest |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| claude-code | 2.1.205 (Claude Code) | 2/2 | 0 | 0 | 12482 | 12215–12748 | 2 | a0004c565a79 |
| codex | codex-cli 0.144.0-alpha.4 | 2/2 | 0 | 0 | 45833 | 43352–48314 | 2 | a0004c565a79 |

Small samples are reported as median and range, not P95. Failed or superseded probes remain under `evals/evidence-attempts/` and never upgrade compatibility. Current claims are derived in `governance/compatibility-evidence.generated.json`.
