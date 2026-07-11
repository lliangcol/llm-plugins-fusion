#!/usr/bin/env node
/** Run one OAuth-authenticated, read-only namespaced route invocation. */

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixedPrompt = '/nova-plugin:route REQUEST="Review a public README change before editing and recommend the next workflow." DEPTH=brief';
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

export function validateRouteResult(result, permissionSpec) {
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
  const commandMatches = [...result.matchAll(/\/nova-plugin:([a-z0-9]+(?:-[a-z0-9]+)*)/g)]
    .map((match) => match[1]);
  if (commandMatches.length === 0) throw new Error('route output did not contain a namespaced nova-plugin command');
  const commandIds = new Set(permissionSpec.expectedInventory.commandIds);
  for (const command of commandMatches) {
    if (!commandIds.has(command)) throw new Error(`route output invented command ${command}`);
  }
  const agents = ['orchestrator', 'architect', 'builder', 'reviewer', 'verifier', 'publisher'];
  if (!agents.some((agent) => result.includes(agent))) throw new Error('route output did not contain a known core agent');
  return { commandMatches: [...new Set(commandMatches)].sort(), requiredFields };
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
    '--disallowedTools',
    'Write,Edit,NotebookEdit,Bash',
  ];
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
    const beforeDigest = sha256(readFileSync(resolve(project, 'README.md')));
    const invocation = await captureProcess('OAuth route smoke', 'claude', routeInvocationArgs(resolvedPluginDir), {
      cwd: project,
      env: routeEnv,
      timeoutMs: 300_000,
    });
    if (!invocation.ok) {
      throw new Error(`OAuth route invocation failed: ${invocation.errorMessage ?? invocation.stderr}`);
    }
    let response;
    try {
      response = JSON.parse(invocation.stdout);
    } catch (error) {
      throw new Error(`route output was not JSON: ${error.message}`);
    }
    if (typeof response.result !== 'string') throw new Error('route JSON output is missing result text');
    const validation = validateRouteResult(response.result, permissionSpec);
    const afterStatus = await gitStatus(project, routeEnv);
    const afterDigest = sha256(readFileSync(resolve(project, 'README.md')));
    if (beforeDigest !== afterDigest || beforeStatus !== afterStatus || afterStatus !== '') {
      throw new Error('route invocation changed the fixture project');
    }
    const evidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      invocation: '/nova-plugin:route',
      authenticationMode: 'claude-code-oauth-token',
      configurationIsolation: 'temporary-home',
      permissionMode: 'dontAsk',
      disallowedTools: ['Write', 'Edit', 'NotebookEdit', 'Bash'],
      outputStructureValid: true,
      commands: validation.commandMatches,
      projectChanged: false,
      beforeDigest,
      afterDigest,
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
