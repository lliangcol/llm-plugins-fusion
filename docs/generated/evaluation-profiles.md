# Evaluation profiles

Generated from `governance/evaluation-profiles.json`. Planned, executed, passed, skipped, and blocked are never interchangeable.

| Profile | Dataset | Mode | Cases | Planned | Prerequisites | Executed | Passed | Skipped | Blocked | Evidence |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| pilot | critical-live@v5 | external-live | 1 | 12 | none | 0 | 0 | 0 | 12 | external-evidence |
| critical | critical-live@v5 | external-live | 8 | 96 | pilot | 0 | 0 | 0 | 96 | external-evidence |
| pr | live-paired@v5 | plan-only | 84 | 84 | none | 0 | 0 | 0 | 0 | not-verified |
| nightly | live-paired@v5 | simulation | 84 | 84 | none | 0 | 0 | 0 | 0 | not-verified |
| release | live-paired@v5 | external-live | 168 | 2016 | pilot, critical | 0 | 0 | 0 | 2016 | external-evidence |
| manual | live-paired@v5 | external-live | 168 | 2016 | pilot, critical | 0 | 0 | 0 | 2016 | external-evidence |

The 12-invocation pilot must pass before the 96-invocation critical profile is authorized. The full release or manual matrix additionally requires successful critical evidence. The runner verifies all prerequisite assistant/condition slices against current source digests before any authenticated invocation. The 24-task real-task benchmark remains a separate dataset with 432 planned external invocations and zero newly authorized executions in this remediation. Legacy minimal CLI observations do not raise compatibility levels.
