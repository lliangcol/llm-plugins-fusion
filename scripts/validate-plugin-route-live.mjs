#!/usr/bin/env node
/** Run one OAuth-authenticated, read-only namespaced route invocation. */

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixedPrompt = '/nova-plugin:route REQUEST="Review a public README change before editing and recommend the next workflow." DEPTH=brief';
export const routeAllowedTools = Object.freeze([
  'Skill(nova-plugin:route)',
  'Skill(nova-plugin:nova-route)',
]);
export const routeDisallowedTools = Object.freeze(['Write', 'Edit', 'NotebookEdit', 'Bash']);
const competingCredentialVariables = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fieldValue(result, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = result.match(new RegExp(`^\\s*(?:[-*]\\s*)?${escaped}\\s*(.+?)\\s*$`, 'mi'));
  if (!match) throw new Error(`route output is missing ${label}`);
  return match[1].replaceAll('`', '').trim();
}

function validateInventoryField(value, allowedValues, label) {
  const connectors = new Set(['and', 'or', 'then', 'plus']);
  const tokens = (value.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [])
    .filter((token) => !connectors.has(token));
  if (tokens.length === 0) throw new Error(`route output ${label} is empty`);
  const invalid = tokens.filter((token) => !allowedValues.has(token));
  if (invalid.length) throw new Error(`route output invented ${label}: ${[...new Set(invalid)].join(', ')}`);
  return [...new Set(tokens)].sort();
}

export function loadRouteInventory(pluginDir, permissionSpec) {
  const agents = readdirSync(resolve(pluginDir, 'agents'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
  const packs = readdirSync(resolve(pluginDir, 'packs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return {
    commandIds: [...permissionSpec.expectedInventory.commandIds],
    skillNames: [...permissionSpec.expectedInventory.skillNames],
    agents,
    packs,
  };
}

export function validateRouteResult(result, routeInventory) {
  const requiredFields = [
    'Command:',
    'Skill:',
    'Core agent:',
    'Capability packs:',
    'Required inputs:',
    'Validation expectations:',
    'Fallback path:',
  ];
  if (!/## Recommended Route/.test(result)) {
    throw new Error('route output is missing "## Recommended Route"');
  }
  for (const field of requiredFields) {
    if (!result.includes(field)) throw new Error(`route output is missing ${field}`);
  }
  const commandField = fieldValue(result, 'Command:');
  const skillField = fieldValue(result, 'Skill:');
  const agentField = fieldValue(result, 'Core agent:');
  const packField = fieldValue(result, 'Capability packs:');
  const commandMatches = [...result.matchAll(/\/nova-plugin:([a-z0-9]+(?:-[a-z0-9]+)*)/g)]
    .map((match) => match[1]);
  if (commandMatches.length === 0) throw new Error('route output did not contain a namespaced nova-plugin command');
  if (!/\/nova-plugin:[a-z0-9]+(?:-[a-z0-9]+)*/.test(commandField)) {
    throw new Error('route output Command field did not contain a namespaced nova-plugin command');
  }
  const commandIds = new Set(routeInventory.commandIds);
  for (const command of commandMatches) {
    if (!commandIds.has(command)) throw new Error(`route output invented command ${command}`);
  }
  const skills = validateInventoryField(skillField, new Set(routeInventory.skillNames), 'skill');
  const agents = validateInventoryField(agentField, new Set(routeInventory.agents), 'core agent');
  const packs = validateInventoryField(packField, new Set(routeInventory.packs), 'capability pack');
  return {
    commandMatches: [...new Set(commandMatches)].sort(),
    skills,
    agents,
    packs,
    requiredFields,
  };
}

function snapshotEntries(rootDir, current = rootDir) {
  const entries = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (current === rootDir && entry.name === '.git') continue;
    const absolute = resolve(current, entry.name);
    const relativePath = absolute.slice(rootDir.length + 1).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      entries.push({ path: relativePath, type: 'directory' });
      entries.push(...snapshotEntries(rootDir, absolute));
    }
    else if (entry.isFile()) {
      const content = readFileSync(absolute);
      entries.push({ path: relativePath, type: 'file', bytes: content.length, sha256: sha256(content) });
    } else if (entry.isSymbolicLink()) {
      entries.push({ path: relativePath, type: 'symlink', target: readlinkSync(absolute) });
    } else {
      entries.push({ path: relativePath, type: 'other' });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function projectSnapshot(rootDir) {
  const files = snapshotEntries(rootDir);
  return { files, digest: sha256(JSON.stringify(files)) };
}

export function buildOAuthRouteEnvironment(env, isolatedHome) {
  if (typeof env.CLAUDE_CODE_OAUTH_TOKEN !== 'string' || !env.CLAUDE_CODE_OAUTH_TOKEN.trim()) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is required for the OAuth live route gate');
  }
  const competing = competingCredentialVariables.filter((name) => {
    const value = env[name];
    return typeof value === 'string' && value.trim();
  });
  if (competing.length) {
    throw new Error(`OAuth live route gate forbids competing credentials: ${competing.join(', ')}`);
  }
  const configHome = resolve(isolatedHome, '.config');
  const dataHome = resolve(isolatedHome, '.local', 'share');
  const stateHome = resolve(isolatedHome, '.local', 'state');
  const claudeConfigDir = resolve(isolatedHome, '.claude');
  for (const directory of [configHome, dataHome, stateHome, claudeConfigDir]) {
    mkdirSync(directory, { recursive: true });
  }
  return {
    ...env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: stateHome,
    CLAUDE_CONFIG_DIR: claudeConfigDir,
  };
}

export function routeInvocationArgs(pluginDir) {
  return [
    '--plugin-dir',
    pluginDir,
    '-p',
    fixedPrompt,
    '--output-format',
    'json',
    '--max-turns',
    '3',
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    routeAllowedTools.join(','),
    '--disallowedTools',
    routeDisallowedTools.join(','),
  ];
}

export function routeFailureDetails(invocation) {
  const details = [`exit=${invocation.code ?? 'unknown'}`];
  if (invocation.timedOut) details.push('timedOut=true');
  try {
    const response = JSON.parse(invocation.stdout ?? '');
    if (typeof response.subtype === 'string') details.push(`subtype=${response.subtype}`);
    if (typeof response.terminal_reason === 'string') details.push(`terminalReason=${response.terminal_reason}`);
    if (Array.isArray(response.permission_denials) && response.permission_denials.length) {
      const denials = response.permission_denials.map((denial) => {
        const skill = denial?.tool_input?.skill;
        return skill ? `${denial.tool_name}(${skill})` : String(denial?.tool_name ?? 'unknown');
      });
      details.push(`permissionDenials=${[...new Set(denials)].join(',')}`);
    }
  } catch {
    if (invocation.errorMessage) details.push(`processError=${invocation.errorMessage}`);
    if (invocation.stderr?.trim()) details.push('stderrPresent=true');
  }
  return details.join(' ');
}

async function gitStatus(cwd, env) {
  const result = await captureProcess('route smoke git status', 'git', ['status', '--short'], {
    cwd,
    env,
    timeoutMs: 30_000,
  });
  if (!result.ok) throw new Error(result.errorMessage ?? 'git status failed');
  return result.stdout;
}

export async function runRouteSmoke({ pluginDir, outPath = null, env = process.env } = {}) {
  const resolvedPluginDir = resolve(pluginDir ?? '');
  const permissionSpec = JSON.parse(readFileSync(
    resolve(resolvedPluginDir, 'runtime/workflow-permissions.json'),
    'utf8',
  ));
  const routeInventory = loadRouteInventory(resolvedPluginDir, permissionSpec);
  const project = mkdtempSync(resolve(tmpdir(), 'nova-route-live-'));
  const oauthHome = mkdtempSync(resolve(tmpdir(), 'nova-route-oauth-home-'));
  try {
    const routeEnv = buildOAuthRouteEnvironment(env, oauthHome);
    writeFileSync(resolve(project, 'README.md'), '# Route Smoke Fixture\n', 'utf8');
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'nova-route-smoke'],
      ['config', 'user.email', 'nova-route-smoke@example.invalid'],
      ['add', 'README.md'],
      ['commit', '-qm', 'fixture'],
    ]) {
      const result = await runProcess(`git ${args[0]}`, 'git', args, { cwd: project, env: routeEnv, timeoutMs: 30_000 });
      if (!result.ok) throw new Error(`failed to initialize route smoke fixture: ${result.stderr || result.errorMessage}`);
    }
    const beforeStatus = await gitStatus(project, routeEnv);
    const beforeProject = projectSnapshot(project);
    const beforeDigest = sha256(readFileSync(resolve(project, 'README.md')));
    const invocation = await captureProcess('OAuth route smoke', 'claude', routeInvocationArgs(resolvedPluginDir), {
      cwd: project,
      env: routeEnv,
      timeoutMs: 300_000,
    });
    if (!invocation.ok) {
      throw new Error(`OAuth route invocation failed: ${routeFailureDetails(invocation)}`);
    }
    let response;
    try {
      response = JSON.parse(invocation.stdout);
    } catch (error) {
      throw new Error(`route output was not JSON: ${error.message}`);
    }
    if (typeof response.result !== 'string') throw new Error('route JSON output is missing result text');
    const validation = validateRouteResult(response.result, routeInventory);
    const afterStatus = await gitStatus(project, routeEnv);
    const afterProject = projectSnapshot(project);
    const afterDigest = sha256(readFileSync(resolve(project, 'README.md')));
    if (
      beforeDigest !== afterDigest
      || beforeProject.digest !== afterProject.digest
      || beforeStatus !== afterStatus
      || afterStatus !== ''
    ) {
      throw new Error('route invocation changed the fixture project');
    }
    const evidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      invocation: '/nova-plugin:route',
      authenticationMode: 'claude-code-oauth-token',
      configurationIsolation: 'temporary-home',
      permissionMode: 'dontAsk',
      allowedTools: routeAllowedTools,
      disallowedTools: routeDisallowedTools,
      outputStructureValid: true,
      commands: validation.commandMatches,
      skills: validation.skills,
      agents: validation.agents,
      packs: validation.packs,
      projectChanged: false,
      beforeDigest,
      afterDigest,
      beforeProjectDigest: beforeProject.digest,
      afterProjectDigest: afterProject.digest,
      projectFileInventory: beforeProject.files,
      gitStatus: afterStatus,
      resultSha256: sha256(response.result),
    };
    if (outPath) {
      const resolvedOut = resolve(root, outPath);
      mkdirSync(dirname(resolvedOut), { recursive: true });
      writeFileSync(resolvedOut, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      console.log(`Wrote route smoke evidence to ${relative(root, resolvedOut).replaceAll('\\', '/')}`);
    }
    console.log(`OK OAuth /nova-plugin:route smoke; projectChanged=false; resultSha256=${evidence.resultSha256}`);
    return evidence;
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(oauthHome, { recursive: true, force: true });
  }
}

async function main(args) {
  let pluginDir = null;
  let outPath = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--plugin-dir') pluginDir = args[++index];
    else if (args[index] === '--out') outPath = args[++index];
    else if (args[index] === '--help' || args[index] === '-h') {
      console.log('Usage: node scripts/validate-plugin-route-live.mjs --plugin-dir <installed-plugin-path> [--out <path>]');
      return 0;
    } else {
      console.error(`ERROR unknown argument: ${args[index]}`);
      return 1;
    }
  }
  if (!pluginDir) {
    console.error('ERROR --plugin-dir is required');
    return 1;
  }
  try {
    await runRouteSmoke({ pluginDir, outPath });
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
