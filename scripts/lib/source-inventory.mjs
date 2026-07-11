import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

function normalize(path) {
  return path.replaceAll('\\', '/');
}

export function sourceModuleInventory(root, runner = spawnSync) {
  const result = runner(
    'git',
    ['ls-files', '-z', '--cached', '--', '*.mjs'],
    { cwd: root, encoding: 'buffer', shell: false },
  );
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr?.toString('utf8') || 'git ls-files failed');
  }
  return result.stdout.toString('utf8')
    .split('\0')
    .filter((path) => path.endsWith('.mjs') && !path.startsWith('tests/'))
    .map(normalize)
    .sort();
}

export function loadedSourceModules(v8Dir, root) {
  const rootAbs = resolve(root);
  const loaded = new Set();
  for (const entry of readdirSync(v8Dir).filter((name) => name.endsWith('.json'))) {
    const report = JSON.parse(readFileSync(resolve(v8Dir, entry), 'utf8'));
    for (const script of report.result ?? []) {
      if (typeof script.url !== 'string' || !script.url.startsWith('file:')) continue;
      let abs;
      try {
        abs = fileURLToPath(script.url);
      } catch {
        continue;
      }
      const rel = normalize(relative(rootAbs, abs));
      if (rel.startsWith('../') || rel === '..' || rel.startsWith('tests/') || !rel.endsWith('.mjs')) continue;
      loaded.add(rel);
    }
  }
  return [...loaded].sort();
}

export function missingCoverageSources(expected, loaded) {
  const loadedSet = new Set(loaded);
  return expected.filter((path) => !loadedSet.has(path));
}
