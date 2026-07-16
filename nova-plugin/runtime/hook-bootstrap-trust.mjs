import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const MAX_SETTINGS_BYTES = 1024 * 1024;
const PROJECT_SETTINGS_NAMES = Object.freeze([
  '.claude/settings.json',
  '.claude/settings.local.json',
]);

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function controlsHookTrust(name) {
  const key = name.toUpperCase();
  return key === 'PATH'
    || key === 'PATHEXT'
    || key === 'BASH_ENV'
    || key === 'ENV'
    || key === 'NODE_OPTIONS'
    || key === 'PAGER'
    || key === 'RIPGREP_CONFIG_PATH'
    || key === 'HOME'
    || key === 'USERPROFILE'
    || key === 'XDG_STATE_HOME'
    || key === 'TMPDIR'
    || key === 'TMP'
    || key === 'TEMP'
    || key.startsWith('NOVA_')
    || key.startsWith('CLAUDE_')
    || key.startsWith('GIT_')
    || key.startsWith('BASH_FUNC_');
}

function pathInside(root, target) {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function inspectProjectHookSettings(projectRoot) {
  const findings = [];
  const lexicalRoot = resolve(projectRoot);
  let physicalRoot;
  try {
    physicalRoot = realpathSync.native(lexicalRoot);
  } catch (error) {
    return { trusted: false, findings: [`project root cannot be resolved: ${error.message}`], reason: `project root cannot be resolved: ${error.message}` };
  }
  for (const relativePath of PROJECT_SETTINGS_NAMES) {
    const target = resolve(lexicalRoot, relativePath);
    let fileStat;
    try {
      fileStat = lstatSync(target);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      findings.push(`${relativePath} cannot be inspected: ${error.message}`);
      continue;
    }
    const settingsParent = resolve(lexicalRoot, '.claude');
    let parentStat;
    try {
      parentStat = lstatSync(settingsParent);
      const physicalTarget = realpathSync.native(target);
      if (parentStat.isSymbolicLink() || !parentStat.isDirectory() || !pathInside(physicalRoot, physicalTarget)) {
        findings.push(`${relativePath} has a symlinked, junction, or outside-project parent`);
        continue;
      }
    } catch (error) {
      findings.push(`${relativePath} parent containment cannot be verified: ${error.message}`);
      continue;
    }
    if (fileStat.isSymbolicLink() || !fileStat.isFile() || statSync(target).nlink !== 1) {
      findings.push(`${relativePath} must be a single-link regular file`);
      continue;
    }
    if (fileStat.size > MAX_SETTINGS_BYTES) {
      findings.push(`${relativePath} exceeds the ${MAX_SETTINGS_BYTES}-byte trust-preflight limit`);
      continue;
    }
    let settings;
    try {
      settings = JSON.parse(readFileSync(target, 'utf8'));
    } catch (error) {
      findings.push(`${relativePath} is not valid JSON: ${error.message}`);
      continue;
    }
    if (!plainObject(settings)) {
      findings.push(`${relativePath} must contain a JSON object`);
      continue;
    }
    if (settings.disableAllHooks === true) {
      findings.push(`${relativePath} sets disableAllHooks=true`);
    } else if (settings.disableAllHooks !== undefined && typeof settings.disableAllHooks !== 'boolean') {
      findings.push(`${relativePath} has a non-boolean disableAllHooks value`);
    }
    if (settings.env !== undefined && !plainObject(settings.env)) {
      findings.push(`${relativePath} has a non-object env value`);
      continue;
    }
    const controlled = Object.keys(settings.env ?? {}).filter(controlsHookTrust).sort();
    if (controlled.length > 0) {
      findings.push(`${relativePath} sets hook-trust environment keys: ${controlled.join(', ')}`);
    }
  }
  return {
    trusted: findings.length === 0,
    findings,
    reason: findings.length === 0 ? null : findings.join('; '),
  };
}
