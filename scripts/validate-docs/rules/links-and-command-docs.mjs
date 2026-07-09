import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';

const LINE_ANCHOR_PATTERN = /^L\d+(?:-L\d+)?$/i;

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

function resolveLocalLink(fromFile, target, root) {
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

function collectMarkdownLinks(src, context) {
  const links = [];
  const stripped = context.stripFencedCode(src);
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

function collectMarkdownAnchors(file, context) {
  if (context.markdownAnchorsByFile.has(file)) return context.markdownAnchorsByFile.get(file);

  const src = readFileSync(file, 'utf8');
  const anchors = new Set();
  const headingCounts = new Map();
  const stripped = context.stripFencedCode(src);

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

  context.markdownAnchorsByFile.set(file, anchors);
  return anchors;
}

function validateLocalLinkAnchor(fromFile, src, link, resolved, context) {
  const fragment = extractLinkFragment(link.target);
  if (!fragment || LINE_ANCHOR_PATTERN.test(fragment)) return;
  if (statSync(resolved).isDirectory()) return;
  if (extname(resolved).toLowerCase() !== '.md') return;

  const anchors = collectMarkdownAnchors(resolved, context);
  if (!anchors.has(fragment)) {
    context.recordError(
      context.rel(fromFile),
      `line ${context.lineNumberAt(src, link.index)} has broken local anchor "${link.target}"`,
    );
  }
}

export function validateMarkdownLinks(context) {
  const markdownFiles = context.walkFiles(context.root, (abs) => extname(abs).toLowerCase() === '.md');
  for (const file of markdownFiles) {
    const src = readFileSync(file, 'utf8');
    for (const link of collectMarkdownLinks(src, context)) {
      const resolved = resolveLocalLink(file, link.target, context.root);
      if (!resolved) continue;
      if (!existsSync(resolved)) {
        context.recordError(
          context.rel(file),
          `line ${context.lineNumberAt(src, link.index)} has broken local link "${link.target}"`,
        );
        continue;
      }
      validateLocalLinkAnchor(file, src, link, resolved, context);
    }
  }
}

function readCommandStage(commandFile) {
  const src = readFileSync(commandFile, 'utf8');
  const frontmatter = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const stage = frontmatter?.[1].match(/^stage:\s*([a-z-]+)\s*$/m)?.[1];
  return stage ?? null;
}

export function validateCommandDocs(context) {
  const commandsDir = resolve(context.root, 'nova-plugin/commands');
  const docsDir = resolve(context.root, 'nova-plugin/docs/commands');
  const commandIds = readdirSync(commandsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'))
    .sort();

  for (const id of commandIds) {
    const commandFile = resolve(commandsDir, `${id}.md`);
    const stage = readCommandStage(commandFile);
    if (!stage) {
      context.recordError(context.rel(commandFile), 'missing command stage frontmatter');
      continue;
    }
    const docDir = context.CODEX_COMMAND_IDS.has(id) ? 'codex' : stage;
    for (const suffix of ['.md', '.README.md', '.README.en.md']) {
      const expectedName = `${id}${suffix}`;
      const expectedPath = resolve(docsDir, docDir, expectedName);
      if (!existsSync(expectedPath)) {
        context.recordError(
          'nova-plugin/docs/commands',
          `missing command doc ${docDir}/${expectedName}`,
        );
      }
    }
  }
}

export function validateLinksAndCommandDocs(context) {
  validateMarkdownLinks(context);
  validateCommandDocs(context);
}
