import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

export const TEST_SUITES = new Set(['unit', 'integration', 'e2e', 'all']);

function walkTestFiles(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walkTestFiles(absPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(absPath);
    }
  }
}

export function discoverTestFiles(rootDir, suite = 'all') {
  if (!TEST_SUITES.has(suite)) {
    throw new Error(`unknown test suite "${suite}"; expected unit, integration, e2e, or all`);
  }

  const testsDir = resolve(rootDir, 'tests');
  const suiteDir = suite === 'all' ? testsDir : resolve(testsDir, suite);
  if (!existsSync(suiteDir)) return [];

  const files = [];
  walkTestFiles(suiteDir, files);
  return files.sort((a, b) => a.localeCompare(b));
}

export function relativeTestFiles(rootDir, suite = 'all') {
  return discoverTestFiles(rootDir, suite)
    .map((file) => relative(rootDir, file).split(sep).join('/'));
}
