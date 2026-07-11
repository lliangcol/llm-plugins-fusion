#!/usr/bin/env node
/** Aggregate release gates into machine-readable JSON and derived Markdown. */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCoverageSummary } from './lib/coverage-thresholds.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { loadRouteInventory } from './validate-plugin-route-live.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');

function usage() {
  return 'Usage: node scripts/generate-release-evidence.mjs [--coverage-summary <path>] [--coverage-metadata <path>] [--timings <path>] [--install <path>] [--route <path>] [--checksums <path>] [--out-dir <path>] [--require-live]';
}

export function parseArgs(args, root = defaultRoot) {
  const options = {
    coverageSummary: resolve(root, '.metrics/coverage/coverage-summary.txt'),
    coverageMetadata: resolve(root, '.metrics/coverage/metadata.json'),
    timings: resolve(root, '.metrics/validation-timings.json'),
    install: resolve(root, '.metrics/release-install-smoke/inventory.json'),
    route: resolve(root, '.metrics/release-install-smoke/route-smoke.json'),
    checksums: resolve(root, '.metrics/release-checksums/SHA256SUMS.txt'),
    outDir: resolve(root, '.metrics/release-evidence'),
    requireLive: false,
    help: false,
  };
  const valueOptions = new Map([
    ['--coverage-summary', 'coverageSummary'],
    ['--coverage-metadata', 'coverageMetadata'],
    ['--timings', 'timings'],
    ['--install', 'install'],
    ['--route', 'route'],
    ['--checksums', 'checksums'],
    ['--out-dir', 'outDir'],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--require-live') options.requireLive = true;
    else if (valueOptions.has(arg)) {
      options[valueOptions.get(arg)] = resolve(root, requireOptionValue(args, index, arg));
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function digestFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function testCounts(summary) {
  const value = (label) => {
    const match = summary.match(new RegExp(`(?:^|\\n)(?:ℹ\\s+)?${label}\\s+(\\d+)`, 'i'));
    return match ? Number.parseInt(match[1], 10) : null;
  };
  return { tests: value('tests'), passed: value('pass'), failed: value('fail') };
}

export function buildReleaseEvidence({
  plugin,
  coverageSummary,
  coverageMetadata,
  timings,
  install = null,
  route = null,
  checksums,
  env = process.env,
  now = () => new Date(),
  artifacts = [],
  requireLive = false,
  expectedRouteInventory = null,
} = {}) {
  const coverage = parseCoverageSummary(coverageSummary);
  if (!coverage) throw new Error('coverage summary does not contain an all files row');
  const counts = testCounts(coverageSummary);
  if (coverageMetadata.exitCode !== 0 || timings.failed !== 0 || timings.skipped !== 0) {
    throw new Error('coverage or validation timing input reports failure or skipped gates');
  }
  if (!Array.isArray(timings.timings) || timings.timings.some((timing) => timing.status !== 'passed')) {
    throw new Error('every validation timing gate must be passed');
  }
  if (counts.failed !== 0 || counts.tests === null || counts.passed !== counts.tests) {
    throw new Error('test summary does not prove a complete zero-failure run');
  }
  for (const metric of ['lines', 'branches', 'functions']) {
    const threshold = coverageMetadata.thresholds?.[metric];
    if (typeof threshold === 'number' && coverage[metric] < threshold) {
      throw new Error(`coverage ${metric} ${coverage[metric]} is below threshold ${threshold}`);
    }
  }

  const commit = env.GITHUB_SHA ?? env.RELEASE_COMMIT ?? 'local-not-recorded';
  const tag = env.GITHUB_REF_NAME ?? env.RELEASE_TAG ?? 'local-not-tagged';
  const expectedTag = `v${plugin.version}`;
  const sha256Pattern = /^[a-f0-9]{64}$/;
  if (requireLive && (!install || !route)) throw new Error('live release evidence requires install and route inputs');
  if (requireLive && !expectedRouteInventory) throw new Error('live release evidence requires canonical runtime inventory');
  if (requireLive && timings.timings.length === 0) throw new Error('live release evidence requires validation timing gates');
  if (requireLive && tag !== expectedTag) throw new Error(`release tag ${tag} does not match ${expectedTag}`);
  if (requireLive && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('release commit is not a full Git SHA');

  if (install) {
    if (install.validation?.passed !== true || install.inventoryDiff?.matches !== true) {
      throw new Error('install evidence reports validation or inventory drift failure');
    }
    const skills = install.inventory?.skills;
    if (install.inventory?.count !== 42 || !Array.isArray(skills) || skills.length !== 42 || new Set(skills).size !== 42) {
      throw new Error('install evidence does not report 42 unique Skills');
    }
    if (
      expectedRouteInventory
      && JSON.stringify([...skills].sort()) !== JSON.stringify([
        ...expectedRouteInventory.commandIds,
        ...expectedRouteInventory.skillNames,
      ].sort())
    ) {
      throw new Error('install evidence Skills differ from the canonical runtime inventory');
    }
    if (!skills.includes('route') || !skills.includes('nova-route')) {
      throw new Error('install evidence is missing route or nova-route');
    }
    if (install.plugin?.version !== plugin.version) throw new Error('installed plugin version differs from release version');
    if (!sha256Pattern.test(install.sourceTreeDigest ?? '') || install.sourceTreeDigest !== install.installedTreeDigest) {
      throw new Error('install evidence does not prove equal source and installed tree digests');
    }
    if (JSON.stringify(install.installedTreeIgnoredPaths) !== JSON.stringify(['.in_use/**'])) {
      throw new Error('install evidence does not use the exact approved installed-tree ignore policy');
    }
    if (install.knownGoodClaudeCli !== '2.1.205' || !String(install.claudeVersion ?? '').startsWith('2.1.205')) {
      throw new Error('install evidence does not prove known-good Claude CLI 2.1.205');
    }
    if (requireLive) {
      if (install.marketplace?.ref !== tag || !String(install.marketplace?.source ?? '').endsWith(`@${tag}`)) {
        throw new Error('install evidence is not bound to the exact release tag');
      }
    }
  }

  if (route) {
    if (route.projectChanged !== false || route.gitStatus !== '') throw new Error('route smoke reports project changes');
    if (route.authenticationMode !== 'claude-code-oauth-token') {
      throw new Error('route smoke does not prove Claude Code OAuth authentication');
    }
    if (route.configurationIsolation !== 'temporary-home') {
      throw new Error('route smoke does not prove temporary-home configuration isolation');
    }
    if (route.invocation !== '/nova-plugin:route' || route.outputStructureValid !== true) {
      throw new Error('route smoke does not prove the required namespaced output structure');
    }
    if (!sha256Pattern.test(route.resultSha256 ?? '')) throw new Error('route result digest is missing or invalid');
    const projectFileInventory = route.projectFileInventory;
    const projectInventoryDigest = Array.isArray(projectFileInventory)
      ? createHash('sha256').update(JSON.stringify(projectFileInventory)).digest('hex')
      : null;
    if (
      !sha256Pattern.test(route.beforeProjectDigest ?? '')
      || route.beforeProjectDigest !== route.afterProjectDigest
      || !Array.isArray(projectFileInventory)
      || projectFileInventory.length === 0
      || projectInventoryDigest !== route.beforeProjectDigest
    ) {
      throw new Error('route smoke does not prove an unchanged project file inventory');
    }
    for (const field of ['commands', 'skills', 'agents', 'packs']) {
      if (!Array.isArray(route[field]) || route[field].length === 0) {
        throw new Error(`route smoke evidence is missing validated ${field}`);
      }
    }
    if (expectedRouteInventory) {
      const expectedByField = {
        commands: expectedRouteInventory.commandIds,
        skills: expectedRouteInventory.skillNames,
        agents: expectedRouteInventory.agents,
        packs: expectedRouteInventory.packs,
      };
      for (const [field, expected] of Object.entries(expectedByField)) {
        const allowed = new Set(expected);
        const invalid = route[field].filter((value) => !allowed.has(value));
        if (invalid.length) throw new Error(`route smoke evidence contains unknown ${field}: ${invalid.join(', ')}`);
      }
    }
  }

  const exactTagInstallPassed = Boolean(
    install
    && tag === expectedTag
    && install.marketplace?.ref === tag
    && String(install.marketplace?.source ?? '').endsWith(`@${tag}`),
  );

  return {
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    release: {
      commit,
      tag,
      pluginVersion: plugin.version,
    },
    runtime: {
      node: coverageMetadata.node,
      claude: install?.claudeVersion ?? 'not-run',
      knownGoodClaudeCli: install?.knownGoodClaudeCli ?? '2.1.205',
    },
    tests: {
      ...counts,
      exitCode: coverageMetadata.exitCode,
      coverage,
      thresholds: coverageMetadata.thresholds,
    },
    gates: [
      ...timings.timings.map((timing) => ({ name: timing.label, status: timing.status, durationMs: timing.ms })),
      { name: 'coverage', status: coverageMetadata.exitCode === 0 ? 'passed' : 'failed' },
      { name: 'exact-tag install inventory', status: exactTagInstallPassed ? 'passed' : 'not-run' },
      { name: 'OAuth namespaced route', status: route ? 'passed' : 'not-run' },
    ],
    install: install ? {
      source: install.marketplace,
      plugin: { id: install.plugin.id, version: install.plugin.version },
      skillsCount: install.inventory.count,
      inventorySha256: createHash('sha256').update(JSON.stringify(install.inventory.skills)).digest('hex'),
      sourceTreeDigest: install.sourceTreeDigest,
      installedTreeDigest: install.installedTreeDigest,
      installedTreeIgnoredPaths: install.installedTreeIgnoredPaths,
    } : null,
    route: route ? {
      invocation: route.invocation,
      authenticationMode: route.authenticationMode,
      configurationIsolation: route.configurationIsolation,
      outputStructureValid: route.outputStructureValid,
      projectChanged: route.projectChanged,
      gitStatus: route.gitStatus,
      commands: route.commands,
      skills: route.skills,
      agents: route.agents,
      packs: route.packs,
      beforeProjectDigest: route.beforeProjectDigest,
      afterProjectDigest: route.afterProjectDigest,
      projectFileInventory: route.projectFileInventory,
      resultSha256: route.resultSha256,
    } : null,
    checksums: checksums.split(/\r?\n/).filter(Boolean),
    artifacts,
  };
}

export function renderReleaseEvidenceMarkdown(evidence) {
  const gates = evidence.gates.map((gate) => `| ${gate.name} | ${gate.status} | ${gate.durationMs ?? ''} |`).join('\n');
  return `# Release Evidence\n\nStatus: generated\n\n- Tag: \`${evidence.release.tag}\`\n- Commit: \`${evidence.release.commit}\`\n- Plugin version: \`${evidence.release.pluginVersion}\`\n- Node: \`${evidence.runtime.node}\`\n- Claude CLI: \`${evidence.runtime.claude}\`\n- Tests: ${evidence.tests.passed ?? 'unknown'} passed, ${evidence.tests.failed ?? 'unknown'} failed\n- Coverage: lines ${evidence.tests.coverage.lines}%, branches ${evidence.tests.coverage.branches}%, functions ${evidence.tests.coverage.functions}%\n- Installed Skills: ${evidence.install?.skillsCount ?? 'not run'}\n- OAuth route: ${evidence.route ? 'passed with temporary-home isolation and zero project writes' : 'not run'}\n\n## Gates\n\n| Gate | Status | Duration ms |\n| --- | --- | --- |\n${gates}\n`;
}

export function generateReleaseEvidence({ root = defaultRoot, args = [], env = process.env, now } = {}) {
  const options = parseArgs(args, root);
  if (options.help) return { help: true };
  const required = [options.coverageSummary, options.coverageMetadata, options.timings, options.checksums];
  if (options.requireLive) required.push(options.install, options.route);
  for (const path of required) {
    if (!existsSync(path)) throw new Error(`required evidence input is missing: ${relative(root, path)}`);
  }
  const artifactPaths = required.filter(existsSync);
  const hasInstallEvidence = existsSync(options.install);
  const hasRouteEvidence = existsSync(options.route);
  let expectedRouteInventory = null;
  if (hasInstallEvidence || hasRouteEvidence) {
    const permissionSpec = readJson(resolve(root, 'nova-plugin/runtime/workflow-permissions.json'));
    expectedRouteInventory = loadRouteInventory(resolve(root, 'nova-plugin'), permissionSpec);
  }
  const evidence = buildReleaseEvidence({
    plugin: JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8')),
    coverageSummary: readFileSync(options.coverageSummary, 'utf8'),
    coverageMetadata: readJson(options.coverageMetadata),
    timings: readJson(options.timings),
    install: hasInstallEvidence ? readJson(options.install) : null,
    route: hasRouteEvidence ? readJson(options.route) : null,
    checksums: readFileSync(options.checksums, 'utf8'),
    env,
    now,
    artifacts: artifactPaths.map((path) => ({
      path: relative(root, path).replaceAll('\\', '/'),
      sha256: digestFile(path),
    })),
    requireLive: options.requireLive,
    expectedRouteInventory,
  });
  mkdirSync(options.outDir, { recursive: true });
  const jsonPath = resolve(options.outDir, 'release-evidence.json');
  const markdownPath = resolve(options.outDir, 'release-evidence.md');
  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, renderReleaseEvidenceMarkdown(evidence), 'utf8');
  return { help: false, evidence, jsonPath, markdownPath };
}

function main(args = process.argv.slice(2)) {
  try {
    const result = generateReleaseEvidence({ args });
    if (result.help) {
      console.log(usage());
      return 0;
    }
    console.log(`Wrote ${relative(defaultRoot, result.jsonPath).replaceAll('\\', '/')}`);
    console.log(`Wrote ${relative(defaultRoot, result.markdownPath).replaceAll('\\', '/')}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
