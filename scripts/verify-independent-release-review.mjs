#!/usr/bin/env node
/** Require a current merged PR approval independent of author and candidate actor. */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireOptionValue } from './lib/cli-args.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { evaluateIndependentReview } from './lib/release-review.mjs';

const root = repoRoot(import.meta.url);

function parseArgs(args, env) {
  const options = { repository: env.GITHUB_REPOSITORY, commit: env.GITHUB_SHA, candidateActor: env.GITHUB_ACTOR, token: env.GH_TOKEN ?? env.GITHUB_TOKEN, reviewers: resolve(root, 'governance/release-reviewers.json'), sensitive: false, out: resolve(root, '.metrics/release-review/independent-review.json') };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--sensitive') { options.sensitive = true; continue; }
    const value = requireOptionValue(args, index, arg);
    if (arg === '--repository') options.repository = value;
    else if (arg === '--commit') options.commit = value;
    else if (arg === '--candidate-actor') options.candidateActor = value;
    else if (arg === '--reviewers') options.reviewers = resolve(root, value);
    else if (arg === '--out') options.out = resolve(root, value);
    else throw new Error(`unknown argument ${arg}`);
    index += 1;
  }
  return options;
}

async function githubJson(path, options, fetchImpl) {
  const response = await fetchImpl(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${options.token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'llm-plugins-fusion-release-review' } });
  if (!response.ok) throw new Error(`GitHub API ${path} failed with ${response.status}`);
  return response.json();
}

async function githubJsonPages(path, options, fetchImpl) {
  const records = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const batch = await githubJson(`${path}${separator}per_page=100&page=${page}`, options, fetchImpl);
    if (!Array.isArray(batch)) throw new Error(`GitHub API ${path} did not return an array`);
    records.push(...batch);
    if (batch.length < 100) return records;
  }
  throw new Error(`GitHub API ${path} exceeded the 2000-record safety limit`);
}

export async function verifyIndependentReview({ args = process.argv.slice(2), env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const options = parseArgs(args, env);
  if (!options.repository || !options.commit || !options.candidateActor || !options.token) throw new Error('repository, commit, candidate actor, and GitHub token are required');
  const reviewerPolicy = JSON.parse(readFileSync(options.reviewers, 'utf8'));
  if (reviewerPolicy.status !== 'configured' || reviewerPolicy.trustedUsers.length + reviewerPolicy.trustedTeams.length === 0) throw new Error('trusted reviewer identity or team is not configured');
  const pulls = await githubJsonPages(`/repos/${options.repository}/commits/${options.commit}/pulls`, options, fetchImpl);
  const pull = pulls.find((entry) => entry.merged_at && entry.merge_commit_sha === options.commit) ?? pulls.find((entry) => entry.merged_at);
  if (!pull) throw new Error('candidate commit is not associated with a merged pull request');
  const reviews = await githubJsonPages(`/repos/${options.repository}/pulls/${pull.number}/reviews`, options, fetchImpl);
  const pullRequestHead = pull.head?.sha;
  if (!pullRequestHead) throw new Error('merged pull request is missing its final head commit');
  const teamMembers = [];
  for (const team of reviewerPolicy.trustedTeams) {
    const [organization, slug] = team.split('/');
    const members = await githubJsonPages(`/orgs/${organization}/teams/${slug}/members`, options, fetchImpl);
    teamMembers.push(...members.map((member) => member.login).filter(Boolean));
  }
  const changedFiles = await githubJsonPages(`/repos/${options.repository}/pulls/${pull.number}/files`, options, fetchImpl);
  const sensitive = options.sensitive || changedFiles.some((file) => reviewerPolicy.sensitivePaths.some((path) => file.filename === path || file.filename.startsWith(path)));
  const minimumApprovals = sensitive ? reviewerPolicy.sensitiveMinimumApprovals : reviewerPolicy.standardMinimumApprovals;
  const result = evaluateIndependentReview({
    pullRequestAuthor: pull.user?.login,
    candidateActor: options.candidateActor,
    expectedReviewCommit: pullRequestHead,
    trustedReviewers: [...new Set([...reviewerPolicy.trustedUsers, ...teamMembers])],
    botActors: reviewerPolicy.botIdentities,
    minimumApprovals,
    reviews: reviews.map((review) => ({ reviewer: review.user?.login, state: review.state, submittedAt: review.submitted_at, commit: review.commit_id })),
  });
  const evidence = { schemaVersion: 1, repository: options.repository, commit: options.commit, pullRequest: pull.number, pullRequestHead, sensitive, reviewerPolicyStatus: reviewerPolicy.status, ...result, checkedAt: now().toISOString() };
  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  if (!result.passed) throw new Error(`candidate requires ${result.minimumApprovals} independent approval; found ${result.approvalReviewers.length}`);
  return evidence;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const evidence = await verifyIndependentReview();
    console.log(`OK independent release review PR #${evidence.pullRequest}: ${evidence.approvalReviewers.join(', ')}`);
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}
