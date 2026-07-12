import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve a path relative to the directory containing an ES module. */
export function resolveFromModule(importMetaUrl, ...segments) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), ...segments);
}

/** Resolve the repository root for modules located directly under scripts/. */
export function repoRoot(importMetaUrl) {
  return resolveFromModule(importMetaUrl, '..');
}
