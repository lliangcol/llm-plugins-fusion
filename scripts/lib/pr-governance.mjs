import { normalizeCommitIdentity, normalizeGithubLogin } from './github-identity.mjs';

export const LARGE_CHANGE_LIMITS = Object.freeze({
  changedFiles: 50,
  changedLines: 1_000,
});

export const REQUIRED_SECTIONS = Object.freeze([
  'Summary',
  'Why',
  'Maintainer Owner',
  'Risk',
  'Validation Results',
]);

// Top-level entrypoints that can create, validate, extract, replay, or publish
// governed release evidence. Helpers below scripts/lib/ are covered as one
// directory boundary; these entrypoints must remain explicit in both
// CODEOWNERS and the independent-release reviewer policy.
export const RELEASE_TRUST_PATHS = Object.freeze([
  'scripts/lib/',
  'scripts/build-candidate-bundle.mjs',
  'scripts/build-release-artifacts.mjs',
  'scripts/build-release-control-bundle.mjs',
  'scripts/extract-release-bundle.mjs',
  'scripts/generate-release-candidate.mjs',
  'scripts/generate-release-checksums.mjs',
  'scripts/generate-release-evidence.mjs',
  'scripts/prepare-release.mjs',
  'scripts/reconcile-github-release.mjs',
  'scripts/release-orchestrator.mjs',
  'scripts/validate-community-governance.mjs',
  'scripts/validate-github-workflows.mjs',
  'scripts/validate-performance-budget.mjs',
  'scripts/validate-plugin-install.mjs',
  'scripts/validate-plugin-route-live.mjs',
  'scripts/validate-pr-governance.mjs',
  'scripts/validate-release-operational-readiness.mjs',
  'scripts/validate-release-readiness.mjs',
  'scripts/verify-independent-release-review.mjs',
  'scripts/verify-release-promotion.mjs',
  'scripts/verify-stable-install.mjs',
]);

/** @param {unknown} value */
export function stripHtmlComments(value) {
  const input = String(value ?? '');
  let cursor = 0;
  let output = '';

  while (cursor < input.length) {
    const opening = input.indexOf('<!--', cursor);
    if (opening === -1) return `${output}${input.slice(cursor)}`.trim();
    output += input.slice(cursor, opening);

    let depth = 1;
    let scan = opening + 4;
    while (depth > 0) {
      const nestedOpening = input.indexOf('<!--', scan);
      const closing = input.indexOf('-->', scan);
      if (closing === -1) return output.trim();
      if (nestedOpening !== -1 && nestedOpening < closing) {
        depth += 1;
        scan = nestedOpening + 4;
      } else {
        depth -= 1;
        scan = closing + 3;
      }
    }
    cursor = scan;
  }

  return output.trim();
}

function sectionIsPlaceholder(value) {
  const normalized = stripHtmlComments(value)
    .replace(/^[-*]\s*/gmu, '')
    .trim();
  if (!normalized) return true;
  return /^(?:todo|tbd|n\/?a|none|replace me|describe .+|what changed:?|why it changed:?|maintainer owner:?)$/iu.test(normalized);
}

export function parsePrBody(body) {
  const sections = new Map();
  const lines = String(body ?? '').split(/\r?\n/u);
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/u);
    if (heading) {
      current = heading[1].trim();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }
  return new Map([...sections].map(([heading, content]) => [heading, content.join('\n').trim()]));
}

export function parseCodeOwnerPaths(source) {
  const paths = String(source ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/u)[0])
    .filter((path) => path && path !== '*');
  const unsupported = paths.find((path) => /[!*?\[\]]/u.test(path));
  if (unsupported) throw new Error(`unsupported CODEOWNERS path pattern for PR governance: ${unsupported}`);
  return paths.map((path) => path.replace(/^\//u, ''));
}

function parseLabeledField(section, label) {
  const pattern = new RegExp(`^\\s*[-*]?\\s*${label}:\\s*(.*?)\\s*$`, 'imu');
  return stripHtmlComments(section.match(pattern)?.[1] ?? '');
}

/** @param {{ additions?: number, deletions?: number, changedFiles?: number }} [change] */
export function isLargeChange({ additions = 0, deletions = 0, changedFiles = 0 } = {}) {
  return changedFiles > LARGE_CHANGE_LIMITS.changedFiles
    || additions + deletions > LARGE_CHANGE_LIMITS.changedLines;
}

export function isSensitivePath(path, sensitivePaths = []) {
  const candidate = String(path ?? '');
  return sensitivePaths.some((policyPath) => (
    policyPath.endsWith('/') ? candidate.startsWith(policyPath) : candidate === policyPath
  ));
}

export function sensitiveChangedFilePaths(file, sensitivePaths = []) {
  const paths = typeof file === 'string'
    ? [file]
    : [file?.filename, file?.previous_filename];
  return [...new Set(paths.filter((path) => typeof path === 'string' && path.length > 0 && isSensitivePath(path, sensitivePaths)))];
}

export function assertCompleteChangedFiles(files, expectedChangedFiles, label = 'GitHub pull request files response') {
  if (!Number.isInteger(expectedChangedFiles) || expectedChangedFiles < 0) {
    throw new Error(`${label} requires a non-negative integer changed_files count`);
  }
  if (!Array.isArray(files)) throw new Error(`${label} must be an array`);
  const filenames = files.map((file) => file?.filename);
  if (files.length !== expectedChangedFiles
    || filenames.some((filename) => typeof filename !== 'string' || filename.length === 0)
    || new Set(filenames).size !== filenames.length) {
    throw new Error(`${label} is incomplete or ambiguous: received ${files.length} records for changed_files=${expectedChangedFiles}`);
  }
  return files;
}

export function assertCompleteReviewRecords(reviews, label = 'GitHub pull request reviews response') {
  if (!Array.isArray(reviews)) throw new Error(`${label} must be an array`);
  const reviewIds = new Set();
  for (const [index, review] of reviews.entries()) {
    if (!review || typeof review !== 'object' || Array.isArray(review)) {
      throw new Error(`${label} record ${index} must be an object`);
    }
    if (!Number.isInteger(review.id) || review.id <= 0 || reviewIds.has(review.id)) {
      throw new Error(`${label} contains a missing, invalid, or duplicate review id`);
    }
    reviewIds.add(review.id);
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED', 'COMMENTED'].includes(review.state)) {
      throw new Error(`${label} record ${review.id} has an invalid review state`);
    }
    normalizeGithubLogin(review.user?.login, `${label} record ${review.id} reviewer`);
    if (!['User', 'Bot'].includes(review.user?.type)) {
      throw new Error(`${label} record ${review.id} has an invalid reviewer type`);
    }
    normalizeCommitIdentity(review.commit_id, `${label} record ${review.id} commit`, { fullSha: true });
    if (typeof review.author_association !== 'string' || review.author_association.length === 0) {
      throw new Error(`${label} record ${review.id} is missing author_association`);
    }
  }
  return reviews;
}

/** @param {Array<Record<string, any>>} [reviews] */
export function latestReviewsByAuthor(reviews = []) {
  const latest = new Map();
  const sorted = [...reviews].sort((left, right) => (
    Number(left.id ?? 0) - Number(right.id ?? 0)
  ));
  for (const review of sorted) {
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    const login = normalizeGithubLogin(review.user?.login, 'pull request reviewer');
    if (login) latest.set(login, review);
  }
  return latest;
}

/**
 * @param {{
 *   body?: string,
 *   additions?: number,
 *   deletions?: number,
 *   changedFiles?: number,
 *   files?: Array<string | Record<string, any>>,
 *   reviews?: Array<Record<string, any>>,
 *   author?: string,
 *   headSha?: string,
 *   sensitivePaths?: string[]
 * }} [input]
 */
export function evaluatePrGovernance({
  body,
  additions = 0,
  deletions = 0,
  changedFiles = 0,
  files = [],
  reviews = [],
  author,
  headSha,
  sensitivePaths = [],
} = {}) {
  const errors = [];
  const sections = parsePrBody(body);

  for (const heading of REQUIRED_SECTIONS) {
    const value = sections.get(heading);
    if (value === undefined) {
      errors.push(`missing required PR section "${heading}"`);
    } else if (sectionIsPlaceholder(value)) {
      errors.push(`PR section "${heading}" must replace template placeholder content with concrete evidence`);
    }
  }

  const owner = stripHtmlComments(sections.get('Maintainer Owner') ?? '');
  if (owner && !/@[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/u.test(owner)) {
    errors.push('PR section "Maintainer Owner" must name an accountable GitHub handle');
  }

  const large = isLargeChange({ additions, deletions, changedFiles });
  if (large) {
    const exception = sections.get('Large Change Exception');
    if (exception === undefined) {
      errors.push('large PR must be split below the review budget or include a "Large Change Exception" section');
    } else {
      const status = parseLabeledField(exception, 'Status').toLowerCase();
      const reason = parseLabeledField(exception, 'Reason');
      const exceptionOwner = parseLabeledField(exception, 'Owner');
      if (status !== 'exception') {
        errors.push('large PR must set Large Change Exception "Status: exception" or be split below the review budget');
      }
      if (sectionIsPlaceholder(reason)) {
        errors.push('large PR exception must include a concrete reason');
      }
      if (!/@[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?/u.test(exceptionOwner)) {
        errors.push('large PR exception must name an accountable owner by GitHub handle');
      }
    }
  }

  const sensitiveFiles = files
    .flatMap((file) => sensitiveChangedFilePaths(file, sensitivePaths));
  if (sensitiveFiles.length > 0) {
    const authorLogin = normalizeGithubLogin(author, 'pull request author');
    const currentHead = normalizeCommitIdentity(headSha, 'pull request head', { fullSha: true });
    assertCompleteReviewRecords(reviews);
    const independentApproval = [...latestReviewsByAuthor(reviews).values()].some((review) => {
      const reviewer = normalizeGithubLogin(review.user?.login, 'pull request reviewer');
      return review.state === 'APPROVED'
        && reviewer
        && reviewer !== authorLogin
        && review.user?.type === 'User'
        && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(review.author_association)
        && normalizeCommitIdentity(review.commit_id, 'pull request review commit', { fullSha: true }) === currentHead;
    });
    if (!independentApproval) {
      errors.push(`sensitive paths require a current-head approval from an eligible human repository reviewer other than the PR author (${sensitiveFiles.join(', ')})`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    large,
    sensitiveFiles,
  };
}
