# Public Workflow Quality Benchmark

Status: generated
Date: 2026-07-12

## Claim Boundary

Static results prove dataset/spec integrity and simulation proves deterministic adapter state transitions. The checked-in live files below are legacy bare-CLI observations covering only two public-safe prompts; they do not load an adapter, prove broad model quality, establish production latency, or prove release publication. The current `live-paired` runner derives 168 cases and 1008 planned invocations from the dataset and paired-plan parameters. The separate `real-task-benchmark` derives 24 tasks and 432 planned invocations. Neither plan upgrades claims until complete digest-bound records are retained.

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
