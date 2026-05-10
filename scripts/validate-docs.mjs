#!/usr/bin/env node
/**
 * Validate active Markdown documentation for local link/anchor health, command
 * doc coverage and placement, release metadata drift, security support range,
 * stale active planning labels, and stale non-archived reports.
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
  'node_modules',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'out',
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
