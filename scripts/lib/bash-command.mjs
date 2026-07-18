import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export function resolveBashCommand(platform = process.platform, env = process.env) {
  if (platform !== 'win32') return env.NOVA_BASH_BIN || 'bash';
  const candidates = [
    env.NOVA_BASH_BIN,
    env.ProgramFiles ? `${env.ProgramFiles}\\Git\\bin\\bash.exe` : null,
    env.ProgramFiles ? `${env.ProgramFiles}\\Git\\usr\\bin\\bash.exe` : null,
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe` : null,
  ].filter((candidate) => typeof candidate === 'string');
  return candidates.find((candidate) => existsSync(candidate)) ?? 'bash';
}

export function resolveExecutableOnPath(command, {
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
} = {}) {
  const names = [];
  if (isAbsolute(command)) names.push(command);
  else if (platform === 'win32') {
    const lower = command.toLowerCase();
    names.push(lower.endsWith('.exe') ? command : `${command}.exe`);
  } else names.push(command);
  const roots = isAbsolute(command) ? [''] : String(env.PATH ?? '').split(delimiter);
  for (const root of roots) {
    for (const name of names) {
      const lexical = isAbsolute(name) ? resolve(name) : resolve(cwd, root || '.', name);
      try {
        if (!statSync(lexical).isFile()) continue;
        accessSync(lexical, constants.X_OK);
        return { lexical, physical: realpathSync.native(lexical) };
      } catch { /* continue through the executable search path */ }
    }
  }
  return null;
}

export function pathIdentityInside(root, candidate) {
  const candidateValue = resolve(candidate).toLowerCase();
  const rootValues = [resolve(root)];
  try { rootValues.push(realpathSync.native(root)); } catch { /* caller reports missing roots elsewhere */ }
  return rootValues.some((value) => {
    const rootValue = value.toLowerCase();
    return candidateValue === rootValue || candidateValue.startsWith(`${rootValue}${sep}`);
  });
}

function pathInside(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
}

export function projectFreeExecutablePath(projectRoot, {
  env = process.env,
  nodeExecutable = process.execPath,
} = {}) {
  const lexicalProjectRoot = resolve(projectRoot);
  const physicalProjectRoot = realpathSync.native(lexicalProjectRoot);
  const nodeDirectory = dirname(realpathSync.native(nodeExecutable));
  const pathValue = process.platform === 'win32' ? (env.Path ?? env.PATH ?? '') : (env.PATH ?? '');
  const safeEntries = [];
  for (const entry of [nodeDirectory, ...String(pathValue).split(delimiter)]) {
    if (!entry || !isAbsolute(entry)) continue;
    const lexicalEntry = resolve(entry);
    let physicalEntry;
    try {
      physicalEntry = realpathSync.native(lexicalEntry);
      if (!statSync(physicalEntry).isDirectory()) continue;
    } catch {
      continue;
    }
    if (pathInside(lexicalProjectRoot, lexicalEntry) || pathInside(physicalProjectRoot, physicalEntry)) continue;
    if (!safeEntries.includes(physicalEntry)) safeEntries.push(physicalEntry);
  }
  if (safeEntries.length === 0) throw new Error('no executable PATH directory remains outside the project');
  return safeEntries.join(delimiter);
}

export function trustedHookBashIdentity(projectRoot, env = process.env, writableRoots = []) {
  const untrustedRoots = [projectRoot, ...writableRoots];
  for (const entry of String(env.PATH ?? '').split(delimiter)) {
    if (!entry || !isAbsolute(entry)) {
      return { trusted: false, identity: null, reason: 'PATH contains an empty or relative entry that can resolve inside the writable project' };
    }
    const lexicalEntry = resolve(entry);
    let physicalEntry = lexicalEntry;
    try { physicalEntry = realpathSync.native(lexicalEntry); } catch { /* a missing external entry cannot currently contain bash */ }
    if (untrustedRoots.some((root) => pathIdentityInside(root, lexicalEntry) || pathIdentityInside(root, physicalEntry))) {
      return { trusted: false, identity: null, reason: 'PATH contains an entry inside an agent-writable root' };
    }
  }
  const identity = resolveExecutableOnPath('bash', { cwd: projectRoot, env });
  if (!identity) return { trusted: false, identity: null, reason: 'bash is not resolvable as a real executable on PATH' };
  if (untrustedRoots.some((root) => pathIdentityInside(root, identity.lexical) || pathIdentityInside(root, identity.physical))) {
    return { trusted: false, identity, reason: 'bash resolves inside an agent-writable root' };
  }
  return { trusted: true, identity, reason: null };
}

export function pathForBash(value, command = resolveBashCommand(), platform = process.platform) {
  if (platform !== 'win32') return value;
  const match = value.match(/^([A-Za-z]):[\\/](.*)$/u);
  if (!match) return value.replaceAll('\\', '/');
  const drive = match[1].toLowerCase();
  const rest = match[2].replaceAll('\\', '/');
  return /Git[\\/](?:bin|usr[\\/]bin)[\\/]bash\.exe$/iu.test(command)
    ? `/${drive}/${rest}`
    : `/mnt/${drive}/${rest}`;
}
