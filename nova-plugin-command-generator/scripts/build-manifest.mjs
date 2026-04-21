#!/usr/bin/env node
/**
 * build-manifest.mjs
 *
 * Reads YAML frontmatter from nova-plugin/commands/*.md and merges with
 * the rich command data in scripts/manifest-data.json to generate
 * src/data/manifest.ts.
 *
 * Usage: node scripts/build-manifest.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const COMMANDS_DIR = path.join(ROOT, 'nova-plugin', 'commands');
const DATA_FILE = path.join(__dirname, 'manifest-data.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'manifest.ts');

// Stage ordering for deterministic output
const STAGE_ORDER = ['explore', 'plan', 'review', 'implement', 'finalize'];

function escapeTemplateLiteral(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function quoteJsString(str) {
  return `'${String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`;
}

function serializeField(field) {
  const parts = [];
  parts.push(`id: ${quoteJsString(field.id)}`);
  parts.push(`label: ${quoteJsString(field.label)}`);
  parts.push(`type: ${quoteJsString(field.type)}`);
  if (field.required) parts.push(`required: true`);
  if (field.bindable) parts.push(`bindable: true`);
  if (field.help) parts.push(`help: ${quoteJsString(field.help)}`);
  if (field.options) {
    const opts = field.options
      .map((o) =>
        typeof o === 'string'
          ? quoteJsString(o)
          : `{ value: ${quoteJsString(o.value)}, label: ${quoteJsString(o.label)} }`,
      )
      .join(', ');
    parts.push(`options: [${opts}]`);
  }
  if (field.defaultValue !== undefined) {
    if (typeof field.defaultValue === 'string') {
      parts.push(`defaultValue: ${quoteJsString(field.defaultValue)}`);
    } else if (typeof field.defaultValue === 'boolean') {
      parts.push(`defaultValue: ${field.defaultValue}`);
    } else if (Array.isArray(field.defaultValue)) {
      parts.push(`defaultValue: ${JSON.stringify(field.defaultValue)}`);
    }
  }
  return `{ ${parts.join(', ')} }`;
}

function serializeCommand(cmd) {
  const lines = [];
  lines.push(`    {`);
  lines.push(`      id: ${quoteJsString(cmd.id)},`);
  lines.push(`      displayName: ${quoteJsString(cmd.displayName)},`);
  lines.push(`      stage: ${quoteJsString(cmd.stage)},`);
  lines.push(`      constraintLevel: ${quoteJsString(cmd.constraintLevel)},`);
  lines.push(`      description: ${quoteJsString(cmd.description)},`);
  lines.push(`      fields: [`);
  for (const field of cmd.fields) {
    lines.push(`        ${serializeField(field)},`);
  }
  lines.push(`      ],`);
  lines.push(`      template: \`${escapeTemplateLiteral(cmd.template)}\`,`);
  if (cmd.outputs && cmd.outputs.length > 0) {
    const outs = cmd.outputs
      .map((o) => {
        const parts = [`id: ${quoteJsString(o.id)}`, `type: ${quoteJsString(o.type)}`];
        if (o.sourceFieldId) parts.push(`sourceFieldId: ${quoteJsString(o.sourceFieldId)}`);
        if (o.valueTemplate) parts.push(`valueTemplate: ${quoteJsString(o.valueTemplate)}`);
        return `{ ${parts.join(', ')} }`;
      })
      .join(', ');
    lines.push(`      outputs: [${outs}],`);
  }
  lines.push(`    },`);
  return lines.join('\n');
}

function serializeWorkflow(wf) {
  const lines = [];
  lines.push(`    {`);
  lines.push(`      id: ${quoteJsString(wf.id)},`);
  lines.push(`      title: ${quoteJsString(wf.title)},`);
  if (wf.intendedScenario) lines.push(`      intendedScenario: ${quoteJsString(wf.intendedScenario)},`);
  if (wf.audience) lines.push(`      audience: ${quoteJsString(wf.audience)},`);
  lines.push(`      steps: [`);
  for (const step of wf.steps) {
    const parts = [`stepId: ${quoteJsString(step.stepId)}`, `commandId: ${quoteJsString(step.commandId)}`];
    if (step.optional) parts.push(`optional: true`);
    if (step.autoBindings) {
      const bindings = step.autoBindings
        .map((b) => {
          const bp = [`fromVar: ${quoteJsString(b.fromVar)}`, `toFieldId: ${quoteJsString(b.toFieldId)}`];
          if (b.mode) bp.push(`mode: ${quoteJsString(b.mode)}`);
          return `{ ${bp.join(', ')} }`;
        })
        .join(', ');
      parts.push(`autoBindings: [${bindings}]`);
    }
    lines.push(`        { ${parts.join(', ')} },`);
  }
  lines.push(`      ],`);
  lines.push(`    },`);
  return lines.join('\n');
}

function serializeScenario(sc) {
  const parts = [`id: ${quoteJsString(sc.id)}`, `category: ${quoteJsString(sc.category)}`, `title: ${quoteJsString(sc.title)}`];
  if (sc.recommendCommandId) parts.push(`recommendCommandId: ${quoteJsString(sc.recommendCommandId)}`);
  if (sc.recommendWorkflowId) parts.push(`recommendWorkflowId: ${quoteJsString(sc.recommendWorkflowId)}`);
  return `    { ${parts.join(', ')} },`;
}

function main() {
  // Read rich data
  const richData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

  // Read and parse all command frontmatters
  const commandFiles = fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const commandMap = {};
  for (const file of commandFiles) {
    const content = fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf-8');
    const { data: fm } = matter(content);
    if (!fm.id) {
      console.warn(`Warning: ${file} has no frontmatter id, skipping.`);
      continue;
    }
    commandMap[fm.id] = fm;
  }

  // Merge frontmatter with rich data, ordered by stage
  const commands = [];
  for (const stage of STAGE_ORDER) {
    const stageCommands = Object.entries(commandMap)
      .filter(([, fm]) => fm.stage === stage)
      .map(([id]) => id);

    for (const id of stageCommands) {
      const fm = commandMap[id];
      const rich = richData.commands[id];
      if (!rich) {
        console.warn(`Warning: No rich data for command '${id}', skipping.`);
        continue;
      }
      commands.push({
        id,
        displayName: fm.title || `/${id}`,
        stage: fm.stage,
        constraintLevel: rich.constraintLevel,
        description: rich.description,
        fields: rich.fields || [],
        template: rich.template,
        outputs: rich.outputs,
      });
    }
  }

  // Build output
  const commandsTs = commands.map(serializeCommand).join('\n');
  const workflowsTs = richData.workflows.map(serializeWorkflow).join('\n');
  const scenariosTs = richData.scenarios.map(serializeScenario).join('\n');

  const output = `// AUTO-GENERATED - do not edit manually
// Generated by scripts/build-manifest.mjs from nova-plugin/commands/*.md frontmatter
import { Manifest } from '../types';

export const manifest: Manifest = {
  version: ${quoteJsString(richData.manifestVersion)},
  commands: [
${commandsTs}
  ],
  workflows: [
${workflowsTs}
  ],
  scenarios: [
${scenariosTs}
  ],
};
`;

  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`Generated ${OUTPUT_FILE} with ${commands.length} commands.`);
}

main();
