#!/usr/bin/env node
/** Prepare validated GitHub release outputs without shell interpolation. */

import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireSemVer } from './lib/semver.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function extractReleaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}]`;
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} - `));
  if (start === -1) throw new Error(`CHANGELOG.md has no release heading for ${version}`);
  const endOffset = lines.slice(start + 1).findIndex((line) => line.startsWith('## ['));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  const notes = lines.slice(start + 1, end).join('\n').trim();
  if (!notes) throw new Error(`CHANGELOG.md release notes are empty for ${version}`);
  return notes;
}

export function prepareRelease({
  root = defaultRoot,
  releaseTag,
  githubOutput = '',
  notesPath = resolve(root, '.metrics/release/release-notes.md'),
} = {}) {
  if (typeof releaseTag !== 'string' || !releaseTag.startsWith('v')) {
    throw new Error('RELEASE_TAG must use v<semver>');
  }
  const version = releaseTag.slice(1);
  const parsed = requireSemVer(version, 'release tag version');
  const plugin = readJson(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'));
  requireSemVer(plugin.version, 'plugin version');
  if (plugin.version !== version) {
    throw new Error(`release tag version ${version} does not match plugin version ${plugin.version}`);
  }

  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const notes = extractReleaseNotes(changelog, version);
  mkdirSync(dirname(notesPath), { recursive: true });
  writeFileSync(notesPath, `${notes}\n`, 'utf8');

  const result = {
    version,
    prerelease: parsed.isPrerelease,
    notesFile: notesPath,
  };
  if (githubOutput) {
    if (/[\r\n]/.test(notesPath)) throw new Error('release notes path must not contain newlines');
    appendFileSync(
      githubOutput,
      `version=${version}\nprerelease=${parsed.isPrerelease}\nnotes_file=${notesPath}\n`,
      'utf8',
    );
  }
  return result;
}

export function main(env = process.env) {
  const result = prepareRelease({
    releaseTag: env.RELEASE_TAG,
    githubOutput: env.GITHUB_OUTPUT || '',
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
