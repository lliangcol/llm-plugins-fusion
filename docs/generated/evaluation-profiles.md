# Evaluation profiles

Generated from `governance/evaluation-profiles.json`. Planned, executed, passed, skipped, and blocked are never interchangeable.

| Profile | Dataset | Mode | Cases | Planned | Executed | Passed | Skipped | Blocked | Evidence |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| critical | critical-live | external-live | 8 | 32 | 0 | 0 | 0 | 32 | external-evidence |
| pr | live-paired | plan-only | 84 | 84 | 0 | 0 | 0 | 0 | not-verified |
| nightly | live-paired | simulation | 84 | 84 | 0 | 0 | 0 | 0 | not-verified |
| release | live-paired | external-live | 168 | 2016 | 0 | 0 | 0 | 2016 | external-evidence |
| manual | live-paired | external-live | 168 | 2016 | 0 | 0 | 0 | 2016 | external-evidence |

The 24-task real-task benchmark remains a separate dataset with 432 planned external invocations and zero newly authorized executions in this remediation. Legacy minimal CLI observations do not raise compatibility levels.
