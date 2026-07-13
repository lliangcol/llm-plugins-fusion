import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

function isContained(root, target) {
  const rel = relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Resolve an existing regular file without permitting lexical or symlink escapes. */
export function resolveContainedFile(root, path) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('spec root must be a non-empty string');
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) throw new TypeError('spec path must be a non-empty relative string');
  if (isAbsolute(path)) throw new Error(`absolute spec path is not allowed: ${path}`);

  const realRoot = realpathSync(resolve(root));
  if (!statSync(realRoot).isDirectory()) throw new Error(`spec root is not a directory: ${root}`);
  const lexicalTarget = resolve(realRoot, path);
  if (!isContained(realRoot, lexicalTarget)) throw new Error(`spec path escapes root: ${path}`);

  let cursor = realRoot;
  for (const component of relative(realRoot, lexicalTarget).split(sep)) {
    cursor = resolve(cursor, component);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`spec path contains a symbolic link: ${path}`);
  }

  const realTarget = realpathSync(lexicalTarget);
  if (!isContained(realRoot, realTarget)) throw new Error(`spec path resolves outside root: ${path}`);
  if (!statSync(realTarget).isFile()) throw new Error(`spec path is not a regular file: ${path}`);
  return realTarget;
}

export function readContainedJson(root, path) {
  return JSON.parse(readFileSync(resolveContainedFile(root, path), 'utf8'));
}
