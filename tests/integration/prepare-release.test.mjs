import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { extractReleaseNotes, prepareRelease } from '../../scripts/prepare-release.mjs';

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
