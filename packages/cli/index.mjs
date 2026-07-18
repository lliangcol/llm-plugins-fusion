import {
  accessSync,
  closeSync,
  constants as fsConstants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, posix, relative, resolve, sep, win32 } from 'node:path';
import { compileDirectory, buildArtifact, migrateBehaviorSpec, migrateWorkflowSpec } from '@llm-plugins-fusion/compiler';
import { evaluateBundle, testConformance } from '@llm-plugins-fusion/conformance';
import { inspectSpecBundle, SPEC_ERROR, SpecBundleError, validateAndLoadSpecBundle } from '@llm-plugins-fusion/spec';
import { createSpecSchemaValidator } from './schema-validator.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry } from '../../scripts/lib/diagnostics.mjs';
import { assertPortableRelativePath, portablePathCollisionKey } from '../../scripts/lib/portable-path.mjs';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

export const EXIT = Object.freeze({ OK: 0, USAGE: 2, VALIDATION: 3, IO: 4, CONFORMANCE: 5 });
const json = (value) => `${JSON.stringify(value)}\n`;
const validateSchema = createSpecSchemaValidator();
const repositoryPackageName = 'llm-plugins-fusion-maintenance';

const checkProfiles = Object.freeze({
  quick: [
    ['schemas', 'scripts/validate-schemas.mjs'],
    ['frontmatter', 'scripts/lint-frontmatter.mjs'],
    ['docs', 'scripts/validate-docs.mjs'],
    ['hooks', 'scripts/validate-hooks.mjs'],
  ],
  full: [
    ['full-validation', 'scripts/validate-all.mjs'],
  ],
  security: [
    ['typecheck', 'node', 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.checkjs.json'],
    [
      'shellcheck',
      'shellcheck',
      '-x',
      '-P',
      'nova-plugin/skills/nova-codex-review-fix/scripts',
      'scripts/verify-agents.sh',
      'nova-plugin/hooks/scripts/post-audit-log.sh',
      'nova-plugin/hooks/scripts/pre-bash-check.sh',
      'nova-plugin/hooks/scripts/pre-write-check.sh',
      'nova-plugin/hooks/scripts/trusted-node-hook.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
      'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
    ],
    ['actionlint', 'actionlint'],
    ['github-workflows', 'scripts/validate-github-workflows.mjs'],
    ['distribution-risk', 'scripts/scan-distribution-risk.mjs'],
  ],
  release: [
    ['coverage', 'scripts/run-test-coverage.mjs', '--check'],
    ['maintainer-evidence', 'scripts/validate-maintainer.mjs', '--evidence-only'],
    ['install-preview', 'scripts/validate-plugin-install.mjs', '--dry-run'],
  ],
});

const generateProfiles = Object.freeze({
  docs: [
    ['diagnostics-docs', 'scripts/generate-diagnostics-docs.mjs'],
    ['command-docs', 'scripts/generate-command-docs.mjs'],
    ['prompt-surface-report', 'scripts/generate-surface-inventory.mjs', '--prompt-report'],
    ['platform-evidence', 'scripts/validate-platform-evidence.mjs'],
    ['doc-governance', 'scripts/generate-doc-governance.mjs'],
  ],
  runtime: [
    ['contract-v6', 'scripts/migrate-v6-contracts.mjs'],
    ['workflow-permissions', 'scripts/generate-workflow-permissions.mjs'],
    ['runtime-contracts', 'scripts/generate-runtime-contracts.mjs'],
    ['behavior-surfaces', 'scripts/generate-behavior-surfaces.mjs'],
    ['adapters', 'scripts/generate-adapters.mjs'],
    ['second-product', 'scripts/validate-second-product-fixture.mjs'],
    ['eval-corpus', 'scripts/generate-eval-corpus.mjs'],
  ],
  release: [
    ['registry', 'scripts/generate-registry.mjs'],
    ['surface-inventory', 'scripts/generate-surface-inventory.mjs'],
    ['compatibility-evidence', 'scripts/generate-compatibility-evidence.mjs'],
    ['workflow-surfaces', 'scripts/evaluate-workflow-surfaces.mjs'],
    ['static-contract', 'scripts/evaluate-static-contracts.mjs'],
    ['adapter-simulation', 'scripts/evaluate-adapter-simulation.mjs'],
    ['critical-mutation', 'scripts/run-critical-mutations.mjs'],
    ['quality-report', 'scripts/generate-quality-report.mjs'],
    ['project-state', 'scripts/generate-project-state.mjs'],
    ['fact-graph', 'scripts/generate-fact-graph.mjs'],
    ['release-summary', 'scripts/generate-release-summary.mjs'],
    ['task-catalog', 'scripts/generate-task-catalog.mjs'],
    ['control-plane', 'scripts/validate-control-plane-complexity.mjs'],
  ],
});

function usageError(message) {
  return Object.assign(new Error(message), { exitCode: EXIT.USAGE });
}

export function parseRepositoryCommandArgs(command, args) {
  let profile = null;
  let root = '.';
  let rootSeen = false;
  let write = false;
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root') {
      if (rootSeen) throw usageError('--root may be specified only once');
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw usageError('--root requires a value');
      root = args[index + 1];
      rootSeen = true;
      index += 1;
      continue;
    }
    if (arg === '--write') {
      if (command !== 'generate') throw usageError('--write is valid only for generate');
      if (write) throw usageError('--write may be specified only once');
      write = true;
      continue;
    }
    if (arg.startsWith('-')) throw usageError(`unknown option: ${arg}`);
    if (profile !== null) throw usageError(`unexpected argument: ${arg}`);
    profile = arg;
  }
  if (!profile) throw usageError(`${command} requires a profile`);
  const profiles = command === 'check' ? checkProfiles : generateProfiles;
  if (profile !== 'all' && !Object.hasOwn(profiles, profile)) throw usageError(`unknown ${command} profile: ${profile}`);
  if (command === 'check' && profile === 'all') throw usageError('unknown check profile: all');
  return { profile, root: resolve(root), write };
}

function repositoryRoot(root) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  } catch (error) {
    throw Object.assign(new Error(`repository root is unreadable: ${error.message}`), { exitCode: EXIT.IO });
  }
  if (manifest.name !== repositoryPackageName || manifest.private !== true) {
    throw Object.assign(new Error(`--root must select the ${repositoryPackageName} repository`), { exitCode: EXIT.IO });
  }
  return root;
}

export function repositoryProfilePlan(command, profile, { write = false } = {}) {
  const profiles = command === 'check' ? checkProfiles : generateProfiles;
  const groups = command === 'generate' && profile === 'all'
    ? ['runtime', 'docs', 'release']
    : [profile];
  return groups.flatMap((group) => profiles[group]).map(([id, runner, ...args]) => {
    if (runner === 'node') {
      return { id, command: process.execPath, args, timeoutMs: 300_000 };
    }
    if (runner === 'shellcheck' || runner === 'actionlint') {
      return { id, command: runner, args, timeoutMs: 300_000 };
    }
    return {
      id,
      command: process.execPath,
      args: [runner, ...args, ...(command === 'generate' && write ? ['--write'] : [])],
      timeoutMs: id === 'coverage' ? 360_000 : id === 'full-validation' ? 300_000 : 180_000,
    };
  });
}

async function executeRepositoryProfile(command, config, runner) {
  const tasks = [];
  for (const task of repositoryProfilePlan(command, config.profile, { write: config.write })) {
    const observed = await runner(task.id, task.command, task.args, {
      cwd: config.root,
      capture: true,
      maxOutputBytes: 65_536,
      timeoutMs: task.timeoutMs,
    });
    const summary = {
      id: task.id,
      ok: observed.ok,
      code: observed.code,
      signal: observed.signal,
      timedOut: observed.timedOut,
      ms: observed.ms,
      stdoutTruncated: observed.stdoutTruncated,
      stderrTruncated: observed.stderrTruncated,
      ...(!observed.ok ? {
        error: observed.errorMessage ?? null,
        stdout: observed.stdout,
        stderr: observed.stderr,
      } : {}),
    };
    tasks.push(summary);
    if (!observed.ok) return { passed: false, tasks, exitCode: observed.code === null ? EXIT.IO : EXIT.VALIDATION };
  }
  return { passed: true, tasks, exitCode: EXIT.OK };
}

const productCommandOptions = Object.freeze({
  help: Object.freeze({}),
  init: Object.freeze({ '--root': 'value' }),
  validate: Object.freeze({ '--root': 'value' }),
  build: Object.freeze({ '--root': 'value', '--out': 'value' }),
  test: Object.freeze({ '--root': 'value' }),
  eval: Object.freeze({ '--root': 'value' }),
  doctor: Object.freeze({ '--root': 'value' }),
  inspect: Object.freeze({ '--root': 'value' }),
  migrate: Object.freeze({ '--root': 'value', '--write': 'flag' }),
});

/** Parse every product command before any filesystem read or write. */
export function parseProductCommandArgs(command, args) {
  if (!Object.hasOwn(productCommandOptions, command)) throw usageError(`unknown command: ${command}`);
  const policy = productCommandOptions[command];
  const seen = new Set();
  const parsed = { root: resolve('.'), out: null, write: false };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (!Object.hasOwn(policy, arg)) throw usageError(`unknown ${command} option: ${arg}`);
    const kind = policy[arg];
    if (seen.has(arg)) throw usageError(`${arg} may be specified only once`);
    seen.add(arg);
    if (kind === 'flag') {
      parsed.write = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw usageError(`${arg} requires a value`);
    if (arg === '--root') parsed.root = resolve(value);
    else if (arg === '--out') parsed.out = value;
    index += 1;
  }
  if (command === 'build' && parsed.out === null) throw usageError('--out is required');
  return parsed;
}

function lstatIfPresent(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function pathInside(root, path) {
  const value = relative(root, path);
  return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value));
}

function productOutputParts(path) {
  if (
    typeof path !== 'string'
    || path.length === 0
    || isAbsolute(path)
    || posix.isAbsolute(path)
    || win32.isAbsolute(path)
    || /^[A-Za-z]:/u.test(path)
    || /\p{Cc}/u.test(path)
  ) {
    throw new Error(`product output must be a relative path inside the product root: ${path}`);
  }
  const portablePath = path.replaceAll('\\', '/');
  assertPortableRelativePath(portablePath, 'product output path');
  return portablePath.split('/');
}

function cleanupCreatedProductParents(createdParents) {
  const errors = [];
  const seen = new Set();
  for (const created of createdParents.toReversed()) {
    const key = `${created.path}:${created.dev}:${created.ino}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const stats = lstatIfPresent(created.path);
      if (!stats) continue;
      if (
        stats.isSymbolicLink()
        || !stats.isDirectory()
        || stats.dev !== created.dev
        || stats.ino !== created.ino
      ) {
        throw new Error(`created product output parent changed before cleanup: ${created.path}`);
      }
      try { rmdirSync(created.path); }
      catch (error) {
        // Treat a wrapper error after a completed removal as success. A
        // remaining or replaced path is still an incomplete cleanup.
        if (lstatIfPresent(created.path)) throw error;
      }
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

/**
 * @param {string} root
 * @param {string} requestedPath
 * @param {{createParents?: boolean, onCreateParent?: (created: {path: string, dev: number, ino: number}) => void}} [options]
 */
function resolveProductOutputLocation(root, requestedPath, {
  createParents = false,
  onCreateParent = () => {},
} = {}) {
  const productRoot = realpathSync(root);
  const rootStats = lstatSync(productRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) throw new Error('product root must be a real directory');
  const parts = productOutputParts(requestedPath);
  const parentPaths = [];
  let parent = productRoot;
  for (const part of parts.slice(0, -1)) {
    parent = resolve(parent, part);
    if (!pathInside(productRoot, parent)) throw new Error(`product output escapes the product root: ${requestedPath}`);
    parentPaths.push(parent);
    const stats = lstatIfPresent(parent);
    if (stats && (stats.isSymbolicLink() || !stats.isDirectory())) {
      throw new Error(`product output parent must be a real directory: ${requestedPath}`);
    }
    if (stats && !pathInside(productRoot, realpathSync(parent))) {
      throw new Error(`product output parent resolves outside the product root: ${requestedPath}`);
    }
  }
  const target = resolve(parent, parts.at(-1));
  if (!pathInside(productRoot, target)) throw new Error(`product output escapes the product root: ${requestedPath}`);
  const existing = lstatIfPresent(target);
  if (existing && (existing.isSymbolicLink() || !existing.isFile())) {
    throw new Error(`product output target must be a regular non-symlink file: ${requestedPath}`);
  }
  if (existing && existing.nlink !== 1) {
    throw new Error(`product output target must not be hard-linked: ${requestedPath}`);
  }
  if (createParents) {
    const createdHere = [];
    try {
      for (const path of parentPaths) {
        if (!lstatIfPresent(path)) {
          try {
            mkdirSync(path);
          } catch (error) {
            const createdStats = lstatIfPresent(path);
            if (
              createdStats
              && !createdStats.isSymbolicLink()
              && createdStats.isDirectory()
              && pathInside(productRoot, realpathSync(path))
            ) {
              const created = { path, dev: createdStats.dev, ino: createdStats.ino };
              createdHere.push(created);
              onCreateParent(created);
            }
            throw error;
          }
          const createdStats = lstatSync(path);
          const created = { path, dev: createdStats.dev, ino: createdStats.ino };
          createdHere.push(created);
          onCreateParent(created);
        }
        const stats = lstatSync(path);
        if (stats.isSymbolicLink() || !stats.isDirectory() || !pathInside(productRoot, realpathSync(path))) {
          throw new Error(`product output parent must remain a real directory inside the product root: ${requestedPath}`);
        }
      }
    } catch (error) {
      const cleanupErrors = cleanupCreatedProductParents(createdHere);
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          `product output parent creation failed and cleanup was incomplete: ${error.message}`,
        );
      }
      throw error;
    }
  }
  return { parts, productRoot, target };
}

export function resolveProductOutput(root, requestedPath, options = {}) {
  return resolveProductOutputLocation(root, requestedPath, options).target;
}

function assertProductOutputIdentity(target, expected = null) {
  const stats = lstatIfPresent(target);
  if (!stats) {
    if (expected) throw new Error(`product output changed during transaction: ${target}`);
    return null;
  }
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`product output target must remain a regular non-symlink file: ${target}`);
  }
  if (stats.nlink !== 1) throw new Error(`product output target must not be hard-linked: ${target}`);
  if (expected && (stats.dev !== expected.dev || stats.ino !== expected.ino || stats.mode !== expected.mode)) {
    throw new Error(`product output changed during transaction: ${target}`);
  }
  return stats;
}

function assertWritableProductOutput(target, expected = null) {
  const stats = assertProductOutputIdentity(target, expected);
  if (!stats) return null;
  if ((stats.mode & 0o222) === 0) throw new Error(`product output target is not writable: ${target}`);
  accessSync(target, fsConstants.W_OK);
  return stats;
}

/**
 * @param {string} root
 * @param {string} requestedPath
 * @param {{createParents?: boolean, onCreateParent?: (created: {path: string, dev: number, ino: number}) => void}} [options]
 */
function captureProductOutputBoundary(root, requestedPath, {
  createParents = false,
  onCreateParent = () => {},
} = {}) {
  const { parts, productRoot, target } = resolveProductOutputLocation(root, requestedPath, {
    createParents,
    onCreateParent,
  });
  const parentPaths = [productRoot];
  let parent = productRoot;
  for (const part of parts.slice(0, -1)) {
    parent = resolve(parent, part);
    parentPaths.push(parent);
  }
  const parents = parentPaths.map((path) => {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`product output parent must be a real directory: ${requestedPath}`);
    }
    const physicalPath = realpathSync(path);
    if (!pathInside(productRoot, physicalPath)) {
      throw new Error(`product output parent resolves outside the product root: ${requestedPath}`);
    }
    return { path, physicalPath, dev: stats.dev, ino: stats.ino };
  });
  return { productRoot, requestedPath, target, parents };
}

function assertProductOutputBoundary(boundary) {
  for (const expected of boundary.parents) {
    let stats;
    let physicalPath;
    try {
      stats = lstatSync(expected.path);
      physicalPath = realpathSync(expected.path);
    } catch (error) {
      throw new Error(`product output parent boundary changed during transaction: ${boundary.requestedPath}`, { cause: error });
    }
    if (
      stats.isSymbolicLink()
      || !stats.isDirectory()
      || stats.dev !== expected.dev
      || stats.ino !== expected.ino
      || physicalPath !== expected.physicalPath
      || !pathInside(boundary.productRoot, physicalPath)
    ) {
      throw new Error(`product output parent boundary changed during transaction: ${boundary.requestedPath}`);
    }
  }
}

function digestProductDescriptor(descriptor, label) {
  const before = fstatSync(descriptor);
  if (!before.isFile() || before.nlink !== 1) {
    throw new Error(`${label} must remain a single-link regular file`);
  }
  if (!Number.isSafeInteger(before.size) || before.size < 0) {
    throw new Error(`${label} has an unsupported size`);
  }
  const hash = createHash('sha256');
  const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, Math.max(1, before.size)));
  let position = 0;
  while (position < before.size) {
    const length = Math.min(chunk.length, before.size - position);
    const bytesRead = readSync(descriptor, chunk, 0, length, position);
    if (bytesRead <= 0) throw new Error(`${label} could not be read back completely`);
    hash.update(chunk.subarray(0, bytesRead));
    position += bytesRead;
  }
  const after = fstatSync(descriptor);
  if (
    after.dev !== before.dev
    || after.ino !== before.ino
    || after.nlink !== before.nlink
    || after.mode !== before.mode
    || after.size !== before.size
    || after.mtimeMs !== before.mtimeMs
    || after.ctimeMs !== before.ctimeMs
  ) {
    throw new Error(`${label} changed while its bytes were verified`);
  }
  return { bytes: before.size, sha256: hash.digest('hex'), stats: after };
}

function verifyProductOutputContent(target, expected, expectedBytes, expectedSha256) {
  assertWritableProductOutput(target, expected);
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  let descriptor;
  try {
    descriptor = openSync(target, fsConstants.O_RDONLY | noFollow);
    const opened = fstatSync(descriptor);
    if (!sameProductFileIdentity(opened, expected) || opened.mode !== expected.mode) {
      throw new Error(`product output changed before content verification: ${target}`);
    }
    const observed = digestProductDescriptor(descriptor, `product output ${target}`);
    const pathStats = assertWritableProductOutput(target, opened);
    if (pathStats.size !== observed.bytes
      || observed.bytes !== expectedBytes
      || observed.sha256 !== expectedSha256) {
      throw new Error(`product output content changed during transaction: ${target}`);
    }
    return pathStats;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function stageProductOutput(record) {
  const flags = fsConstants.O_RDWR
    | fsConstants.O_CREAT
    | fsConstants.O_EXCL
    | (fsConstants.O_NOFOLLOW ?? 0);
  let descriptor = null;
  let contentWriteStarted = false;
  try {
    assertProductOutputBoundary(record.boundary);
    try {
      descriptor = openSync(
        record.stage,
        flags,
        record.original ? record.original.mode & 0o777 : 0o600,
      );
    } catch (error) {
      // A wrapper can report an error after the exclusive create completed.
      // Reconcile the unique transaction path so the outer rollback can
      // remove the exact regular file instead of orphaning it.
      assertProductOutputBoundary(record.boundary);
      const created = error?.code !== 'EEXIST' ? lstatIfPresent(record.stage) : null;
      if (created && !created.isSymbolicLink() && created.isFile() && created.nlink === 1) {
        record.stageCreated = true;
        record.staged = created;
      }
      throw error;
    }
    record.stageCreated = true;
    const descriptorStats = fstatSync(descriptor);
    if (!descriptorStats.isFile() || descriptorStats.nlink !== 1) {
      throw new Error(`product output stage must be a single-link regular file: ${record.target}`);
    }
    record.staged = descriptorStats;
    const desiredMode = record.original ? record.original.mode & 0o777 : 0o600;
    fchmodSync(descriptor, desiredMode);
    const modeAdjusted = fstatSync(descriptor);
    if (!sameProductFileIdentity(modeAdjusted, descriptorStats) || (modeAdjusted.mode & 0o777) !== desiredMode) {
      throw new Error(`product output stage did not retain its intended mode: ${record.target}`);
    }
    record.staged = modeAdjusted;
    assertProductOutputBoundary(record.boundary);
    const pathStats = assertWritableProductOutput(record.stage);
    if (pathStats.dev !== modeAdjusted.dev || pathStats.ino !== modeAdjusted.ino || pathStats.mode !== modeAdjusted.mode) {
      throw new Error(`product output stage changed during transaction: ${record.target}`);
    }

    // Write through the already verified descriptor. A parent-path replacement
    // after this point cannot redirect content to a different file.
    contentWriteStarted = true;
    writeFileSync(descriptor, record.expectedContent);
    fsyncSync(descriptor);
    const completedStats = fstatSync(descriptor);
    if (completedStats.dev !== modeAdjusted.dev || completedStats.ino !== modeAdjusted.ino
      || completedStats.mode !== modeAdjusted.mode) {
      throw new Error(`product output stage changed during transaction: ${record.target}`);
    }
    const observed = digestProductDescriptor(descriptor, `product output stage ${record.target}`);
    if (observed.bytes !== record.expectedBytes || observed.sha256 !== record.expectedSha256) {
      throw new Error(`product output stage content differs from the requested bytes: ${record.target}`);
    }
    assertProductOutputBoundary(record.boundary);
    record.staged = observed.stats;
  } catch (error) {
    const cleanupErrors = [];
    if (descriptor !== null && contentWriteStarted) {
      try {
        ftruncateSync(descriptor, 0);
        fsyncSync(descriptor);
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (descriptor !== null) {
      try {
        const current = fstatSync(descriptor);
        if (current.isFile() && current.nlink === 1) record.staged = current;
      } catch {
        // Preserve the primary failure; the outer rollback will report any
        // path cleanup failure using the last verified identity.
      }
    }
    if (descriptor !== null) {
      try { closeSync(descriptor); }
      catch (cleanupError) { cleanupErrors.push(cleanupError); }
      descriptor = null;
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        `product output staging failed and partial content cleanup was incomplete: ${error.message}`,
      );
    }
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

function sameProductFileIdentity(stats, expected) {
  return Boolean(stats)
    && !stats.isSymbolicLink()
    && stats.isFile()
    && stats.nlink === 1
    && stats.dev === expected.dev
    && stats.ino === expected.ino;
}

function reconcileProductRename(source, destination, expected) {
  const sourceStats = lstatIfPresent(source);
  const destinationStats = lstatIfPresent(destination);
  if (!sourceStats && sameProductFileIdentity(destinationStats, expected)) return 'completed';
  if (sameProductFileIdentity(sourceStats, expected) && !destinationStats) return 'not-completed';
  throw new Error(`product output rename outcome is ambiguous: ${source} -> ${destination}`);
}

function attemptProductRename(renameFile, source, destination, expected) {
  let operationError = null;
  try { renameFile(source, destination); }
  catch (error) { operationError = error; }

  let outcome;
  try { outcome = reconcileProductRename(source, destination, expected); }
  catch (reconcileError) {
    if (operationError) {
      throw new AggregateError(
        [operationError, reconcileError],
        `product output rename failed with an ambiguous outcome: ${operationError.message}`,
      );
    }
    throw reconcileError;
  }
  if (outcome !== 'completed') {
    if (operationError) throw operationError;
    throw new Error(`product output rename did not complete: ${source} -> ${destination}`);
  }
  return operationError;
}

function attemptProductRemoval(removeFile, path, expected) {
  let operationError = null;
  try { removeFile(path, { force: true }); }
  catch (error) { operationError = error; }
  const remaining = lstatIfPresent(path);
  if (!remaining) return operationError;
  if (!sameProductFileIdentity(remaining, expected)) {
    const reconcileError = new Error(`product output removal outcome is ambiguous: ${path}`);
    if (operationError) {
      throw new AggregateError(
        [operationError, reconcileError],
        `product output removal failed with an ambiguous outcome: ${operationError.message}`,
      );
    }
    throw reconcileError;
  }
  if (operationError) throw operationError;
  throw new Error(`product output removal did not complete: ${path}`);
}

/**
 * Replace related generated outputs as one best-effort transaction.
 * All targets are preflighted and staged before the first original is moved.
 * Node.js has no portable openat/renameat API, so repeated physical parent
 * checks narrow and detect path races but cannot make this operation race-free.
 *
 * @param {string} root
 * @param {Array<{requestedPath: string, content: string}>} entries
 * @param {{createParents?: boolean, removeFile?: typeof rmSync, renameFile?: typeof renameSync, transactionId?: string}} [options]
 * @returns {string[]}
 */
export function writeProductOutputsAtomically(root, entries, {
  createParents = false,
  removeFile = rmSync,
  renameFile = renameSync,
  transactionId = randomUUID(),
} = {}) {
  if (!/^[A-Za-z0-9._-]+$/u.test(transactionId)) throw new Error('product output transaction id is not portable');
  const collisionKeys = new Map();
  const planned = entries.map(({ requestedPath, content }, index) => {
    if (typeof content !== 'string') throw new TypeError('product output content must be a string');
    const portablePath = productOutputParts(requestedPath).join('/');
    const collisionKey = portablePathCollisionKey(portablePath);
    const prior = collisionKeys.get(collisionKey);
    if (prior) throw new Error(`product output transaction contains a portable path collision: ${prior} and ${portablePath}`);
    collisionKeys.set(collisionKey, portablePath);
    const location = resolveProductOutputLocation(root, requestedPath, { createParents: false });
    const original = assertWritableProductOutput(location.target);
    const prefix = `${location.target}.llmf-txn-${transactionId}-${index}`;
    const stage = `${prefix}.stage`;
    const backup = `${prefix}.backup`;
    const portablePrefix = `${portablePath}.llmf-txn-${transactionId}-${index}`;
    if (lstatIfPresent(stage) || lstatIfPresent(backup)) {
      throw new Error(`product output transaction temporary path already exists: ${location.target}`);
    }
    return {
      requestedPath,
      portablePath,
      collisionKey,
      content,
      target: location.target,
      original,
      stage,
      backup,
      stagePortablePath: `${portablePrefix}.stage`,
      backupPortablePath: `${portablePrefix}.backup`,
    };
  });
  const targets = new Set(planned.map(({ target }) => target));
  if (targets.size !== planned.length) throw new Error('product output transaction contains duplicate targets');
  for (let leftIndex = 0; leftIndex < planned.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < planned.length; rightIndex += 1) {
      const left = planned[leftIndex];
      const right = planned[rightIndex];
      if (
        left.collisionKey.startsWith(`${right.collisionKey}/`)
        || right.collisionKey.startsWith(`${left.collisionKey}/`)
      ) {
        throw new Error(`product output transaction contains an ancestor path collision: ${left.portablePath} and ${right.portablePath}`);
      }
    }
  }
  const transactionNamespace = planned.flatMap((entry) => [
    { kind: 'target', path: entry.portablePath, key: entry.collisionKey },
    { kind: 'stage', path: entry.stagePortablePath, key: portablePathCollisionKey(entry.stagePortablePath) },
    { kind: 'backup', path: entry.backupPortablePath, key: portablePathCollisionKey(entry.backupPortablePath) },
  ]);
  for (let leftIndex = 0; leftIndex < transactionNamespace.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < transactionNamespace.length; rightIndex += 1) {
      const left = transactionNamespace[leftIndex];
      const right = transactionNamespace[rightIndex];
      if (
        left.key === right.key
        || left.key.startsWith(`${right.key}/`)
        || right.key.startsWith(`${left.key}/`)
      ) {
        throw new Error(`product output transaction contains a temporary namespace collision: ${left.path} and ${right.path}`);
      }
    }
  }

  // Resolve every target and reject all currently observable conflicts before
  // creating a parent for any entry.
  const records = [];
  const createdParents = [];

  try {
    for (const { requestedPath, content, original: plannedOriginal, stage, backup } of planned) {
      const boundary = captureProductOutputBoundary(root, requestedPath, {
        createParents,
        onCreateParent(created) { createdParents.push(created); },
      });
      const { target } = boundary;
      assertProductOutputBoundary(boundary);
      const original = plannedOriginal
        ? assertWritableProductOutput(target, plannedOriginal)
        : assertWritableProductOutput(target);
      if (plannedOriginal === null && original !== null) {
        throw new Error(`product output changed during transaction: ${target}`);
      }
      const record = {
        boundary,
        target,
        content,
        expectedContent: Buffer.from(content, 'utf8'),
        expectedBytes: Buffer.byteLength(content, 'utf8'),
        expectedSha256: createHash('sha256').update(content, 'utf8').digest('hex'),
        original,
        stage,
        backup,
        stageCreated: false,
        backupMoved: false,
        installed: false,
        staged: null,
      };
      if (lstatIfPresent(record.stage) || lstatIfPresent(record.backup)) {
        throw new Error(`product output transaction temporary path already exists: ${target}`);
      }
      records.push(record);
    }
    for (const record of records) {
      stageProductOutput(record);
    }
    for (const record of records) {
      assertProductOutputBoundary(record.boundary);
      verifyProductOutputContent(
        record.stage,
        record.staged,
        record.expectedBytes,
        record.expectedSha256,
      );
      if (record.original) {
        assertWritableProductOutput(record.target, record.original);
        if (lstatIfPresent(record.backup)) {
          throw new Error(`product output transaction backup path appeared during commit: ${record.target}`);
        }
        const renameError = attemptProductRename(
          renameFile,
          record.target,
          record.backup,
          record.original,
        );
        record.backupMoved = true;
        if (renameError) throw renameError;
        assertProductOutputBoundary(record.boundary);
        assertWritableProductOutput(record.backup, record.original);
      } else if (lstatIfPresent(record.target)) {
        throw new Error(`product output changed during transaction: ${record.target}`);
      }
      assertProductOutputBoundary(record.boundary);
      verifyProductOutputContent(
        record.stage,
        record.staged,
        record.expectedBytes,
        record.expectedSha256,
      );
      const renameError = attemptProductRename(
        renameFile,
        record.stage,
        record.target,
        record.staged,
      );
      record.installed = true;
      record.stageCreated = false;
      if (renameError) throw renameError;
      assertProductOutputBoundary(record.boundary);
      verifyProductOutputContent(
        record.target,
        record.staged,
        record.expectedBytes,
        record.expectedSha256,
      );
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const record of records.toReversed()) {
      let boundarySafe = true;
      try {
        assertProductOutputBoundary(record.boundary);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
        boundarySafe = false;
      }
      if (!boundarySafe) continue;
      if (record.installed) {
        try {
          assertWritableProductOutput(record.target, record.staged);
          attemptProductRemoval(removeFile, record.target, record.staged);
          record.installed = false;
          assertProductOutputBoundary(record.boundary);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (record.backupMoved && !record.installed) {
        try {
          assertWritableProductOutput(record.backup, record.original);
          if (lstatIfPresent(record.target)) {
            throw new Error(`product output rollback refuses to replace a newly appeared target: ${record.target}`);
          }
          attemptProductRename(renameFile, record.backup, record.target, record.original);
          record.backupMoved = false;
          assertProductOutputBoundary(record.boundary);
          assertWritableProductOutput(record.target, record.original);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (record.stageCreated) {
        try {
          const staged = assertProductOutputIdentity(record.stage, record.staged);
          attemptProductRemoval(removeFile, record.stage, staged);
          record.stageCreated = false;
          assertProductOutputBoundary(record.boundary);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    rollbackErrors.push(...cleanupCreatedProductParents(createdParents));
    if (rollbackErrors.length) {
      throw new AggregateError([error, ...rollbackErrors], `product output transaction failed and rollback was incomplete: ${error.message}`);
    }
    throw error;
  }

  const cleanupErrors = [];
  for (const record of records) {
    if (!record.backupMoved) continue;
    try {
      assertProductOutputBoundary(record.boundary);
      assertWritableProductOutput(record.backup, record.original);
      attemptProductRemoval(removeFile, record.backup, record.original);
      record.backupMoved = false;
      assertProductOutputBoundary(record.boundary);
    }
    catch (error) { cleanupErrors.push(error); }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      `product outputs were committed but transaction cleanup was incomplete: ${cleanupErrors[0].message}`,
    );
  }
  return records.map(({ target }) => target);
}

function ensureInitRoot(root) {
  const absolute = resolve(root);
  const missing = [];
  let ancestor = absolute;
  while (!lstatIfPresent(ancestor)) {
    missing.unshift(basename(ancestor));
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error(`initialization root has no existing parent: ${root}`);
    ancestor = parent;
  }
  const ancestorStats = lstatSync(ancestor);
  if (ancestorStats.isSymbolicLink() || !ancestorStats.isDirectory()) {
    throw new Error('initialization root parent must be a real directory');
  }
  let current = realpathSync(ancestor);
  for (const component of missing) {
    const parentStats = lstatSync(current);
    if (parentStats.isSymbolicLink() || !parentStats.isDirectory()) {
      throw new Error('initialization root parent changed while it was created');
    }
    const next = resolve(current, component);
    mkdirSync(next);
    const nextStats = lstatSync(next);
    if (nextStats.isSymbolicLink() || !nextStats.isDirectory() || realpathSync(next) !== next) {
      throw new Error('initialization root must remain a real directory');
    }
    const parentAfter = lstatSync(current);
    if (parentAfter.dev !== parentStats.dev || parentAfter.ino !== parentStats.ino) {
      throw new Error('initialization root parent changed while it was created');
    }
    current = next;
  }
  return current;
}

function init(root, outputTransactionOptions = {}) {
  ensureInitRoot(root);
  const adaptersRoot = resolve(root, 'adapters');
  try {
    const adapters = lstatSync(adaptersRoot);
    if (adapters.isSymbolicLink() || !adapters.isDirectory()) {
      throw new Error('initialization adapters target must be a real directory');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const files = {
    'framework.json': { schemaVersion: 4, permissionStates: ['denied', 'prompt', 'preapproved', 'unsupported', 'explicit'], permissionPolicyKeys: ['workspaceRead', 'workspaceWrite', 'shell', 'network', 'credentials', 'userScopeMutation', 'externalPublish', 'gitHistoryMutation'], riskLevels: ['none', 'low', 'medium', 'high'], runtimeNeedLevels: ['none', 'optional', 'required'], credentialSources: ['none', 'assistant-owned-authentication', 'consumer-owned-authentication'], enforcementLevels: ['native-and-hook', 'adapter', 'advisory', 'unsupported'] },
    'product.json': { schemaVersion: 2, pluginNamespace: 'example-flow', expectedWorkflowCount: 1, stages: ['intake'], primaryEntrypoints: ['triage'], runtimeCompatibility: { 'example-host': '1.0.0' }, automaticRouting: { identity: 'canonical-surface-plus-variant-parameters', canonicalTargets: ['triage'], compatibilityAliases: 'excluded' }, adapterDefinitions: ['adapters/example.json'], agents: ['coordinator'], packs: [], tools: ['Inspect'] },
    'workflows.json': { schemaVersion: 5, contractVersions: { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' }, permissionProfiles: { inspect: { allowedTools: ['Inspect'], disallowedTools: [], permissionPolicy: { workspaceRead: 'preapproved', workspaceWrite: 'denied', shell: 'denied', network: 'denied', credentials: 'denied', userScopeMutation: 'denied', externalPublish: 'denied', gitHistoryMutation: 'denied' } } }, workflows: [{ id: 'triage', stage: 'intake', ownerAgents: ['coordinator'], recommendedPacks: [], requiredInputs: ['REQUEST'], outputContract: 'triage-v1', risk: 'none', modelInvocable: true, subagentSafe: true, permissionProfile: 'inspect', legacyAlias: 'example-triage', contractPath: 'contracts/triage.md', canonicalSurfaceId: 'triage', variantPreset: {}, compatibilityAlias: false }] },
    'behaviors.json': { schemaVersion: 1, behaviors: [{ id: 'triage', purpose: 'Triage a request.', inputs: [{ name: 'REQUEST', required: true, aliases: [], description: 'Request.' }], decisionTable: [{ when: 'REQUEST exists.', action: 'Triage it.' }], invariants: ['No writes.'], stopConditions: ['REQUEST missing.'], workflowSteps: [{ id: 'triage', action: 'Triage.' }], deviationPolicy: { mode: 'forbid', instructions: 'No deviation.' }, output: { mode: 'chat', fields: [{ name: 'next step', required: true, description: 'Next step.' }], order: ['next step'], severityLevels: [] }, validation: ['One next step.'], failureOutput: { fields: ['status'], order: ['status'] } }] },
    'adapters/example.json': { schemaVersion: 1, id: 'example', enforcement: 'advisory', declaredLevel: 'L1', maximumSupportedLevel: 'L2', invocation: { kind: 'contract-manifest', prefix: 'example:' }, evidenceRequiredFor: ['L2'] },
  };
  const existing = Object.keys(files).filter((path) => {
    try { lstatSync(resolve(root, path)); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  });
  if (existing.length) throw new Error(`initialization target already exists: ${existing.sort().join(', ')}`);
  writeProductOutputsAtomically(
    root,
    Object.entries(files).map(([requestedPath, value]) => ({
      requestedPath,
      content: `${JSON.stringify(value, null, 2)}\n`,
    })),
    { createParents: true, ...outputTransactionOptions },
  );
  return { files: Object.keys(files).sort() };
}

export async function runCli(args, io = process, { runner = runProcess, outputTransactionOptions = {} } = {}) {
  const command = ['--help', '-h'].includes(args[0]) ? 'help' : args[0];
  if (!['help', 'init', 'validate', 'build', 'test', 'eval', 'doctor', 'inspect', 'migrate', 'check', 'generate'].includes(command)) return { exitCode: EXIT.USAGE, output: { ok: false, command: command ?? null, error: 'unknown-command' } };
  try {
    const repositoryConfig = ['check', 'generate'].includes(command)
      ? parseRepositoryCommandArgs(command, args)
      : null;
    const productConfig = repositoryConfig ? null : parseProductCommandArgs(command, args);
    const root = repositoryConfig
      ? repositoryRoot(repositoryConfig.root)
      : productConfig.root;
    let result;
    if (command === 'help') result = {
      usage: 'llmf <command> [--root <path>] [options]',
      commands: {
        init: 'create a minimal product specification',
        validate: 'compile and validate product conformance',
        build: 'write a compiled artifact with --out <path>',
        test: 'run deterministic conformance checks',
        eval: 'evaluate the compiled bundle',
        doctor: 'report local runtime support',
        inspect: 'summarize the loaded specification',
        migrate: 'preview or write Contract v6/v2 projections',
        check: 'run repository checks: quick, full, security, or release',
        generate: 'check or write repository projections: docs, runtime, release, or all',
      },
      exitCodes: EXIT,
    };
    else if (command === 'check' || command === 'generate') {
      const execution = await executeRepositoryProfile(command, { ...repositoryConfig, root }, runner);
      const repositoryResult = {
        profile: repositoryConfig.profile,
        ...(command === 'generate' ? { write: repositoryConfig.write } : {}),
        passed: execution.passed,
        tasks: execution.tasks,
      };
      if (!execution.passed) return { exitCode: execution.exitCode, output: { ok: false, command, result: repositoryResult } };
      result = repositoryResult;
    }
    else if (command === 'init') result = init(root, outputTransactionOptions);
    else if (command === 'doctor') {
      const supported = Number(process.versions.node.split('.')[0]) >= 22;
      const registry = loadReasonRegistry();
      result = diagnosticReport('llmf doctor', [diagnosticResult({ command: 'llmf doctor', check: 'node-version', status: supported ? 'passed' : 'failed', reasonCode: supported ? 'CHECK_PASSED' : 'NODE_VERSION_UNSUPPORTED', expected: '>=22', actual: process.versions.node }, registry)]);
    }
    else if (command === 'validate') { const compiled = compileDirectory(root, { validateSchema }); const conformance = testConformance(compiled); if (!conformance.passed) return { exitCode: EXIT.VALIDATION, output: { ok: false, command, result: conformance } }; result = { valid: true, ...inspectSpecBundle(compiled) }; }
    else if (command === 'inspect') result = inspectSpecBundle(validateAndLoadSpecBundle(root, { validateSchema }));
    else if (command === 'test') { result = testConformance(compileDirectory(root, { validateSchema })); if (!result.passed) return { exitCode: EXIT.CONFORMANCE, output: { ok: false, command, result } }; }
    else if (command === 'eval') result = evaluateBundle(compileDirectory(root, { validateSchema }));
    else if (command === 'build') { const artifact = buildArtifact(compileDirectory(root, { validateSchema })); const [output] = writeProductOutputsAtomically(root, [{ requestedPath: productConfig.out, content: `${JSON.stringify(artifact, null, 2)}\n` }], { ...outputTransactionOptions, createParents: true }); result = { output, workflowCount: artifact.workflows.length }; }
    else if (command === 'migrate') { const bundle = validateAndLoadSpecBundle(root, { validateSchema }); const workflows = migrateWorkflowSpec(bundle.workflows, bundle.behaviors); const behaviors = migrateBehaviorSpec(bundle.behaviors); if (productConfig.write) { writeProductOutputsAtomically(root, [{ requestedPath: 'workflows.v6.json', content: `${JSON.stringify(workflows, null, 2)}\n` }, { requestedPath: 'behaviors.v2.json', content: `${JSON.stringify(behaviors, null, 2)}\n` }], { ...outputTransactionOptions, createParents: false }); } result = { write: productConfig.write, workflowCount: workflows.workflows.length, workflowSchemaVersion: 6, behaviorSchemaVersion: 2 }; }
    return { exitCode: EXIT.OK, output: { ok: true, command, result } };
  } catch (error) {
    const failure = /** @type {Error & { exitCode?: number }} */ (error);
    const specValidationFailure = failure instanceof SpecBundleError && (failure.code === SPEC_ERROR.SCHEMA || failure.code === SPEC_ERROR.INVARIANT);
    return { exitCode: failure.exitCode ?? (failure instanceof SyntaxError || specValidationFailure ? EXIT.VALIDATION : EXIT.IO), output: { ok: false, command, error: failure.message } };
  }
}

export async function main(args = process.argv.slice(2), io = process) {
  const result = await runCli(args, io);
  (result.exitCode === 0 ? io.stdout : io.stderr).write(json(result.output));
  return result.exitCode;
}
