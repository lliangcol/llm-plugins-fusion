#!/usr/bin/env node
/** Apply and verify governed documentation moves while retaining public compatibility stubs. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const registry = JSON.parse(readFileSync(resolve(root, 'governance/docs-migrations.json'), 'utf8'));
const redirects = new Map(registry.mappings.map((entry) => [entry.from, entry.to]));
const rel = (from, to) => relative(dirname(resolve(root, from)), resolve(root, to)).split(sep).join('/');
const stub = (from, to) => `# Documentation moved\n\nThis public compatibility path is retained. The maintained document is [${to}](${rel(from, to)}).\n`;
const movedMarker = (from) => `<!-- migrated-from: ${from} -->`;
const mergedMarker = (from) => `<!-- merged-from: ${from} -->`;
const isMarkdown = (path) => extname(path).toLowerCase() === '.md';

function repositoryPath(path, label) {
  const absolute = resolve(root, path);
  const normalized = relative(root, absolute);
  if (!normalized || normalized.startsWith(`..${sep}`) || normalized === '..' || isAbsolute(normalized)) {
    throw new Error(`${label} must stay inside the repository: ${path}`);
  }
  const portable = normalized.split(sep).join('/');
  if (portable !== path) throw new Error(`${label} must be a normalized repository-relative path: ${path}`);
  return absolute;
}

function validateRegistry() {
  const seen = new Set();
  for (const entry of registry.mappings) {
    repositoryPath(entry.from, 'migration source');
    repositoryPath(entry.to, 'migration target');
    if (seen.has(entry.from)) throw new Error(`duplicate migration source: ${entry.from}`);
    seen.add(entry.from);
    if (!isMarkdown(entry.from) && entry.disposition === 'merge-with-stub') {
      throw new Error(`non-Markdown migration cannot use merge-with-stub: ${entry.from}`);
    }
    if (extname(entry.from).toLowerCase() !== extname(entry.to).toLowerCase()) {
      throw new Error(`migration must preserve the file format: ${entry.from} -> ${entry.to}`);
    }
  }
}

validateRegistry();

function rewriteLinks(content, from, to) {
  return content.replace(/(\]\()([^\s)]+)(\))/gu, (match, open, href, close) => {
    if (/^(?:[a-z]+:|#|\/)/iu.test(href)) return match;
    const [pathPart, suffix = ''] = href.split(/(?=[?#])/u, 2);
    if (!pathPart) return match;
    const absolute = resolve(dirname(resolve(root, from)), pathPart);
    const rewritten = relative(dirname(resolve(root, to)), absolute).split(sep).join('/') || '.';
    return `${open}${rewritten}${suffix}${close}`;
  });
}

function rewriteRedirectLinks(content, documentPath) {
  return content.replace(/(\]\()([^\s)]+)(\))/gu, (match, open, href, close) => {
    if (/^(?:[a-z]+:|#|\/)/iu.test(href)) return match;
    const [pathPart, suffix = ''] = href.split(/(?=[?#])/u, 2);
    const absolute = resolve(dirname(resolve(root, documentPath)), pathPart);
    const repositoryPath = relative(root, absolute).split(sep).join('/');
    const redirected = redirects.get(repositoryPath);
    return redirected ? `${open}${rel(documentPath, redirected)}${suffix}${close}` : match;
  });
}

function committedSource(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'utf8' });
}

function checkEntry(entry) {
  const source = repositoryPath(entry.from, 'migration source'); const target = repositoryPath(entry.to, 'migration target');
  if (!existsSync(source)) throw new Error(`missing compatibility path: ${entry.from}`);
  if (!existsSync(target)) throw new Error(`missing migration target: ${entry.to}`);
  if (entry.from === entry.to) return;
  const targetContent = readFileSync(target, 'utf8');
  if (isMarkdown(entry.from)) {
    if (readFileSync(source, 'utf8') !== stub(entry.from, entry.to)) throw new Error(`stale compatibility stub: ${entry.from}`);
    const marker = entry.disposition === 'merge-with-stub' ? mergedMarker(entry.from) : movedMarker(entry.from);
    if (!targetContent.includes(marker)) throw new Error(`migration target lacks source marker: ${entry.to}`);
    return;
  }
  if (extname(entry.from).toLowerCase() === '.json') JSON.parse(targetContent);
  if (readFileSync(source, 'utf8') !== targetContent) throw new Error(`stale compatibility copy: ${entry.from}`);
}

function writeEntry(entry) {
  const source = repositoryPath(entry.from, 'migration source'); const target = repositoryPath(entry.to, 'migration target');
  if (entry.from === entry.to || entry.disposition === 'retain' || entry.disposition === 'generated') return;
  mkdirSync(dirname(target), { recursive: true });
  if (entry.disposition === 'move-with-stub' && !existsSync(target)) renameSync(source, target);
  if (!existsSync(target)) throw new Error(`merge target must exist before stubbing ${entry.from}: ${entry.to}`);
  if (!isMarkdown(entry.from)) {
    let content = readFileSync(target, 'utf8');
    if (extname(entry.from).toLowerCase() === '.json') {
      content = content.replace(/^<!-- migrated-from: [^\r\n]+ -->\r?\n/u, '');
      JSON.parse(content);
    }
    writeFileSync(target, content, 'utf8');
    if (!existsSync(source) || readFileSync(source, 'utf8') !== content) writeFileSync(source, content, 'utf8');
    return;
  }
  if (entry.disposition === 'move-with-stub') {
    const marker = movedMarker(entry.from); const content = readFileSync(target, 'utf8');
    if (!content.includes(marker)) writeFileSync(target, `${marker}\n${rewriteLinks(content, entry.from, entry.to)}`, 'utf8');
  }
  if (entry.disposition === 'merge-with-stub') {
    const marker = mergedMarker(entry.from); const content = readFileSync(target, 'utf8');
    if (!content.includes(marker)) {
      const sourceContent = readFileSync(source, 'utf8') === stub(entry.from, entry.to) ? committedSource(entry.from) : readFileSync(source, 'utf8');
      const merged = rewriteLinks(sourceContent, entry.from, entry.to);
      writeFileSync(target, `${content.trimEnd()}\n\n${marker}\n<details>\n<summary>Migrated source: ${entry.from}</summary>\n\n${merged.trim()}\n\n</details>\n`, 'utf8');
    }
  }
  const redirected = rewriteRedirectLinks(readFileSync(target, 'utf8'), entry.to);
  if (redirected !== readFileSync(target, 'utf8')) writeFileSync(target, redirected, 'utf8');
  const expected = stub(entry.from, entry.to);
  if (!existsSync(source) || readFileSync(source, 'utf8') !== expected) writeFileSync(source, expected, 'utf8');
}

const write = process.argv.includes('--write');
if (process.argv.slice(2).some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/migrate-documentation-layout.mjs [--write]');
if (write) for (const entry of registry.mappings) writeEntry(entry);
for (const entry of registry.mappings) checkEntry(entry);
console.log(`OK documentation migrations (${registry.mappings.length} governed compatibility paths${write ? ', written' : ''})`);
