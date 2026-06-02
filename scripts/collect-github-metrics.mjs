#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const defaults = {
  owner: 'lliangcol',
  repo: 'llm-plugins-fusion',
  out: '.metrics/latest.json',
  starsBefore: null,
};

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--owner') {
      options.owner = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--repo') {
      options.repo = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--out') {
      options.out = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--stars-before') {
      const raw = requireValue(argv, index, arg);
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('--stars-before requires a non-negative integer');
      }
      options.starsBefore = parsed;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: node scripts/collect-github-metrics.mjs [--owner OWNER] [--repo REPO] [--out PATH] [--stars-before COUNT]

Defaults:
  --owner ${defaults.owner}
  --repo  ${defaults.repo}
  --out   ${defaults.out}

Set GITHUB_TOKEN to include owner-only GitHub traffic endpoints. Traffic 403/404
responses are recorded as skipped and do not fail the script.`);
}

function assertNode20() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 20) {
    throw new Error(`Node.js 20+ is required; current version is ${process.versions.node}`);
  }
}

function parseLinkCount(linkHeader, fallbackCount) {
  if (!linkHeader) {
    return fallbackCount;
  }
  const last = linkHeader
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="last"'));
  if (!last) {
    return fallbackCount;
  }
  const match = last.match(/[?&]page=(\d+)/);
  return match ? Number(match[1]) : fallbackCount;
}

function makeHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'llm-plugins-fusion-metrics',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubRequest(url, { token, tolerate = false } = {}) {
  let response;
  try {
    response = await fetch(url, { headers: makeHeaders(token) });
  } catch (error) {
    throw new Error(
      `Unable to reach GitHub API (${url}): ${error.message}. Check network access or retry later.`,
    );
  }
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const error = {
      status: response.status,
      url,
      message: body?.message ?? response.statusText,
    };
    if (tolerate) {
      return { ok: false, error, body, response };
    }
    throw new Error(`${response.status} ${response.statusText}: ${error.message} (${url})`);
  }

  return { ok: true, body, response };
}

async function countByListEndpoint(url, token) {
  const result = await githubRequest(`${url}${url.includes('?') ? '&' : '?'}per_page=1`, { token });
  const items = Array.isArray(result.body) ? result.body : [];
  return parseLinkCount(result.response.headers.get('Link'), items.length);
}

async function searchCount(query, token) {
  const encoded = encodeURIComponent(query);
  const result = await githubRequest(`https://api.github.com/search/issues?q=${encoded}&per_page=1`, { token });
  return result.body.total_count;
}

function settledValue(result) {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  throw result.reason;
}

async function collectTraffic(baseUrl, token) {
  const traffic = {};
  const skipped = [];
  const errors = [];
  const endpoints = [
    ['views', `${baseUrl}/traffic/views`],
    ['clones', `${baseUrl}/traffic/clones`],
    ['referrers', `${baseUrl}/traffic/popular/referrers`],
    ['paths', `${baseUrl}/traffic/popular/paths`],
  ];

  if (!token) {
    for (const [name] of endpoints) {
      skipped.push({ endpoint: name, reason: 'GITHUB_TOKEN not set' });
    }
    return { traffic, skipped, errors };
  }

  for (const [name, url] of endpoints) {
    const result = await githubRequest(url, { token, tolerate: true });
    if (result.ok) {
      traffic[name] = result.body;
    } else if (result.error.status === 403 || result.error.status === 404) {
      skipped.push({
        endpoint: name,
        status: result.error.status,
        reason: result.error.message,
      });
    } else {
      errors.push({
        endpoint: name,
        status: result.error.status,
        reason: result.error.message,
      });
    }
  }

  return { traffic, skipped, errors };
}

async function main() {
  assertNode20();
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.GITHUB_TOKEN || '';
  const baseUrl = `https://api.github.com/repos/${options.owner}/${options.repo}`;
  const collectedAt = new Date().toISOString();

  const [repoResult, releasesCount, latestReleaseResult, communityResult, openIssues, openPrs] =
    (await Promise.allSettled([
      githubRequest(baseUrl, { token }),
      countByListEndpoint(`${baseUrl}/releases`, token),
      githubRequest(`${baseUrl}/releases/latest`, { token, tolerate: true }),
      githubRequest(`${baseUrl}/community/profile`, { token, tolerate: true }),
      searchCount(`repo:${options.owner}/${options.repo} is:issue is:open`, token),
      searchCount(`repo:${options.owner}/${options.repo} is:pr is:open`, token),
    ])).map(settledValue);

  const repo = repoResult.body;
  const trafficResult = await collectTraffic(baseUrl, token);
  const stars = repo.stargazers_count;
  const views = trafficResult.traffic.views?.uniques ?? null;
  const newStars =
    options.starsBefore === null ? null : Math.max(0, stars - options.starsBefore);
  const visitorToStarEstimate =
    views && views > 0 && newStars !== null ? Number((newStars / views).toFixed(4)) : null;

  const snapshot = {
    collectedAt,
    repository: {
      owner: options.owner,
      repo: options.repo,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      htmlUrl: repo.html_url,
      visibility: repo.visibility,
      stars,
      forks: repo.forks_count,
      watchers: repo.subscribers_count,
      openIssues,
      openPullRequests: openPrs,
      latestPushedAt: repo.pushed_at,
      latestUpdatedAt: repo.updated_at,
    },
    releases: {
      count: releasesCount,
      latest: latestReleaseResult.ok
        ? {
            name: latestReleaseResult.body.name,
            tagName: latestReleaseResult.body.tag_name,
            draft: latestReleaseResult.body.draft,
            prerelease: latestReleaseResult.body.prerelease,
            publishedAt: latestReleaseResult.body.published_at,
            htmlUrl: latestReleaseResult.body.html_url,
          }
        : null,
      skipped: latestReleaseResult.ok
        ? []
        : [{ endpoint: 'latest-release', status: latestReleaseResult.error.status, reason: latestReleaseResult.error.message }],
    },
    community: communityResult.ok
      ? {
          healthPercentage: communityResult.body.health_percentage,
          files: communityResult.body.files,
        }
      : {
          skipped: [
            {
              endpoint: 'community-profile',
              status: communityResult.error.status,
              reason: communityResult.error.message,
            },
          ],
        },
    traffic: trafficResult.traffic,
    derived: {
      starsBefore: options.starsBefore,
      newStars,
      visitorToStarEstimate,
      visitorToStarEstimateNote:
        visitorToStarEstimate === null
          ? 'Unavailable because unique views were not collected or --stars-before was not provided.'
          : 'Approximate new stars divided by current unique views snapshot; align --stars-before with the same observation window.',
    },
    skipped: trafficResult.skipped,
    errors: trafficResult.errors,
  };

  const outPath = resolve(process.cwd(), options.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log(`Wrote metrics snapshot to ${options.out}`);
  console.log(
    `Public metrics: stars=${snapshot.repository.stars} forks=${snapshot.repository.forks} issues=${snapshot.repository.openIssues} prs=${snapshot.repository.openPullRequests} releases=${snapshot.releases.count}`,
  );
  if (snapshot.skipped.length > 0) {
    console.log(`Skipped ${snapshot.skipped.length} traffic endpoint(s).`);
  }
  if (snapshot.errors.length > 0) {
    console.error(`Traffic errors: ${snapshot.errors.length}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`collect-github-metrics failed: ${error.message}`);
  process.exit(1);
});
