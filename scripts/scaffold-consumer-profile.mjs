#!/usr/bin/env node
/**
 * Initialize a public-safe consumer profile from docs/consumers templates.
 *
 * Dry-run is the default. Use --write to create files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const TYPES = {
  'java-backend': {
    source: 'docs/consumers/private-java-backend-template.md',
    target: 'AGENTS.md',
    title: 'Java Backend Consumer Profile',
  },
  frontend: {
    source: 'docs/consumers/frontend-project-template.md',
    target: 'AGENTS.md',
    title: 'Frontend Consumer Profile',
  },
  workbench: {
    source: 'docs/consumers/workbench-template.md',
    target: 'workbench/README.md',
    title: 'Workbench Consumer Profile',
  },
};

function usage() {
  return `Scaffold a public-safe consumer profile.

Usage:
  node scripts/scaffold-consumer-profile.mjs --type java-backend --out <dir>
  node scripts/scaffold-consumer-profile.mjs --type frontend --out <dir> --write
  node scripts/scaffold-consumer-profile.mjs --type workbench --out <dir> --write

Options:
  --type <type>   java-backend, frontend, or workbench.
  --out <dir>     Output directory for the consumer-owned profile.
  --write         Write files. Without this flag the command is a dry-run.
  --force         Overwrite the target file when used with --write.
  --help          Show this help.

The generated file keeps placeholders generic. Fill private project facts only
inside the consumer repository or private documentation, not in this public repo.
`;
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  console.error('');
  console.error(usage());
  process.exit(1);
}

function parseBooleanFlag(value, label) {
  if (value === null) return true;
  if (value === 'true') return true;
  if (value === 'false') return false;
  fail(`--${label} must be used without a value or with true/false`);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) fail(`unexpected positional argument "${arg}"`);

    const raw = arg.slice(2);
    const eq = raw.indexOf('=');
    const key = eq === -1 ? raw : raw.slice(0, eq);
    const valueFromEquals = eq === -1 ? null : raw.slice(eq + 1);

    if (['write', 'force', 'help'].includes(key)) {
      options[key] = parseBooleanFlag(valueFromEquals, key);
      continue;
    }

    if (!['type', 'out'].includes(key)) fail(`unknown option --${key}`);
    if (valueFromEquals !== null) {
      options[key] = valueFromEquals;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) fail(`missing value for --${key}`);
    options[key] = next;
    i += 1;
  }
  return options;
}

function targetPath(outDir, target) {
  return resolve(outDir, target);
}

function buildContent(typeConfig) {
  const template = readFileSync(resolve(root, typeConfig.source), 'utf8').trimEnd();
  return `# ${typeConfig.title}

Status: local consumer draft
Source template: ${typeConfig.source}

This file was initialized from a public-safe \`nova-plugin\` consumer template.
Replace placeholders only inside the private consumer workspace. Do not copy
private names, local paths, endpoints, credentials, repository addresses,
runtime flags, business rules, or private knowledge base content back into the
public \`llm-plugins-fusion\` repository.

${template}
`;
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return 0;
  }

  const type = options.type;
  if (!type || !TYPES[type]) {
    fail(`--type must be one of ${Object.keys(TYPES).join(', ')}`);
  }
  if (!options.out) fail('missing --out');

  const outDir = resolve(options.out);
  const config = TYPES[type];
  const outputPath = targetPath(outDir, config.target);
  const content = buildContent(config);

  if (!options.write) {
    console.log('Dry run. File that would be written:');
    console.log(`  - ${outputPath}`);
    console.log('');
    console.log('Use --write to create the file.');
    return 0;
  }

  if (existsSync(outputPath) && !options.force) {
    fail(`refusing to overwrite existing file: ${outputPath}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, 'utf8');
  console.log(`Wrote ${outputPath}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
