#!/usr/bin/env node
/**
 * Validate active Markdown documentation for local link/anchor health, command
 * doc coverage and placement, release metadata drift, documentation inventory
 * counts, project positioning contracts, maintenance status contracts,
 * exact-tag release promotion boundaries, maintainer diagnostic and security
 * setting semantics, public API compatibility contracts, marketplace trust,
 * author workflow, compatibility, and security review contracts, contribution
 * and issue intake contracts, docs index navigation contracts, consumer
 * profile privacy contracts, prompt template privacy contracts, local data
 * handling privacy contracts, workflow
 * evidence contracts, showcase
 * public-safety contracts, growth metrics privacy contracts, assets capture
 * privacy contracts, deferred portal IA contracts, multi-plugin readiness evidence
 * contracts, security support range, stale active
 * planning labels, and stale
 * non-archived reports.
 *
 * Historical archives are intentionally excluded from link checks because they
 * preserve old repository state. Active docs should link to current files.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireOptionValue } from '../lib/cli-args.mjs';
import { parseSemVer } from '../lib/semver.mjs';
import { validateActivePlanningAndReports } from './rules/active-planning-and-reports.mjs';
import { validateLinksAndCommandDocs } from './rules/links-and-command-docs.mjs';
import { deriveEvaluationFacts } from '../lib/evaluation-facts.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..', '..');

function usage() {
  return 'Usage: node scripts/validate-docs.mjs [--root <repo-root>]';
}

function parseRoot(args) {
  let selectedRoot = defaultRoot;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--root') {
      const value = requireOptionValue(args, index, '--root');
      selectedRoot = resolve(value);
      index += 1;
      continue;
    }
    console.error(`ERROR unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }
  return selectedRoot;
}

let root;
try {
  root = parseRoot(process.argv.slice(2));
} catch (error) {
  console.error(`ERROR ${error.message}`);
  console.error(usage());
  process.exit(1);
}

const errors = [];
const warnings = [];

const SKIP_DIRS = new Set([
  '.git',
  '.codex',
  '.metrics',
  '.cache',
  '.idea',
  '.vite',
  '.vscode',
  'node_modules',
  'coverage',
  'logs',
  'dist',
  'build',
  'target',
  '.next',
  '.nuxt',
  'out',
  'tmp',
  'temp',
]);

const ARCHIVE_SEGMENTS = [
  ['.claude', 'agents', 'archive'],
  ['docs', 'reports', 'archive'],
];

const HISTORY_SEGMENTS = [
  ['nova-plugin', 'docs', 'history'],
];

const CODEX_COMMAND_IDS = new Set([
  'codex-review-fix',
  'codex-review-only',
  'codex-verify-only',
]);

const STALE_ACTIVE_PLANNING_PATTERNS = [
  {
    pattern: /^\|[^\n|]*\bv1\.\d+(?:\.\d+)?\b[^\n|]*\|/gm,
    message: 'stale v1.x version label in active planning table; use Deferred or a current roadmap lane',
  },
];

const markdownAnchorsByFile = new Map();

function rel(file) {
  return relative(root, file).split(sep).join('/');
}

function recordError(file, msg) {
  errors.push(`  - ${file}: ${msg}`);
}

function recordWarning(file, msg) {
  warnings.push(`  - ${file}: ${msg}`);
}

function isArchivePath(absPath) {
  const parts = rel(absPath).split('/');
  return ARCHIVE_SEGMENTS.some((segments) => {
    for (let i = 0; i <= parts.length - segments.length; i += 1) {
      if (segments.every((segment, offset) => parts[i + offset] === segment)) {
        return true;
      }
    }
    return false;
  });
}

function hasPathSegments(absPath, segmentGroups) {
  const parts = rel(absPath).split('/');
  return segmentGroups.some((segments) => {
    for (let i = 0; i <= parts.length - segments.length; i += 1) {
      if (segments.every((segment, offset) => parts[i + offset] === segment)) {
        return true;
      }
    }
    return false;
  });
}

function shouldSkipDir(absPath) {
  const name = basename(absPath);
  if (SKIP_DIRS.has(name)) return true;
  return isArchivePath(absPath);
}

function walkFiles(start, predicate) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldSkipDir(abs)) walk(abs);
      } else if (entry.isFile() && predicate(abs)) {
        files.push(abs);
      }
    }
  }
  walk(start);
  return files.sort();
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

function stripFencedCode(src) {
  return src.replace(/(^|\n)(```|~~~)[\s\S]*?(\n\2[ \t]*(?=\n|$))/g, '\n');
}

function lineNumberAt(src, index) {
  return src.slice(0, index).split(/\r?\n/).length;
}

function validateVersionReferences() {
  const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
  const releaseChannels = readJson('governance/release-channels.json');
  const marketplace = readJson('.claude-plugin/marketplace.json');
  const metadata = readJson('.claude-plugin/marketplace.metadata.json');
  const marketplaceEntry = marketplace.plugins?.find((entry) => entry.name === plugin.name);
  if (!marketplaceEntry) {
    recordError('.claude-plugin/marketplace.json', `missing plugin entry for ${plugin.name}`);
    return;
  }
  const metadataEntry = metadata.plugins?.find((entry) => entry.name === plugin.name);
  if (!metadataEntry) {
    recordError('.claude-plugin/marketplace.metadata.json', `missing plugin metadata for ${plugin.name}`);
    return;
  }

  if (marketplaceEntry.version !== releaseChannels.stable.version) {
    recordError(
      '.claude-plugin/marketplace.json',
      `plugins[].version is "${marketplaceEntry.version}", expected stable "${releaseChannels.stable.version}"`,
    );
  }
  if (metadataEntry.version !== releaseChannels.stable.version) {
    recordError(
      '.claude-plugin/marketplace.metadata.json',
      `plugins[].version is "${metadataEntry.version}", expected stable "${releaseChannels.stable.version}"`,
    );
  }

  const version = releaseChannels.stable.version;
  const versionPattern = escapeRegExp(version);
  const developmentVersionPattern = escapeRegExp(plugin.version);
  const updated = metadataEntry['last-updated'];

  expectContentRegex('README.md', new RegExp(`version-${versionPattern}-blue\\.svg`), 'version badge');
  expectContentRegex('README.md', new RegExp(`<td>${versionPattern}<\\/td>`), 'plugin version table value');
  expectContentRegex(
    'nova-plugin/docs/overview/README.en.md',
    new RegExp(`version-${versionPattern}-blue\\.svg`),
    'version badge',
  );
  expectContentRegex(
    'nova-plugin/docs/overview/README.en.md',
    new RegExp(`<td>${versionPattern}<\\/td>`),
    'plugin version table value',
  );
  expectContentRegex(
    'nova-plugin/docs/guides/commands-reference-guide.md',
    new RegExp(`\\*\\*开发版本\\*\\*:\\s*${developmentVersionPattern}[\\s\\S]*\\*\\*稳定版本\\*\\*:\\s*${versionPattern}`),
    'command reference development and stable versions',
  );
  expectContentRegex(
    'nova-plugin/docs/guides/commands-reference-guide.en.md',
    new RegExp(`\\*\\*Development version\\*\\*:\\s*${developmentVersionPattern}[\\s\\S]*\\*\\*Stable version\\*\\*:\\s*${versionPattern}`),
    'command reference development and stable versions',
  );
  expectContentRegex(
    'docs/project/plans/portal-information-architecture.md',
    new RegExp(`remains the current \`v${versionPattern}\` marketplace state`),
    'current portal boundary version',
  );
  expectContentRegex(
    'nova-plugin/docs/overview/README.en.md',
    new RegExp(`current \`v${versionPattern}\` single-plugin boundary`),
    'English overview current portal version',
  );
  expectContentRegex(
    'nova-plugin/docs/architecture/hooks-design.md',
    new RegExp(`当前 \`${versionPattern}\` 中仍未发布`),
    'hooks design current version',
  );

  if (!updated) {
    recordWarning('.claude-plugin/marketplace.metadata.json', 'nova-plugin has no last-updated field');
  }

  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const changelogMatch = changelog.match(new RegExp(`^## \\[${escapedVersion}\\] - (\\d{4}-\\d{2}-\\d{2})`, 'm'));
  if (!changelogMatch) {
    recordError('CHANGELOG.md', `missing release section for ${version}`);
  } else if (updated && changelogMatch[1] !== updated) {
    recordError(
      'CHANGELOG.md',
      `release date for ${version} is "${changelogMatch[1]}", expected "${updated}"`,
    );
  }
}

function countFiles(dir, predicate) {
  return readdirSync(resolve(root, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .length;
}

function countDirectories(dir, predicate) {
  return readdirSync(resolve(root, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && predicate(entry.name))
    .length;
}

function expectInventoryRegex(file, pattern, expectedValues, label) {
  const src = readFileSync(resolve(root, file), 'utf8');
  const match = src.match(pattern);
  if (!match) {
    recordError(file, `missing ${label}`);
    return;
  }
  for (let index = 0; index < expectedValues.length; index += 1) {
    const actual = match[index + 1];
    const expected = String(expectedValues[index]);
    if (actual !== expected) {
      recordError(
        file,
        `${label} value ${index + 1} is "${actual}", expected "${expected}"`,
      );
    }
  }
}

function expectContentRegex(file, pattern, label) {
  const src = readFileSync(resolve(root, file), 'utf8');
  if (!pattern.test(src)) {
    recordError(file, `missing ${label}`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateInventoryFacts() {
  const commandCount = countFiles('nova-plugin/commands', (name) => name.endsWith('.md'));
  const skillCount = readdirSync(resolve(root, 'nova-plugin/skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('nova-') && existsSync(resolve(root, 'nova-plugin/skills', entry.name, 'SKILL.md'))).length;
  const activeAgentCount = countFiles('nova-plugin/agents', (name) => name.endsWith('.md'));
  const packCount = countDirectories('nova-plugin/packs', () => true);

  const checks = [
    {
      file: 'README.md',
      pattern: /<td>(\d+) 个命令，(\d+) 个 canonical skills<\/td>/,
      values: [commandCount, skillCount],
      label: 'README command/skill count',
    },
    {
      file: 'README.md',
      pattern: /<td>(\d+) 个 core agents，位于 <code>nova-plugin\/agents\/<\/code>；(\d+) 个 capability packs/,
      values: [activeAgentCount, packCount],
      label: 'README agent/pack count',
    },
    {
      file: 'README.md',
      pattern: /\|   \|-- commands\/\s+# (\d+) 个 slash command/,
      values: [commandCount],
      label: 'README repository tree command count',
    },
    {
      file: 'README.md',
      pattern: /\|   \|-- skills\/\s+# (\d+) 个 (?:canonical )?nova-\* skills/,
      values: [skillCount],
      label: 'README repository tree skill count',
    },
    {
      file: 'README.md',
      pattern: /\|   \|-- agents\/\s+# (\d+) 个 core active agents/,
      values: [activeAgentCount],
      label: 'README repository tree agent count',
    },
    {
      file: 'README.md',
      pattern: /\|   \|-- packs\/\s+# (\d+) 个 capability pack 文档/,
      values: [packCount],
      label: 'README repository tree pack count',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /<td>(\d+) commands, (\d+) canonical skills<\/td>/,
      values: [commandCount, skillCount],
      label: 'English overview command/skill count',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /<td>(\d+) core agents in <code>nova-plugin\/agents\/<\/code>; (\d+) capability packs/,
      values: [activeAgentCount, packCount],
      label: 'English overview agent/pack count',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /\|   \|-- commands\/\s+# (\d+) slash command/,
      values: [commandCount],
      label: 'English overview repository tree command count',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /\|   \|-- skills\/\s+# (\d+) (?:canonical )?nova-\* skills/,
      values: [skillCount],
      label: 'English overview repository tree skill count',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /\|   \|-- agents\/\s+# (\d+) core active agents/,
      values: [activeAgentCount],
      label: 'English overview repository tree agent count',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /\|   \|-- packs\/\s+# (\d+) capability pack docs/,
      values: [packCount],
      label: 'English overview repository tree pack count',
    },
    {
      file: 'AGENTS.md',
      pattern: /- Commands: (\d+) files under `nova-plugin\/commands\/\*\.md`/,
      values: [commandCount],
      label: 'AGENTS command count',
    },
    {
      file: 'AGENTS.md',
      pattern: /- Skills: (\d+) files under `nova-plugin\/skills\/nova-\*\/SKILL\.md`/,
      values: [skillCount],
      label: 'AGENTS skill count',
    },
    {
      file: 'AGENTS.md',
      pattern: /- Active agents: (\d+) core files under `nova-plugin\/agents\/\*\.md`/,
      values: [activeAgentCount],
      label: 'AGENTS active agent count',
    },
    {
      file: 'AGENTS.md',
      pattern: /- Capability packs: (\d+) documentation packs under `nova-plugin\/packs\/\*\/README\.md`/,
      values: [packCount],
      label: 'AGENTS pack count',
    },
    {
      file: 'CLAUDE.md',
      pattern: /- Current command snapshot: (\d+) files under `nova-plugin\/commands\/\*\.md`/,
      values: [commandCount],
      label: 'CLAUDE command count',
    },
    {
      file: 'CLAUDE.md',
      pattern: /- Current skill snapshot: (\d+) files under `nova-plugin\/skills\/nova-\*\/SKILL\.md`/,
      values: [skillCount],
      label: 'CLAUDE skill count',
    },
    {
      file: 'CLAUDE.md',
      pattern: /- Current active agent snapshot: (\d+) core files under `nova-plugin\/agents\/\*\.md`/,
      values: [activeAgentCount],
      label: 'CLAUDE active agent count',
    },
    {
      file: 'CLAUDE.md',
      pattern: /- Capability pack snapshot: (\d+) documentation packs under `nova-plugin\/packs\/\*\/README\.md`/,
      values: [packCount],
      label: 'CLAUDE pack count',
    },
    {
      file: 'ROADMAP.md',
      pattern: /generated:project-state:start[\s\S]*Inventory: (\d+) commands, (\d+) skills/,
      values: [commandCount, skillCount],
      label: 'ROADMAP generated command/skill count',
    },
    {
      file: 'docs/reference/compatibility/marketplace.md',
      pattern: /\| Nova commands and skills \| (\d+) generated commands and (\d+) canonical `nova-\*` skills \|/,
      values: [commandCount, skillCount],
      label: 'compatibility matrix command/skill count',
    },
    {
      file: 'nova-plugin/docs/architecture/dual-track-design.md',
      pattern: /但只有 (\d+) 个\s+canonical Skills/,
      values: [skillCount],
      label: 'dual-track skill count',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /- Commands: (\d+) files under `nova-plugin\/commands\/\*\.md`/,
      values: [commandCount],
      label: 'maintenance status command count',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /- Skills: (\d+) files under `nova-plugin\/skills\/nova-\*\/SKILL\.md`/,
      values: [skillCount],
      label: 'maintenance status skill count',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /- Active agents: (\d+) core files under `nova-plugin\/agents\/\*\.md`/,
      values: [activeAgentCount],
      label: 'maintenance status active agent count',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /- Capability packs: (\d+) documentation packs under `nova-plugin\/packs\/\*\/README\.md`/,
      values: [packCount],
      label: 'maintenance status pack count',
    },
  ];

  for (const check of checks) {
    expectInventoryRegex(check.file, check.pattern, check.values, check.label);
  }
}

function validateProjectPositioningContracts() {
  const checks = [
    {
      file: 'AGENTS.md',
      pattern: /primary deliverable is `nova-plugin`/,
      label: 'AGENTS nova-plugin primary deliverable boundary',
    },
    {
      file: 'AGENTS.md',
      pattern: /Do not describe this repository as a mature multi-plugin ecosystem or a public\s+portal/,
      label: 'AGENTS mature ecosystem and public portal boundary',
    },
    {
      file: 'CLAUDE.md',
      pattern: /primary plugin is `nova-plugin`/,
      label: 'CLAUDE nova-plugin primary plugin boundary',
    },
    {
      file: 'CLAUDE.md',
      pattern: /Do not describe this repository as a mature multi-plugin ecosystem or a public\s+portal/,
      label: 'CLAUDE mature ecosystem and public portal boundary',
    },
    {
      file: 'README.md',
      pattern: /当前主交付物是 `nova-plugin`/,
      label: 'README nova-plugin primary deliverable boundary',
    },
    {
      file: 'README.md',
      pattern: /不描述为成熟多插件生态，也不把 deferred public portal 当作已实现能力/,
      label: 'README mature ecosystem and public portal boundary',
    },
    {
      file: 'ROADMAP.md',
      pattern: /single-production-plugin workflow framework centered\s+on `nova-plugin`/,
      label: 'ROADMAP nova-plugin core boundary',
    },
    {
      file: 'ROADMAP.md',
      pattern: /## Deferred Product Lanes[\s\S]*production multi-plugin layout[\s\S]*hosted public portal/,
      label: 'ROADMAP deferred product-lane boundary',
    },
    {
      file: 'docs/project/plans/current-remediation.md',
      pattern: /`nova-plugin` is the only production plugin/,
      label: 'optimization plan one production plugin boundary',
    },
    {
      file: 'docs/project/plans/current-remediation.md',
      pattern: /Public portal work and production multi-plugin directory migration remain\s+deferred[\s\S]*independently\s+named product lanes[\s\S]*not coupled to an already released version number/,
      label: 'optimization plan deferred portal and multi-plugin boundary',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /This repository should not be described as a mature multi-plugin ecosystem, and the deferred public portal is not an implemented capability/,
      label: 'English overview mature ecosystem and public portal boundary',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /public AI engineering workflow framework centered on\s+`nova-plugin`/,
      label: 'maintenance status nova-plugin centered boundary',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /Explore -> Plan -> Review -> Implement -> Finalize/,
      label: 'maintenance status five-stage workflow boundary',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /`nova-plugin` is the only production plugin/,
      label: 'maintenance status one production plugin boundary',
    },
    {
      file: 'docs/operations/maintainers/status.md',
      pattern: /must not be\s+described as a mature multi-plugin ecosystem, public portal, paid marketplace,\s+runtime dynamic plugin platform, or enterprise private knowledge base/,
      label: 'maintenance status deferred scope boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateAuthoringSourceContracts() {
  const checks = [
    {
      file: 'CLAUDE.md',
      pattern: /Workflow authoring sources[\s\S]*`workflow-specs\/workflows\.json` \(v5 compatibility input\)[\s\S]*`workflow-specs\/behaviors\.json` \(v1 compatibility input\)/,
      label: 'CLAUDE workflow authoring source boundary',
    },
    {
      file: 'CLAUDE.md',
      pattern: /Never hand-edit[\s\S]*`workflows\.v6\.json`, `behaviors\.v2\.json`, generated command wrappers,[\s\S]*generated Skill behavior blocks[\s\S]*node scripts\/migrate-v6-contracts\.mjs --write/,
      label: 'CLAUDE generated workflow projection boundary',
    },
    {
      file: 'AGENTS.md',
      pattern: /Do not hand-edit `workflow-specs\/workflows\.v6\.json`,[\s\S]*`workflow-specs\/behaviors\.v2\.json`, generated command wrappers,[\s\S]*node scripts\/migrate-v6-contracts\.mjs --write/,
      label: 'AGENTS generated workflow projection boundary',
    },
    {
      file: 'workflow-specs/README.md',
      pattern: /`workflows\.json` and `behaviors\.json` files are the authoring[\s\S]*sources[\s\S]*Do not[\s\S]*hand-edit `workflows\.v6\.json` or `behaviors\.v2\.json`/,
      label: 'workflow specs authoring source boundary',
    },
    {
      file: 'workflow-specs/README.md',
      pattern: /node scripts\/migrate-v6-contracts\.mjs --write[\s\S]*node scripts\/generate-workflow-permissions\.mjs --write[\s\S]*node scripts\/generate-runtime-contracts\.mjs --write[\s\S]*node scripts\/generate-behavior-surfaces\.mjs --write[\s\S]*node scripts\/generate-adapters\.mjs --write[\s\S]*node scripts\/generate-command-docs\.mjs --write/,
      label: 'workflow specs projection order',
    },
  ];
  for (const check of checks) expectContentRegex(check.file, check.pattern, check.label);

  const claudePath = 'CLAUDE.md';
  const claude = readFileSync(resolve(root, claudePath), 'utf8');
  for (const stale of [
    /### Modify an Existing Command[\s\S]{0,500}?Edit `nova-plugin\/commands\/<id>\.md`/,
    /### Modify an Existing Command[\s\S]{0,700}?Edit `nova-plugin\/skills\/nova-<id>\/SKILL\.md`/,
  ]) {
    if (stale.test(claude)) recordError(claudePath, 'stale direct-edit workflow bypasses authoring sources');
  }
}

function validateReleasePromotionContracts() {
  const releaseChannels = readJson('governance/release-channels.json');
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const stable = parseSemVer(releaseChannels.stable?.version);
  if (!stable || stable.isPrerelease) {
    recordError('governance/release-channels.json', 'stable channel has no stable SemVer promotion baseline');
    return;
  }
  if (!new RegExp(`^## \\[${escapeRegExp(stable.version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'mu').test(changelog)) {
    recordError('CHANGELOG.md', `missing stable channel release section for ${stable.version}`);
  }
  const tag = releaseChannels.stable.tag;
  const tagPattern = escapeRegExp(tag);
  const checks = [
    {
      file: 'README.md',
      pattern: new RegExp('稳定安装入口以正式 release tag 为准[\\s\\S]*当前稳定推广基线是 `'
        + tagPattern
        + '`[\\s\\S]*不能替代 exact\\s+release tag 作为稳定发布证据'),
      label: 'README exact release tag promotion boundary',
    },
    {
      file: 'SECURITY.md',
      pattern: /稳定推广仍\s*必须以 exact release tag 为准[\s\S]*moving `main` 不等同于\s*已发布版本/,
      label: 'SECURITY exact release tag promotion boundary',
    },
    {
      file: 'ROADMAP.md',
      pattern: /A stable tag never serves as the first complete integration test of a release\s+workflow/,
      label: 'ROADMAP rehearsed stable promotion boundary',
    },
    {
      file: 'docs/project/plans/current-remediation.md',
      pattern: new RegExp('Exact `'
        + tagPattern
        + '` is the current stable promotion baseline[\\s\\S]*Moving `main` may\\s+contain later unreleased maintenance work and must not be promoted as stable\\s+release content'),
      label: 'optimization plan exact release tag promotion boundary',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: new RegExp('Promote formal release tags such as `'
        + tagPattern
        + '`, not a moving `main` branch'),
      label: 'English overview exact release tag promotion boundary',
    },
    {
      file: 'docs/operations/releases/hygiene.md',
      pattern: /Stable promotion targets must be exact release tags[\s\S]*moving `main` branch[\s\S]*development snapshot rather than stable release material/,
      label: 'release hygiene exact release tag promotion boundary',
    },
    {
      file: 'docs/templates/evidence/release.md',
      pattern: new RegExp('Promote exact release tags such as `'
        + tagPattern
        + '`; do not promote moving `main` as stable'),
      label: 'release evidence exact release tag promotion boundary',
    },
    {
      file: 'docs/templates/evidence/release.md',
      pattern: /If local validation reports skipped checks,[\s\S]*name each skipped check and the replacement CI\/Linux evidence/,
      label: 'release evidence skipped checks replacement boundary',
    },
    {
      file: 'docs/templates/evidence/release.md',
      pattern: /Treat `node scripts\/validate-plugin-install\.mjs` as a separate CI or isolated\s+test-user check because it may install or update user-scope Claude plugin\s+state/,
      label: 'release evidence plugin install isolation boundary',
    },
    {
      file: 'docs/templates/evidence/release.md',
      pattern: /node scripts\/validate-all\.mjs:[\s\S]*node scripts\/validate-github-workflows\.mjs:[\s\S]*node scripts\/validate-runtime-smoke\.mjs:/,
      label: 'release evidence GitHub workflow validation result slot',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /If the target has no exact tag[\s\S]*do not promote[\s\S]*unreleased development snapshot/,
      label: 'release runbook missing exact tag decision boundary',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /Neither candidate nor stable tag\s+pushes trigger a release workflow[\s\S]*Stable publication uses both the\s+signed stable tag and the exact candidate tag/,
      label: 'release runbook protected-main stable and candidate dispatch boundary',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /GitHub workflow contracts \| Automated \| `node scripts\/validate-github-workflows\.mjs` passes; this proves workflow permissions,[\s\S]*workflow inventory,[\s\S]*required-check list synchronization/,
      label: 'release runbook GitHub workflow contract gate',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /If any required manual gate is missing,[\s\S]*describe the target as an unreleased\s+development snapshot,[\s\S]*not a stable release/,
      label: 'release runbook missing manual gate snapshot boundary',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /scripts\/validate-runtime-smoke\.mjs[\s\S]*scripts\/validate-github-workflows\.mjs[\s\S]*scripts\/validate-surface-budget\.mjs/,
      label: 'release runbook focused GitHub workflow validation command',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /`node scripts\/validate-workflow-fixtures\.mjs` passes; this proves fixture integrity,[\s\S]*not slash-command output quality/,
      label: 'release runbook fixture quality boundary',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /`node scripts\/validate-plugin-install\.mjs --accept-user-scope-mutation` mutates\s+Claude Code user-scope plugin state[\s\S]*Run it only in CI or in an isolated\s+test-user environment/,
      label: 'release runbook plugin install mutation boundary',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /Plugin install smoke is missing \| Do not promote; record pending isolated\/CI evidence[\s\S]*Manual workflow evidence is missing[\s\S]*Do not promote until recorded/,
      label: 'release runbook promotion missing evidence boundary',
    },
    {
      file: 'docs/operations/releases/validation.md',
      pattern: /Never fill missing evidence with assumptions[\s\S]*Record `not run`, `skipped`, or\s+`pending` with a concrete reason/,
      label: 'release runbook no assumed evidence boundary',
    },
    {
      file: 'docs/operations/releases/hygiene.md',
      pattern: /Run `node scripts\/validate-plugin-install\.mjs` only in CI or an isolated\s+test-user environment[\s\S]*unattended local release evidence should record it as pending/,
      label: 'release hygiene unattended install smoke pending boundary',
    },
    {
      file: 'docs/operations/releases/hygiene.md',
      pattern: /content-addressed\s+control bundle[\s\S]*actual control-bundle archive and\s+file inventory[\s\S]*publishing those exact candidate bytes/,
      label: 'release hygiene verified immutable candidate asset boundary',
    },
    {
      file: 'docs/operations/releases/hygiene.md',
      pattern: /node scripts\/validate-all\.mjs[\s\S]*node scripts\/validate-github-workflows\.mjs[\s\S]*node scripts\/validate-runtime-smoke\.mjs/,
      label: 'release hygiene GitHub workflow validation command',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateMaintainerDiagnosticContracts() {
  const checks = [
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /## Diagnostic Result Semantics[\s\S]*`npm run doctor` is read-only[\s\S]*Treat them as evidence to record, not as automatic\s+failures/,
      label: 'maintainer quickstart diagnostic semantics introduction',
    },
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /`Claude CLI: WARN`[\s\S]*live Claude plugin validation and user-scope install smoke are not proven locally[\s\S]*`node scripts\/validate-plugin-install\.mjs --dry-run`[\s\S]*isolated test user/,
      label: 'maintainer quickstart Claude CLI warning boundary',
    },
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /`Codex CLI: WARN`[\s\S]*Do not claim Codex review\/fix\/verify runtime behavior was proven/,
      label: 'maintainer quickstart Codex CLI warning boundary',
    },
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /`Bash: WARN` or `skipped>0`[\s\S]*Record the skipped checks[\s\S]*CI\/Linux Bash evidence/,
      label: 'maintainer quickstart Bash skipped-check boundary',
    },
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /`Exact release tag: WARN`[\s\S]*development snapshot[\s\S]*signed `v<plugin-version>-rc\.<number>` candidate[\s\S]*stable tag at the same commit/,
      label: 'maintainer quickstart exact-tag warning boundary',
    },
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /`npm run validate:maintainer` fails only on hard gate failures[\s\S]*carry those\s+warnings into the handoff/,
      label: 'maintainer quickstart passing gate warning handoff boundary',
    },
    {
      file: 'docs/operations/maintainers/README.md',
      pattern: /CI or release workflow[\s\S]*`npm run validate:github-workflows`[\s\S]*review changed workflow trigger, permissions, workflow inventory, and required-check list/,
      label: 'maintainer quickstart GitHub workflow shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /## Boundary Rules[\s\S]*Do not loosen global permissions,[\s\S]*agent sandbox settings,[\s\S]*workflow token\s+scope to hide a missing local tool or unavailable platform check/,
      label: 'maintainer troubleshooting no permission bypass boundary',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /Do not paste private machine paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*tokens,[\s\S]*consumer names,[\s\S]*business rules,[\s\S]*private alert details\s+into public troubleshooting notes/,
      label: 'maintainer troubleshooting private details boundary',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /Record unavailable checks as `skipped`, `not run`, or `pending`[\s\S]*replacement CI\/Linux or owner-verified evidence/,
      label: 'maintainer troubleshooting unavailable checks boundary',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /## Fast Failure Map[\s\S]*Use the smallest focused check that matches the failure before running the full\s+maintainer gate again/,
      label: 'maintainer troubleshooting fast failure map purpose',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| Markdown link, anchor, inventory, positioning, or release wording failure \| `npm run validate:docs` \| Fix active public docs only; do not patch generated marketplace outputs by hand\. \|/,
      label: 'maintainer troubleshooting docs failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| Command or skill frontmatter failure \| `node scripts\/lint-frontmatter\.mjs` \| Preserve canonical skill ownership, generated alias mapping, and existing tool permission intent\. \|/,
      label: 'maintainer troubleshooting frontmatter failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| GitHub workflow permission, inventory, or required-check drift \| `npm run validate:github-workflows` \| Do not broaden default token scope or move mutating plugin install smoke into default PR\/push checks\. \|/,
      label: 'maintainer troubleshooting GitHub workflow failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| `generated registry drift check` or generated marketplace drift \| `node scripts\/generate-registry\.mjs --write` \| Edit registry or plugin metadata sources first, then regenerate outputs\. \|/,
      label: 'maintainer troubleshooting generated registry failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| Distribution risk scan secret, private path, or `\.codex\/` artifact finding \| `npm run scan:distribution` \| Remove or redact the active public content; use allowlists only for intentional historical warnings\. \|/,
      label: 'maintainer troubleshooting distribution risk failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| Capability pack documentation-only, enhanced, or fallback boundary failure \| `node scripts\/validate-packs\.mjs` \| Keep packs as documentation guidance; do not introduce runtime dynamic loading as a fix\. \|/,
      label: 'maintainer troubleshooting pack boundary shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| `validate surface budget` warning or failure \| `npm run validate:surface` \| Split bloated shipped surfaces or update the allowlist only with a rationale and split plan\. \|/,
      label: 'maintainer troubleshooting surface budget shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| Bash hook syntax failure \| `bash -n nova-plugin\/hooks\/scripts\/pre-write-check\.sh`, `bash -n nova-plugin\/hooks\/scripts\/pre-bash-check\.sh`, `bash -n nova-plugin\/hooks\/scripts\/trusted-node-hook\.sh`, and `bash -n nova-plugin\/hooks\/scripts\/post-audit-log\.sh` \| Run only where Bash is available; treat Windows no-Bash skips as skipped, not passed\. \|/,
      label: 'maintainer troubleshooting hook syntax failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /\| Codex runtime helper smoke failure \| `node scripts\/validate-runtime-smoke\.mjs` \| Use CI\/Linux for replacement evidence when local Bash is unavailable\. \|/,
      label: 'maintainer troubleshooting runtime smoke failure shortcut',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /## GitHub Workflow Permissions[\s\S]*npm run validate:github-workflows[\s\S]*read-only default token scope,[\s\S]*forbids `pull_request_target`[\s\S]*release write permission scoped to the release job,[\s\S]*workflow\s+file inventory synchronized with `CLAUDE\.md`[\s\S]*required-check docs and the\s+read-only print script synchronized with CI labels[\s\S]*Do not broaden workflow token\s+scope/,
      label: 'maintainer troubleshooting GitHub workflow validator',
    },
    {
      file: 'docs/operations/maintainers/github-security.md',
      pattern: /owner-verified checklist,[\s\S]*not a public portal,[\s\S]*automated\s+settings auditor,[\s\S]*substitute for GitHub UI evidence/,
      label: 'GitHub security settings manual evidence boundary',
    },
    {
      file: 'docs/operations/maintainers/github-security.md',
      pattern: /Keep raw CodeQL alerts,[\s\S]*secret scanning hits,[\s\S]*dependency advisory details,[\s\S]*repository rule screenshots,[\s\S]*tokens,[\s\S]*owner-only security settings out of\s+public docs and issue threads/,
      label: 'GitHub security settings private alert boundary',
    },
    {
      file: 'docs/operations/maintainers/github-security.md',
      pattern: /Do not raise default Actions token permissions[\s\S]*make mutating install smoke\s+a default required check[\s\S]*least-privilege\s+workflow permissions and isolated release evidence/,
      label: 'GitHub security settings least privilege boundary',
    },
    {
      file: 'docs/operations/maintainers/github-security.md',
      pattern: /## Suggested Required Checks[\s\S]*Required \/ Aggregate[\s\S]*Dependency Review[\s\S]*CodeQL \/ Analyze JavaScript[\s\S]*Contracts,[\s\S]*Tests,[\s\S]*Security,[\s\S]*platform matrix,[\s\S]*Package/,
      label: 'GitHub security settings required workflow checks',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validatePublicApiCompatibilityContracts() {
  const checks = [
    {
      file: 'docs/reference/compatibility/public-api.md',
      pattern: /`nova-plugin` is the only production plugin[\s\S]*registry fixtures and generated\s+multi-entry examples are not stable production plugin directories/,
      label: 'public API single production plugin boundary',
    },
    {
      file: 'docs/reference/compatibility/public-api.md',
      pattern: /Marketplace metadata and the generated catalog are install and distribution\s+artifacts,[\s\S]*not a hosted public portal,[\s\S]*paid marketplace,[\s\S]*frontend\s+application/,
      label: 'public API no portal marketplace app boundary',
    },
    {
      file: 'docs/reference/compatibility/public-api.md',
      pattern: /Capability packs are documentation contracts;[\s\S]*do not create runtime\s+dynamic pack or plugin loading/,
      label: 'public API no runtime dynamic loading boundary',
    },
    {
      file: 'docs/reference/compatibility/public-api.md',
      pattern: /Consumer-specific profile content,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository\s+addresses,[\s\S]*local paths,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content are not part of the public API/,
      label: 'public API private consumer boundary',
    },
    {
      file: 'docs/reference/compatibility/public-api.md',
      pattern: /The mutation install smoke path is intentionally not a default local API[\s\S]*Run it only in CI or an isolated test-user environment/,
      label: 'public API install smoke mutation boundary',
    },
    {
      file: 'docs/reference/compatibility/public-api.md',
      pattern: /Do not hand-edit generated marketplace outputs[\s\S]*Update `\.claude-plugin\/registry\.source\.json` or\s+`nova-plugin\/\.claude-plugin\/plugin\.json`, then run:[\s\S]*node scripts\/generate-registry\.mjs --write/,
      label: 'public API generated output source boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateMarketplaceContracts() {
  const checks = [
    {
      file: 'docs/reference/security/marketplace-trust.md',
      pattern: /repository-local marketplace metadata for the current\s+`nova-plugin` entry[\s\S]*not a hosted public portal,[\s\S]*paid marketplace,[\s\S]*production multi-plugin directory,[\s\S]*external trust registry[\s\S]*must not be copied into the\s+Claude-compatible `\.claude-plugin\/marketplace\.json`/,
      label: 'marketplace trust repo-local metadata boundary',
    },
    {
      file: 'docs/reference/security/marketplace-trust.md',
      pattern: /does not rely on blanket high-permission execution as a public\s+recommendation[\s\S]*without recommending global permission bypasses/,
      label: 'marketplace trust permission posture boundary',
    },
    {
      file: 'docs/reference/security/marketplace-trust.md',
      pattern: /Release workflow or `\.github\/workflows\/\*\*` changes should run\s+`node scripts\/validate-github-workflows\.mjs`[\s\S]*least-privilege\s+workflow token scope,[\s\S]*workflow file inventory,[\s\S]*required-check docs and\s+read-only print output synchronization,[\s\S]*isolated mutating install smoke\s+boundaries[\s\S]*Do not broaden workflow token\s+scope/,
      label: 'marketplace trust GitHub workflow contract boundary',
    },
    {
      file: 'docs/reference/security/marketplace-trust.md',
      pattern: /Reviewers must verify that Claude-incompatible fields remain only in\s+repository-local metadata[\s\S]*Public docs and prompts must keep high-risk permission guidance scoped,[\s\S]*contextual,[\s\S]*preferably negative/,
      label: 'marketplace trust incompatible fields boundary',
    },
    {
      file: 'docs/reference/security/security-review.md',
      pattern: /## Public Review Boundary[\s\S]*do not paste private vulnerability\s+reports,[\s\S]*exploit details,[\s\S]*credentials,[\s\S]*tokens,[\s\S]*private endpoints,[\s\S]*repository\s+addresses,[\s\S]*local paths,[\s\S]*customer data,[\s\S]*private knowledge-base content/,
      label: 'security review public-safe disclosure boundary',
    },
    {
      file: 'docs/reference/security/security-review.md',
      pattern: /Use \[SECURITY\.md\]\(\.\.\/\.\.\/\.\.\/SECURITY\.md\) for private vulnerability reports[\s\S]*sanitized risk category,[\s\S]*affected surface,[\s\S]*validation,[\s\S]*skipped checks,[\s\S]*residual risk/,
      label: 'security review private report route boundary',
    },
    {
      file: 'docs/reference/security/security-review.md',
      pattern: /Broad permission-bypass guidance must remain scoped,[\s\S]*negative,[\s\S]*maintainer-approved[\s\S]*not turn it into a default operating mode/,
      label: 'security review permission bypass boundary',
    },
    {
      file: 'docs/reference/security/security-review.md',
      pattern: /Escalate private vulnerability reports through \[SECURITY\.md\]\(\.\.\/\.\.\/\.\.\/SECURITY\.md\)[\s\S]*instead of a public issue or PR comment/,
      label: 'security review disclosure escalation boundary',
    },
    {
      file: 'docs/reference/security/security-review.md',
      pattern: /Distribution risk scan result for active private paths,[\s\S]*credentials,[\s\S]*private\s+network addresses,[\s\S]*internal endpoints,[\s\S]*high-risk blanket permission advice,[\s\S]*tracked `\.codex\/` runtime artifacts/,
      label: 'security review distribution risk output boundary',
    },
    {
      file: 'docs/reference/security/security-review.md',
      pattern: /Broad workflow changes \| `node scripts\/validate-github-workflows\.mjs`[\s\S]*Changes under `\.github\/workflows\/\*\*` must include\s+`node scripts\/validate-github-workflows\.mjs`;[\s\S]*least-privilege token scope,[\s\S]*workflow file inventory,[\s\S]*required-check\s+docs\/read-only print output synchronization,[\s\S]*isolated mutating install\s+smoke boundaries/,
      label: 'security review GitHub workflow validation route',
    },
    {
      file: 'docs/operations/marketplace/registry-authoring.md',
      pattern: /## Current Scope Boundary[\s\S]*current `nova-plugin` entry[\s\S]*not a public portal,[\s\S]*paid marketplace,[\s\S]*production multi-plugin directory,[\s\S]*reason to move `nova-plugin\/`[\s\S]*Multi-entry fixtures prove generator behavior only[\s\S]*roadmap evidence,[\s\S]*release evidence,[\s\S]*maintainer approval/,
      label: 'registry author workflow current scope boundary',
    },
    {
      file: 'docs/operations/marketplace/registry-authoring.md',
      pattern: /Public registry metadata and review notes must stay generic and redacted[\s\S]*Do\s+not include private consumer names,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository\s+addresses,[\s\S]*local paths,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content/,
      label: 'registry author workflow public-safe metadata boundary',
    },
    {
      file: 'docs/operations/marketplace/registry-authoring.md',
      pattern: /Marketplace PRs that change CI\/release workflows or required-check guidance\s+must also run `node scripts\/validate-github-workflows\.mjs`[\s\S]*workflow token scope,[\s\S]*workflow file inventory,[\s\S]*required-check docs\/read-only\s+print output synchronization,[\s\S]*isolated mutating install smoke boundaries[\s\S]*Do not loosen workflow token\s+scope/,
      label: 'registry author workflow GitHub workflow validation route',
    },
    {
      file: 'docs/reference/compatibility/marketplace.md',
      pattern: /## Evidence Scope Boundary[\s\S]*current `nova-plugin` entry[\s\S]*registry fixture behavior[\s\S]*not a hosted public portal,[\s\S]*paid\s+marketplace,[\s\S]*runtime dynamic loading contract,[\s\S]*production\s+multi-plugin migration is active/,
      label: 'compatibility matrix evidence scope boundary',
    },
    {
      file: 'docs/reference/compatibility/marketplace.md',
      pattern: /Optional enhanced tools remain optional[\s\S]*record the\s+check as unavailable,[\s\S]*skipped,[\s\S]*pending with replacement evidence[\s\S]*instead of\s+broadening permissions[\s\S]*missing tool as passed/,
      label: 'compatibility matrix optional tools boundary',
    },
    {
      file: 'docs/reference/compatibility/marketplace.md',
      pattern: /Repository validation \| Node\.js 22\+ and lockfile-pinned development dependencies installed with `npm ci --ignore-scripts` \|[\s\S]*The distributed `nova-plugin` archive has no Node runtime dependencies; maintainer validation still uses the locked Ajv and TypeScript development toolchain/,
      label: 'compatibility matrix maintainer dependency boundary',
    },
    {
      file: 'docs/reference/compatibility/marketplace.md',
      pattern: /GitHub workflow contracts \| Node\.js 22\+ \| `node scripts\/validate-github-workflows\.mjs`[\s\S]*least-privilege workflow token scope,[\s\S]*`\.github\/workflows\/` inventory,[\s\S]*required-check docs\/read-only print output synchronization,[\s\S]*isolated mutating install smoke boundaries[\s\S]*GitHub workflow evidence should include `node scripts\/validate-github-workflows\.mjs`[\s\S]*CI\/release workflows,[\s\S]*workflow inventory,[\s\S]*required-check guidance/,
      label: 'compatibility matrix GitHub workflow evidence boundary',
    },
    {
      file: 'docs/reference/compatibility/marketplace.md',
      pattern: /Compatibility evidence must stay public-safe[\s\S]*not private consumer paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository\s+addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*customer data,[\s\S]*private\s+knowledge-base content/,
      label: 'compatibility matrix private evidence boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateContributionContracts() {
  const checks = [
    {
      file: 'CONTRIBUTING.md',
      pattern: /## 公开贡献边界[\s\S]*只接收可公开维护的 workflow[\s\S]*consumer profile 契约[\s\S]*脱敏模板[\s\S]*prompt 模板[\s\S]*capability pack 指南[\s\S]*验证脚本[\s\S]*marketplace metadata/,
      label: 'contributing public contribution scope boundary',
    },
    {
      file: 'CONTRIBUTING.md',
      pattern: /不要在 issue[\s\S]*PR[\s\S]*示例[\s\S]*模板[\s\S]*review notes[\s\S]*validation output 中包含真实\s+consumer 名称[\s\S]*私有路径[\s\S]*endpoint[\s\S]*凭据[\s\S]*仓库地址[\s\S]*runtime flags[\s\S]*业务规则[\s\S]*客户数据[\s\S]*私有截图[\s\S]*私有知识库内容/,
      label: 'contributing private details boundary',
    },
    {
      file: 'CONTRIBUTING.md',
      pattern: /不要把贡献描述成 public portal[\s\S]*付费 marketplace[\s\S]*production multi-plugin\s+directory[\s\S]*runtime dynamic loading[\s\S]*大量领域命令扩张[\s\S]*除非 roadmap evidence[\s\S]*release evidence[\s\S]*明确激活该方向/,
      label: 'contributing deferred capability boundary',
    },
    {
      file: 'CONTRIBUTING.md',
      pattern: /不要用放宽全局权限[\s\S]*agent sandbox[\s\S]*workflow token scope[\s\S]*掩盖缺失工具[\s\S]*缺失 Bash[\s\S]*缺失 CLI[\s\S]*缺失平台检查[\s\S]*记录为 skipped[\s\S]*pending[\s\S]*not run/,
      label: 'contributing no permission bypass boundary',
    },
    {
      file: 'CONTRIBUTING.md',
      pattern: /维护者 npm 便捷入口[\s\S]*`npm ci --ignore-scripts` 安装 lockfile 固定的开发依赖[\s\S]*分发的\s+`nova-plugin` 归档不包含 Node 运行时依赖[\s\S]*不代表维护者校验入口\s+dependency-free[\s\S]*不使用通用 `build` 名称[\s\S]*`release:artifacts` 构建/,
      label: 'contributing npm shortcut facts',
    },
    {
      file: '.github/pull_request_template.md',
      pattern: /Public PR content is free of private consumer names,[\s\S]*local paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*customer data,[\s\S]*private screenshots,[\s\S]*private knowledge-base content/,
      label: 'PR template private details boundary',
    },
    {
      file: '.github/pull_request_template.md',
      pattern: /does not present public portal,[\s\S]*paid marketplace,[\s\S]*production multi-plugin directory,[\s\S]*runtime dynamic loading,[\s\S]*broad domain-command expansion as current capability[\s\S]*roadmap and release evidence explicitly activate it/,
      label: 'PR template deferred capability boundary',
    },
    {
      file: '.github/pull_request_template.md',
      pattern: /Skipped or unavailable checks are recorded as skipped,[\s\S]*pending,[\s\S]*not run with a reason[\s\S]*does not broaden global permissions,[\s\S]*agent sandbox settings,[\s\S]*workflow token scope to hide missing tools/,
      label: 'PR template no permission bypass boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateIssueTemplateContracts() {
  const checks = [
    {
      file: '.github/ISSUE_TEMPLATE/bug_report.yml',
      pattern: /public, reproducible bugs[\s\S]*Do not include credentials,[\s\S]*private endpoints,[\s\S]*private repository addresses,[\s\S]*local machine paths,[\s\S]*consumer-specific facts,[\s\S]*undisclosed vulnerability details[\s\S]*Security issues must be reported privately through the Security Policy/,
      label: 'bug report public-safe disclosure boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/bug_report.yml',
      pattern: /If a tool,[\s\S]*Bash,[\s\S]*Claude CLI,[\s\S]*Codex CLI,[\s\S]*platform check is unavailable,[\s\S]*skipped,[\s\S]*pending,[\s\S]*not run[\s\S]*Do not broaden global permissions,[\s\S]*agent sandbox settings,[\s\S]*workflow token scope/,
      label: 'bug report unavailable check boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/bug_report.yml',
      pattern: /label: Public-safety check[\s\S]*I have removed credentials,[\s\S]*private endpoints,[\s\S]*private repository addresses,[\s\S]*local machine paths,[\s\S]*consumer-specific facts,[\s\S]*undisclosed vulnerability details[\s\S]*required: true/,
      label: 'bug report required public safety checkbox',
    },
    {
      file: '.github/ISSUE_TEMPLATE/bug_report.yml',
      pattern: /placeholder: vX\.Y\.Z, X\.Y\.Z, or a commit SHA/,
      label: 'bug report version placeholder is drift-safe',
    },
    {
      file: '.github/ISSUE_TEMPLATE/feature_request.yml',
      pattern: /feature proposals that can be discussed publicly[\s\S]*generic and redacted[\s\S]*Do not include credentials,[\s\S]*private endpoints,[\s\S]*private repository addresses,[\s\S]*local machine paths,[\s\S]*consumer-specific business rules,[\s\S]*private knowledge-base content/,
      label: 'feature request public-safe disclosure boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/feature_request.yml',
      pattern: /Do not present public portal,[\s\S]*paid marketplace,[\s\S]*production multi-plugin directory,[\s\S]*runtime dynamic loading,[\s\S]*broad domain-command expansion as current capability[\s\S]*roadmap and release evidence explicitly activate it/,
      label: 'feature request deferred capability boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/feature_request.yml',
      pattern: /Do not propose broadening global permissions,[\s\S]*sandbox settings,[\s\S]*workflow token scope as a workaround for missing tools or validators/,
      label: 'feature request no permission bypass boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/feature_request.yml',
      pattern: /I have not framed deferred portal,[\s\S]*marketplace,[\s\S]*multi-plugin,[\s\S]*runtime loading,[\s\S]*broad domain-command work as current capability[\s\S]*required: true/,
      label: 'feature request deferred capability checkbox',
    },
    {
      file: '.github/ISSUE_TEMPLATE/showcase_feedback.yml',
      pattern: /public-safe showcase and growth feedback[\s\S]*Redacted examples,[\s\S]*generic workflow observations[\s\S]*Do not include credentials,[\s\S]*private endpoints,[\s\S]*private repository addresses,[\s\S]*local machine paths,[\s\S]*consumer names,[\s\S]*business rules,[\s\S]*private knowledge-base content/,
      label: 'showcase feedback public-safe disclosure boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/showcase_feedback.yml',
      pattern: /Do not submit real consumer case studies,[\s\S]*private screenshots,[\s\S]*private analytics,[\s\S]*public portal claims,[\s\S]*paid marketplace claims,[\s\S]*automated promotion requests,[\s\S]*owner-only data/,
      label: 'showcase feedback no portal private evidence boundary',
    },
    {
      file: '.github/ISSUE_TEMPLATE/showcase_feedback.yml',
      pattern: /I have not included real consumer case-study details,[\s\S]*private screenshots,[\s\S]*private analytics,[\s\S]*public portal \/ paid marketplace claims[\s\S]*required: true/,
      label: 'showcase feedback deferred claim checkbox',
    },
    {
      file: '.github/ISSUE_TEMPLATE/config.yml',
      pattern: /blank_issues_enabled: false[\s\S]*Security reports[\s\S]*Report vulnerabilities privately; do not disclose security details in a public issue[\s\S]*Showcase and growth feedback[\s\S]*Share public-safe examples/,
      label: 'issue template config private security route',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateDocsIndexContracts() {
  const checks = [
    {
      file: 'docs/README.md',
      pattern: /## Public Navigation Boundary[\s\S]*`docs\/tutorials\/` and `docs\/templates\/` are public-safe learning and reuse[\s\S]*not a public portal or real consumer case-study library/,
      label: 'docs index public navigation boundary',
    },
    {
      file: 'docs/README.md',
      pattern: /Tutorials\s+explain reusable scenario workflows; templates provide redacted fixtures,[\s\S]*rubrics, prompts, profiles, and evidence records/,
      label: 'docs index tutorials templates distinction',
    },
    {
      file: 'docs/README.md',
      pattern: /Keep consumer-specific profiles,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*local\s+paths,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+repository addresses,[\s\S]*private\s+knowledge-base content[\s\S]*consumer-owned workspace/,
      label: 'docs index private consumer workspace boundary',
    },
    {
      file: 'docs/README.md',
      pattern: /Understand local audit logs and data handling[\s\S]*\(reference\/security\/data-handling\.md\)/,
      label: 'docs index data handling start-here link',
    },
    {
      file: 'docs/README.md',
      pattern: /\|-- reference\/\s+# architecture, compatibility, evaluation, security, and workflow contracts/,
      label: 'docs index canonical reference directory map',
    },
    {
      file: 'docs/README.md',
      pattern: /\[reference\/\]\(reference\/\)[\s\S]*including local audit-log data handling/,
      label: 'docs index canonical reference responsibility',
    },
    {
      file: 'docs/README.md',
      pattern: /\[reference\/security\/data-handling\.md\]\(reference\/security\/data-handling\.md\)/,
      label: 'docs index canonical data handling link label',
    },
    {
      file: 'docs/README.md',
      pattern: /## Compatibility Stubs[\s\S]*`governance\/docs-migrations\.json`[\s\S]*Do not add maintained\s+content, new inbound links, or directory ownership claims/,
      label: 'docs index compatibility stub boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateDataHandlingContracts() {
  const checks = [
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /must not contain real consumer profiles,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*private\s+repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*customer data,[\s\S]*local\s+machine paths,[\s\S]*private knowledge-base content/,
      label: 'data handling public repository boundary',
    },
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /\$\{CLAUDE_PLUGIN_DATA:-\$\{XDG_STATE_HOME:-\$HOME\/\.local\/state\}\/nova-plugin\}\/audit\.log/,
      label: 'data handling default audit log path',
    },
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /directory with `700`[\s\S]*log file with\s+`600`[\s\S]*rotates to\s+`audit\.log\.1` after 5 MB/,
      label: 'data handling permissions and rotation',
    },
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /NOVA_AUDIT_DISABLED=1/,
      label: 'data handling audit disable switch',
    },
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /best-effort redaction[\s\S]*Redaction is a guardrail, not a guarantee/,
      label: 'data handling best-effort redaction boundary',
    },
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /If the redaction helper is unavailable,[\s\S]*records a placeholder\s+summary rather than echoing command text/,
      label: 'data handling unavailable redaction fallback',
    },
    {
      file: 'docs/reference/security/data-handling.md',
      pattern: /Public docs must not include:[\s\S]*Real consumer names[\s\S]*Local machine paths,[\s\S]*private repository URLs,[\s\S]*endpoints[\s\S]*Credentials,[\s\S]*tokens,[\s\S]*private keys,[\s\S]*raw authorization headers/,
      label: 'data handling public docs private-data boundary',
    },
    {
      file: 'SECURITY.md',
      pattern: /本地审计日志、脱敏边界和 public-safe 数据处理规则见[\s\S]*(?:\.\/)?docs\/reference\/security\/data-handling\.md/,
      label: 'security policy data handling route',
    },
    {
      file: 'docs/operations/maintainers/troubleshooting.md',
      pattern: /## Audit Log Location[\s\S]*NOVA_AUDIT_DISABLED=1[\s\S]*\.\.\/privacy\/data-handling\.md[\s\S]*Do not commit local\s+audit logs or treat redaction as a guarantee/,
      label: 'maintainer troubleshooting data handling route',
    },
    {
      file: 'nova-plugin/docs/architecture/hooks-design.md',
      pattern: /PreToolUse[\s\S]*runtime\/secret-rules\.mjs[\s\S]*PostToolUse[\s\S]*docs\/reference\/security\/data-handling\.md/,
      label: 'hooks design shared secret rules and data handling route',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateValidatorCoverageNarrative() {
  const checks = [
    {
      file: 'CLAUDE.md',
      pattern: /`node scripts\/validate-docs\.mjs` validates[\s\S]*project\s+positioning\s+contracts,[\s\S]*exact-tag\s+release\s+promotion\s+boundaries,[\s\S]*maintainer\s+diagnostic\s+and\s+security\s+setting\s+semantics,[\s\S]*public\s+API\s+compatibility\s+contracts,[\s\S]*marketplace\s+trust,[\s\S]*author\s+workflow,[\s\S]*compatibility,[\s\S]*security\s+review\s+contracts,[\s\S]*contribution\s+and\s+issue\s+intake\s+contracts,[\s\S]*docs\s+index\s+navigation\s+contracts,[\s\S]*consumer\s+profile\s+privacy\s+contracts,[\s\S]*prompt\s+template\s+privacy\s+contracts,[\s\S]*local\s+data\s+handling\s+privacy\s+contracts,[\s\S]*workflow\s+evidence\s+contracts,[\s\S]*showcase\s+public-safety\s+contracts,[\s\S]*growth\s+metrics\s+privacy\s+contracts,[\s\S]*assets\s+capture\s+privacy\s+contracts,[\s\S]*deferred\s+portal\s+IA\s+contracts,[\s\S]*multi-plugin\s+readiness\s+evidence\s+contracts/,
      label: 'CLAUDE validate-docs coverage narrative',
    },
    {
      file: 'CLAUDE.md',
      pattern: /Current CI includes[\s\S]*GitHub workflow permission, inventory, and\s+required-check validation/,
      label: 'CLAUDE CI GitHub workflow coverage narrative',
    },
    {
      file: 'README.md',
      pattern: /该入口覆盖[\s\S]*GitHub workflow 权限、库存和 required-check 合约/,
      label: 'README validate-all GitHub workflow coverage narrative',
    },
    {
      file: 'README.md',
      pattern: /lines 85%、branches 70%、functions 90%/,
      label: 'README coverage threshold source alignment',
    },
    {
      file: 'docs/project/plans/current-remediation.md',
      pattern: /`validate-docs` checks[\s\S]*project\s+positioning\s+contracts,[\s\S]*exact-tag\s+release\s+promotion\s+boundaries,[\s\S]*maintainer\s+diagnostic\s+and\s+security\s+setting\s+semantics,[\s\S]*public\s+API\s+compatibility\s+contracts,[\s\S]*marketplace\s+trust,[\s\S]*author\s+workflow,[\s\S]*compatibility,[\s\S]*security\s+review\s+contracts,[\s\S]*contribution\s+and\s+issue\s+intake\s+contracts,[\s\S]*docs\s+index\s+navigation\s+contracts,[\s\S]*consumer\s+profile\s+privacy\s+contracts,[\s\S]*prompt\s+template\s+privacy\s+contracts,[\s\S]*local\s+data\s+handling\s+privacy\s+contracts,[\s\S]*workflow\s+evidence\s+contracts,[\s\S]*showcase\s+public-safety\s+contracts,[\s\S]*growth\s+metrics\s+privacy\s+contracts,[\s\S]*assets\s+capture\s+privacy\s+contracts,[\s\S]*deferred\s+portal\s+IA\s+contracts,[\s\S]*multi-plugin\s+readiness\s+evidence\s+contracts/,
      label: 'optimization plan validate-docs coverage narrative',
    },
    {
      file: 'docs/project/plans/current-remediation.md',
      pattern: /Existing validation covers[\s\S]*GitHub workflow permission, inventory, and required-check\s+contracts/,
      label: 'optimization plan GitHub workflow coverage narrative',
    },
    {
      file: 'docs/project/plans/current-remediation.md',
      pattern: /`validate-github-workflows` checks GitHub workflow token scope, workflow file\s+inventory, required-check docs and print output/,
      label: 'optimization plan validate-github-workflows scope narrative',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateConsumerProfileContracts() {
  const checks = [
    {
      file: 'docs/guides/assistants/README.md',
      pattern: /public, redacted contract[\s\S]*only generic workflow guidance,[\s\S]*consumer profile shapes,[\s\S]*sanitized examples/,
      label: 'consumer README public redacted contract',
    },
    {
      file: 'docs/guides/assistants/README.md',
      pattern: /Real consumer profiles must live in the consumer project itself[\s\S]*Do not copy closed-source project names,[\s\S]*paths,[\s\S]*private\s+identifiers,[\s\S]*network\s+endpoints,[\s\S]*runtime\s+flags,[\s\S]*private\s+repository addresses,[\s\S]*private\s+knowledge base content/,
      label: 'consumer README private profile boundary',
    },
    {
      file: 'docs/guides/assistants/README.md',
      pattern: /Add `--write` only when the output directory\s+is a consumer-owned workspace outside this public repository checkout[\s\S]*script refuses `--write` targets inside `llm-plugins-fusion`/,
      label: 'consumer README scaffold write boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/contract.md',
      pattern: /public repository defines the contract only; the real\s+profile belongs in the consumer's project-local `AGENTS\.md`, `CLAUDE\.md`,\s+`\.claude\/`, or private documentation/,
      label: 'consumer profile contract source boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/contract.md',
      pattern: /Do not expose private names,[\s\S]*paths,[\s\S]*identifiers,[\s\S]*repository addresses,[\s\S]*network endpoints,[\s\S]*runtime flags,[\s\S]*credentials,[\s\S]*configuration values[\s\S]*Do not write public repository docs from private consumer facts/,
      label: 'consumer profile contract private facts boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/java-backend.md',
      pattern: /redacted template for a private Java\/Spring backend consumer[\s\S]*Copy the shape into the consumer's\s+private `AGENTS\.md`, `CLAUDE\.md`, `\.claude\/`, or private documentation[\s\S]*Do not replace placeholders with real private values in this public repository/,
      label: 'consumer Java template private profile boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/java-backend.md',
      pattern: /Keep public examples at the family level[\s\S]*Do not publish private component\s+identifiers,[\s\S]*repository addresses,[\s\S]*environment names,[\s\S]*network endpoints,[\s\S]*runtime\s+flags,[\s\S]*credentials,[\s\S]*configuration values[\s\S]*Do not copy private component identifiers,[\s\S]*package names,[\s\S]*local paths,[\s\S]*private docs into public artifacts/,
      label: 'consumer Java template private facts boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/java-backend.md',
      pattern: /Do not run destructive data,[\s\S]*migration,[\s\S]*deployment commands unless the\s+private project source of truth explicitly authorizes them[\s\S]*Do not change command or skill behavior from this template/,
      label: 'consumer Java template destructive boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/frontend.md',
      pattern: /redacted template for a private frontend application[\s\S]*Copy the shape\s+into the consumer's private `AGENTS\.md`, `CLAUDE\.md`, `\.claude\/`, or private\s+documentation[\s\S]*Do not replace placeholders with real private values in this public repository/,
      label: 'consumer frontend template private profile boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/frontend.md',
      pattern: /Keep public examples at the family level[\s\S]*Do not publish private route names,[\s\S]*feature names,[\s\S]*environment names,[\s\S]*network endpoints,[\s\S]*repository addresses,[\s\S]*credentials,[\s\S]*configuration values[\s\S]*Do not copy private route names,[\s\S]*feature names,[\s\S]*local paths,[\s\S]*private\s+design docs into public artifacts/,
      label: 'consumer frontend template private facts boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/frontend.md',
      pattern: /Do not introduce new frontend stacks,[\s\S]*dependencies,[\s\S]*public portal work\s+unless the private project source of truth explicitly asks for them[\s\S]*Do not change command or skill behavior from this template/,
      label: 'consumer frontend template public portal boundary',
    },
    {
      file: 'docs/guides/assistants/codex.md',
      pattern: /keep `\.codex\/` runtime artifacts out of this public\s+repository[\s\S]*treat `\.codex\/` as disposable local evidence unless the project-local source\s+of truth defines a stricter artifact policy/,
      label: 'consumer Codex setup runtime artifact boundary',
    },
    {
      file: 'docs/guides/assistants/codex.md',
      pattern: /If Codex CLI or Bash is unavailable,[\s\S]*do not\s+relax global permissions to hide the missing runtime/,
      label: 'consumer Codex setup no permission bypass boundary',
    },
    {
      file: 'docs/guides/assistants/cursor.md',
      pattern: /Keep Cursor rules and project-specific workflow details in the consumer\s+repository[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge\s+base content,[\s\S]*consumer-specific commands into public templates or examples/,
      label: 'consumer Cursor setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/cursor.md',
      pattern: /If Cursor cannot run a selected validator,[\s\S]*do not loosen global permissions or agent sandbox settings\s+to bypass the missing tool/,
      label: 'consumer Cursor setup no permission bypass boundary',
    },
    {
      file: 'docs/guides/assistants/cline.md',
      pattern: /Keep Cline rules in the consumer repository[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge base content,[\s\S]*consumer-specific commands into this public repository/,
      label: 'consumer Cline setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/cline.md',
      pattern: /If Cline cannot run a selected validator,[\s\S]*instead of broadening permissions or sandbox settings to hide the gap/,
      label: 'consumer Cline setup no permission bypass boundary',
    },
    {
      file: 'docs/guides/assistants/aider.md',
      pattern: /Keep private repository names,[\s\S]*local paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime\s+flags,[\s\S]*business rules,[\s\S]*private knowledge base content,[\s\S]*real project\s+prompts in the consumer workspace/,
      label: 'consumer Aider setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/aider.md',
      pattern: /If Aider cannot run a validator,[\s\S]*instead of\s+treating the check as passed/,
      label: 'consumer Aider setup no false pass boundary',
    },
    {
      file: 'docs/guides/assistants/openhands.md',
      pattern: /The consumer project should own any OpenHands workspace setup,[\s\S]*Keep consumer-specific repository addresses,[\s\S]*paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge base content,[\s\S]*local\s+OpenHands configuration in the consumer repository/,
      label: 'consumer OpenHands setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/openhands.md',
      pattern: /Do not broaden sandbox or workflow permissions merely to convert a missing\s+tool into a passing check/,
      label: 'consumer OpenHands setup no permission bypass boundary',
    },
    {
      file: 'docs/guides/assistants/gemini-cli.md',
      pattern: /Keep Gemini skill or context files that contain consumer facts in the\s+private consumer project[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge\s+base content,[\s\S]*consumer-specific commands into public templates or examples/,
      label: 'consumer Gemini setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/gemini-cli.md',
      pattern: /If Gemini CLI cannot run the selected validator,[\s\S]*do not broaden global tool permissions,[\s\S]*shell access,[\s\S]*sandbox settings to hide the missing runtime/,
      label: 'consumer Gemini setup no permission bypass boundary',
    },
    {
      file: 'docs/guides/assistants/opencode.md',
      pattern: /Store OpenCode-specific configuration in the consumer project[\s\S]*Keep consumer-specific rules,[\s\S]*private paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge\s+base content out of public templates and examples/,
      label: 'consumer OpenCode setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/opencode.md',
      pattern: /If a selected safety check or validator is unavailable,[\s\S]*do not loosen global permissions to bypass the\s+missing tool/,
      label: 'consumer OpenCode setup no permission bypass boundary',
    },
    {
      file: 'docs/guides/assistants/copilot.md',
      pattern: /Keep `\.github\/copilot-instructions\.md` and persona mappings private unless\s+they are fully generic and redacted[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*branch policies,[\s\S]*business rules,[\s\S]*private knowledge\s+base\s+content into public templates or examples/,
      label: 'consumer Copilot setup private config boundary',
    },
    {
      file: 'docs/guides/assistants/copilot.md',
      pattern: /If Copilot cannot run a check,[\s\S]*do not loosen repository or agent permissions to bypass the missing\s+tool/,
      label: 'consumer Copilot setup no permission bypass boundary',
    },
    {
      file: 'docs/templates/consumer-profiles/workbench.md',
      pattern: /Do not copy private consumer names,[\s\S]*local absolute paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge base content[\s\S]*Fill concrete values only inside the private consumer workspace/,
      label: 'consumer workbench private workspace boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validatePromptTemplateContracts() {
  const checks = [
    {
      file: 'docs/templates/prompts/README.md',
      pattern: /public-safe prompt templates[\s\S]*They are templates, not consumer profiles[\s\S]*Replace\s+placeholders inside the private consumer project[\s\S]*keep private names,[\s\S]*local\s+paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*configuration values,[\s\S]*business-specific\s+rules out of this public repository/,
      label: 'prompt README public-safe private facts boundary',
    },
    {
      file: 'docs/templates/prompts/README.md',
      pattern: /Do not paste full files,[\s\S]*full diffs,[\s\S]*long generated output into final\s+answers when an artifact path or summary is enough[\s\S]*Treat HTML outputs as derived reading artifacts[\s\S]*keep Markdown,[\s\S]*code,[\s\S]*review,[\s\S]*validation evidence as the source of truth/,
      label: 'prompt README evidence summary boundary',
    },
    {
      file: 'docs/templates/prompts/common/checkpoint-artifact.md',
      pattern: /private consumer workbench[\s\S]*Keep private names,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*local paths,[\s\S]*runtime flags,[\s\S]*business rules in the\s+consumer project only[\s\S]*Do not include private credentials,[\s\S]*endpoints,[\s\S]*local machine paths,[\s\S]*private knowledge-base content unless this artifact stays in the private\s+consumer workspace/,
      label: 'checkpoint prompt private workspace boundary',
    },
    {
      file: 'docs/templates/prompts/common/html-artifact.md',
      pattern: /HTML artifacts are derived reading artifacts,[\s\S]*not the source of truth[\s\S]*事实源仍是 Markdown、代码、diff、review artifact、validation output[\s\S]*不包含私有 endpoint、凭据、真实用户数据、私有仓库地址或个人绝对路径/,
      label: 'HTML prompt source-of-truth privacy boundary',
    },
    {
      file: 'docs/templates/prompts/common/html-artifact.md',
      pattern: /默认不使用外部 CDN、远程 JavaScript、远程字体或远程图片[\s\S]*默认不发起网络请求[\s\S]*不提交表单[\s\S]*不写 localStorage 或 sessionStorage[\s\S]*长期保留的 HTML 必须配套 Markdown 摘要或来源说明/,
      label: 'HTML prompt offline derived artifact boundary',
    },
    {
      file: 'docs/templates/prompts/common/workbench-tidy.md',
      pattern: /private consumer workspace[\s\S]*不删除文件，除非用户明确要求[\s\S]*不移动源码仓库文件，除非它们确实是误放的过程文档[\s\S]*不把私有文档复制到公开仓库/,
      label: 'workbench tidy prompt private workspace boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateWorkflowEvidenceContracts() {
  const checks = [
    {
      file: 'docs/guides/workflows/source-controlled-checks.md',
      pattern: /source-controlled AI\s+workflow checks without turning the public repository into a mature multi-plugin\s+platform or a custom CI product/,
      label: 'source-controlled checks no platform boundary',
    },
    {
      file: 'docs/guides/workflows/source-controlled-checks.md',
      pattern: /the useful part is not a new\s+runtime[\s\S]*making workflow expectations reviewable,[\s\S]*repeatable,[\s\S]*public-safe/,
      label: 'source-controlled checks no runtime positioning',
    },
    {
      file: 'docs/guides/workflows/source-controlled-checks.md',
      pattern: /A future `\.nova\/checks\/` or `nova-plugin\/checks\/` directory is appropriate only\s+after at least two checks repeat across releases or consumer projects/,
      label: 'source-controlled checks future checks threshold',
    },
    {
      file: 'docs/guides/workflows/source-controlled-checks.md',
      pattern: /Checks must not include private consumer names,[\s\S]*local paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content/,
      label: 'source-controlled checks private facts boundary',
    },
    {
      file: 'docs/guides/workflows/source-controlled-checks.md',
      pattern: /Do not add a new runtime or CI layer when a deterministic script plus rubric is\s+enough/,
      label: 'source-controlled checks no runtime CI layer',
    },
    {
      file: 'docs/reference/workflows/verification-evidence.md',
      pattern: /It must not include private consumer names,[\s\S]*local\s+machine paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge-base content/,
      label: 'verification evidence private facts boundary',
    },
    {
      file: 'docs/reference/workflows/verification-evidence.md',
      pattern: /Do not claim completion from tool success alone\. Map evidence back to the\s+behavior,[\s\S]*repository fact,[\s\S]*review finding,[\s\S]*change goal being verified/,
      label: 'verification evidence maps tool success to behavior',
    },
    {
      file: 'docs/reference/workflows/verification-evidence.md',
      pattern: /Check skipped \| Environment or tool reason plus residual risk[\s\S]*Silent omission or reporting the check as passed/,
      label: 'verification evidence skipped-check honesty',
    },
    {
      file: 'docs/reference/workflows/verification-evidence.md',
      pattern: /skipped or unavailable checks with reasons[\s\S]*known unverified behavior,[\s\S]*repository facts,[\s\S]*edge cases,[\s\S]*residual risk/,
      label: 'verification summary skipped residual risk',
    },
    {
      file: 'docs/reference/workflows/routing-guardrails.md',
      pattern: /The route output is a recommendation,[\s\S]*not evidence that validation has passed/,
      label: 'routing guardrail route output not evidence',
    },
    {
      file: 'docs/reference/workflows/routing-guardrails.md',
      pattern: /`Skipped or Unverified` records skipped checks,[\s\S]*unverified behavior or facts,[\s\S]*reasons,[\s\S]*residual risk/,
      label: 'routing guardrail skipped unverified boundary',
    },
    {
      file: 'docs/reference/workflows/routing-guardrails.md',
      pattern: /should not recommend blanket permission bypasses\s+as the default path[\s\S]*Affirmative guidance that recommends broad bypasses should trigger security\s+review and distribution-risk scanning/,
      label: 'routing guardrail no blanket bypass boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateShowcaseContracts() {
  const checks = [
    {
      file: 'docs/tutorials/README.md',
      pattern: /public-safe\s+entry points[\s\S]*Keep examples generic and redacted/,
      label: 'showcase README public-safe positioning',
    },
    {
      file: 'docs/tutorials/README.md',
      pattern: /Do not publish real consumer profiles,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*private\s+repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content/,
      label: 'showcase README private consumer boundary',
    },
    {
      file: 'docs/tutorials/java-backend.md',
      pattern: /## Private context boundary[\s\S]*real service names,[\s\S]*endpoints,[\s\S]*schema names,[\s\S]*credentials,[\s\S]*private\s+repository addresses,[\s\S]*feature flags,[\s\S]*business logic/,
      label: 'Java backend showcase private context boundary',
    },
    {
      file: 'docs/tutorials/frontend.md',
      pattern: /## Private context boundary[\s\S]*real product names,[\s\S]*routes,[\s\S]*API hosts,[\s\S]*customer data,[\s\S]*feature\s+flags,[\s\S]*analytics keys,[\s\S]*business rules,[\s\S]*screenshots/,
      label: 'frontend showcase private context boundary',
    },
    {
      file: 'docs/tutorials/release-and-docs.md',
      pattern: /## Private context boundary[\s\S]*private consumer names,[\s\S]*local\s+machine paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge-base content,[\s\S]*non-public metrics/,
      label: 'release docs showcase private context boundary',
    },
    {
      file: 'docs/tutorials/release-and-docs.md',
      pattern: /If Windows cannot run Bash-dependent checks[\s\S]*report those\s+checks as skipped instead of passed/,
      label: 'release docs showcase skipped Bash boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateGrowthMetricsContracts() {
  const checks = [
    {
      file: 'docs/operations/community/metrics.md',
      pattern: /Repository Topics and bounded contribution issues may be\s+managed through an authenticated GitHub workflow[\s\S]*Discussions,[\s\S]*social preview\s+upload,[\s\S]*external posting,[\s\S]*user outreach,[\s\S]*consent,[\s\S]*private traffic data\s+remain maintainer-owned actions/,
      label: 'growth metrics manual action boundary',
    },
    {
      file: 'docs/operations/community/metrics.md',
      pattern: /not a public portal,[\s\S]*paid marketplace,[\s\S]*automated posting workflow,[\s\S]*owner-only analytics publication surface/,
      label: 'growth metrics no portal automation boundary',
    },
    {
      file: 'docs/operations/community/metrics.md',
      pattern: /Default output is `\.metrics\/latest\.json`, which is intentionally ignored by\s+Git[\s\S]*Use `--out <path>` only for private dashboards or temporary analysis/,
      label: 'growth metrics private output boundary',
    },
    {
      file: 'docs/operations/community/metrics.md',
      pattern: /## Privacy Boundary[\s\S]*Do not commit `\.metrics\/` output[\s\S]*Do not publish raw referrers,[\s\S]*private campaign URLs,[\s\S]*internal dashboards,[\s\S]*tokens,[\s\S]*owner-only traffic details[\s\S]*Do not infer personal user identity[\s\S]*aggregate metric definitions and collection cadence,[\s\S]*not private analytics records/,
      label: 'growth metrics privacy boundary',
    },
    {
      file: 'docs/operations/community/metrics.md',
      pattern: /If `npm run doctor` reports that HEAD is not an exact release tag,[\s\S]*development snapshot rather than a stable release/,
      label: 'growth metrics exact tag promotion boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateAssetsContracts() {
  const checks = [
    {
      file: 'docs/operations/community/assets.md',
      pattern: /public-safe visual assets and capture guidance[\s\S]*workflow quickly without exposing private consumer context/,
      label: 'assets public-safe positioning',
    },
    {
      file: 'docs/operations/community/assets.md',
      pattern: /Visual assets are not a public portal,[\s\S]*hosted demo site,[\s\S]*automated promotion\s+workflow,[\s\S]*substitute for release evidence/,
      label: 'assets no portal automation boundary',
    },
    {
      file: 'docs/operations/community/assets.md',
      pattern: /GitHub social preview upload,[\s\S]*external posting,[\s\S]*real demo publication[\s\S]*maintainer-owned manual\s+actions[\s\S]*GitHub UI or an authenticated workflow/,
      label: 'assets manual action boundary',
    },
    {
      file: 'docs/operations/community/assets.md',
      pattern: /nova-route-demo\.gif[\s\S]*deterministic `npm run demo:route` fixture output[\s\S]*nova-route-demo\.svg[\s\S]*Reviewable source/,
      label: 'assets tracked media boundary',
    },
    {
      file: 'docs/operations/community/assets.md',
      pattern: /Before adding a demo GIF or short video[\s\S]*matching command evidence from `npm run doctor`, `npm run\s+validate:workflow`, or an equivalent release record[\s\S]*Do not present a mock\s+terminal session as product evidence/,
      label: 'assets demo evidence boundary',
    },
    {
      file: 'docs/operations/community/assets.md',
      pattern: /Use an exact release tag for installation demos,[\s\S]*label the capture as a\s+development snapshot[\s\S]*If Bash checks are skipped on Windows,[\s\S]*show the skipped status explicitly/,
      label: 'assets release and skipped-check boundary',
    },
    {
      file: 'docs/operations/community/assets.md',
      pattern: /## Privacy Boundary[\s\S]*Do not capture private consumer project names,[\s\S]*local paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*customer data,[\s\S]*private screenshots,[\s\S]*private knowledge-base content[\s\S]*Use public fixtures,\s+redacted examples, or a clean demo repository/,
      label: 'assets privacy boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateDeferredPortalIaContracts() {
  const pluginVersionPattern = escapeRegExp(
    readJson('governance/release-channels.json').stable.version,
  );
  const checks = [
    {
      file: 'docs/project/plans/portal-information-architecture.md',
      pattern: /documentation-only preparation:[\s\S]*does not move `nova-plugin\/`,[\s\S]*does not build a frontend site,[\s\S]*does not add release or deployment pipeline\s+dependencies/,
      label: 'portal IA documentation-only boundary',
    },
    {
      file: 'docs/project/plans/portal-information-architecture.md',
      pattern: /not an implemented public portal,[\s\S]*hosted marketplace,[\s\S]*frontend app,[\s\S]*deployment plan,[\s\S]*evidence that a public portal is active/,
      label: 'portal IA no implemented portal boundary',
    },
    {
      file: 'docs/project/plans/portal-information-architecture.md',
      pattern: /Portal implementation code must not become a new source of truth[\s\S]*consume\s+these repository sources rather than duplicate plugin metadata by hand/,
      label: 'portal IA source-of-truth boundary',
    },
    {
      file: 'docs/project/plans/portal-information-architecture.md',
      pattern: new RegExp('single-plugin portal preparation boundary was introduced in `v2\\.2\\.0`[\\s\\S]*remains the current `v'
        + pluginVersionPattern
        + '` marketplace state[\\s\\S]*does not require\\s+a plugin path move or a public portal implementation[\\s\\S]*breaking multi-plugin\\s+repository layout remains a future major-version candidate'),
      label: 'portal IA historical and current single-plugin boundary',
    },
    {
      file: 'docs/project/plans/portal-information-architecture.md',
      pattern: /## Explicit Non-Goals For This Preparation[\s\S]*Do not move, rename, or copy `nova-plugin\/`[\s\S]*Do not build a React, Vite, Next\.js, static-site, or other frontend portal[\s\S]*Do not add package dependencies, deployment jobs,[\s\S]*Do not change plugin versions or generated release metadata[\s\S]*Do not put repository-local fields[\s\S]*Claude-compatible marketplace manifest/,
      label: 'portal IA explicit non-goals',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateMultiPluginReadinessEvidenceContracts() {
  const checks = [
    {
      file: 'docs/project/plans/multi-plugin-readiness.md',
      pattern: /product lane in\s+`governance\/product-lanes\.json`[\s\S]*independent of plugin version numbers/,
      label: 'multi-plugin readiness version-independent decision boundary',
    },
    {
      file: 'docs/project/plans/multi-plugin-readiness.md',
      pattern: /Registry fixtures prove that generators can process\s+multiple entries[\s\S]*do not prove that production directories,[\s\S]*ownership,[\s\S]*release cadence,[\s\S]*installation paths should change/,
      label: 'multi-plugin readiness fixture-only evidence boundary',
    },
    {
      file: 'docs/project/plans/multi-plugin-readiness.md',
      pattern: /production layout remains single-plugin[\s\S]*`nova-plugin\/` is the only public\s+production plugin path/,
      label: 'multi-plugin readiness one production plugin boundary',
    },
    {
      file: 'docs/project/plans/multi-plugin-readiness.md',
      pattern: /## Not Allowed Without Activation[\s\S]*Moving, renaming, or copying the production `nova-plugin\/` path[\s\S]*Treating `plugins\/\*` as a production install location[\s\S]*Claiming fixture-only behavior as a mature multi-plugin ecosystem[\s\S]*Coupling this product decision to a future version number/,
      label: 'multi-plugin readiness activation non-goals',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateReviewLevelLiteContract() {
  const activeFiles = [
    'nova-plugin/skills/nova-review/SKILL.md',
    'nova-plugin/docs/commands/review/review.md',
    'nova-plugin/docs/commands/review/review.README.md',
    'nova-plugin/docs/commands/review/review.README.en.md',
    'nova-plugin/docs/guides/commands-reference-guide.md',
    'nova-plugin/docs/guides/commands-reference-guide.en.md',
    'nova-plugin/docs/guides/claude-code-commands-handbook.md',
    'nova-plugin/docs/guides/claude-code-commands-handbook.en.md',
  ];
  const stalePatterns = [
    /不在统一命令/,
    /not part of the unified command depth switch/i,
  ];

  for (const file of activeFiles) {
    const src = readFileSync(resolve(root, file), 'utf8');
    if (!/LEVEL=lite/.test(src)) {
      recordError(file, 'missing /review LEVEL=lite contract');
    }
    for (const pattern of stalePatterns) {
      if (pattern.test(src)) {
        recordError(file, `stale /review LEVEL=lite wording matches ${pattern}`);
      }
    }
  }

  const skill = readFileSync(resolve(root, 'nova-plugin/skills/nova-review/SKILL.md'), 'utf8');
  const routes = [
    ['lite', 'review {"LEVEL":"lite"}'],
    ['standard', 'review {"LEVEL":"standard"}'],
    ['strict', 'review {"LEVEL":"strict"}'],
    ['findings-only', 'review {"MODE":"findings-only"}'],
  ];
  for (const [variant, target] of routes) {
    if (!skill.includes(`\`${target}\``)) {
      recordError('nova-plugin/skills/nova-review/SKILL.md', `missing canonical review variant ${variant}`);
    }
  }
  if (!/automatic routing must not select the alias/iu.test(skill)) recordError('nova-plugin/skills/nova-review/SKILL.md', 'missing review-only automatic-routing exclusion');
}

function validateNamespacedCommandInvocations() {
  const migrationExceptions = new Set([
    'docs/project/migrations/2.4.1-command-namespace.md',
  ]);
  const commandIds = readdirSync(resolve(root, 'nova-plugin/commands'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => basename(name, '.md'))
    .sort((left, right) => right.length - left.length);
  const escaped = commandIds.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const bareInvocation = new RegExp(`(^|[^A-Za-z0-9_-])/(${escaped})(?![A-Za-z0-9-])`, 'gm');

  for (const file of walkFiles(root, (entry) => extname(entry) === '.md')) {
    const relativePath = rel(file);
    if (migrationExceptions.has(relativePath) || isArchivePath(file) || hasPathSegments(file, HISTORY_SEGMENTS)) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(bareInvocation)) {
      const slashOffset = match.index + match[1].length;
      recordError(
        relativePath,
        `bare plugin invocation /${match[2]} at line ${lineNumberAt(source, slashOffset)}; use /nova-plugin:${match[2]}`,
      );
    }
  }
}

function validateToolVocabularyProse() {
  const invalidPatterns = [
    { pattern: /Read\/Glob\/Grep\/Glob/, message: 'duplicate Glob in prose tool vocabulary' },
    { pattern: /Read Glob Grep Glob/, message: 'duplicate Glob in space-separated tool vocabulary' },
    { pattern: /`Write`, `Edit`, `Edit`/, message: 'duplicate Edit in prose tool vocabulary' },
    {
      pattern: /移除活动 runtime surface 中的 `Glob`、`Edit`/,
      message: 'release notes must identify retired LS and MultiEdit, not active Glob and Edit',
    },
  ];
  for (const file of walkFiles(root, (entry) => extname(entry) === '.md')) {
    if (isArchivePath(file) || hasPathSegments(file, HISTORY_SEGMENTS)) continue;
    const source = readFileSync(file, 'utf8');
    for (const invalid of invalidPatterns) {
      const match = invalid.pattern.exec(source);
      if (match) recordError(rel(file), `${invalid.message} at line ${lineNumberAt(source, match.index)}`);
    }
  }
}

function validateEvaluationFactContracts() {
  const facts = deriveEvaluationFacts(root);
  const qualityPath = 'docs/reference/evaluation/benchmark.md';
  const quality = readFileSync(resolve(root, qualityPath), 'utf8');
  const liveStatement = `current \`${facts.livePaired.datasetId}\` runner derives ${facts.livePaired.caseCount} cases and ${facts.livePaired.plannedInvocations} planned invocations`;
  const realTaskStatement = `\`${facts.realTask.datasetId}\` derives ${facts.realTask.taskCount} tasks and ${facts.realTask.plannedInvocations} planned invocations`;
  if (!quality.includes(liveStatement)) recordError(qualityPath, 'current live evaluation facts are not derived from the dataset identity');
  if (!quality.includes(realTaskStatement)) recordError(qualityPath, 'real-task facts are not derived independently from the benchmark identity');

  const evalReadmePath = 'evals/README.md';
  const evalReadme = readFileSync(resolve(root, evalReadmePath), 'utf8');
  if (/live\/cases\.json` contains 24 (?:hidden-label )?public-safe cases/iu.test(evalReadme)) {
    recordError(evalReadmePath, 'current live dataset is described with the historical 24-case value');
  }
}

validateLinksAndCommandDocs({
  root,
  CODEX_COMMAND_IDS,
  HISTORY_SEGMENTS,
  hasPathSegments,
  isArchivePath,
  lineNumberAt,
  markdownAnchorsByFile,
  recordError,
  rel,
  stripFencedCode,
  walkFiles,
});
validateVersionReferences();
validateInventoryFacts();
validateProjectPositioningContracts();
validateAuthoringSourceContracts();
validateReleasePromotionContracts();
validateMaintainerDiagnosticContracts();
validatePublicApiCompatibilityContracts();
validateMarketplaceContracts();
validateContributionContracts();
validateIssueTemplateContracts();
validateDocsIndexContracts();
validateValidatorCoverageNarrative();
validateConsumerProfileContracts();
validatePromptTemplateContracts();
validateDataHandlingContracts();
validateWorkflowEvidenceContracts();
validateShowcaseContracts();
validateGrowthMetricsContracts();
validateAssetsContracts();
validateDeferredPortalIaContracts();
validateMultiPluginReadinessEvidenceContracts();
validateReviewLevelLiteContract();
validateNamespacedCommandInvocations();
validateToolVocabularyProse();
validateEvaluationFactContracts();
validateActivePlanningAndReports({
  root,
  HISTORY_SEGMENTS,
  STALE_ACTIVE_PLANNING_PATTERNS,
  hasPathSegments,
  isArchivePath,
  lineNumberAt,
  readJson,
  recordError,
  rel,
  stripFencedCode,
  walkFiles,
});

if (warnings.length) {
  console.warn('Documentation validation warnings:');
  for (const warning of warnings) console.warn(warning);
}

if (errors.length) {
  console.error(`Documentation validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log('OK docs validation passed');
