#!/usr/bin/env node
/** Apply and verify governed documentation moves while retaining public compatibility stubs. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { requireSemVer } from './lib/semver.mjs';

const root = repoRoot(import.meta.url);
const registry = JSON.parse(readFileSync(resolve(root, 'governance/docs-migrations.json'), 'utf8'));
const directRedirects = new Map(registry.mappings.map((entry) => [entry.from, entry.to]));
function finalRedirect(path) {
  const seen = new Set();
  let current = path;
  while (directRedirects.has(current)) {
    if (seen.has(current)) throw new Error(`documentation redirect cycle includes ${current}`);
    seen.add(current);
    current = directRedirects.get(current);
  }
  return current;
}
const redirects = new Map(registry.mappings.map((entry) => [entry.from, finalRedirect(entry.from)]));
const currentVersion = requireSemVer(JSON.parse(readFileSync(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'), 'utf8')).version, 'plugin version');
const rel = (from, to) => relative(dirname(resolve(root, from)), resolve(root, to)).split(sep).join('/');
const stub = (from, to) => `# Documentation moved\n\nThis public compatibility path is retained. The maintained document is [${to}](${rel(from, to)}).\n`;
const movedMarker = (from) => `<!-- migrated-from: ${from} -->`;
const mergedMarker = (from) => `<!-- merged-from: ${from} -->`;
const isMarkdown = (path) => extname(path).toLowerCase() === '.md';

export function repositoryPath(path, label) {
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
  if (JSON.stringify(registry.retirementPolicy?.requiredChecks) !== JSON.stringify([
    'zero-repository-inbound-links',
    'public-url-audit',
    'maintainer-approval',
  ])) throw new Error('documentation retirement policy must require internal links, public URL audit, and maintainer approval');
  const seen = new Set();
  for (const entry of registry.mappings) {
    repositoryPath(entry.from, 'migration source');
    repositoryPath(entry.to, 'migration target');
    if (seen.has(entry.from)) throw new Error(`duplicate migration source: ${entry.from}`);
    seen.add(entry.from);
    requireSemVer(entry.retireAfterVersion, `${entry.from} retireAfterVersion`);
    if (!isMarkdown(entry.from) && entry.disposition === 'merge-with-stub') {
      throw new Error(`non-Markdown migration cannot use merge-with-stub: ${entry.from}`);
    }
    if (extname(entry.from).toLowerCase() !== extname(entry.to).toLowerCase()) {
      throw new Error(`migration must preserve the file format: ${entry.from} -> ${entry.to}`);
    }
  }
}

validateRegistry();

export function compareStableVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    const delta = Number(left[key]) - Number(right[key]);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

function retirementDue(entry) {
  return compareStableVersions(currentVersion, requireSemVer(entry.retireAfterVersion)) >= 0;
}

const markdownSkip = new Set(['.git', '.codex', '.metrics', 'node_modules', 'dist', 'build', 'coverage']);
function markdownFiles(directory = '.') {
  const output = [];
  for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
    if (markdownSkip.has(entry.name)) continue;
    const path = directory === '.' ? entry.name : `${directory}/${entry.name}`;
    if (entry.isDirectory()) output.push(...markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.md')) output.push(path);
  }
  return output;
}

function activeMarkdownFiles() {
  const compatibilityPaths = new Set(registry.mappings.map((entry) => entry.from));
  return markdownFiles().filter((path) => !compatibilityPaths.has(path));
}

export function inboundCompatibilityLinks() {
  const findings = [];
  for (const path of activeMarkdownFiles()) {
    const content = readFileSync(resolve(root, path), 'utf8');
    for (const match of content.matchAll(/\]\(([^\s)]+)\)/gu)) {
      const href = match[1];
      if (/^(?:[a-z]+:|#|\/)/iu.test(href)) continue;
      const [pathPart] = href.split(/(?=[?#])/u, 1);
      const absolute = resolve(dirname(resolve(root, path)), pathPart);
      const repositoryRelative = relative(root, absolute).split(sep).join('/');
      if (redirects.has(repositoryRelative)) findings.push({ path, href, compatibilityPath: repositoryRelative });
    }
  }
  return findings;
}

export function rewriteInboundCompatibilityLinks() {
  for (const path of activeMarkdownFiles()) {
    const target = resolve(root, path);
    const content = readFileSync(target, 'utf8');
    const rewritten = rewriteRedirectLinks(content, path);
    if (rewritten !== content) writeFileSync(target, rewritten, 'utf8');
  }
}

function splitLinkHref(href) {
  const suffixAt = href.search(/[?#]/u);
  return suffixAt === -1 ? [href, ''] : [href.slice(0, suffixAt), href.slice(suffixAt)];
}

export function rewriteLinks(content, from, to) {
  return content.replace(/(\]\()([^\s)]+)(\))/gu, (match, open, href, close) => {
    if (/^(?:[a-z]+:|#|\/)/iu.test(href)) return match;
    const [pathPart, suffix] = splitLinkHref(href);
    if (!pathPart) return match;
    const absolute = resolve(dirname(resolve(root, from)), pathPart);
    const rewritten = relative(dirname(resolve(root, to)), absolute).split(sep).join('/') || '.';
    return `${open}${rewritten}${suffix}${close}`;
  });
}

export function rewriteRedirectLinks(content, documentPath) {
  return content.replace(/(\]\()([^\s)]+)(\))/gu, (match, open, href, close) => {
    if (/^(?:[a-z]+:|#|\/)/iu.test(href)) return match;
    const [pathPart, suffix] = splitLinkHref(href);
    const absolute = resolve(dirname(resolve(root, documentPath)), pathPart);
    const repositoryPath = relative(root, absolute).split(sep).join('/');
    const redirected = redirects.get(repositoryPath);
    return redirected ? `${open}${rel(documentPath, redirected)}${suffix}${close}` : match;
  });
}

export function committedSource(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: root, encoding: 'utf8' });
}

function checkEntry(entry) {
  const source = repositoryPath(entry.from, 'migration source'); const target = repositoryPath(entry.to, 'migration target');
  if (!existsSync(target)) throw new Error(`missing migration target: ${entry.to}`);
  if (entry.from === entry.to) return;
  if (retirementDue(entry)) {
    if (existsSync(source)) throw new Error(`compatibility path reached retireAfterVersion ${entry.retireAfterVersion}: ${entry.from}; remove it only after all retirementPolicy checks have evidence`);
    return;
  }
  if (!existsSync(source)) throw new Error(`missing compatibility path before ${entry.retireAfterVersion}: ${entry.from}`);
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

export function writeEntry(entry) {
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

export function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/migrate-documentation-layout.mjs [--write]');
  const write = args.includes('--write');
  if (write) {
    for (const entry of registry.mappings) writeEntry(entry);
    rewriteInboundCompatibilityLinks();
  }
  for (const entry of registry.mappings) checkEntry(entry);
  const inbound = inboundCompatibilityLinks();
  if (inbound.length) {
    const sample = inbound.slice(0, 5).map((item) => `${item.path}: ${item.href}`).join('; ');
    throw new Error(`${inbound.length} active documentation link(s) still target compatibility paths: ${sample}`);
  }
  console.log(`OK documentation migrations (${registry.mappings.length} governed compatibility paths; zero active inbound links; retire no earlier than ${[...new Set(registry.mappings.map((entry) => entry.retireAfterVersion))].join(', ')}${write ? ', written' : ''})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
