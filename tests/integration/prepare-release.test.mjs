import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildPromotionNotes, extractReleaseNotes, prepareRelease } from '../../scripts/prepare-release.mjs';

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

test('stable promotion notes are generated from exact release and compatibility facts', async (t) => {
  const oldNarrative = '- Set the development version to `4.0.0` while keeping the published stable channel pinned to `v3.2.0`; no 4.0 release or compatibility upgrade is claimed.';
  const root = await releaseRoot(t, '4.0.0', `# Changelog\n\n## [4.0.0]\n\n### Changed\n${oldNarrative}\n`);
  await mkdir(join(root, 'governance'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ engines: { node: '>=22' } }), 'utf8');
  await writeFile(join(root, 'governance/assistant-support.json'), JSON.stringify({ knownGood: [
    { assistant: 'claude-code', version: '2.1.205' },
    { assistant: 'codex', version: '0.144.0-alpha.4' },
  ] }), 'utf8');
  await writeFile(join(root, 'governance/compatibility-evidence.generated.json'), JSON.stringify({ currentClaims: [
    { assistant: 'claude-code', effectiveLevel: 'L2' },
    { assistant: 'codex', effectiveLevel: 'L2' },
    { assistant: 'generic', effectiveLevel: 'L1' },
  ] }), 'utf8');
  await writeFile(join(root, 'governance/project-state.generated.json'), JSON.stringify({ runtime: { distributedBash: '3.2+' } }), 'utf8');

  const sourceCommit = 'a'.repeat(40);
  const result = prepareRelease({
    root,
    releaseTag: 'v4.0.0',
    promotion: { candidateTag: 'v4.0.0-rc.8', sourceCommit },
  });
  const notes = await readFile(result.notesFile, 'utf8');
  assert.match(notes, /^## Release Summary/mu);
  assert.match(notes, /Stable: `v4\.0\.0` at `a{40}`/u);
  assert.match(notes, /Candidate: `v4\.0\.0-rc\.8`/u);
  assert.match(notes, /Claude Code L2, Codex L2, and generic assistants L1/u);
  assert.match(notes, /Node\.js `>=22`; Bash `3\.2\+`/u);
  assert.match(notes, /Known-good assistants: Claude Code `2\.1\.205`; Codex `0\.144\.0-alpha\.4`/u);
  assert.doesNotMatch(notes, /stable channel pinned to `v3\.2\.0`/u);
  assert.match(notes, /Published `v4\.0\.0` as the stable channel/u);

  assert.throws(
    () => buildPromotionNotes({ root, releaseTag: 'v4.0.0', candidateTag: 'v4.1.0-rc.1', sourceCommit, notes: 'x' }),
    /does not target/u,
  );
  assert.throws(
    () => buildPromotionNotes({ root, releaseTag: 'v4.0.0', candidateTag: 'v4.0.0-rc.8', sourceCommit: 'bad', notes: 'x' }),
    /source commit/u,
  );
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
