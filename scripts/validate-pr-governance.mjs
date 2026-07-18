#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import {
  assertCompleteChangedFiles,
  assertCompleteReviewRecords,
  evaluatePrGovernance,
  LARGE_CHANGE_LIMITS,
  parseCodeOwnerPaths,
  sensitiveChangedFilePaths,
} from './lib/pr-governance.mjs';
import { normalizeCommitIdentity, normalizeGithubLogin } from './lib/github-identity.mjs';

assertNodeVersion({ label: 'PR governance validation' });

const API_VERSION = '2022-11-28';
const __dir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CODEOWNERS = resolve(__dir, '..', '.github', 'CODEOWNERS');

/**
 * @param {string} url
 * @param {{ token?: string, fetchImpl?: typeof fetch }} [options]
 */
async function githubJson(url, { token, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}`);
  }
  return response.json();
}

/**
 * @param {string} url
 * @param {{ token?: string, fetchImpl?: typeof fetch }} options
 */
async function githubPages(url, options) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const separator = url.includes('?') ? '&' : '?';
    const batch = await githubJson(`${url}${separator}per_page=100&page=${page}`, options);
    if (!Array.isArray(batch)) throw new Error(`GitHub API expected an array for ${url}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

/**
 * @param {{
 *   event?: Record<string, any>,
 *   repository?: string,
 *   token?: string,
 *   fetchImpl?: typeof fetch,
 *   apiBase?: string,
 *   sensitivePaths?: string[]
 * }} [input]
 */
export async function validatePullRequestGovernance({
  event,
  repository,
  token,
  fetchImpl = fetch,
  apiBase = 'https://api.github.com',
  sensitivePaths,
} = {}) {
  const pullRequest = event?.pull_request;
  if (!pullRequest) throw new Error('PR governance requires a pull_request or pull_request_review event payload');
  if (!repository || !/^[^/]+\/[^/]+$/u.test(repository)) throw new Error('GITHUB_REPOSITORY must be owner/repository');
  if (!token) throw new Error('GITHUB_TOKEN is required for PR governance API reads');
  if (!Array.isArray(sensitivePaths) || sensitivePaths.length === 0) {
    throw new Error('PR governance requires tracked CODEOWNERS sensitive paths');
  }

  const number = pullRequest.number ?? event?.number;
  if (!Number.isInteger(number) || number <= 0) throw new Error('pull request number is missing or invalid in the event payload');
  normalizeGithubLogin(pullRequest.user?.login, 'pull request author');
  normalizeCommitIdentity(pullRequest.head?.sha, 'pull request head', { fullSha: true });
  const pullUrl = `${apiBase}/repos/${repository}/pulls/${number}`;
  let metrics = pullRequest;
  if (![metrics.additions, metrics.deletions, metrics.changed_files].every((value) => Number.isInteger(value) && value >= 0)) {
    metrics = await githubJson(pullUrl, { token, fetchImpl });
  }
  if (![metrics.additions, metrics.deletions, metrics.changed_files].every((value) => Number.isInteger(value) && value >= 0)) {
    throw new Error('GitHub pull request metrics must contain non-negative integer additions, deletions, and changed_files');
  }
  const files = await githubPages(`${pullUrl}/files`, { token, fetchImpl });
  assertCompleteChangedFiles(files, metrics.changed_files);
  const hasSensitivePath = files.some((file) => sensitiveChangedFilePaths(file, sensitivePaths).length > 0);
  const reviews = hasSensitivePath
    ? await githubPages(`${pullUrl}/reviews`, { token, fetchImpl })
    : [];
  if (hasSensitivePath) assertCompleteReviewRecords(reviews);

  return evaluatePrGovernance({
    body: pullRequest.body,
    additions: metrics.additions,
    deletions: metrics.deletions,
    changedFiles: metrics.changed_files,
    files,
    reviews,
    author: pullRequest.user?.login,
    headSha: pullRequest.head?.sha,
    sensitivePaths,
  });
}

export async function main({ env = process.env, fetchImpl = fetch } = {}) {
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required');
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  const sensitivePaths = parseCodeOwnerPaths(await readFile(DEFAULT_CODEOWNERS, 'utf8'));
  const result = await validatePullRequestGovernance({
    event,
    repository: env.GITHUB_REPOSITORY,
    token: env.GITHUB_TOKEN,
    fetchImpl,
    apiBase: env.GITHUB_API_URL || 'https://api.github.com',
    sensitivePaths,
  });
  if (!result.ok) {
    console.error(`PR Governance failed (${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}):`);
    for (const error of result.errors) console.error(`  - ${error}`);
    console.error(`Review budget: at most ${LARGE_CHANGE_LIMITS.changedFiles} files and ${LARGE_CHANGE_LIMITS.changedLines} changed lines without an explicit exception.`);
    return 1;
  }
  console.log(`OK PR Governance passed (large=${result.large}, sensitive_paths=${result.sensitiveFiles.length})`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
