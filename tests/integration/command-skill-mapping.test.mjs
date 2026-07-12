import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

async function markdownIds(dir, transform = (value) => value) {
  const entries = await readdir(resolve(repoRoot, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => transform(entry.name.replace(/\.md$/, '')))
    .sort();
}

async function skillIds() {
  const entries = await readdir(resolve(repoRoot, 'nova-plugin/skills'), { withFileTypes: true });
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('nova-')) continue;
    const skillFile = join(repoRoot, 'nova-plugin/skills', entry.name, 'SKILL.md');
    ids.push(entry.name.replace(/^nova-/, ''));
    await access(skillFile);
  }
  return ids.sort();
}

test('command and skill ids stay one-to-one', async () => {
  const commands = await markdownIds('nova-plugin/commands');
  const skills = await skillIds();

  assert.equal(commands.length, 21);
  assert.deepEqual(skills, commands);
});

test('every direct command requires its full authored behavior contract', async () => {
  const commands = await markdownIds('nova-plugin/commands');
  for (const id of commands) {
    const source = await readFile(resolve(repoRoot, 'nova-plugin/commands', `${id}.md`), 'utf8');
    assert.match(source, new RegExp(`runtime/contracts/${id}\\.json`));
    assert.match(source, new RegExp(`skills/nova-${id}/SKILL\\.md`));
    assert.match(source, /authoritative behavioral contract/iu);
    assert.match(source, /fail closed/iu);
  }
});
