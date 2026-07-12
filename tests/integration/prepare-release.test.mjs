import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { extractReleaseNotes, prepareRelease } from '../../scripts/prepare-release.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function releaseRoot(t, version, changelog = null) {
  const root = await mkdtemp(join(tmpdir(), 'nova-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'nova-plugin/.claude-plugin'), { recursive: true });
  await writeFile(join(root, 'nova-plugin/.claude-plugin/plugin.json'), JSON.stringify({ version }), 'utf8');
  await writeFile(
    join(root, 'CHANGELOG.md'),
    changelog ?? `# Changelog\n\n## [${version}] - 2026-07-11\n\n- release notes\n\n## [2.3.0]\n\n- old\n`,
    'utf8',
  );
  return root;
}

test('prepareRelease writes safe prerelease outputs and exact notes', async (t) => {
  const root = await releaseRoot(t, '2.4.0-rc.1');
  const githubOutput = join(root, 'github-output.txt');
  await writeFile(githubOutput, '', 'utf8');
  const result = prepareRelease({ root, releaseTag: 'v2.4.0-rc.1', githubOutput });
  assert.equal(result.prerelease, true);
  assert.equal(await readFile(result.notesFile, 'utf8'), '- release notes\n');
  assert.equal(
    await readFile(githubOutput, 'utf8'),
    `version=2.4.0-rc.1\nprerelease=true\nnotes_file=${result.notesFile}\n`,
  );
});

test('prepareRelease treats build-only versions as stable', async (t) => {
  const root = await releaseRoot(t, '2.4.0+build-7');
  assert.equal(prepareRelease({ root, releaseTag: 'v2.4.0+build-7' }).prerelease, false);
});

test('prepareRelease accepts an RC tag whose base equals the stable plugin version', async (t) => {
  const root = await releaseRoot(t, '3.0.1');
  const result = prepareRelease({ root, releaseTag: 'v3.0.1-rc.2', candidate: true });
  assert.equal(result.version, '3.0.1');
  assert.equal(result.prerelease, true);
  assert.equal(await readFile(result.notesFile, 'utf8'), '- release notes\n');
});

test('2.4.1 release notes include every post-tag release blocker fix', async () => {
  const changelog = await readFile(resolve(repositoryRoot, 'CHANGELOG.md'), 'utf8');
  const notes = extractReleaseNotes(changelog, '2.4.1');
  assert.match(notes, /\.in_use\/\*\*/);
  assert.match(notes, /Skill\(nova-plugin:route\)/);
  assert.match(notes, /recommended-route-v1|七字段契约/);
  assert.match(notes, /manifest validation|manifest 校验/);
});

test('prepareRelease rejects malformed, mismatched, missing, and empty releases', async (t) => {
  const root = await releaseRoot(t, '2.4.0');
  assert.throws(() => prepareRelease({ root, releaseTag: 'v2.4.1' }), /does not match/);
  assert.throws(
    () => prepareRelease({ root, releaseTag: 'v2.4.0";printf${IFS}INJECTED;#' }),
    /valid SemVer/,
  );
  assert.throws(() => extractReleaseNotes('# Changelog\n', '2.4.0'), /no release heading/);
  assert.throws(() => extractReleaseNotes('## [2.4.0]\n\n## [2.3.0]\n- old\n', '2.4.0'), /empty/);
});
