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
import { parseCandidateTag } from './lib/release-candidate.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');

/** @typedef {{candidateTag: string, sourceCommit: string}} PromotionFacts */

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

/** @param {{root: string, releaseTag: string, candidateTag: string, sourceCommit: string, notes: string}} options */
export function buildPromotionNotes({ root, releaseTag, candidateTag, sourceCommit, notes }) {
  const stableVersion = releaseTag.slice(1);
  const candidate = parseCandidateTag(candidateTag);
  if (candidate.stableVersion !== stableVersion) {
    throw new Error(`candidate tag ${candidateTag} does not target ${releaseTag}`);
  }
  if (!/^[a-f0-9]{40}$/u.test(sourceCommit ?? '')) {
    throw new Error('promotion source commit must be a lowercase 40-character SHA');
  }

  const support = readJson(resolve(root, 'governance/assistant-support.json'));
  const compatibility = readJson(resolve(root, 'governance/compatibility-evidence.generated.json'));
  const projectState = readJson(resolve(root, 'governance/project-state.generated.json'));
  const packageJson = readJson(resolve(root, 'package.json'));
  const knownGood = new Map(support.knownGood.map((entry) => [entry.assistant, entry.version]));
  const claims = new Map(compatibility.currentClaims.map((entry) => [entry.assistant, entry.effectiveLevel]));
  const requiredFacts = [
    knownGood.get('claude-code'),
    knownGood.get('codex'),
    claims.get('claude-code'),
    claims.get('codex'),
    claims.get('generic'),
    packageJson.engines?.node,
    projectState.runtime?.distributedBash,
  ];
  if (requiredFacts.some((value) => typeof value !== 'string' || value.length === 0)) {
    throw new Error('promotion summary facts are incomplete');
  }

  const stableNarrative = `- Published \`${releaseTag}\` as the stable channel and bound the public compatibility claim to its exact tag, commit, candidate evidence, and isolated install proof.`;
  const normalizedNotes = notes.replace(
    /^- Set the development version to `[^`]+` while keeping the published stable channel pinned to `v[^`]+`; no [^\r\n]+\.?$/mu,
    stableNarrative,
  );
  return [
    '## Release Summary',
    '',
    `- Stable: \`${releaseTag}\` at \`${sourceCommit}\`.`,
    `- Candidate: \`${candidateTag}\`.`,
    `- Compatibility: Claude Code ${claims.get('claude-code')}, Codex ${claims.get('codex')}, and generic assistants ${claims.get('generic')}; claims remain bounded by the published evidence.`,
    `- Runtime: Node.js \`${packageJson.engines.node}\`; Bash \`${projectState.runtime.distributedBash}\`.`,
    `- Known-good assistants: Claude Code \`${knownGood.get('claude-code')}\`; Codex \`${knownGood.get('codex')}\`. Latest-version checks remain non-blocking drift canaries.`,
    '',
    normalizedNotes,
  ].join('\n');
}

/**
 * @param {{root?: string, releaseTag?: string, candidate?: boolean, githubOutput?: string, notesPath?: string, promotion?: PromotionFacts | null}} [options]
 */
export function prepareRelease({
  root = defaultRoot,
  releaseTag,
  candidate = false,
  githubOutput = '',
  notesPath = resolve(root, '.metrics/release/release-notes.md'),
  promotion = null,
} = {}) {
  if (typeof releaseTag !== 'string' || !releaseTag.startsWith('v')) {
    throw new Error('RELEASE_TAG must use v<semver>');
  }
  const tagVersion = releaseTag.slice(1);
  const parsed = candidate ? null : requireSemVer(tagVersion, 'release tag version');
  const candidateDetails = candidate ? parseCandidateTag(releaseTag) : null;
  const version = candidateDetails?.stableVersion ?? tagVersion;
  const plugin = readJson(resolve(root, 'nova-plugin/.claude-plugin/plugin.json'));
  requireSemVer(plugin.version, 'plugin version');
  if (plugin.version !== version) {
    throw new Error(`release base version ${version} does not match plugin version ${plugin.version}`);
  }

  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  let notes = extractReleaseNotes(changelog, version);
  if (promotion) {
    notes = buildPromotionNotes({
      root,
      releaseTag,
      candidateTag: promotion.candidateTag,
      sourceCommit: promotion.sourceCommit,
      notes,
    });
  }
  mkdirSync(dirname(notesPath), { recursive: true });
  writeFileSync(notesPath, `${notes}\n`, 'utf8');

  const result = {
    version,
    prerelease: candidate || parsed.isPrerelease,
    notesFile: notesPath,
  };
  if (githubOutput) {
    if (/[\r\n]/.test(notesPath)) throw new Error('release notes path must not contain newlines');
    appendFileSync(
      githubOutput,
      `version=${version}\nprerelease=${candidate || parsed.isPrerelease}\nnotes_file=${notesPath}\n`,
      'utf8',
    );
  }
  return result;
}

export function main(env = process.env) {
  const result = prepareRelease({
    releaseTag: env.RELEASE_TAG,
    candidate: env.RELEASE_CANDIDATE === '1',
    githubOutput: env.GITHUB_OUTPUT || '',
    promotion: env.RELEASE_PROMOTION === '1'
      ? { candidateTag: env.CANDIDATE_TAG, sourceCommit: env.SOURCE_COMMIT }
      : null,
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
