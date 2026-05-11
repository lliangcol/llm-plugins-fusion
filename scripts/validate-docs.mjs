#!/usr/bin/env node
/**
 * Validate active Markdown documentation for local link/anchor health, command
 * doc coverage and placement, release metadata drift, documentation inventory
 * counts, security support range, stale active planning labels, and stale
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
const root = resolve(__dir, '..');

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
  ];

  for (const check of checks) {
    expectInventoryRegex(check.file, check.pattern, check.values, check.label);
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
