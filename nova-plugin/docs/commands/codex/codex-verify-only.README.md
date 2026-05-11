# /codex-verify-only

- 来源：`nova-plugin/commands/codex-verify-only.md`

## 命令定位

- 基于已有 `review.md` 做 Codex verify
- 输出 `verify.md` 与 `verify.runtime-environment.txt`
- 适用：修复后复验、多人协作二次确认

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REVIEW_FILE` | Yes | 上一轮 `review.md` 路径 | `.codex/codex-review-fix/latest-artifacts/review.md` |
| `CHECKS_FILE` | No | 本地 checks 输出文件 | `.codex/codex-review-fix/latest-artifacts/checks.txt` |
| `BASE` | No | 基线分支 | `main` |

## 示例

```text
/codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt BASE=main
```
