# Effective Permissions

Status: generated

Generated from `nova-plugin/runtime/workflow-permissions.json` by `node scripts/generate-workflow-permissions.mjs --write`. `allowed-tools` are pre-approvals, not a complete whitelist.

- Known-good Claude CLI: `2.1.205`
- Expected installed Skills: 42

| Invocation | Visibility | Risk | Model invocable | Pre-approved | Disallowed | Permission prompt |
| --- | --- | --- | --- | --- | --- | --- |
| `/nova-plugin:backend-plan` | advanced | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:nova-backend-plan` | compatibility | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:codex-review-fix` | advanced | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:nova-codex-review-fix` | compatibility | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:codex-review-only` | advanced | low | false | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:nova-codex-review-only` | compatibility | low | false | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:codex-verify-only` | advanced | low | false | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:nova-codex-verify-only` | compatibility | low | false | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:explore` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-explore` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:explore-lite` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-explore-lite` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:explore-review` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-explore-review` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:finalize-lite` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-finalize-lite` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:finalize-work` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:nova-finalize-work` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:implement-lite` | advanced | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:nova-implement-lite` | compatibility | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:implement-plan` | primary | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:nova-implement-plan` | compatibility | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:implement-standard` | advanced | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:nova-implement-standard` | compatibility | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:plan-lite` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-plan-lite` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:plan-review` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-plan-review` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:produce-plan` | primary | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:nova-produce-plan` | compatibility | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:review` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-review` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:review-lite` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-review-lite` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:review-only` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-review-only` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:review-strict` | advanced | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-review-strict` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:route` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-route` | compatibility | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:senior-explore` | advanced | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:nova-senior-explore` | compatibility | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
