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

function normalizedLogin(value) {
  return String(value ?? '').trim().replace(/^@/u, '').toLowerCase();
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

/** @param {Array<Record<string, any>>} [reviews] */
export function latestReviewsByAuthor(reviews = []) {
  const latest = new Map();
  const sorted = [...reviews].sort((left, right) => (
    Number(left.id ?? 0) - Number(right.id ?? 0)
  ));
  for (const review of sorted) {
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    const login = normalizedLogin(review.user?.login);
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
    .map((file) => typeof file === 'string' ? file : file?.filename)
    .filter((file) => file && isSensitivePath(file, sensitivePaths));
  if (sensitiveFiles.length > 0) {
    const authorLogin = normalizedLogin(author);
    const currentHead = String(headSha ?? '').toLowerCase();
    const independentApproval = [...latestReviewsByAuthor(reviews).values()].some((review) => {
      const reviewer = normalizedLogin(review.user?.login);
      return review.state === 'APPROVED'
        && reviewer
        && reviewer !== authorLogin
        && review.user?.type !== 'Bot'
        && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(review.author_association)
        && String(review.commit_id ?? '').toLowerCase() === currentHead;
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
