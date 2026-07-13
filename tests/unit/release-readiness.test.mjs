import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { main, parseReadinessArgs, validateReleaseReadiness } from '../../scripts/validate-release-readiness.mjs';

test('release readiness resolves safe defaults and reports the current hold without failing integrity mode', () => {
  const parsed = parseReadinessArgs([]);
  assert.match(parsed.stableTag, /^v\d+\.\d+\.\d+$/u);
  assert.match(parsed.candidateTag, /-rc\.0$/u);
  assert.match(parsed.sourceCommit, /^[a-f0-9]{40}$/u);
  const { result } = validateReleaseReadiness([]);
  assert.equal(result.status, 'BLOCKED_POLICY');
  assert.equal(result.reasonCode, 'ACTIVE_RELEASE_HOLD');
  assert.equal(main([]), 0);
  assert.equal(main(['--require-ready']), 2);
});

test('release readiness rejects malformed explicit identity and unknown arguments', () => {
  assert.throws(() => parseReadinessArgs(['--unknown']), /unknown argument/u);
  const { result } = validateReleaseReadiness(['--stable-tag', 'v4.0.0', '--candidate-tag', 'v4.0.0-rc.1', '--source-commit', 'a'.repeat(40)]);
  assert.equal(result.maximumPermittedState, 'DRAFT');
});

test('release readiness parses evidence and protected-publication flags and keeps failures structured', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'readiness-review-'));
  try {
    const commit = 'a'.repeat(40);
    const review = resolve(directory, 'review.json');
    writeFileSync(review, `${JSON.stringify({ passed: true, commit, pullRequestHead: commit })}\n`);
    const args = ['--mode', 'promote', '--stable-tag', 'v4.0.0', '--candidate-tag', 'v4.0.0-rc.1', '--source-commit', commit, '--independent-review-evidence', review, '--protected-publication-approved'];
    const parsed = parseReadinessArgs(args);
    assert.equal(parsed.mode, 'promote');
    assert.equal(parsed.protectedPublicationApproved, true);
    assert.equal(validateReleaseReadiness(args).result.reasonCode, 'ACTIVE_RELEASE_HOLD');
    assert.equal(main(['--mode']), 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
