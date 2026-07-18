/** Bound plugin install evidence writes to dedicated ignored repository subtrees. */

import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  createPhysicalReadBoundary,
  preparePhysicalFileWrite,
  validatePhysicalFileWritePath,
  writePhysicalFileAtomically,
} from './physical-read-boundary.mjs';
import { assertPortableRelativePath, portablePathCollisionKey } from './portable-path.mjs';

export const PLUGIN_EVIDENCE_OUTPUT_PATTERN = /^\.metrics\/(?:plugin-[A-Za-z0-9._-]+|candidate-[A-Za-z0-9._-]+)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.json$/u;

function isContained(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
}

function portableKeysHaveAncestorConflict(left, right) {
  return left !== right && (left.startsWith(`${right}/`) || right.startsWith(`${left}/`));
}

export function validatePluginEvidenceOutputPath(path, label = 'plugin evidence output') {
  const portable = assertPortableRelativePath(path, label);
  if (!PLUGIN_EVIDENCE_OUTPUT_PATTERN.test(portable)) {
    throw new Error(`${label} must name a JSON file under .metrics/plugin-*/ or .metrics/candidate-*/`);
  }
  return portable;
}

/**
 * @param {string} repositoryRoot
 * @param {ReadonlyArray<{key: string, path: string | null | undefined, label: string}>} entries
 * @param {{protectedPaths?: ReadonlyArray<string>}} options
 */
export function validatePluginEvidenceOutputSelection(repositoryRoot, entries, { protectedPaths = [] } = {}) {
  const selected = entries
    .filter((entry) => entry.path != null)
    .map((entry) => ({
      ...entry,
      path: validatePluginEvidenceOutputPath(entry.path, entry.label),
    }));
  const targets = new Set();
  const keys = new Set();
  const portableTargets = new Set();
  const portableKeys = new Set();
  const protectedTargets = new Set(protectedPaths.map((path) => resolve(repositoryRoot, path)));
  const protectedPortableTargets = new Set(protectedPaths.flatMap((path) => {
    const value = relative(resolve(repositoryRoot), resolve(repositoryRoot, path));
    if (value === '' || isAbsolute(value) || value === '..' || value.startsWith(`..${sep}`)) return [];
    return [portablePathCollisionKey(value.split(sep).join('/'))];
  }));
  const priorTargets = [];
  for (const entry of selected) {
    if (typeof entry.key !== 'string' || entry.key.length === 0) {
      throw new Error('plugin evidence output plan requires a stable key');
    }
    const keyCollision = portablePathCollisionKey(entry.key);
    if (keys.has(entry.key) || portableKeys.has(keyCollision)) {
      throw new Error(`duplicate or portable-colliding plugin evidence output key: ${entry.key}`);
    }
    const target = resolve(repositoryRoot, entry.path);
    const targetCollision = portablePathCollisionKey(entry.path);
    if (targets.has(target) || portableTargets.has(targetCollision)) {
      throw new Error('plugin evidence outputs must not alias or portably collide with one another');
    }
    if (priorTargets.some((prior) => (
      (prior.target !== target && (isContained(prior.target, target) || isContained(target, prior.target)))
      || portableKeysHaveAncestorConflict(prior.targetCollision, targetCollision)
    ))) {
      throw new Error('plugin evidence outputs must not have an ancestor or descendant relationship');
    }
    if (protectedTargets.has(target) || protectedPortableTargets.has(targetCollision)) {
      throw new Error(`${entry.label} must not alias or portably collide with a protected input`);
    }
    keys.add(entry.key);
    portableKeys.add(keyCollision);
    targets.add(target);
    portableTargets.add(targetCollision);
    priorTargets.push({ target, targetCollision });
  }
  return Object.freeze(selected.map((entry) => Object.freeze({
    ...entry,
    target: resolve(repositoryRoot, entry.path),
  })));
}

/**
 * Validate every target before creating any parent, then hold one physical
 * lease per target across the operation that produces the evidence.
 *
 * @param {string} repositoryRoot
 * @param {ReadonlyArray<{key: string, path: string | null | undefined, label: string}>} entries
 * @param {{protectedPaths?: ReadonlyArray<string>}} options
 */
export function preparePluginEvidenceOutputPlan(repositoryRoot, entries, { protectedPaths = [] } = {}) {
  const selected = validatePluginEvidenceOutputSelection(repositoryRoot, entries, { protectedPaths });

  const boundary = createPhysicalReadBoundary(repositoryRoot, 'plugin evidence repository');
  for (const entry of selected) {
    validatePhysicalFileWritePath(boundary, entry.target, entry.label);
  }
  const outputs = Object.create(null);
  for (const entry of selected) {
    Object.defineProperty(outputs, entry.key, {
      enumerable: true,
      value: Object.freeze({
        label: entry.label,
        path: entry.path,
        target: entry.target,
        preparation: preparePhysicalFileWrite(boundary, entry.target, entry.label),
      }),
    });
  }
  return Object.freeze({ boundary, outputs: Object.freeze(outputs) });
}

export function writePluginEvidenceOutput(plan, key, content) {
  if (!plan?.outputs || !Object.hasOwn(plan.outputs, key)) {
    throw new Error(`plugin evidence output plan does not contain ${key}`);
  }
  const output = plan.outputs[key];
  return writePhysicalFileAtomically(
    plan.boundary,
    output.target,
    content,
    output.label,
    { preparation: output.preparation },
  );
}
