#!/usr/bin/env node
/** Block common shell write-bypass forms before the normal Bash permission prompt. */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_COMMAND_BYTES = 16 * 1024;
const directMutators = new Set([
  'rm', 'mv', 'cp', 'install', 'dd', 'tee', 'truncate', 'touch', 'mkdir', 'rmdir',
  'chmod', 'chown', 'ln', 'patch', 'ed', 'ex', 'vi', 'vim', 'nano',
]);
const gitMutators = new Set([
  'add', 'am', 'apply', 'bisect', 'branch', 'checkout', 'cherry-pick', 'clean', 'commit',
  'merge', 'mv', 'pull', 'push', 'rebase', 'reset', 'restore', 'revert', 'rm', 'stash',
  'switch', 'tag', 'worktree',
]);

function executableName(token = '') {
  return basename(token.replace(/^['"]|['"]$/g, '')).toLowerCase();
}

export function validateBashCommand(command) {
  const reasons = [];
  if (typeof command !== 'string' || command.trim() === '') return ['Bash command must be a non-empty string'];
  if (Buffer.byteLength(command, 'utf8') > MAX_COMMAND_BYTES) reasons.push('command exceeds the guarded size limit');
  if (/[\r\n]/u.test(command)) reasons.push('multi-line shell programs are not allowed');
  if (/[;&|<>`]/u.test(command) || /\$\(/u.test(command)) reasons.push('shell composition, redirection, pipes, or command substitution are not allowed');
  const tokens = command.trim().split(/\s+/u);
  const executable = executableName(tokens[0]);
  const subcommand = String(tokens[1] ?? '').toLowerCase();
  if (directMutators.has(executable)) reasons.push(`direct filesystem mutator ${executable} is not allowed`);
  if (['sed', 'perl', 'ruby', 'python', 'python3'].includes(executable)) reasons.push(`general-purpose file-capable interpreter ${executable} is not allowed`);
  if (executable === 'node' && tokens.some((token) => ['-e', '--eval', '-p', '--print'].includes(token))) reasons.push('inline Node execution is not allowed');
  if (['sh', 'zsh', 'fish'].includes(executable) || (executable === 'bash' && subcommand !== '-n')) reasons.push(`nested shell ${executable} is not allowed`);
  if (executable === 'git' && gitMutators.has(subcommand)) reasons.push(`mutating git subcommand ${subcommand} is not allowed`);
  if (executable === 'npx' || (executable === 'npm' && ['exec', 'install', 'uninstall', 'update', 'publish'].includes(subcommand))) reasons.push(`package execution or mutation through ${executable} is not allowed`);
  return [...new Set(reasons)];
}

function block(reasons) {
  console.error('[nova-plugin] Bash command violates the scoped shell policy; execution blocked.');
  for (const reason of reasons) console.error(`  ${reason}`);
  console.error('  Use Write/Edit for guarded file changes, or run the command outside this workflow after explicit review.');
  process.exit(2);
}

function main() {
  let payload;
  try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { block(['hook payload is not valid JSON']); }
  if (payload?.tool_name !== 'Bash') block([`unexpected tool ${JSON.stringify(payload?.tool_name)}`]);
  const reasons = validateBashCommand(payload?.tool_input?.command);
  if (reasons.length) block(reasons);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
