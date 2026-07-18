import { Buffer } from 'node:buffer';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { assertPortableRelativePath } from '../../framework/io/portable-path.mjs';

export { assertPortableRelativePath };

/**
 * Convert a host path below a root into a portable manifest path without
 * silently treating a backslash in a POSIX filename as a separator.
 *
 * @param {string} root
 * @param {string} target
 * @param {string} [label]
 */
export function portableRelativeFromRoot(root, target, label = 'path') {
  const value = relative(resolve(root), resolve(target));
  if (!value || isAbsolute(value)) throw new Error(`${label} escapes its root: ${target}`);
  const components = value.split(sep);
  if (components.some((component) => (
    component === ''
    || component === '.'
    || component === '..'
    || component.includes('/')
    || component.includes('\\')
  ))) {
    throw new Error(`${label} contains non-portable, traversal, dot, or empty components: ${target}`);
  }
  return assertPortableRelativePath(components.join('/'), label);
}

/**
 * Return a deterministic conservative collision key. NFKC plus Unicode
 * upper-then-lower mapping catches compatibility and additional case pairs
 * (for example long-s/s, sharp-s/ss, final-sigma/sigma, and ligatures), but
 * intentionally does not claim to reproduce every filesystem algorithm.
 */
export function portablePathCollisionKey(value) {
  return value.normalize('NFKC').toUpperCase().toLowerCase().normalize('NFKC');
}

/** Compare portable paths by their UTF-8 bytes, independent of locale and ICU. */
export function comparePortablePaths(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}
