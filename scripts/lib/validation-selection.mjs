import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess } from './process-runner.mjs';

const normalize = (value) => value.replaceAll('\\', '/').replace(/^\.\//u, '');

export function globRegex(glob) {
  let source = '^';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*' && glob[index + 1] === '*') {
      source += glob[index + 2] === '/' ? '(?:.*/)?' : '.*';
      index += glob[index + 2] === '/' ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += /[\\^$+?.()|{}[\]]/u.test(char) ? `\\${char}` : char;
  }
  return new RegExp(`${source}$`, 'u');
}

export function matchesAny(path, patterns) {
  const value = normalize(path);
  return patterns.some((pattern) => globRegex(pattern).test(value));
}

export function selectValidationTasks(definitions, files, { forceFull = false } = {}) {
  if (forceFull || files.length === 0) return { full: true, reason: forceFull ? 'explicit full mode' : 'no bounded change set', selectedIds: definitions.map((item) => item.id) };
  const normalizedFiles = [...new Set(files.map(normalize))].sort();
  const globalPatterns = ['package.json', 'package-lock.json', '.node-version', 'scripts/validate-all.mjs', 'scripts/lib/validation-task-registry.mjs', 'scripts/lib/validation-selection.mjs', 'scripts/lib/**'];
  const globalFile = normalizedFiles.find((file) => matchesAny(file, globalPatterns));
  if (globalFile) return { full: true, reason: `global validation input changed: ${globalFile}`, selectedIds: definitions.map((item) => item.id) };
  const selected = new Set();
  const unmatched = [];
  for (const file of normalizedFiles) {
    const matches = definitions.filter((definition) => matchesAny(file, definition.inputs));
    if (matches.length === 0) unmatched.push(file);
    for (const definition of matches) selected.add(definition.id);
  }
  if (unmatched.length > 0) return { full: true, reason: `unmatched path fails closed: ${unmatched[0]}`, selectedIds: definitions.map((item) => item.id), unmatched };
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of definitions) {
      if (selected.has(definition.id)) {
        for (const dependency of definition.deps) if (!selected.has(dependency)) { selected.add(dependency); changed = true; }
      }
    }
  }
  return { full: false, reason: 'bounded impact selection', selectedIds: definitions.filter((item) => selected.has(item.id)).map((item) => item.id), files: normalizedFiles };
}

async function gitPaths(root, args) {
  const result = await captureProcess(`git ${args.join(' ')}`, 'git', args, { cwd: root, timeoutMs: 30_000, maxOutputBytes: 10_485_760 });
  if (!result.ok) throw new Error(`unable to compute changed files: ${result.errorMessage ?? result.stderr ?? result.code}`);
  return result.stdout.split(/\r?\n/u).map((line) => normalize(line.trim())).filter(Boolean);
}

export async function changedFilesSince(root, revision) {
  const changed = await gitPaths(root, ['diff', '--name-only', '--diff-filter=ACDMRTUXB', revision, '--']);
  const untracked = await gitPaths(root, ['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...changed, ...untracked])].sort();
}

export async function trackedAndUntrackedFiles(root) {
  const tracked = await gitPaths(root, ['ls-files']);
  const untracked = await gitPaths(root, ['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...untracked])].sort();
}

export function expandFileArguments(args, repoFiles) {
  const values = [];
  for (const arg of args) {
    const normalized = normalize(arg);
    if (normalized.includes('*') || normalized.includes('?')) {
      const matches = repoFiles.filter((file) => globRegex(normalized).test(file));
      if (matches.length === 0) values.push(normalized);
      else values.push(...matches);
    } else values.push(normalized);
  }
  return [...new Set(values)].sort();
}

const hash = (value) => createHash('sha256').update(value).digest('hex');

function digestPaths(root, paths, fileDigestCache = new Map()) {
  const parts = [];
  for (const path of paths.sort()) {
    const absolute = resolve(root, path.split('/').join(sep));
    const stats = existsSync(absolute) ? statSync(absolute, { bigint: true }) : null;
    const signature = stats?.isFile() ? `${stats.size}:${stats.mtimeNs}` : 'missing';
    let cached = fileDigestCache.get(path);
    if (!cached || cached.signature !== signature) {
      cached = { signature, digest: stats?.isFile() ? hash(readFileSync(absolute)) : 'missing' };
      fileDigestCache.set(path, cached);
    }
    const fileDigest = cached.digest;
    parts.push(`${path}:${fileDigest}`);
  }
  return hash(parts.join('\n'));
}

export function createValidationCache({ root, definitions, repoFiles, enabled = false }) {
  const cacheRoot = resolve(root, '.cache/nova-validate');
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const fileDigestCache = new Map();
  const comparableEnvironment = {
    nodeMajor: process.versions.node.split('.')[0], platform: process.platform, arch: process.arch, concurrency: process.env.NOVA_VALIDATE_CONCURRENCY ?? '3',
    engineDigest: hash(Buffer.concat([
      readFileSync(fileURLToPath(import.meta.url)),
      readFileSync(fileURLToPath(new URL('./validation-task-registry.mjs', import.meta.url))),
    ])),
  };
  function keyFor(definition) {
    const inputs = repoFiles.filter((file) => matchesAny(file, definition.inputs));
    return hash(JSON.stringify({ definition, comparableEnvironment, inputDigest: digestPaths(root, inputs, fileDigestCache) }));
  }
  function outputDigest(definition) { return digestPaths(root, definition.outputs, fileDigestCache); }
  return {
    lookup(task) {
      const definition = definitionById.get(task.id);
      if (!enabled || !definition || definition.cachePolicy !== 'content') return null;
      const path = resolve(cacheRoot, `${task.id}.json`);
      if (!existsSync(path)) return null;
      try {
        const entry = JSON.parse(readFileSync(path, 'utf8'));
        if (entry.status !== 'passed' || entry.key !== keyFor(definition) || entry.outputDigest !== outputDigest(definition)) return null;
        return { id: task.id, label: task.label, ok: true, cached: true, stdout: `CACHE HIT ${task.id}\n`, stderr: '', ms: 0 };
      } catch { return null; }
    },
    store(task, result) {
      const definition = definitionById.get(task.id);
      if (!enabled || !definition || definition.cachePolicy !== 'content' || !result.ok || result.skipped) return;
      const path = resolve(cacheRoot, `${task.id}.json`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, taskId: task.id, status: 'passed', key: keyFor(definition), outputDigest: outputDigest(definition) }, null, 2)}\n`, 'utf8');
    },
  };
}
