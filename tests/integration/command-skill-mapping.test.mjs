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
    try {
      await access(skillFile);
      ids.push(entry.name.replace(/^nova-/, ''));
    } catch {
      // Supporting assets may remain under retired compatibility skill paths.
    }
  }
  return ids.sort();
}

test('six canonical skills own behavior and commands are generated projections', async () => {
  const commands = await markdownIds('nova-plugin/commands');
  const skills = await skillIds();

  assert.equal(commands.length, 21);
  assert.deepEqual(skills, ['explore', 'finalize-work', 'implement-plan', 'produce-plan', 'review', 'route']);
});

test('every command is a thin generated wrapper for one canonical skill and preset', async () => {
  const commands = await markdownIds('nova-plugin/commands');
  for (const id of commands) {
    const source = await readFile(resolve(repoRoot, 'nova-plugin/commands', `${id}.md`), 'utf8');
    assert.match(source, new RegExp(`runtime/contracts/${id}\\.json`));
    assert.match(source, /canonical surface `nova-[a-z-]+`/u);
    assert.match(source, /variant preset `\{.*\}`/u);
    assert.match(source, /canonical skill/iu);
    assert.match(source, /fail closed/iu);
    assert.doesNotMatch(source, /## Purpose|## Invariants|## Failure Output/iu);
  }
});
