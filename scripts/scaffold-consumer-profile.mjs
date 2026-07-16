#!/usr/bin/env node
/**
 * Initialize a public-safe consumer profile from canonical docs/templates sources.
 *
 * Dry-run is the default. Use --write to create files.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const physicalRoot = realpathSync.native(root);

const TYPES = {
  'java-backend': {
    source: 'docs/templates/consumer-profiles/java-backend.md',
    target: 'AGENTS.md',
    title: 'Java Backend Consumer Profile',
    shellCommands: [{ id: 'maven-test', argv: ['mvn', 'test'], purpose: 'Run the reviewed Maven test entrypoint.' }],
  },
  frontend: {
    source: 'docs/templates/consumer-profiles/frontend.md',
    target: 'AGENTS.md',
    title: 'Frontend Consumer Profile',
    shellCommands: [{ id: 'npm-test', argv: ['npm', 'test'], purpose: 'Run the reviewed frontend test entrypoint.' }],
  },
  workbench: {
    source: 'docs/templates/consumer-profiles/workbench.md',
    target: 'workbench/README.md',
    title: 'Workbench Consumer Profile',
    shellCommands: [],
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
  --force         Overwrite both generated files when used with --write.
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

    try {
      options[key] = requireOptionValue(argv, i, `--${key}`);
    } catch (error) {
      fail(error.message);
    }
    i += 1;
  }
  return options;
}

function targetPath(outDir, target) {
  return resolve(outDir, target);
}

function pathInside(base, target) {
  const rel = relative(base, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function resolveThroughNearestExistingAncestor(path) {
  let ancestor = resolve(path);
  const missing = [];
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error(`no existing ancestor for output path: ${path}`);
    missing.unshift(basename(ancestor));
    ancestor = parent;
  }
  return resolve(realpathSync.native(ancestor), ...missing);
}

function pathTraversesPhysicalRepository(path) {
  const absolute = resolve(path);
  const filesystemRoot = parse(absolute).root;
  let current = filesystemRoot;
  for (const component of relative(filesystemRoot, absolute).split(sep).filter(Boolean)) {
    current = resolve(current, component);
    if (!existsSync(current)) break;
    if (pathInside(physicalRoot, realpathSync.native(current))) return true;
  }
  return false;
}

function assertNoCallerOwnedSymlinkComponents(path) {
  const absolute = resolve(path);
  const filesystemRoot = parse(absolute).root;
  let current = filesystemRoot;
  for (const component of relative(filesystemRoot, absolute).split(sep).filter(Boolean)) {
    const next = resolve(current, component);
    const stats = lstatSync(next, { throwIfNoEntry: false });
    if (!stats) break;
    if (stats.isSymbolicLink()) {
      // macOS commonly exposes /var and /tmp as root-level aliases. Normalize
      // that platform boundary, but reject links in caller-owned path segments.
      if (current !== filesystemRoot) fail(`refusing linked consumer output path component: ${next}`);
      current = realpathSync.native(next);
      continue;
    }
    current = next;
  }
}

function assertConsumerTargetsOutsideRepository(paths) {
  for (const path of paths) {
    const lexical = resolve(path);
    assertNoCallerOwnedSymlinkComponents(lexical);
    const physical = resolveThroughNearestExistingAncestor(lexical);
    if (pathInside(root, lexical)
      || pathInside(physicalRoot, physical)
      || pathTraversesPhysicalRepository(lexical)) {
      fail(
        'refusing to write a consumer profile inside the public llm-plugins-fusion repository; '
        + 'choose a consumer-owned workspace outside this checkout',
      );
    }
  }
}

function assertExistingTargetIsDirectFile(path) {
  if (!existsSync(path)) return;
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink !== 1) {
    fail(`refusing to overwrite a linked or non-regular output file: ${path}`);
  }
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

function buildShellPolicyContent(typeConfig) {
  return `${JSON.stringify({ schemaVersion: 1, allowCommands: typeConfig.shellCommands }, null, 2)}\n`;
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
  const shellPolicyPath = targetPath(outDir, '.nova/shell-policy.json');
  const content = buildContent(config);
  const shellPolicyContent = buildShellPolicyContent(config);

  if (!options.write) {
    console.log('Dry run. Files that would be written:');
    console.log(`  - ${outputPath}`);
    console.log(`  - ${shellPolicyPath}`);
    console.log('');
    console.log('Use --write to create both files.');
    return 0;
  }

  assertConsumerTargetsOutsideRepository([outputPath, shellPolicyPath]);

  for (const path of [outputPath, shellPolicyPath]) if (existsSync(path) && !options.force) fail(`refusing to overwrite existing file: ${path}`);
  for (const path of [outputPath, shellPolicyPath]) assertExistingTargetIsDirectFile(path);

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(shellPolicyPath), { recursive: true });
  // Re-resolve after directory creation to detect a linked nearest ancestor
  // introduced while the output directories were being prepared.
  assertConsumerTargetsOutsideRepository([outputPath, shellPolicyPath]);
  for (const path of [outputPath, shellPolicyPath]) assertExistingTargetIsDirectFile(path);
  writeFileSync(outputPath, content, 'utf8');
  writeFileSync(shellPolicyPath, shellPolicyContent, 'utf8');
  console.log(`Wrote ${outputPath}`);
  console.log(`Wrote ${shellPolicyPath}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
