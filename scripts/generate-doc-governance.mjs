#!/usr/bin/env node
/** Resolve sidecar metadata and migration dispositions for every Markdown page. */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url); const skip = new Set(['.git', '.codex', '.metrics', 'node_modules', 'dist', 'build', 'coverage']);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
function files(dir = root) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => skip.has(entry.name) ? [] : entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)]); }
function rel(path) { return relative(root, path).split(sep).join('/'); }
function resolveMetadata(path, registry) { const value = { ...registry.defaults }; for (const rule of registry.rules) { if (new RegExp(rule.pattern, 'u').test(path)) Object.assign(value, Object.fromEntries(Object.entries(rule).filter(([key]) => key !== 'pattern'))); } return value; }
export function outputs() {
  const registry = readJson('governance/doc-metadata.json'); const migrations = readJson('governance/docs-migrations.json'); const byFrom = new Map(migrations.mappings.map((entry) => [entry.from, entry]));
  const markdown = files().filter((path) => extname(path) === '.md').map(rel).sort();
  const resolved = { schemaVersion: 1, documents: markdown.map((path) => ({ path, ...resolveMetadata(path, registry) })) };
  const docsFiles = files(resolve(root, 'docs')).map(rel).sort();
  const manifest = { schemaVersion: 1, files: docsFiles.map((path) => ({ path, target: byFrom.get(path)?.to ?? path, disposition: byFrom.get(path)?.disposition ?? (path.startsWith('docs/generated/') ? 'generated' : 'retain') })) };
  const redirects = { schemaVersion: 1, redirects: migrations.mappings.filter((entry) => entry.from !== entry.to).map((entry) => ({ from: entry.from, to: entry.to, kind: 'compatibility-stub' })) };
  const nav = `# Generated Documentation Navigation\n\nGenerated from \`governance/doc-metadata.json\` by \`node scripts/generate-doc-governance.mjs --write\`. Compatibility stubs remain in the redirect manifest but are omitted from active navigation.\n\n${resolved.documents.filter((entry) => entry.path.startsWith('docs/') && !entry.generated && !byFrom.has(entry.path)).map((entry) => `- [${entry.path}](../../${entry.path}) — ${entry.audience}; ${entry.contentType}`).join('\n')}\n`;
  return new Map([['docs/generated/doc-metadata-resolved.json', `${JSON.stringify(resolved, null, 2)}\n`], ['docs/generated/migration-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`], ['docs/generated/redirect-map.json', `${JSON.stringify(redirects, null, 2)}\n`], ['docs/generated/documentation-navigation.md', nav]]);
}
export function checkOrWrite({ write = false } = {}) { const stale = []; for (const [path, content] of outputs()) { const target = resolve(root, path); if (!existsSync(target) || readFileSync(target, 'utf8') !== content) { if (write) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content, 'utf8'); } else stale.push(path); } } if (stale.length) throw new Error(`${stale.join(', ')} document governance outputs are stale`); }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { try { const args = process.argv.slice(2); if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-doc-governance.mjs [--write]'); checkOrWrite({ write: args.includes('--write') }); console.log(args.includes('--write') ? 'Wrote document governance outputs' : 'OK document governance outputs'); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; } }
