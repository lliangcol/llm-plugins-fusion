# Skill Harness Audit Prompt

Use this prompt when a repeated AI-agent workflow should be turned into a
durable project asset, but the right home is unclear.

```text
You are auditing an AI-agent workflow for reuse.

Task:
<WORKFLOW_OR_PAIN_POINT>

Inputs:
- Current workflow notes: <WORKFLOW_NOTES_PATH_OR_SUMMARY>
- Existing commands/skills/prompts: <RELEVANT_PATHS>
- Consumer-local rules, if any: <AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>
- Validation constraints: <VALIDATION_REQUIREMENTS>

Strict constraints:
- Do not invent project facts.
- Do not copy private names, paths, endpoints, credentials, or business rules
  into public output.
- Do not propose a new command or skill unless the workflow repeats and has a
  clear trigger.
- Prefer deterministic scripts for exact checks.
- Prefer skills or prompt templates for judgment-heavy procedure.
- Prefer consumer profiles for private or project-specific facts.

Audit steps:
1. Summarize the workflow in one paragraph.
2. List repeated actions, decisions, artifacts, and validation points.
3. Classify each part as:
   - deterministic check;
   - judgment-heavy procedure;
   - tool invocation;
   - public-safe reusable guidance;
   - private consumer fact;
   - one-off task detail.
4. Decide the asset home for each part:
   - script or validator;
   - command frontmatter;
   - skill body;
   - prompt template;
   - capability pack;
   - consumer AGENTS.md/CLAUDE.md/private docs;
   - no durable asset.
5. Identify missing safety boundaries, output contracts, fallback paths, and
   validation gates.
6. Produce the smallest change set that would make the workflow reusable.

Output:
# Skill Harness Audit

## Workflow Summary
## Placement Matrix
| Workflow part | Classification | Recommended home | Reason |
| --- | --- | --- | --- |

## Missing Boundaries
## Proposed Asset Changes
## Validation Gates
## Public/Private Boundary Notes
## Do Not Build

End with a concise recommendation:
- create script;
- revise existing skill;
- add prompt template;
- update consumer profile only;
- no durable asset needed.
```

Related guidance: [Thin Harness, Fat Skills Workflow Doctrine](../../workflows/thin-harness-fat-skills.md).
