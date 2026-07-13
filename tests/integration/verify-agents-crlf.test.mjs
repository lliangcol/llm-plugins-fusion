import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { pathForBash, resolveBashCommand } from '../../scripts/lib/bash-command.mjs';
import { commandExists, runProcess } from '../../scripts/lib/process-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bashCommand = resolveBashCommand();
const agentNames = [
  'architect.md',
  'builder.md',
  'orchestrator.md',
  'publisher.md',
  'reviewer.md',
  'verifier.md',
];

test('verify-agents accepts CRLF frontmatter and body delimiters', async (t) => {
  if (!(await commandExists(bashCommand))) {
    t.skip('Bash is unavailable; CRLF agent verification requires Bash');
    return;
  }

  const fixtureRoot = await mkdtemp(join(tmpdir(), 'nova-verify-agents-crlf-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  const scriptDir = join(fixtureRoot, 'scripts');
  const agentDir = join(fixtureRoot, 'nova-plugin', 'agents');
  await mkdir(scriptDir, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await copyFile(
    join(repoRoot, 'scripts', 'verify-agents.sh'),
    join(scriptDir, 'verify-agents.sh'),
  );

  for (const agentName of agentNames) {
    const source = await readFile(join(repoRoot, 'nova-plugin', 'agents', agentName), 'utf8');
    await writeFile(join(agentDir, agentName), source.replace(/\r?\n/g, '\r\n'));
  }

  const result = await runProcess(
    'verify agents CRLF fixture',
    bashCommand,
    [pathForBash(join(scriptDir, 'verify-agents.sh'), bashCommand)],
    { cwd: fixtureRoot },
  );

  assert.equal(result.ok, true, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /- architect\.md: ok/);
  assert.match(result.stdout, /- verifier\.md: ok/);
});
