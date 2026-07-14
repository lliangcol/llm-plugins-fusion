#!/usr/bin/env node
/** Apply and verify governed documentation moves while retaining public compatibility stubs. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const registry = JSON.parse(readFileSync(resolve(root, 'governance/docs-migrations.json'), 'utf8'));
const redirects = new Map(registry.mappings.map((entry) => [entry.from, entry.to]));
const rel = (from, to) => relative(dirname(resolve(root, from)), resolve(root, to)).split(sep).join('/');
const stub = (from, to) => `# Documentation moved\n\nThis public compatibility path is retained. The maintained document is [${to}](${rel(from, to)}).\n`;
const movedMarker = (from) => `<!-- migrated-from: ${from} -->`;
const mergedMarker = (from) => `<!-- merged-from: ${from} -->`;

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
  const source = resolve(root, entry.from); const target = resolve(root, entry.to);
  if (!existsSync(source)) throw new Error(`missing compatibility path: ${entry.from}`);
  if (!existsSync(target)) throw new Error(`missing migration target: ${entry.to}`);
  if (entry.from !== entry.to && readFileSync(source, 'utf8') !== stub(entry.from, entry.to)) throw new Error(`stale compatibility stub: ${entry.from}`);
}

function writeEntry(entry) {
  const source = resolve(root, entry.from); const target = resolve(root, entry.to);
  if (entry.from === entry.to || entry.disposition === 'retain' || entry.disposition === 'generated') return;
  mkdirSync(dirname(target), { recursive: true });
  if (entry.disposition === 'move-with-stub' && !existsSync(target)) renameSync(source, target);
  if (!existsSync(target)) throw new Error(`merge target must exist before stubbing ${entry.from}: ${entry.to}`);
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
