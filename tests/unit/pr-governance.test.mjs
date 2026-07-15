import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  evaluatePrGovernance,
  isLargeChange,
  isSensitivePath,
  LARGE_CHANGE_LIMITS,
  parseCodeOwnerPaths,
  parsePrBody,
  stripHtmlComments,
} from '../../scripts/lib/pr-governance.mjs';

const COMPLETE_BODY = `## Summary
Add a reviewable governance check.

## Why
Template placeholders currently survive until merge.

## Maintainer Owner
@maintainer

## Risk
The check can block merging when evidence is incomplete.

## Validation Results
- node --test: passed

## Large Change Exception
- Status: not-required
- Reason:
- Owner:
`;
const SENSITIVE_PATHS = ['.github/', 'scripts/validate-pr-governance.mjs'];

test('PR body parser and required evidence reject blank template sections', () => {
  assert.equal(parsePrBody(COMPLETE_BODY).get('Summary'), 'Add a reviewable governance check.');
  const result = evaluatePrGovernance({ body: '## Summary\n<!-- describe it -->' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Summary.*concrete evidence/u);
  assert.match(result.errors.join('\n'), /missing required PR section "Why"/u);
});

test('HTML comment stripping removes nested and unclosed placeholder content', () => {
  assert.equal(stripHtmlComments('safe<!-- outer <!-- nested --> tail -->done'), 'safedone');
  assert.equal(stripHtmlComments('safe<!-- unclosed'), 'safe');
  assert.equal(stripHtmlComments('<!-- only <!-- nested --> comment -->'), '');
});

test('the tracked PR template fails until required placeholders are replaced', () => {
  const template = readFileSync(new URL('../../.github/pull_request_template.md', import.meta.url), 'utf8');
  const result = evaluatePrGovernance({ body: template });
  assert.equal(result.ok, false);
  for (const heading of ['Summary', 'Why', 'Maintainer Owner', 'Risk', 'Validation Results']) {
    assert.match(result.errors.join('\n'), new RegExp(heading, 'u'));
  }
});

test('large change requires an explicit accountable exception', () => {
  assert.equal(isLargeChange({ changedFiles: LARGE_CHANGE_LIMITS.changedFiles + 1 }), true);
  assert.equal(isLargeChange({ additions: 700, deletions: 301 }), true);
  const missing = evaluatePrGovernance({ body: COMPLETE_BODY, changedFiles: 51 });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join('\n'), /Status: exception/u);

  const accepted = evaluatePrGovernance({
    body: COMPLETE_BODY.replace(
      '- Status: not-required\n- Reason:\n- Owner:',
      '- Status: exception\n- Reason: Generated contracts must change atomically.\n- Owner: @maintainer',
    ),
    additions: 1_001,
  });
  assert.equal(accepted.ok, true);
});

test('sensitive paths require a distinct human approval on the current head', () => {
  assert.deepEqual(parseCodeOwnerPaths('# owner\n* @default\n/.github/ @security\n/scripts/check.mjs @security'), ['.github/', 'scripts/check.mjs']);
  assert.throws(() => parseCodeOwnerPaths('/docs/*.md @docs'), /unsupported CODEOWNERS path pattern/u);
  assert.equal(isSensitivePath('.github/workflows/ci.yml', SENSITIVE_PATHS), true);
  assert.equal(isSensitivePath('docs/README.md', SENSITIVE_PATHS), false);
  const base = {
    body: COMPLETE_BODY,
    files: [{ filename: 'scripts/validate-pr-governance.mjs' }],
    author: 'author',
    headSha: 'abc123',
    sensitivePaths: SENSITIVE_PATHS,
  };
  const stale = evaluatePrGovernance({
    ...base,
    reviews: [{ id: 1, state: 'APPROVED', commit_id: 'old', author_association: 'COLLABORATOR', user: { login: 'reviewer', type: 'User' } }],
  });
  assert.equal(stale.ok, false);
  assert.match(stale.errors.join('\n'), /current-head approval/u);

  const outsider = evaluatePrGovernance({
    ...base,
    reviews: [{ id: 2, state: 'APPROVED', commit_id: 'abc123', author_association: 'CONTRIBUTOR', user: { login: 'reviewer', type: 'User' } }],
  });
  assert.equal(outsider.ok, false);

  const approved = evaluatePrGovernance({
    ...base,
    reviews: [
      { id: 2, state: 'APPROVED', commit_id: 'abc123', author_association: 'COLLABORATOR', user: { login: 'reviewer', type: 'User' } },
      { id: 3, state: 'COMMENTED', commit_id: 'abc123', author_association: 'COLLABORATOR', user: { login: 'reviewer', type: 'User' } },
    ],
  });
  assert.equal(approved.ok, true);
});
