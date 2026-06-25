#!/usr/bin/env node
/**
 * Validate active Markdown documentation for local link/anchor health, command
 * doc coverage and placement, release metadata drift, documentation inventory
 * counts, project positioning contracts, maintenance status contracts,
 * exact-tag release promotion boundaries, maintainer diagnostic and security
 * setting semantics, public API compatibility contracts, marketplace trust,
 * author workflow, compatibility, and security review contracts, contribution
 * and issue intake contracts, docs index navigation contracts, consumer
 * profile privacy contracts, prompt template privacy contracts, workflow
 * evidence contracts, showcase
 * public-safety contracts, growth metrics privacy contracts, assets capture
 * privacy contracts, deferred portal IA contracts, v3 readiness evidence
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
  statSync,
} from 'node:fs';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');

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
      const value = args[index + 1];
      if (!value) {
        console.error('ERROR --root requires a path');
        console.error(usage());
        process.exit(1);
      }
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

const root = parseRoot(process.argv.slice(2));

const errors = [];
const warnings = [];

const SKIP_DIRS = new Set([
  '.git',
  '.codex',
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

const LINE_ANCHOR_PATTERN = /^L\d+(?:-L\d+)?$/i;
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

function linkTargetIsExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

function parseLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target) return null;
  if (target.startsWith('<')) {
    const end = target.indexOf('>');
    if (end === -1) return null;
    target = target.slice(1, end);
  } else {
    target = target.split(/\s+/)[0];
  }
  if (!target) return null;
  if (linkTargetIsExternal(target)) return null;
  if (target.includes('$') || target.includes('*')) return null;
  return target;
}

function stripTargetSuffix(target) {
  const hashIndex = target.indexOf('#');
  const queryIndex = target.indexOf('?');
  const cutIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  const cutAt = cutIndexes.length ? Math.min(...cutIndexes) : target.length;
  return target.slice(0, cutAt);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractLinkFragment(target) {
  const hashIndex = target.indexOf('#');
  if (hashIndex === -1) return null;
  const raw = target.slice(hashIndex + 1).split('?')[0];
  if (!raw) return null;
  return safeDecode(raw);
}

function resolveLocalLink(fromFile, target) {
  const clean = stripTargetSuffix(target);
  if (!clean && target.startsWith('#')) return fromFile;
  if (!clean) return null;
  let decoded = clean;
  try {
    decoded = decodeURI(clean);
  } catch {
    decoded = clean;
  }
  if (decoded.startsWith('/')) {
    return resolve(root, `.${decoded}`);
  }
  return resolve(dirname(fromFile), decoded);
}

function collectMarkdownLinks(src) {
  const links = [];
  const stripped = stripFencedCode(src);
  const inlinePattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
  const referencePattern = /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]+(\S.*)$/gm;
  const htmlPattern = /\bhref=["']([^"']+)["']/g;

  for (const match of stripped.matchAll(inlinePattern)) {
    const target = parseLinkTarget(match[1]);
    if (target) links.push({ target, index: match.index ?? 0 });
  }
  for (const match of stripped.matchAll(referencePattern)) {
    const target = parseLinkTarget(match[1]);
    if (target) links.push({ target, index: match.index ?? 0 });
  }
  for (const match of stripped.matchAll(htmlPattern)) {
    const target = parseLinkTarget(match[1]);
    if (target) links.push({ target, index: match.index ?? 0 });
  }
  return links;
}

function lineNumberAt(src, index) {
  return src.slice(0, index).split(/\r?\n/).length;
}

function stripInlineMarkdown(src) {
  return src
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function slugifyAnchor(src) {
  const slug = src
    .toLowerCase()
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || null;
}

function addSlugWithDedup(anchors, counts, slug) {
  if (!slug) return;
  const count = counts.get(slug) ?? 0;
  anchors.add(count === 0 ? slug : `${slug}-${count}`);
  counts.set(slug, count + 1);
}

function headingSlugCandidates(headingText) {
  const text = stripInlineMarkdown(headingText.replace(/\s+#+\s*$/, ''));
  const withoutEmoji = text.replace(/\p{Extended_Pictographic}/gu, '');
  const candidates = [text.trim(), withoutEmoji.trim()]
    .map((candidate) => slugifyAnchor(candidate))
    .filter(Boolean);
  return [...new Set(candidates)];
}

function collectMarkdownAnchors(file) {
  if (markdownAnchorsByFile.has(file)) return markdownAnchorsByFile.get(file);

  const src = readFileSync(file, 'utf8');
  const anchors = new Set();
  const headingCounts = new Map();
  const stripped = stripFencedCode(src);

  const htmlIdPattern = /<[a-z][^>]*\s(?:id|name)=["']([^"']+)["'][^>]*>/gi;
  for (const match of stripped.matchAll(htmlIdPattern)) {
    anchors.add(safeDecode(match[1]));
  }

  const headingPattern = /^(#{1,6})[ \t]+(.+)$/gm;
  for (const match of stripped.matchAll(headingPattern)) {
    for (const slug of headingSlugCandidates(match[2])) {
      addSlugWithDedup(anchors, headingCounts, slug);
    }
  }

  markdownAnchorsByFile.set(file, anchors);
  return anchors;
}

function validateLocalLinkAnchor(fromFile, src, link, resolved) {
  const fragment = extractLinkFragment(link.target);
  if (!fragment || LINE_ANCHOR_PATTERN.test(fragment)) return;
  if (statSync(resolved).isDirectory()) return;
  if (extname(resolved).toLowerCase() !== '.md') return;

  const anchors = collectMarkdownAnchors(resolved);
  if (!anchors.has(fragment)) {
    recordError(
      rel(fromFile),
      `line ${lineNumberAt(src, link.index)} has broken local anchor "${link.target}"`,
    );
  }
}

function validateMarkdownLinks() {
  const markdownFiles = walkFiles(root, (abs) => extname(abs).toLowerCase() === '.md');
  for (const file of markdownFiles) {
    const src = readFileSync(file, 'utf8');
    for (const link of collectMarkdownLinks(src)) {
      const resolved = resolveLocalLink(file, link.target);
      if (!resolved) continue;
      if (!existsSync(resolved)) {
        recordError(
          rel(file),
          `line ${lineNumberAt(src, link.index)} has broken local link "${link.target}"`,
        );
        continue;
      }
      validateLocalLinkAnchor(file, src, link, resolved);
    }
  }
}

function readCommandStage(commandFile) {
  const src = readFileSync(commandFile, 'utf8');
  const frontmatter = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const stage = frontmatter?.[1].match(/^stage:\s*([a-z-]+)\s*$/m)?.[1];
  return stage ?? null;
}

function validateCommandDocs() {
  const commandsDir = resolve(root, 'nova-plugin/commands');
  const docsDir = resolve(root, 'nova-plugin/docs/commands');
  const commandIds = readdirSync(commandsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'))
    .sort();

  for (const id of commandIds) {
    const commandFile = resolve(commandsDir, `${id}.md`);
    const stage = readCommandStage(commandFile);
    if (!stage) {
      recordError(rel(commandFile), 'missing command stage frontmatter');
      continue;
    }
    const docDir = CODEX_COMMAND_IDS.has(id) ? 'codex' : stage;
    for (const suffix of ['.md', '.README.md', '.README.en.md']) {
      const expectedName = `${id}${suffix}`;
      const expectedPath = resolve(docsDir, docDir, expectedName);
      if (!existsSync(expectedPath)) {
        recordError(
          'nova-plugin/docs/commands',
          `missing command doc ${docDir}/${expectedName}`,
        );
      }
    }
  }
}

function expectRegex(file, pattern, expected, label) {
  const abs = resolve(root, file);
  const src = readFileSync(abs, 'utf8');
  const match = src.match(pattern);
  if (!match) {
    recordError(file, `missing ${label}`);
    return;
  }
  if (match[1] !== expected) {
    recordError(file, `${label} is "${match[1]}", expected "${expected}"`);
  }
}

function validateVersionReferences() {
  const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
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

  if (marketplaceEntry.version !== plugin.version) {
    recordError(
      '.claude-plugin/marketplace.json',
      `plugins[].version is "${marketplaceEntry.version}", expected "${plugin.version}"`,
    );
  }
  if (metadataEntry.version !== plugin.version) {
    recordError(
      '.claude-plugin/marketplace.metadata.json',
      `plugins[].version is "${metadataEntry.version}", expected "${plugin.version}"`,
    );
  }

  const version = plugin.version;
  const updated = metadataEntry['last-updated'];

  expectRegex('README.md', /version-(\d+\.\d+\.\d+)-blue\.svg/, version, 'version badge');
  expectRegex('README.md', /<td>(\d+\.\d+\.\d+)<\/td>/, version, 'plugin version table value');
  expectRegex(
    'nova-plugin/docs/overview/README.en.md',
    /version-(\d+\.\d+\.\d+)-blue\.svg/,
    version,
    'version badge',
  );
  expectRegex(
    'nova-plugin/docs/overview/README.en.md',
    /<td>(\d+\.\d+\.\d+)<\/td>/,
    version,
    'plugin version table value',
  );
  expectRegex(
    'nova-plugin/docs/guides/commands-reference-guide.md',
    /\*\*版本\*\*:\s*(\d+\.\d+\.\d+)/,
    version,
    'command reference version',
  );
  expectRegex(
    'nova-plugin/docs/guides/commands-reference-guide.en.md',
    /\*\*Version\*\*:\s*(\d+\.\d+\.\d+)/,
    version,
    'command reference version',
  );

  if (updated) {
    expectRegex(
      'nova-plugin/docs/guides/commands-reference-guide.md',
      /\*\*最后更新\*\*:\s*(\d{4}-\d{2}-\d{2})/,
      updated,
      'command reference last-updated date',
    );
    expectRegex(
      'nova-plugin/docs/guides/commands-reference-guide.en.md',
      /\*\*Last updated\*\*:\s*(\d{4}-\d{2}-\d{2})/,
      updated,
      'command reference last-updated date',
    );
  } else {
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
  const skillCount = countDirectories('nova-plugin/skills', (name) => name.startsWith('nova-'));
  const activeAgentCount = countFiles('nova-plugin/agents', (name) => name.endsWith('.md'));
  const packCount = countDirectories('nova-plugin/packs', () => true);

  const checks = [
    {
      file: 'README.md',
      pattern: /<td>(\d+) 个命令，(\d+) 个一对一 skills<\/td>/,
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
      pattern: /\|   \|-- skills\/\s+# (\d+) 个 nova-\* skills/,
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
      pattern: /<td>(\d+) commands, (\d+) one-to-one skills<\/td>/,
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
      pattern: /\|   \|-- skills\/\s+# (\d+) nova-\* skills/,
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
      pattern: /\| 插件能力面 \| (\d+) 个 slash commands 与 (\d+) 个一对一 `nova-\*` skills。 \|/,
      values: [commandCount, skillCount],
      label: 'ROADMAP current command/skill count',
    },
    {
      file: 'docs/marketplace/compatibility-matrix.md',
      pattern: /\| Nova commands and skills \| (\d+) commands and (\d+) one-to-one `nova-\*` skills \|/,
      values: [commandCount, skillCount],
      label: 'compatibility matrix command/skill count',
    },
    {
      file: 'nova-plugin/docs/architecture/dual-track-design.md',
      pattern: /避免参数、安全和输出规则在 (\d+) 个 skill 中漂移/,
      values: [skillCount],
      label: 'dual-track skill count',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /- Commands: (\d+) files under `nova-plugin\/commands\/\*\.md`/,
      values: [commandCount],
      label: 'maintenance status command count',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /- Skills: (\d+) files under `nova-plugin\/skills\/nova-\*\/SKILL\.md`/,
      values: [skillCount],
      label: 'maintenance status skill count',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /- Active agents: (\d+) core files under `nova-plugin\/agents\/\*\.md`/,
      values: [activeAgentCount],
      label: 'maintenance status active agent count',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
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
      pattern: /仍以一个主插件 `nova-plugin` 为核心/,
      label: 'ROADMAP nova-plugin core boundary',
    },
    {
      file: 'ROADMAP.md',
      pattern: /状态：Deferred。[\s\S]*仓库仍只有一个\s+主插件/,
      label: 'ROADMAP deferred v3 public portal boundary',
    },
    {
      file: 'docs/project-optimization-plan.md',
      pattern: /`nova-plugin` is the only production plugin/,
      label: 'optimization plan one production plugin boundary',
    },
    {
      file: 'docs/project-optimization-plan.md',
      pattern: /Keep\s+`v3\.0\.0`, public portal work, and production multi-plugin directory migration\s+deferred/,
      label: 'optimization plan deferred v3 public portal boundary',
    },
    {
      file: 'nova-plugin/docs/overview/README.en.md',
      pattern: /This repository should not be described as a mature multi-plugin ecosystem, and the deferred public portal is not an implemented capability/,
      label: 'English overview mature ecosystem and public portal boundary',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /public AI engineering workflow framework centered on\s+`nova-plugin`/,
      label: 'maintenance status nova-plugin centered boundary',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /Explore -> Plan -> Review -> Implement -> Finalize/,
      label: 'maintenance status five-stage workflow boundary',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /`nova-plugin` is the only production plugin/,
      label: 'maintenance status one production plugin boundary',
    },
    {
      file: 'docs/llm-plugins-fusion-maintenance-status.md',
      pattern: /must not be\s+described as a mature multi-plugin ecosystem, public portal, paid marketplace,\s+runtime dynamic plugin platform, or enterprise private knowledge base/,
      label: 'maintenance status deferred scope boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateReleasePromotionContracts() {
  const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
  const tag = `v${plugin.version}`;
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
      pattern: /稳定推广仍\s+必须以 exact release tag 为准[\s\S]*moving `main` 不等同于\s+已发布版本/,
      label: 'SECURITY exact release tag promotion boundary',
    },
    {
      file: 'ROADMAP.md',
      pattern: new RegExp('当前稳定推广版本为 exact release tag `'
        + tagPattern
        + '`[\\s\\S]*移动 `main`[\\s\\S]*不能替代正式 tag'),
      label: 'ROADMAP exact release tag promotion boundary',
    },
    {
      file: 'docs/project-optimization-plan.md',
      pattern: new RegExp('Stable promotion still requires\\s+an exact `'
        + tagPattern
        + '` tag; moving `main` must not be promoted as stable release\\s+content'),
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
      file: 'docs/releases/release-hygiene.md',
      pattern: /Stable promotion targets must be exact release tags[\s\S]*moving `main` branch[\s\S]*development snapshot rather than stable release material/,
      label: 'release hygiene exact release tag promotion boundary',
    },
    {
      file: 'docs/releases/release-evidence-template.md',
      pattern: new RegExp('Promote exact release tags such as `'
        + tagPattern
        + '`; do not promote moving `main` as stable'),
      label: 'release evidence exact release tag promotion boundary',
    },
    {
      file: 'docs/releases/release-evidence-template.md',
      pattern: /If local validation reports skipped checks,[\s\S]*name each skipped check and the replacement CI\/Linux evidence/,
      label: 'release evidence skipped checks replacement boundary',
    },
    {
      file: 'docs/releases/release-evidence-template.md',
      pattern: /Treat `node scripts\/validate-plugin-install\.mjs` as a separate CI or isolated\s+test-user check because it may install or update user-scope Claude plugin\s+state/,
      label: 'release evidence plugin install isolation boundary',
    },
    {
      file: 'docs/releases/release-evidence-template.md',
      pattern: /node scripts\/validate-all\.mjs:[\s\S]*node scripts\/validate-github-workflows\.mjs:[\s\S]*node scripts\/validate-runtime-smoke\.mjs:/,
      label: 'release evidence GitHub workflow validation result slot',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /If the target has no exact tag[\s\S]*do not promote[\s\S]*unreleased development snapshot/,
      label: 'release runbook missing exact tag decision boundary',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /GitHub workflow contracts \| Automated \| `node scripts\/validate-github-workflows\.mjs` passes; this proves workflow permissions,[\s\S]*workflow inventory,[\s\S]*required-check list synchronization/,
      label: 'release runbook GitHub workflow contract gate',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /If any required manual gate is missing,[\s\S]*describe the target as an unreleased\s+development snapshot,[\s\S]*not a stable release/,
      label: 'release runbook missing manual gate snapshot boundary',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /scripts\/validate-runtime-smoke\.mjs[\s\S]*scripts\/validate-github-workflows\.mjs[\s\S]*scripts\/validate-surface-budget\.mjs/,
      label: 'release runbook focused GitHub workflow validation command',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /`node scripts\/validate-workflow-fixtures\.mjs` passes; this proves fixture integrity,[\s\S]*not slash-command output quality/,
      label: 'release runbook fixture quality boundary',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /`node scripts\/validate-plugin-install\.mjs --accept-user-scope-mutation` mutates\s+Claude Code user-scope plugin state[\s\S]*Run it only in CI or in an isolated\s+test-user environment/,
      label: 'release runbook plugin install mutation boundary',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /Plugin install smoke is missing \| Do not promote; record pending isolated\/CI evidence[\s\S]*Manual workflow evidence is missing[\s\S]*Do not promote until recorded/,
      label: 'release runbook promotion missing evidence boundary',
    },
    {
      file: 'docs/releases/release-validation-runbook.md',
      pattern: /Never fill missing evidence with assumptions[\s\S]*Record `not run`, `skipped`, or\s+`pending` with a concrete reason/,
      label: 'release runbook no assumed evidence boundary',
    },
    {
      file: 'docs/releases/release-hygiene.md',
      pattern: /Run `node scripts\/validate-plugin-install\.mjs` only in CI or an isolated\s+test-user environment[\s\S]*unattended local release evidence should record it as pending/,
      label: 'release hygiene unattended install smoke pending boundary',
    },
    {
      file: 'docs/releases/release-hygiene.md',
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
      file: 'docs/maintainers/quickstart.md',
      pattern: /## Diagnostic Result Semantics[\s\S]*`npm run doctor` is read-only[\s\S]*Treat them as evidence to record, not as automatic\s+failures/,
      label: 'maintainer quickstart diagnostic semantics introduction',
    },
    {
      file: 'docs/maintainers/quickstart.md',
      pattern: /`Claude CLI: WARN`[\s\S]*live Claude plugin validation and user-scope install smoke are not proven locally[\s\S]*`node scripts\/validate-plugin-install\.mjs --dry-run`[\s\S]*isolated test user/,
      label: 'maintainer quickstart Claude CLI warning boundary',
    },
    {
      file: 'docs/maintainers/quickstart.md',
      pattern: /`Codex CLI: WARN`[\s\S]*Do not claim Codex review\/fix\/verify runtime behavior was proven/,
      label: 'maintainer quickstart Codex CLI warning boundary',
    },
    {
      file: 'docs/maintainers/quickstart.md',
      pattern: /`Bash: WARN` or `skipped>0`[\s\S]*Record the skipped checks[\s\S]*CI\/Linux Bash evidence/,
      label: 'maintainer quickstart Bash skipped-check boundary',
    },
    {
      file: 'docs/maintainers/quickstart.md',
      pattern: /`Exact release tag: WARN`[\s\S]*development snapshot[\s\S]*exact `v<plugin-version>` tag/,
      label: 'maintainer quickstart exact-tag warning boundary',
    },
    {
      file: 'docs/maintainers/quickstart.md',
      pattern: /`npm run validate:maintainer` fails only on hard gate failures[\s\S]*carry those\s+warnings into the handoff/,
      label: 'maintainer quickstart passing gate warning handoff boundary',
    },
    {
      file: 'docs/maintainers/quickstart.md',
      pattern: /CI or release workflow[\s\S]*`npm run validate:github-workflows`[\s\S]*review changed workflow trigger, permissions, workflow inventory, and required-check list/,
      label: 'maintainer quickstart GitHub workflow shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /## Boundary Rules[\s\S]*Do not loosen global permissions,[\s\S]*agent sandbox settings,[\s\S]*workflow token\s+scope to hide a missing local tool or unavailable platform check/,
      label: 'maintainer troubleshooting no permission bypass boundary',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /Do not paste private machine paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*tokens,[\s\S]*consumer names,[\s\S]*business rules,[\s\S]*private alert details\s+into public troubleshooting notes/,
      label: 'maintainer troubleshooting private details boundary',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /Record unavailable checks as `skipped`, `not run`, or `pending`[\s\S]*replacement CI\/Linux or owner-verified evidence/,
      label: 'maintainer troubleshooting unavailable checks boundary',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /## Fast Failure Map[\s\S]*Use the smallest focused check that matches the failure before running the full\s+maintainer gate again/,
      label: 'maintainer troubleshooting fast failure map purpose',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| Markdown link, anchor, inventory, positioning, or release wording failure \| `npm run validate:docs` \| Fix active public docs only; do not patch generated marketplace outputs by hand\. \|/,
      label: 'maintainer troubleshooting docs failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| Command or skill frontmatter failure \| `node scripts\/lint-frontmatter\.mjs` \| Preserve command\/skill one-to-one mapping and existing tool permission intent\. \|/,
      label: 'maintainer troubleshooting frontmatter failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| GitHub workflow permission, inventory, or required-check drift \| `npm run validate:github-workflows` \| Do not broaden default token scope or move mutating plugin install smoke into default PR\/push checks\. \|/,
      label: 'maintainer troubleshooting GitHub workflow failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| `generated registry drift check` or generated marketplace drift \| `node scripts\/generate-registry\.mjs --write` \| Edit registry or plugin metadata sources first, then regenerate outputs\. \|/,
      label: 'maintainer troubleshooting generated registry failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| Distribution risk scan secret, private path, or `\.codex\/` artifact finding \| `npm run scan:distribution` \| Remove or redact the active public content; use allowlists only for intentional historical warnings\. \|/,
      label: 'maintainer troubleshooting distribution risk failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| `validate surface budget` warning or failure \| `npm run validate:surface` \| Split bloated shipped surfaces or update the allowlist only with a rationale and split plan\. \|/,
      label: 'maintainer troubleshooting surface budget shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| Bash hook syntax failure \| `bash -n nova-plugin\/hooks\/scripts\/pre-write-check\.sh` and `bash -n nova-plugin\/hooks\/scripts\/post-audit-log\.sh` \| Run only where Bash is available; treat Windows no-Bash skips as skipped, not passed\. \|/,
      label: 'maintainer troubleshooting hook syntax failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /\| Codex runtime helper smoke failure \| `node scripts\/validate-runtime-smoke\.mjs` \| Use CI\/Linux for replacement evidence when local Bash is unavailable\. \|/,
      label: 'maintainer troubleshooting runtime smoke failure shortcut',
    },
    {
      file: 'docs/maintainers/troubleshooting.md',
      pattern: /## GitHub Workflow Permissions[\s\S]*npm run validate:github-workflows[\s\S]*read-only default token scope,[\s\S]*forbids `pull_request_target`[\s\S]*release write permission scoped to the release job,[\s\S]*workflow\s+file inventory synchronized with `CLAUDE\.md`[\s\S]*required-check docs and the\s+read-only print script synchronized with CI labels[\s\S]*Do not broaden workflow token\s+scope/,
      label: 'maintainer troubleshooting GitHub workflow validator',
    },
    {
      file: 'docs/maintainers/github-security-settings.md',
      pattern: /owner-verified checklist,[\s\S]*not a public portal,[\s\S]*automated\s+settings auditor,[\s\S]*substitute for GitHub UI evidence/,
      label: 'GitHub security settings manual evidence boundary',
    },
    {
      file: 'docs/maintainers/github-security-settings.md',
      pattern: /Keep raw CodeQL alerts,[\s\S]*secret scanning hits,[\s\S]*dependency advisory details,[\s\S]*repository rule screenshots,[\s\S]*tokens,[\s\S]*owner-only security settings out of\s+public docs and issue threads/,
      label: 'GitHub security settings private alert boundary',
    },
    {
      file: 'docs/maintainers/github-security-settings.md',
      pattern: /Do not raise default Actions token permissions[\s\S]*make mutating install smoke\s+a default required check[\s\S]*least-privilege\s+workflow permissions and isolated release evidence/,
      label: 'GitHub security settings least privilege boundary',
    },
    {
      file: 'docs/maintainers/github-security-settings.md',
      pattern: /## Suggested Required Checks[\s\S]*Validate Hooks[\s\S]*Validate GitHub Workflows[\s\S]*Validate Runtime Smoke[\s\S]*Dependency Review[\s\S]*CodeQL \/ Analyze JavaScript/,
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
      file: 'docs/compatibility/public-api.md',
      pattern: /`nova-plugin` is the only production plugin[\s\S]*registry fixtures and generated\s+multi-entry examples are not stable production plugin directories/,
      label: 'public API single production plugin boundary',
    },
    {
      file: 'docs/compatibility/public-api.md',
      pattern: /Marketplace metadata and the generated catalog are install and distribution\s+artifacts,[\s\S]*not a hosted public portal,[\s\S]*paid marketplace,[\s\S]*frontend\s+application/,
      label: 'public API no portal marketplace app boundary',
    },
    {
      file: 'docs/compatibility/public-api.md',
      pattern: /Capability packs are documentation contracts;[\s\S]*do not create runtime\s+dynamic pack or plugin loading/,
      label: 'public API no runtime dynamic loading boundary',
    },
    {
      file: 'docs/compatibility/public-api.md',
      pattern: /Consumer-specific profile content,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository\s+addresses,[\s\S]*local paths,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content are not part of the public API/,
      label: 'public API private consumer boundary',
    },
    {
      file: 'docs/compatibility/public-api.md',
      pattern: /The mutation install smoke path is intentionally not a default local API[\s\S]*Run it only in CI or an isolated test-user environment/,
      label: 'public API install smoke mutation boundary',
    },
    {
      file: 'docs/compatibility/public-api.md',
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
      file: 'docs/marketplace/trust-policy.md',
      pattern: /repository-local marketplace metadata for the current\s+`nova-plugin` entry[\s\S]*not a hosted public portal,[\s\S]*paid marketplace,[\s\S]*production multi-plugin directory,[\s\S]*external trust registry[\s\S]*must not be copied into the\s+Claude-compatible `\.claude-plugin\/marketplace\.json`/,
      label: 'marketplace trust repo-local metadata boundary',
    },
    {
      file: 'docs/marketplace/trust-policy.md',
      pattern: /does not rely on blanket high-permission execution as a public\s+recommendation[\s\S]*without recommending global permission bypasses/,
      label: 'marketplace trust permission posture boundary',
    },
    {
      file: 'docs/marketplace/trust-policy.md',
      pattern: /Release workflow or `\.github\/workflows\/\*\*` changes should run\s+`node scripts\/validate-github-workflows\.mjs`[\s\S]*least-privilege\s+workflow token scope,[\s\S]*workflow file inventory,[\s\S]*required-check docs and\s+read-only print output synchronization,[\s\S]*isolated mutating install smoke\s+boundaries[\s\S]*Do not broaden workflow token\s+scope/,
      label: 'marketplace trust GitHub workflow contract boundary',
    },
    {
      file: 'docs/marketplace/trust-policy.md',
      pattern: /Reviewers must verify that Claude-incompatible fields remain only in\s+repository-local metadata[\s\S]*Public docs and prompts must keep high-risk permission guidance scoped,[\s\S]*contextual,[\s\S]*preferably negative/,
      label: 'marketplace trust incompatible fields boundary',
    },
    {
      file: 'docs/marketplace/security-review-route.md',
      pattern: /## Public Review Boundary[\s\S]*do not paste private vulnerability\s+reports,[\s\S]*exploit details,[\s\S]*credentials,[\s\S]*tokens,[\s\S]*private endpoints,[\s\S]*repository\s+addresses,[\s\S]*local paths,[\s\S]*customer data,[\s\S]*private knowledge-base content/,
      label: 'security review public-safe disclosure boundary',
    },
    {
      file: 'docs/marketplace/security-review-route.md',
      pattern: /Use \[SECURITY\.md\]\(\.\.\/\.\.\/SECURITY\.md\) for private vulnerability reports[\s\S]*sanitized risk category,[\s\S]*affected surface,[\s\S]*validation,[\s\S]*skipped checks,[\s\S]*residual risk/,
      label: 'security review private report route boundary',
    },
    {
      file: 'docs/marketplace/security-review-route.md',
      pattern: /Broad permission-bypass guidance must remain scoped,[\s\S]*negative,[\s\S]*maintainer-approved[\s\S]*not turn it into a default operating mode/,
      label: 'security review permission bypass boundary',
    },
    {
      file: 'docs/marketplace/security-review-route.md',
      pattern: /Escalate private vulnerability reports through \[SECURITY\.md\]\(\.\.\/\.\.\/SECURITY\.md\)[\s\S]*instead of a public issue or PR comment/,
      label: 'security review disclosure escalation boundary',
    },
    {
      file: 'docs/marketplace/security-review-route.md',
      pattern: /Distribution risk scan result for active private paths,[\s\S]*credentials,[\s\S]*private\s+network addresses,[\s\S]*internal endpoints,[\s\S]*high-risk blanket permission advice,[\s\S]*tracked `\.codex\/` runtime artifacts/,
      label: 'security review distribution risk output boundary',
    },
    {
      file: 'docs/marketplace/security-review-route.md',
      pattern: /Broad workflow changes \| `node scripts\/validate-github-workflows\.mjs`[\s\S]*Changes under `\.github\/workflows\/\*\*` must include\s+`node scripts\/validate-github-workflows\.mjs`;[\s\S]*least-privilege token scope,[\s\S]*workflow file inventory,[\s\S]*required-check\s+docs\/read-only print output synchronization,[\s\S]*isolated mutating install\s+smoke boundaries/,
      label: 'security review GitHub workflow validation route',
    },
    {
      file: 'docs/marketplace/registry-author-workflow.md',
      pattern: /## Current Scope Boundary[\s\S]*current `nova-plugin` entry[\s\S]*not a public portal,[\s\S]*paid marketplace,[\s\S]*production multi-plugin directory,[\s\S]*reason to move `nova-plugin\/`[\s\S]*Multi-entry fixtures prove generator behavior only[\s\S]*roadmap evidence,[\s\S]*release evidence,[\s\S]*maintainer approval/,
      label: 'registry author workflow current scope boundary',
    },
    {
      file: 'docs/marketplace/registry-author-workflow.md',
      pattern: /Public registry metadata and review notes must stay generic and redacted[\s\S]*Do\s+not include private consumer names,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository\s+addresses,[\s\S]*local paths,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content/,
      label: 'registry author workflow public-safe metadata boundary',
    },
    {
      file: 'docs/marketplace/registry-author-workflow.md',
      pattern: /Marketplace PRs that change CI\/release workflows or required-check guidance\s+must also run `node scripts\/validate-github-workflows\.mjs`[\s\S]*workflow token scope,[\s\S]*workflow file inventory,[\s\S]*required-check docs\/read-only\s+print output synchronization,[\s\S]*isolated mutating install smoke boundaries[\s\S]*Do not loosen workflow token\s+scope/,
      label: 'registry author workflow GitHub workflow validation route',
    },
    {
      file: 'docs/marketplace/compatibility-matrix.md',
      pattern: /## Evidence Scope Boundary[\s\S]*current `nova-plugin` entry[\s\S]*registry fixture behavior[\s\S]*not a hosted public portal,[\s\S]*paid\s+marketplace,[\s\S]*runtime dynamic loading contract,[\s\S]*production\s+multi-plugin migration is active/,
      label: 'compatibility matrix evidence scope boundary',
    },
    {
      file: 'docs/marketplace/compatibility-matrix.md',
      pattern: /Optional enhanced tools remain optional[\s\S]*record the\s+check as unavailable,[\s\S]*skipped,[\s\S]*pending with replacement evidence[\s\S]*instead of\s+broadening permissions[\s\S]*missing tool as passed/,
      label: 'compatibility matrix optional tools boundary',
    },
    {
      file: 'docs/marketplace/compatibility-matrix.md',
      pattern: /GitHub workflow contracts \| Node\.js 20\+ \| `node scripts\/validate-github-workflows\.mjs`[\s\S]*least-privilege workflow token scope,[\s\S]*`\.github\/workflows\/` inventory,[\s\S]*required-check docs\/read-only print output synchronization,[\s\S]*isolated mutating install smoke boundaries[\s\S]*GitHub workflow evidence should include `node scripts\/validate-github-workflows\.mjs`[\s\S]*CI\/release workflows,[\s\S]*workflow inventory,[\s\S]*required-check guidance/,
      label: 'compatibility matrix GitHub workflow evidence boundary',
    },
    {
      file: 'docs/marketplace/compatibility-matrix.md',
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
      pattern: /`package\.json` 包含 dependency-free 的\s+`lint` 和 `test` 入口[\s\S]*仍不声明 `check` \/ `build` 脚本名/,
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
      pattern: /## Public Navigation Boundary[\s\S]*`docs\/showcase\/` and `docs\/examples\/` are public-safe navigation aids,[\s\S]*not a\s+public portal or real consumer case-study library/,
      label: 'docs index public navigation boundary',
    },
    {
      file: 'docs/README.md',
      pattern: /Showcase pages explain\s+reusable scenario workflows; examples provide redacted fixtures, rubrics, and\s+templates/,
      label: 'docs index showcase examples distinction',
    },
    {
      file: 'docs/README.md',
      pattern: /Keep consumer-specific profiles,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*local\s+paths,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+repository addresses,[\s\S]*private\s+knowledge-base content[\s\S]*consumer-owned workspace/,
      label: 'docs index private consumer workspace boundary',
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
      pattern: /`node scripts\/validate-docs\.mjs` validates[\s\S]*project\s+positioning\s+contracts,[\s\S]*exact-tag\s+release\s+promotion\s+boundaries,[\s\S]*maintainer\s+diagnostic\s+and\s+security\s+setting\s+semantics,[\s\S]*public\s+API\s+compatibility\s+contracts,[\s\S]*marketplace\s+trust,[\s\S]*author\s+workflow,[\s\S]*compatibility,[\s\S]*security\s+review\s+contracts,[\s\S]*contribution\s+and\s+issue\s+intake\s+contracts,[\s\S]*docs\s+index\s+navigation\s+contracts,[\s\S]*consumer\s+profile\s+privacy\s+contracts,[\s\S]*prompt\s+template\s+privacy\s+contracts,[\s\S]*workflow\s+evidence\s+contracts,[\s\S]*showcase\s+public-safety\s+contracts,[\s\S]*growth\s+metrics\s+privacy\s+contracts,[\s\S]*assets\s+capture\s+privacy\s+contracts,[\s\S]*deferred\s+portal\s+IA\s+contracts,[\s\S]*v3\s+readiness\s+evidence\s+contracts/,
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
      file: 'docs/project-optimization-plan.md',
      pattern: /`validate-docs` checks[\s\S]*project\s+positioning\s+contracts,[\s\S]*exact-tag\s+release\s+promotion\s+boundaries,[\s\S]*maintainer\s+diagnostic\s+and\s+security\s+setting\s+semantics,[\s\S]*public\s+API\s+compatibility\s+contracts,[\s\S]*marketplace\s+trust,[\s\S]*author\s+workflow,[\s\S]*compatibility,[\s\S]*security\s+review\s+contracts,[\s\S]*contribution\s+and\s+issue\s+intake\s+contracts,[\s\S]*docs\s+index\s+navigation\s+contracts,[\s\S]*consumer\s+profile\s+privacy\s+contracts,[\s\S]*prompt\s+template\s+privacy\s+contracts,[\s\S]*workflow\s+evidence\s+contracts,[\s\S]*showcase\s+public-safety\s+contracts,[\s\S]*growth\s+metrics\s+privacy\s+contracts,[\s\S]*assets\s+capture\s+privacy\s+contracts,[\s\S]*deferred\s+portal\s+IA\s+contracts,[\s\S]*v3\s+readiness\s+evidence\s+contracts/,
      label: 'optimization plan validate-docs coverage narrative',
    },
    {
      file: 'docs/project-optimization-plan.md',
      pattern: /Existing validation covers[\s\S]*GitHub workflow permission, inventory, and required-check\s+contracts/,
      label: 'optimization plan GitHub workflow coverage narrative',
    },
    {
      file: 'docs/project-optimization-plan.md',
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
      file: 'docs/consumers/README.md',
      pattern: /public, redacted contract[\s\S]*only generic workflow guidance,[\s\S]*consumer profile shapes,[\s\S]*sanitized examples/,
      label: 'consumer README public redacted contract',
    },
    {
      file: 'docs/consumers/README.md',
      pattern: /Real consumer profiles must live in the consumer project itself[\s\S]*Do not copy closed-source project names,[\s\S]*paths,[\s\S]*private\s+identifiers,[\s\S]*network\s+endpoints,[\s\S]*runtime\s+flags,[\s\S]*private\s+repository addresses,[\s\S]*private\s+knowledge base content/,
      label: 'consumer README private profile boundary',
    },
    {
      file: 'docs/consumers/README.md',
      pattern: /Add `--write` only when the output directory\s+is a consumer-owned workspace outside this public repository checkout[\s\S]*script refuses `--write` targets inside `llm-plugins-fusion`/,
      label: 'consumer README scaffold write boundary',
    },
    {
      file: 'docs/consumers/profile-contract.md',
      pattern: /public repository defines the contract only; the real\s+profile belongs in the consumer's project-local `AGENTS\.md`, `CLAUDE\.md`,\s+`\.claude\/`, or private documentation/,
      label: 'consumer profile contract source boundary',
    },
    {
      file: 'docs/consumers/profile-contract.md',
      pattern: /Do not expose private names,[\s\S]*paths,[\s\S]*identifiers,[\s\S]*repository addresses,[\s\S]*network endpoints,[\s\S]*runtime flags,[\s\S]*credentials,[\s\S]*configuration values[\s\S]*Do not write public repository docs from private consumer facts/,
      label: 'consumer profile contract private facts boundary',
    },
    {
      file: 'docs/consumers/private-java-backend-template.md',
      pattern: /redacted template for a private Java\/Spring backend consumer[\s\S]*Copy the shape into the consumer's\s+private `AGENTS\.md`, `CLAUDE\.md`, `\.claude\/`, or private documentation[\s\S]*Do not replace placeholders with real private values in this public repository/,
      label: 'consumer Java template private profile boundary',
    },
    {
      file: 'docs/consumers/private-java-backend-template.md',
      pattern: /Keep public examples at the family level[\s\S]*Do not publish private component\s+identifiers,[\s\S]*repository addresses,[\s\S]*environment names,[\s\S]*network endpoints,[\s\S]*runtime\s+flags,[\s\S]*credentials,[\s\S]*configuration values[\s\S]*Do not copy private component identifiers,[\s\S]*package names,[\s\S]*local paths,[\s\S]*private docs into public artifacts/,
      label: 'consumer Java template private facts boundary',
    },
    {
      file: 'docs/consumers/private-java-backend-template.md',
      pattern: /Do not run destructive data,[\s\S]*migration,[\s\S]*deployment commands unless the\s+private project source of truth explicitly authorizes them[\s\S]*Do not change command or skill behavior from this template/,
      label: 'consumer Java template destructive boundary',
    },
    {
      file: 'docs/consumers/frontend-project-template.md',
      pattern: /redacted template for a private frontend application[\s\S]*Copy the shape\s+into the consumer's private `AGENTS\.md`, `CLAUDE\.md`, `\.claude\/`, or private\s+documentation[\s\S]*Do not replace placeholders with real private values in this public repository/,
      label: 'consumer frontend template private profile boundary',
    },
    {
      file: 'docs/consumers/frontend-project-template.md',
      pattern: /Keep public examples at the family level[\s\S]*Do not publish private route names,[\s\S]*feature names,[\s\S]*environment names,[\s\S]*network endpoints,[\s\S]*repository addresses,[\s\S]*credentials,[\s\S]*configuration values[\s\S]*Do not copy private route names,[\s\S]*feature names,[\s\S]*local paths,[\s\S]*private\s+design docs into public artifacts/,
      label: 'consumer frontend template private facts boundary',
    },
    {
      file: 'docs/consumers/frontend-project-template.md',
      pattern: /Do not introduce new frontend stacks,[\s\S]*dependencies,[\s\S]*public portal work\s+unless the private project source of truth explicitly asks for them[\s\S]*Do not change command or skill behavior from this template/,
      label: 'consumer frontend template public portal boundary',
    },
    {
      file: 'docs/consumers/codex-setup.md',
      pattern: /keep `\.codex\/` runtime artifacts out of this public\s+repository[\s\S]*treat `\.codex\/` as disposable local evidence unless the project-local source\s+of truth defines a stricter artifact policy/,
      label: 'consumer Codex setup runtime artifact boundary',
    },
    {
      file: 'docs/consumers/codex-setup.md',
      pattern: /If Codex CLI or Bash is unavailable,[\s\S]*do not\s+relax global permissions to hide the missing runtime/,
      label: 'consumer Codex setup no permission bypass boundary',
    },
    {
      file: 'docs/consumers/cursor-setup.md',
      pattern: /Keep Cursor rules and project-specific workflow details in the consumer\s+repository[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge\s+base content,[\s\S]*consumer-specific commands into public templates or examples/,
      label: 'consumer Cursor setup private config boundary',
    },
    {
      file: 'docs/consumers/cursor-setup.md',
      pattern: /If Cursor cannot run a selected validator,[\s\S]*do not loosen global permissions or agent sandbox settings\s+to bypass the missing tool/,
      label: 'consumer Cursor setup no permission bypass boundary',
    },
    {
      file: 'docs/consumers/gemini-cli-setup.md',
      pattern: /Keep Gemini skill or context files that contain consumer facts in the\s+private consumer project[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge\s+base content,[\s\S]*consumer-specific commands into public templates or examples/,
      label: 'consumer Gemini setup private config boundary',
    },
    {
      file: 'docs/consumers/gemini-cli-setup.md',
      pattern: /If Gemini CLI cannot run the selected validator,[\s\S]*do not broaden global tool permissions,[\s\S]*shell access,[\s\S]*sandbox settings to hide the missing runtime/,
      label: 'consumer Gemini setup no permission bypass boundary',
    },
    {
      file: 'docs/consumers/opencode-setup.md',
      pattern: /Store OpenCode-specific configuration in the consumer project[\s\S]*Keep consumer-specific rules,[\s\S]*private paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge\s+base content out of public templates and examples/,
      label: 'consumer OpenCode setup private config boundary',
    },
    {
      file: 'docs/consumers/opencode-setup.md',
      pattern: /If a selected safety check or validator is unavailable,[\s\S]*do not loosen global permissions to bypass the\s+missing tool/,
      label: 'consumer OpenCode setup no permission bypass boundary',
    },
    {
      file: 'docs/consumers/copilot-setup.md',
      pattern: /Keep `\.github\/copilot-instructions\.md` and persona mappings private unless\s+they are fully generic and redacted[\s\S]*Do not copy private paths,[\s\S]*repository addresses,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*runtime flags,[\s\S]*branch policies,[\s\S]*business rules,[\s\S]*private knowledge\s+base\s+content into public templates or examples/,
      label: 'consumer Copilot setup private config boundary',
    },
    {
      file: 'docs/consumers/copilot-setup.md',
      pattern: /If Copilot cannot run a check,[\s\S]*do not loosen repository or agent permissions to bypass the missing\s+tool/,
      label: 'consumer Copilot setup no permission bypass boundary',
    },
    {
      file: 'docs/consumers/workbench-template.md',
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
      file: 'docs/prompts/README.md',
      pattern: /public-safe prompt templates[\s\S]*They are templates, not consumer profiles[\s\S]*Replace\s+placeholders inside the private consumer project[\s\S]*keep private names,[\s\S]*local\s+paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*configuration values,[\s\S]*business-specific\s+rules out of this public repository/,
      label: 'prompt README public-safe private facts boundary',
    },
    {
      file: 'docs/prompts/README.md',
      pattern: /Do not paste full files,[\s\S]*full diffs,[\s\S]*long generated output into final\s+answers when an artifact path or summary is enough[\s\S]*Treat HTML outputs as derived reading artifacts[\s\S]*keep Markdown,[\s\S]*code,[\s\S]*review,[\s\S]*validation evidence as the source of truth/,
      label: 'prompt README evidence summary boundary',
    },
    {
      file: 'docs/prompts/common/checkpoint-artifact.md',
      pattern: /private consumer workbench[\s\S]*Keep private names,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*local paths,[\s\S]*runtime flags,[\s\S]*business rules in the\s+consumer project only[\s\S]*Do not include private credentials,[\s\S]*endpoints,[\s\S]*local machine paths,[\s\S]*private knowledge-base content unless this artifact stays in the private\s+consumer workspace/,
      label: 'checkpoint prompt private workspace boundary',
    },
    {
      file: 'docs/prompts/common/html-artifact.md',
      pattern: /HTML artifacts are derived reading artifacts,[\s\S]*not the source of truth[\s\S]*事实源仍是 Markdown、代码、diff、review artifact、validation output[\s\S]*不包含私有 endpoint、凭据、真实用户数据、私有仓库地址或个人绝对路径/,
      label: 'HTML prompt source-of-truth privacy boundary',
    },
    {
      file: 'docs/prompts/common/html-artifact.md',
      pattern: /默认不使用外部 CDN、远程 JavaScript、远程字体或远程图片[\s\S]*默认不发起网络请求[\s\S]*不提交表单[\s\S]*不写 localStorage 或 sessionStorage[\s\S]*长期保留的 HTML 必须配套 Markdown 摘要或来源说明/,
      label: 'HTML prompt offline derived artifact boundary',
    },
    {
      file: 'docs/prompts/common/workbench-tidy.md',
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
      file: 'docs/workflows/source-controlled-checks.md',
      pattern: /source-controlled AI\s+workflow checks without turning the public repository into a mature multi-plugin\s+platform or a custom CI product/,
      label: 'source-controlled checks no platform boundary',
    },
    {
      file: 'docs/workflows/source-controlled-checks.md',
      pattern: /the useful part is not a new\s+runtime[\s\S]*making workflow expectations reviewable,[\s\S]*repeatable,[\s\S]*public-safe/,
      label: 'source-controlled checks no runtime positioning',
    },
    {
      file: 'docs/workflows/source-controlled-checks.md',
      pattern: /A future `\.nova\/checks\/` or `nova-plugin\/checks\/` directory is appropriate only\s+after at least two checks repeat across releases or consumer projects/,
      label: 'source-controlled checks future checks threshold',
    },
    {
      file: 'docs/workflows/source-controlled-checks.md',
      pattern: /Checks must not include private consumer names,[\s\S]*local paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content/,
      label: 'source-controlled checks private facts boundary',
    },
    {
      file: 'docs/workflows/source-controlled-checks.md',
      pattern: /Do not add a new runtime or CI layer when a deterministic script plus rubric is\s+enough/,
      label: 'source-controlled checks no runtime CI layer',
    },
    {
      file: 'docs/workflows/verification-evidence-contract.md',
      pattern: /It must not include private consumer names,[\s\S]*local\s+machine paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge-base content/,
      label: 'verification evidence private facts boundary',
    },
    {
      file: 'docs/workflows/verification-evidence-contract.md',
      pattern: /Do not claim completion from tool success alone\. Map evidence back to the\s+behavior,[\s\S]*repository fact,[\s\S]*review finding,[\s\S]*change goal being verified/,
      label: 'verification evidence maps tool success to behavior',
    },
    {
      file: 'docs/workflows/verification-evidence-contract.md',
      pattern: /Check skipped \| Environment or tool reason plus residual risk[\s\S]*Silent omission or reporting the check as passed/,
      label: 'verification evidence skipped-check honesty',
    },
    {
      file: 'docs/workflows/verification-evidence-contract.md',
      pattern: /skipped or unavailable checks with reasons[\s\S]*known unverified behavior,[\s\S]*repository facts,[\s\S]*edge cases,[\s\S]*residual risk/,
      label: 'verification summary skipped residual risk',
    },
    {
      file: 'docs/workflows/routing-validation-guardrails.md',
      pattern: /The route output is a recommendation,[\s\S]*not evidence that validation has passed/,
      label: 'routing guardrail route output not evidence',
    },
    {
      file: 'docs/workflows/routing-validation-guardrails.md',
      pattern: /`Skipped or Unverified` records skipped checks,[\s\S]*unverified behavior or facts,[\s\S]*reasons,[\s\S]*residual risk/,
      label: 'routing guardrail skipped unverified boundary',
    },
    {
      file: 'docs/workflows/routing-validation-guardrails.md',
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
      file: 'docs/showcase/README.md',
      pattern: /public-safe\s+entry points[\s\S]*Keep examples generic and redacted/,
      label: 'showcase README public-safe positioning',
    },
    {
      file: 'docs/showcase/README.md',
      pattern: /Do not publish real consumer profiles,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*private\s+repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private\s+knowledge-base content/,
      label: 'showcase README private consumer boundary',
    },
    {
      file: 'docs/showcase/java-backend.md',
      pattern: /## Private context boundary[\s\S]*real service names,[\s\S]*endpoints,[\s\S]*schema names,[\s\S]*credentials,[\s\S]*private\s+repository addresses,[\s\S]*feature flags,[\s\S]*business logic/,
      label: 'Java backend showcase private context boundary',
    },
    {
      file: 'docs/showcase/frontend.md',
      pattern: /## Private context boundary[\s\S]*real product names,[\s\S]*routes,[\s\S]*API hosts,[\s\S]*customer data,[\s\S]*feature\s+flags,[\s\S]*analytics keys,[\s\S]*business rules,[\s\S]*screenshots/,
      label: 'frontend showcase private context boundary',
    },
    {
      file: 'docs/showcase/release-and-docs.md',
      pattern: /## Private context boundary[\s\S]*private consumer names,[\s\S]*local\s+machine paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*private knowledge-base content,[\s\S]*non-public metrics/,
      label: 'release docs showcase private context boundary',
    },
    {
      file: 'docs/showcase/release-and-docs.md',
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
      file: 'docs/growth/README.md',
      pattern: /local repository deliverable only[\s\S]*GitHub Topics,[\s\S]*Discussions,[\s\S]*social preview uploads,[\s\S]*real issue creation,[\s\S]*external posting[\s\S]*maintainer-owned manual actions[\s\S]*GitHub UI or\s+an authenticated workflow/,
      label: 'growth metrics manual action boundary',
    },
    {
      file: 'docs/growth/README.md',
      pattern: /not a public portal,[\s\S]*paid marketplace,[\s\S]*automated posting workflow,[\s\S]*owner-only analytics publication surface/,
      label: 'growth metrics no portal automation boundary',
    },
    {
      file: 'docs/growth/README.md',
      pattern: /Default output is `\.metrics\/latest\.json`, which is intentionally ignored by\s+Git[\s\S]*Use `--out <path>` only for private dashboards or temporary analysis/,
      label: 'growth metrics private output boundary',
    },
    {
      file: 'docs/growth/README.md',
      pattern: /## Privacy Boundary[\s\S]*Do not commit `\.metrics\/` output[\s\S]*Do not publish raw referrers,[\s\S]*private campaign URLs,[\s\S]*internal dashboards,[\s\S]*tokens,[\s\S]*owner-only traffic details[\s\S]*Do not infer personal user identity[\s\S]*aggregate metric definitions and collection cadence,[\s\S]*not private analytics records/,
      label: 'growth metrics privacy boundary',
    },
    {
      file: 'docs/growth/README.md',
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
      file: 'docs/assets/README.md',
      pattern: /public-safe visual assets and capture guidance[\s\S]*workflow quickly without exposing private consumer context/,
      label: 'assets public-safe positioning',
    },
    {
      file: 'docs/assets/README.md',
      pattern: /Visual assets are not a public portal,[\s\S]*hosted demo site,[\s\S]*automated promotion\s+workflow,[\s\S]*substitute for release evidence/,
      label: 'assets no portal automation boundary',
    },
    {
      file: 'docs/assets/README.md',
      pattern: /GitHub social preview upload,[\s\S]*external posting,[\s\S]*real demo publication[\s\S]*maintainer-owned manual\s+actions[\s\S]*GitHub UI or an authenticated workflow/,
      label: 'assets manual action boundary',
    },
    {
      file: 'docs/assets/README.md',
      pattern: /No demo GIF is currently tracked[\s\S]*Do not link GIFs from README or release notes\s+until the actual files exist/,
      label: 'assets tracked media boundary',
    },
    {
      file: 'docs/assets/README.md',
      pattern: /Before adding a demo GIF or short video[\s\S]*matching command evidence from `npm run doctor`, `npm run\s+validate:workflow`, or an equivalent release record[\s\S]*Do not present a mock\s+terminal session as product evidence/,
      label: 'assets demo evidence boundary',
    },
    {
      file: 'docs/assets/README.md',
      pattern: /Use an exact release tag for installation demos,[\s\S]*label the capture as a\s+development snapshot[\s\S]*If Bash checks are skipped on Windows,[\s\S]*show the skipped status explicitly/,
      label: 'assets release and skipped-check boundary',
    },
    {
      file: 'docs/assets/README.md',
      pattern: /## Privacy Boundary[\s\S]*Do not capture private consumer project names,[\s\S]*local paths,[\s\S]*endpoints,[\s\S]*credentials,[\s\S]*repository addresses,[\s\S]*runtime flags,[\s\S]*business rules,[\s\S]*customer data,[\s\S]*private screenshots,[\s\S]*private knowledge-base content[\s\S]*Use public fixtures,\s+redacted examples, or a clean demo repository/,
      label: 'assets privacy boundary',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateDeferredPortalIaContracts() {
  const checks = [
    {
      file: 'docs/marketplace/portal-information-architecture.md',
      pattern: /documentation-only preparation:[\s\S]*does not move `nova-plugin\/`,[\s\S]*does not build a frontend site,[\s\S]*does not add release or deployment pipeline\s+dependencies/,
      label: 'portal IA documentation-only boundary',
    },
    {
      file: 'docs/marketplace/portal-information-architecture.md',
      pattern: /not an implemented public portal,[\s\S]*hosted marketplace,[\s\S]*frontend app,[\s\S]*deployment plan,[\s\S]*activation evidence for `v3\.0\.0`/,
      label: 'portal IA no implemented portal boundary',
    },
    {
      file: 'docs/marketplace/portal-information-architecture.md',
      pattern: /Portal implementation code must not become a new source of truth[\s\S]*consume\s+these repository sources rather than duplicate plugin metadata by hand/,
      label: 'portal IA source-of-truth boundary',
    },
    {
      file: 'docs/marketplace/portal-information-architecture.md',
      pattern: /The current portal preparation boundary is the `v2\.2\.0` single-plugin\s+marketplace state[\s\S]*does not require\s+a plugin path move or a public portal implementation[\s\S]*breaking multi-plugin\s+repository layout remains a future `v3\.0\.0` candidate/,
      label: 'portal IA v2.2 single-plugin boundary',
    },
    {
      file: 'docs/marketplace/portal-information-architecture.md',
      pattern: /## Explicit Non-Goals For This Preparation[\s\S]*Do not move, rename, or copy `nova-plugin\/`[\s\S]*Do not build a React, Vite, Next\.js, static-site, or other frontend portal[\s\S]*Do not add package dependencies, deployment jobs,[\s\S]*Do not change plugin versions or generated release metadata[\s\S]*Do not put repository-local fields[\s\S]*Claude-compatible marketplace manifest/,
      label: 'portal IA explicit non-goals',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateV3ReadinessEvidenceContracts() {
  const checks = [
    {
      file: 'docs/marketplace/v3-readiness-evidence.md',
      pattern: /current decision is to keep `v3\.0\.0` deferred[\s\S]*must not move `nova-plugin\/`, introduce a public portal\s+frontend, or change plugin installation paths/,
      label: 'v3 readiness deferred decision boundary',
    },
    {
      file: 'docs/marketplace/v3-readiness-evidence.md',
      pattern: /Registry fixtures may prove generator behavior,[\s\S]*not production\s+plugin directories,[\s\S]*`v3\.0\.0` activation evidence,[\s\S]*reason to move install\s+paths/,
      label: 'v3 readiness fixture-only evidence boundary',
    },
    {
      file: 'docs/marketplace/v3-readiness-evidence.md',
      pattern: /One production plugin: `nova-plugin`[\s\S]*Multi-entry behavior is covered by fixtures only[\s\S]*Do not migrate real directories/,
      label: 'v3 readiness one production plugin boundary',
    },
    {
      file: 'docs/marketplace/v3-readiness-evidence.md',
      pattern: /## Not Allowed Without Activation[\s\S]*Moving, renaming, or copying `nova-plugin\/`[\s\S]*Introducing `plugins\/\*` as the production install path[\s\S]*public portal dependency[\s\S]*Treating fixture-only multi-plugin support as evidence that production\s+migration is necessary/,
      label: 'v3 readiness activation non-goals',
    },
  ];

  for (const check of checks) {
    expectContentRegex(check.file, check.pattern, check.label);
  }
}

function validateReviewLevelLiteContract() {
  const activeFiles = [
    'nova-plugin/skills/nova-review/SKILL.md',
    'nova-plugin/commands/review.md',
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
    ['lite', 'nova-review-lite'],
    ['standard', 'nova-review-only'],
    ['strict', 'nova-review-strict'],
  ];
  for (const [level, target] of routes) {
    const pattern = new RegExp(`\`${level}\`\\s*->\\s*\`${target}\``);
    if (!pattern.test(skill)) {
      recordError('nova-plugin/skills/nova-review/SKILL.md', `missing route ${level} -> ${target}`);
    }
  }
}

function expectedCurrentMinorRange(version) {
  const match = /^(\d+)\.(\d+)\.\d+(?:[-+].*)?$/.exec(version);
  if (!match) return null;
  return `${match[1]}.${match[2]}.x`;
}

function validateSecuritySupportRange() {
  const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
  const expectedRange = expectedCurrentMinorRange(plugin.version);
  if (!expectedRange) {
    recordError('nova-plugin/.claude-plugin/plugin.json', `version "${plugin.version}" cannot derive current MINOR support range`);
    return;
  }

  const file = 'SECURITY.md';
  const src = readFileSync(resolve(root, file), 'utf8');
  const match = src.match(/最新 MINOR 版本（当前 `([^`]+)`）/);
  if (!match) {
    recordError(file, 'missing current MINOR support range in security policy');
    return;
  }
  if (match[1] !== expectedRange) {
    recordError(file, `current MINOR support range is "${match[1]}", expected "${expectedRange}" from plugin version ${plugin.version}`);
  }
}

function shouldSkipStalePlanningScan(absPath) {
  const relPath = rel(absPath);
  return relPath === 'CHANGELOG.md'
    || isArchivePath(absPath)
    || hasPathSegments(absPath, HISTORY_SEGMENTS);
}

function validateStaleActivePlanningLabels() {
  const markdownFiles = walkFiles(root, (abs) => extname(abs).toLowerCase() === '.md')
    .filter((abs) => !shouldSkipStalePlanningScan(abs));

  for (const file of markdownFiles) {
    const src = stripFencedCode(readFileSync(file, 'utf8'));
    for (const { pattern, message } of STALE_ACTIVE_PLANNING_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of src.matchAll(pattern)) {
        recordError(rel(file), `line ${lineNumberAt(src, match.index ?? 0)} has ${message}`);
      }
    }
  }
}

function validateReports() {
  const reportsDir = resolve(root, 'docs/reports');
  if (!existsSync(reportsDir)) return;
  const reportFiles = walkFiles(reportsDir, (abs) => extname(abs).toLowerCase() === '.md')
    .filter((abs) => !isArchivePath(abs));
  const historyMarker = /\b(historical|archived)\b|历史|已归档|归档/i;
  for (const file of reportFiles) {
    const src = readFileSync(file, 'utf8');
    if (!historyMarker.test(src)) {
      recordError(
        rel(file),
        'non-archived report must include an explicit historical/archived status marker',
      );
    }
  }
}

validateMarkdownLinks();
validateCommandDocs();
validateVersionReferences();
validateInventoryFacts();
validateProjectPositioningContracts();
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
validateWorkflowEvidenceContracts();
validateShowcaseContracts();
validateGrowthMetricsContracts();
validateAssetsContracts();
validateDeferredPortalIaContracts();
validateV3ReadinessEvidenceContracts();
validateReviewLevelLiteContract();
validateSecuritySupportRange();
validateStaleActivePlanningLabels();
validateReports();

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
