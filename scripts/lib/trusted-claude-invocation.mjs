/** Resolve one physical Claude invocation without executable PATH ambiguity. */

import {
  accessSync,
  closeSync,
  constants,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from 'node:fs';
import { delimiter, dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveExecutableInvocation } from './process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '../..');

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function pathInsideForPlatform(rootPath, candidatePath, platform = process.platform) {
  const pathApi = platform === 'win32' ? win32 : { isAbsolute, relative, sep };
  const relPath = pathApi.relative(rootPath, candidatePath);
  return relPath === '' || (relPath !== '..' && !relPath.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relPath));
}

export function sanitizeIsolatedExecutablePath(pathValue, {
  workspaceRoot = root,
  platform = process.platform,
} = {}) {
  if (typeof pathValue !== 'string' || pathValue.length === 0) {
    throw new Error('isolated install environment requires PATH');
  }
  const separator = platform === 'win32' ? ';' : delimiter;
  const pathApi = platform === 'win32' ? win32 : { isAbsolute, resolve };
  const lexicalWorkspace = pathApi.resolve(workspaceRoot);
  const physicalWorkspace = realpathSync.native(workspaceRoot);
  const safeEntries = [];
  for (const rawEntry of pathValue.split(separator)) {
    if (!rawEntry) throw new Error('isolated install PATH must not contain empty entries');
    if (!pathApi.isAbsolute(rawEntry)) throw new Error(`isolated install PATH entries must be absolute: ${rawEntry}`);
    const lexicalEntry = pathApi.resolve(rawEntry);
    if (pathInsideForPlatform(lexicalWorkspace, lexicalEntry, platform)) {
      throw new Error(`isolated install PATH must not include the repository: ${rawEntry}`);
    }
    const lexicalStats = lstatIfPresent(lexicalEntry);
    if (!lexicalStats) continue;
    let physicalEntry;
    try {
      physicalEntry = realpathSync.native(lexicalEntry);
    } catch (error) {
      throw new Error(`isolated install PATH entry is unreadable: ${rawEntry}`, { cause: error });
    }
    const physicalStats = lstatSync(physicalEntry);
    if (!physicalStats.isDirectory() || physicalStats.isSymbolicLink()) {
      throw new Error(`isolated install PATH entry must resolve to a physical directory: ${rawEntry}`);
    }
    if (pathInsideForPlatform(physicalWorkspace, physicalEntry, platform)) {
      throw new Error(`isolated install PATH must not resolve inside the repository: ${rawEntry}`);
    }
    if (!safeEntries.includes(physicalEntry)) safeEntries.push(physicalEntry);
  }
  if (safeEntries.length === 0) throw new Error('isolated install PATH contains no existing physical directories');
  return safeEntries.join(separator);
}

function captureInvocationFile(path, label, { workspaceRoot = root, executable = false, platform = process.platform } = {}) {
  const physicalPath = realpathSync.native(path);
  const stats = lstatSync(physicalPath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
    throw new Error(`${label} must resolve to a single-link physical file`);
  }
  if (executable) accessSync(physicalPath, constants.X_OK);
  const physicalWorkspace = realpathSync.native(workspaceRoot);
  if (pathInsideForPlatform(physicalWorkspace, physicalPath, platform)) {
    throw new Error(`${label} must resolve outside the repository`);
  }
  return Object.freeze({
    path: physicalPath,
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    ctimeMs: stats.ctimeMs,
  });
}

function assertInvocationFile(identity, label) {
  const stats = lstatSync(identity.path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1
    || stats.dev !== identity.dev || stats.ino !== identity.ino || stats.mode !== identity.mode
    || stats.size !== identity.size || stats.mtimeMs !== identity.mtimeMs || stats.ctimeMs !== identity.ctimeMs
    || realpathSync.native(identity.path) !== identity.path) {
    throw new Error(`${label} changed after its trusted invocation was resolved`);
  }
}

function readExecutableShebang(path) {
  const descriptor = openSync(path, 'r');
  try {
    const prefix = Buffer.alloc(512);
    const bytesRead = readSync(descriptor, prefix, 0, prefix.length, 0);
    if (bytesRead < 2 || prefix[0] !== 0x23 || prefix[1] !== 0x21) return null;
    const newline = prefix.subarray(0, bytesRead).indexOf(0x0a);
    if (newline === -1 && bytesRead === prefix.length) {
      throw new Error('Claude executable shebang exceeds the trusted parser limit');
    }
    const line = prefix.subarray(0, newline === -1 ? bytesRead : newline).toString('utf8').replace(/\r$/u, '');
    const match = /^#![\t ]*(\/[^\t ]+)(?:[\t ]+([^\t ].*?))?[\t ]*$/u.exec(line);
    if (!match) throw new Error('Claude executable has an unsupported shebang');
    return { interpreter: match[1], argument: match[2] ?? null };
  } finally {
    closeSync(descriptor);
  }
}

function isNodeInterpreter(path) {
  return /(?:^|\/)(?:node|nodejs)$/u.test(path);
}

export function resolveTrustedClaudeInvocation({
  env = process.env,
  workspaceRoot = root,
  platform = process.platform,
  nodeExecutable = process.execPath,
} = {}) {
  let resolved;
  if (platform === 'win32') {
    resolved = resolveExecutableInvocation('claude', { platform, env, nodeExecutable });
  } else {
    const candidate = String(env.PATH ?? '').split(delimiter)
      .map((entry) => resolve(entry, 'claude'))
      .find((path) => {
        const stats = lstatIfPresent(path);
        if (!stats) return false;
        try { accessSync(path, constants.X_OK); return stats.isFile() || stats.isSymbolicLink(); }
        catch { return false; }
      });
    if (!candidate) throw new Error('claude is unavailable on the isolated executable PATH');
    resolved = { command: candidate, argsPrefix: [], resolutionKind: 'posix-physical-executable' };
  }
  const selectedIdentity = captureInvocationFile(resolved.command, 'Claude executable', {
    workspaceRoot, executable: true, platform,
  });
  const argsPrefix = [...resolved.argsPrefix];
  const supportingFiles = [];
  let commandIdentity = selectedIdentity;
  if (resolved.resolutionKind === 'windows-node-shim') {
    const scriptIdentity = captureInvocationFile(argsPrefix[0], 'Claude Node shim target', { workspaceRoot, platform });
    argsPrefix[0] = scriptIdentity.path;
    supportingFiles.push(scriptIdentity);
  } else if (platform !== 'win32') {
    const shebang = readExecutableShebang(selectedIdentity.path);
    if (shebang) {
      const envNode = shebang.interpreter === '/usr/bin/env' && shebang.argument === 'node';
      const directNode = isNodeInterpreter(shebang.interpreter) && shebang.argument === null;
      if (!envNode && !directNode) {
        throw new Error(`Claude executable has an unsupported shebang interpreter: ${shebang.interpreter}`);
      }
      commandIdentity = captureInvocationFile(nodeExecutable, 'Claude Node interpreter', {
        workspaceRoot, executable: true, platform,
      });
      argsPrefix.unshift(selectedIdentity.path);
      supportingFiles.push(selectedIdentity);
      resolved = { ...resolved, resolutionKind: 'posix-node-script' };
    }
  }
  return Object.freeze({
    command: commandIdentity.path,
    argsPrefix: Object.freeze(argsPrefix),
    resolutionKind: resolved.resolutionKind,
    commandIdentity,
    supportingFiles: Object.freeze(supportingFiles),
  });
}

export function assertTrustedClaudeInvocation(invocation) {
  if (!invocation?.commandIdentity || invocation.command !== invocation.commandIdentity.path) {
    throw new Error('trusted Claude invocation is incomplete');
  }
  assertInvocationFile(invocation.commandIdentity, 'Claude executable');
  for (const identity of invocation.supportingFiles ?? []) assertInvocationFile(identity, 'Claude invocation support file');
  return invocation;
}
