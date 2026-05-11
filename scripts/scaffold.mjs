#!/usr/bin/env node
/**
 * Scaffold nova-plugin command/skill pairs and required command docs.
 *
 * Usage:
 *   node scripts/scaffold.mjs command /foo --stage plan --description "Create a lightweight foo plan."
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const STAGES = new Set(['explore', 'plan', 'implement', 'review', 'finalize']);
const DESTRUCTIVE_ACTIONS = new Set(['none', 'low', 'medium', 'high']);
const KNOWN_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'Write', 'Edit', 'MultiEdit', 'Bash']);
const SIDE_EFFECT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash']);
const VALUE_FLAGS = new Set([
  'stage',
  'description',
  'profile',
  'allowed-tools',
  'destructive-actions',
  'argument-hint',
  'input-name',
  'subagent-safe',
  'docs-dir',
]);
const BOOLEAN_FLAGS = new Set(['codex', 'dry-run', 'force', 'help']);

const PROFILES = {
  read: {
    allowedTools: 'Read Glob Grep LS',
    destructiveActions: 'none',
    summary: 'read-only repository inspection',
    inputName: 'INPUT',
  },
  artifact: {
    allowedTools: 'Read Glob Grep LS Write Edit',
    destructiveActions: 'low',
    summary: 'explicit artifact writing without production code edits',
    inputName: 'INPUT',
  },
  implementation: {
    allowedTools: 'Read Glob Grep LS Write Edit MultiEdit Bash',
    destructiveActions: 'medium',
    summary: 'bounded project-code edits and local validation',
    inputName: 'TASK',
  },
};

function usage() {
  return `Scaffold nova-plugin command/skill pairs.

Usage:
  node scripts/scaffold.mjs command /foo --stage plan --description "Create a lightweight foo plan."

Required:
  command <id>                 Command id, with or without leading slash.
  --stage <stage>              One of: explore, plan, implement, review, finalize.
  --description <text>         Command and skill description, at least 20 characters.

Options:
  --profile <name>             read, artifact, or implementation. Default: read.
  --allowed-tools <tools>      Space-separated tool list. Overrides profile tools.
  --destructive-actions <lvl>  none, low, medium, or high. Overrides profile risk.
  --argument-hint <text>       Skill argument hint.
  --input-name <name>          Primary skill input parameter. Default depends on profile.
  --subagent-safe <bool>       true or false. Default: true.
  --docs-dir <dir>             Command docs directory. Use codex for Codex commands.
  --codex                      Shorthand for --docs-dir codex.
  --force                      Overwrite existing scaffold targets.
  --dry-run                    Print target files without writing.
  --help                       Show this help.

Profiles:
  read                          Read-only repository inspection; no project writes.
  artifact                      Explicit artifact writing; no production code edits.
  implementation                Bounded project-code edits; implement stage only.

Examples:
  node scripts/scaffold.mjs command /foo --stage plan --description "Create a practical foo execution plan." --dry-run
  node scripts/scaffold.mjs command /foo-artifact --stage review --profile artifact --description "Write a bounded foo review artifact."
  node scripts/scaffold.mjs command /foo-fix --stage implement --profile implementation --description "Implement a bounded foo fix with validation."
  node scripts/scaffold.mjs command /codex-audit --stage review --profile artifact --docs-dir codex --description "Write a bounded Codex audit artifact."
`;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  console.error('');
  console.error(usage());
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw : raw.slice(0, eq);
    if (!key) fail(`invalid option "${arg}"`);
    if (!BOOLEAN_FLAGS.has(key) && !VALUE_FLAGS.has(key)) {
      fail(`unknown option --${key}`);
    }

    if (BOOLEAN_FLAGS.has(key)) {
      options[key] = eq === -1 ? true : parseBoolean(raw.slice(eq + 1), key);
      continue;
    }

    if (eq !== -1) {
      options[key] = raw.slice(eq + 1);
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) fail(`missing value for --${key}`);
    options[key] = next;
    i += 1;
  }

  return { positional, options };
}

function parseBoolean(value, label) {
  if (value === true || value === false) return value;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  fail(`--${label} must be true or false`);
}

function normalizeCommandId(raw) {
  if (!raw) fail('missing command id');
  let id = raw.trim();
  if (id.startsWith('/')) id = id.slice(1);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
    fail(`command id "${raw}" must be kebab-case, for example /foo or /foo-bar`);
  }
  return id;
}

function normalizeInputName(raw) {
  if (!raw) fail('input name cannot be empty');
  const value = raw.trim().replace(/-/g, '_').toUpperCase();
  if (!/^[A-Z][A-Z0-9_]*$/.test(value)) {
    fail(`input name "${raw}" must resolve to uppercase snake case`);
  }
  return value;
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function splitTools(value) {
  return String(value).trim().split(/\s+/).filter(Boolean);
}

function hasSideEffectTool(allowedTools) {
  return splitTools(allowedTools).some((tool) => SIDE_EFFECT_TOOLS.has(tool));
}

function validateTools(allowedTools) {
  const tools = splitTools(allowedTools);
  if (tools.length === 0) fail('allowed-tools cannot be empty');
  const unknown = tools.filter((tool) => !KNOWN_TOOLS.has(tool));
  if (unknown.length) {
    fail(`unknown allowed tool(s): ${unknown.join(', ')}`);
  }
  const duplicate = tools.find((tool, index) => tools.indexOf(tool) !== index);
  if (duplicate) fail(`allowed-tools contains duplicate tool "${duplicate}"`);
  return tools.join(' ');
}

function validateToolRisk(allowedTools, destructiveActions) {
  const tools = new Set(splitTools(allowedTools));
  if (!DESTRUCTIVE_ACTIONS.has(destructiveActions)) {
    fail(`destructive-actions "${destructiveActions}" must be one of ${[...DESTRUCTIVE_ACTIONS].join(', ')}`);
  }
  if ((tools.has('Write') || tools.has('Edit') || tools.has('MultiEdit')) && destructiveActions === 'none') {
    fail('Write/Edit/MultiEdit tools require destructive-actions other than none');
  }
  if (tools.has('MultiEdit') && !['medium', 'high'].includes(destructiveActions)) {
    fail('MultiEdit requires destructive-actions medium or high');
  }
  if (tools.has('Bash') && destructiveActions === 'none') {
    fail('Bash requires destructive-actions other than none');
  }
}

function validateProfileToolConsistency(profileName, allowedTools, allowedToolsWasOverridden) {
  if (profileName !== 'read' || !allowedToolsWasOverridden || !hasSideEffectTool(allowedTools)) return;
  fail('read profile cannot use side-effect tools from --allowed-tools; choose --profile artifact or --profile implementation');
}

function validateProfileStageConsistency(profileName, stage) {
  if (profileName !== 'implementation' || stage === 'implement') return;
  fail('implementation profile can only be used with --stage implement; choose --profile read or --profile artifact for non-implementation stages');
}

function resolveDocsDir(stage, options) {
  const docsDir = options.codex ? 'codex' : String(options['docs-dir'] ?? stage);
  if (options.codex && options['docs-dir'] && options['docs-dir'] !== 'codex') {
    fail('--codex cannot be combined with --docs-dir other than codex');
  }
  if (docsDir === 'codex') return docsDir;
  if (!STAGES.has(docsDir)) {
    fail(`--docs-dir "${docsDir}" must be codex or one of ${[...STAGES].join(', ')}`);
  }
  if (docsDir !== stage) {
    fail('--docs-dir can only differ from --stage when it is codex');
  }
  return docsDir;
}

function rel(path) {
  return relative(root, path).split(sep).join('/');
}

function buildConfig(positional, options) {
  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  const [kind, rawId, ...extra] = positional;
  if (kind !== 'command') fail('first positional argument must be "command"');
  if (extra.length) fail(`unexpected positional argument(s): ${extra.join(' ')}`);

  const id = normalizeCommandId(rawId);
  const profileName = options.profile ?? 'read';
  const profile = PROFILES[profileName];
  if (!profile) fail(`profile "${profileName}" must be one of ${Object.keys(PROFILES).join(', ')}`);

  const stage = options.stage;
  if (!stage) fail('missing --stage');
  if (!STAGES.has(stage)) fail(`stage "${stage}" must be one of ${[...STAGES].join(', ')}`);
  validateProfileStageConsistency(profileName, stage);

  const description = String(options.description ?? '').trim();
  if (!description) fail('missing --description');
  if (description.length < 20) fail('--description must be at least 20 characters');
  if (description.length > 1024) fail('--description must not exceed 1024 characters');
  if (/[\r\n]/.test(description)) fail('--description must be a single line');

  const allowedToolsWasOverridden = options['allowed-tools'] !== undefined;
  const allowedTools = validateTools(options['allowed-tools'] ?? profile.allowedTools);
  const destructiveActions = String(options['destructive-actions'] ?? profile.destructiveActions);
  validateToolRisk(allowedTools, destructiveActions);
  validateProfileToolConsistency(profileName, allowedTools, allowedToolsWasOverridden);

  const inputName = normalizeInputName(options['input-name'] ?? profile.inputName);
  const skillName = `nova-${id}`;
  const argumentHint = options['argument-hint']
    ? String(options['argument-hint'])
    : `Example: ${id} ${inputName}='describe the request'`;
  const subagentSafe = options['subagent-safe'] === undefined
    ? true
    : parseBoolean(options['subagent-safe'], 'subagent-safe');
  const docsDir = resolveDocsDir(stage, options);

  return {
    id,
    skillName,
    stage,
    docsDir,
    description,
    allowedTools,
    destructiveActions,
    inputName,
    argumentHint,
    subagentSafe,
    profileName,
    profileSummary: profile.summary,
    dryRun: Boolean(options['dry-run']),
    force: Boolean(options.force),
  };
}

function artifactInputRows(config) {
  if (config.profileName !== 'artifact') return '';
  return '| `OUTPUT_PATH` | Yes, for artifact writes | None | Explicit artifact path; do not infer. |\n';
}

function artifactRequiredInputBullets(config) {
  if (config.profileName !== 'artifact') return '';
  return '- `OUTPUT_PATH`: Explicit artifact path; do not infer.\n';
}

function artifactParameterRows(config) {
  if (config.profileName !== 'artifact') return '';
  return '| `OUTPUT_PATH` | Yes | Explicit artifact path; do not infer. | `docs/artifacts/result.md` |\n';
}

function entryInputSummary(config) {
  if (config.profileName === 'artifact') {
    return `Uses \`${config.inputName}\`, required \`OUTPUT_PATH\`, plus optional \`CONSTRAINTS\`.`;
  }
  return `Uses \`${config.inputName}\` plus optional \`CONSTRAINTS\`.`;
}

function exampleArguments(config) {
  const outputPath = config.profileName === 'artifact'
    ? ` OUTPUT_PATH="docs/artifacts/${config.id}.md"`
    : '';
  return `${config.inputName}="Describe the request"${outputPath}`;
}

function safetyBoundaryParameters(config) {
  if (config.profileName === 'artifact') return '`OUTPUT_PATH`';
  return 'none for this skill';
}

function safetyPreflightBlock(config) {
  if (!hasSideEffectTool(config.allowedTools)) {
    return `- This skill is read-only for project files and must not modify code.
- No interrupting preflight is required for ordinary Read/Glob/Grep/LS usage.
- If the workflow is extended to write an explicit artifact or invoke Bash, run the shared preflight first.
- Do not infer safety-boundary values for artifact exports or latest artifact selection.
- Full policy: \`nova-plugin/skills/_shared/safety-preflight.md\`.`;
  }

  const sideEffectTools = splitTools(config.allowedTools)
    .filter((tool) => SIDE_EFFECT_TOOLS.has(tool))
    .map((tool) => `\`${tool}\``)
    .join(', ');
  return `- This skill declares side-effect-capable tools: ${sideEffectTools}.
- Resolve parameters and present a preflight card before writing artifacts, editing project files, or running Bash.
- Show files or artifacts that may be written, scripts or commands that may run, disallowed operations, and the proceed condition.
- Do not infer missing safety-boundary values; ask once in interactive mode or fail in non-interactive mode.
- Preserve repository constraints: no destructive Git cleanup, no branch deletion, no push/merge/rebase, no editing archived agents as active agents.
- Full policy: \`nova-plugin/skills/_shared/safety-preflight.md\`.`;
}

function commandTemplate(config) {
  return `---
id: ${config.id}
stage: ${config.stage}
title: /${config.id}
description: ${yamlQuote(config.description)}
destructive-actions: ${config.destructiveActions}
allowed-tools: ${config.allowedTools}
invokes:
  skill: ${config.skillName}
---

# /${config.id}

Invoke \`${config.skillName}\` with \`$ARGUMENTS\`.

This slash entry is intentionally thin. The skill is the source of truth for parameter resolution, workflow, output format, and safety boundaries.

Entry semantics:

- ${entryInputSummary(config)}
- Follows the \`${config.profileName}\` scaffold profile: ${config.profileSummary}.
- Keep reusable behavior in \`${config.skillName}\`.
`;
}

function skillTemplate(config) {
  return `---
name: ${config.skillName}
description: ${yamlQuote(config.description)}
license: MIT
allowed-tools: ${config.allowedTools}
argument-hint: ${yamlQuote(config.argumentHint)}
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: ${config.subagentSafe}
    destructiveActions: ${config.destructiveActions}
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| \`${config.inputName}\` | Yes | Remaining payload | Primary request for this skill. |
${artifactInputRows(config)}| \`CONSTRAINTS\` | No | None | Scope boundaries, files, tests, or compatibility limits. |

## Parameter Resolution

- Parse natural-language payload, explicit \`KEY=value\`, \`--flag value\`, and \`--flag=value\` forms from \`$ARGUMENTS\`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to \`${config.inputName}\`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: ${safetyBoundaryParameters(config)}.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: \`nova-plugin/skills/_shared/parameter-resolution.md\`.

## Safety Preflight

${safetyPreflightBlock(config)}

## Outputs

- Follow the skill-specific output rules below and the shared output contract.
- For written artifacts, report the path and a short executive summary instead of pasting the full artifact into chat.
- For reviews and verification, lead with findings or verdicts and state residual risk.
- Full policy: \`nova-plugin/skills/_shared/output-contracts.md\`.
- Artifact policy: \`nova-plugin/skills/_shared/artifact-policy.md\`.

## Workflow

1. Resolve parameters using the shared policy and this skill's input table.
2. Read only the context needed for the requested scope.
3. Apply the skill-specific guidance below.
4. Respect safety preflight before any side effects.
5. Produce the required output and report validation or skipped validation honestly.

## Failure Modes

- Required payload is missing or ambiguous.
- A safety-boundary parameter is missing, conflicting, or unsafe to infer.
- Required files, scripts, CLIs, credentials, or runtime dependencies are unavailable.
- Existing user changes overlap the intended write scope and cannot be merged safely.
- Repository policy conflicts with the requested action.

## Examples

- Use \`/${config.id}\` when the request matches this skill's purpose.
- Explicit parameters may use \`KEY=value\` or \`--flag value\`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

${config.description}

### Behavior

- Keep work aligned to \`${config.inputName}\` and declared \`CONSTRAINTS\`.
- State assumptions when important context is missing.
- Prefer repository-local conventions and validation commands.

### Outputs

- Return a concise result summary.
- Include files changed, artifacts written, validation run, skipped validation, and residual risks when applicable.
`;
}

function shortDocTemplate(config) {
  return `# Skill: /${config.id}

- Source: \`nova-plugin/commands/${config.id}.md\`

## Use Cases

- Use this command when the request matches: ${config.description}
- Use it when the expected workflow fits the \`${config.profileName}\` scaffold profile.

## Inputs

### Required

- \`${config.inputName}\`: Primary request payload.
${artifactRequiredInputBullets(config)}

### Optional

- \`CONSTRAINTS\`: Scope boundaries, files, tests, or compatibility limits.

## Behavior

1. Resolve parameters from \`$ARGUMENTS\`.
2. Gather only the needed context.
3. Execute the skill-specific workflow.
4. Report outputs and validation honestly.

## Output Contract

- Provide a concise summary with validation status and residual risks.
- For artifacts, report paths instead of pasting full generated content.

## Examples

\`\`\`text
/${config.id} ${exampleArguments(config)}
\`\`\`
`;
}

function readmeTemplate(config) {
  return `# /${config.id}

- Source: \`nova-plugin/commands/${config.id}.md\`

## Command Positioning

- Stage: \`${config.stage}\`
- Profile: \`${config.profileName}\` (${config.profileSummary})
- Skill: \`${config.skillName}\`

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| \`${config.inputName}\` | Yes | Primary request payload. | \`Describe the request\` |
${artifactParameterRows(config)}| \`CONSTRAINTS\` | No | Scope boundaries or compatibility limits. | \`No public API change\` |

## Output

- Concise result summary.
- Validation status, skipped validation, and residual risks when applicable.
- Artifact paths instead of full artifact content when files are written.

## Full Example

\`\`\`text
/${config.id} ${exampleArguments(config)} CONSTRAINTS="No public API change"
\`\`\`

## Incorrect Usage / Anti-patterns

- Expanding scope beyond the supplied request.
- Claiming validation passed when it was not run.
- Using side-effect tools outside the declared safety boundary.
`;
}

function docsReadmeEnTemplate(config) {
  return `# /${config.id}

- Source: \`nova-plugin/commands/${config.id}.md\`

## Command Positioning

- Stage: \`${config.stage}\`
- Profile: \`${config.profileName}\` (${config.profileSummary})
- Skill: \`${config.skillName}\`

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| \`${config.inputName}\` | Yes | Primary request payload. | \`Describe the request\` |
${artifactParameterRows(config)}| \`CONSTRAINTS\` | No | Scope boundaries or compatibility limits. | \`No public API change\` |

## Output

- Concise result summary.
- Validation status, skipped validation, and residual risks when applicable.
- Artifact paths instead of full artifact content when files are written.

## Full Example

\`\`\`text
/${config.id} ${exampleArguments(config)} CONSTRAINTS="No public API change"
\`\`\`

## Incorrect Usage / Anti-patterns

- Expanding scope beyond the supplied request.
- Claiming validation passed when it was not run.
- Using side-effect tools outside the declared safety boundary.
`;
}

function scaffoldFiles(config) {
  const docsDir = resolve(root, 'nova-plugin/docs/commands', config.docsDir);
  return [
    {
      path: resolve(root, 'nova-plugin/commands', `${config.id}.md`),
      content: commandTemplate(config),
    },
    {
      path: resolve(root, 'nova-plugin/skills', config.skillName, 'SKILL.md'),
      content: skillTemplate(config),
    },
    {
      path: resolve(docsDir, `${config.id}.md`),
      content: shortDocTemplate(config),
    },
    {
      path: resolve(docsDir, `${config.id}.README.md`),
      content: readmeTemplate(config),
    },
    {
      path: resolve(docsDir, `${config.id}.README.en.md`),
      content: docsReadmeEnTemplate(config),
    },
  ];
}

function writeScaffold(files, config) {
  const existing = files.filter((file) => existsSync(file.path));
  if (existing.length && !config.force) {
    fail(`refusing to overwrite existing file(s): ${existing.map((file) => rel(file.path)).join(', ')}`);
  }

  if (config.dryRun) {
    console.log('Dry run. Files that would be written:');
    for (const file of files) console.log(`  - ${rel(file.path)}`);
    return;
  }

  for (const file of files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, `${file.content.replace(/\s+$/u, '')}\n`, 'utf8');
  }

  console.log(`Scaffolded /${config.id} and ${config.skillName}:`);
  for (const file of files) console.log(`  - ${rel(file.path)}`);
  console.log('');
  console.log('Recommended validation:');
  console.log('  node scripts/lint-frontmatter.mjs');
  console.log('  node scripts/validate-docs.mjs');
  console.log('');
  console.log('For release-ready command additions, update user-facing indexes, CHANGELOG.md, version metadata, and generated marketplace files as required by repository policy.');
}

const { positional, options } = parseArgs(process.argv.slice(2));
const config = buildConfig(positional, options);
writeScaffold(scaffoldFiles(config), config);
