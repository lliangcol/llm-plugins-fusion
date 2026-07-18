import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { parseDocument } from 'yaml';
import {
  main as validatePrGovernanceMain,
  validatePullRequestGovernance,
} from '../../scripts/validate-pr-governance.mjs';
import { prGovernanceTrustBoundaryErrors } from '../../scripts/validate-github-workflows.mjs';

const BODY = `## Summary
Protect sensitive paths.
## Why
Ordinary PRs need independent review.
## Maintainer Owner
@owner
## Risk
False negatives could permit an unreviewed governance change.
## Validation Results
- focused tests: passed
## Large Change Exception
- Status: not-required
- Reason:
- Owner:
`;
const HEAD_SHA = 'a'.repeat(40);
const SCRIPT = fileURLToPath(new URL('../../scripts/validate-pr-governance.mjs', import.meta.url));
const ROOT = resolve(import.meta.dirname, '../..');

test('checked-in PR governance workflow resists pull-request validator replacement mutations', () => {
  const file = '.github/workflows/pr-governance.yml';
  const model = parseDocument(readFileSync(resolve(ROOT, file), 'utf8')).toJS();
  assert.deepEqual(prGovernanceTrustBoundaryErrors(file, model), []);

  const validatorFromPullRequestCheckout = structuredClone(model);
  validatorFromPullRequestCheckout.jobs.governance.steps[0].with.ref = '${{ github.sha }}';
  delete validatorFromPullRequestCheckout.jobs.governance.steps
    .find((step) => step.run === 'node scripts/validate-pr-governance.mjs')['working-directory'];
  const findings = prGovernanceTrustBoundaryErrors(file, validatorFromPullRequestCheckout).join('\n');
  assert.match(findings, /base SHA/u);
  assert.match(findings, /trusted-governance base checkout/u);

  const competingHeadCheckout = structuredClone(model);
  competingHeadCheckout.jobs.governance.steps.splice(1, 0, {
    uses: 'actions/checkout@0123456789012345678901234567890123456789',
    with: { 'persist-credentials': false },
  });
  assert.match(prGovernanceTrustBoundaryErrors(file, competingHeadCheckout).join('\n'), /exactly one checkout/u);

  const rewrittenBaseValidator = structuredClone(model);
  rewrittenBaseValidator.jobs.governance.steps.splice(2, 0, {
    run: "printf 'process.exit(0)' > trusted-governance/scripts/validate-pr-governance.mjs",
  });
  assert.match(
    prGovernanceTrustBoundaryErrors(file, rewrittenBaseValidator).join('\n'),
    /no pull-request-controlled mutation step/u,
  );
});

function runCli(env, preload = null) {
  return new Promise((resolve, reject) => {
    const args = preload ? ['--import', pathToFileURL(preload).href, SCRIPT] : [SCRIPT];
    const child = spawn(process.execPath, args, { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('PR governance integrates event facts with paginated GitHub files and reviews', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/files?')) {
      return new Response(JSON.stringify([{ filename: '.github/workflows/ci.yml' }]), { status: 200 });
    }
    if (url.includes('/reviews?')) {
      return new Response(JSON.stringify([{ id: 7, state: 'APPROVED', commit_id: HEAD_SHA, author_association: 'MEMBER', user: { login: 'reviewer', type: 'User' } }]), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const result = await validatePullRequestGovernance({
    event: {
      pull_request: {
        number: 42,
        body: BODY,
        additions: 10,
        deletions: 2,
        changed_files: 1,
        user: { login: 'author' },
        head: { sha: HEAD_SHA },
      },
    },
    repository: 'owner/repo',
    token: 'test-token',
    apiBase: 'https://github.invalid',
    sensitivePaths: ['.github/'],
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.sensitiveFiles[0], '.github/workflows/ci.yml');
  assert.equal(calls.length, 2);
  assert.match(calls[0], /pulls\/42\/files\?per_page=100&page=1/u);
  assert.match(calls[1], /pulls\/42\/reviews\?per_page=100&page=1/u);
});

test('PR governance fails closed when the files API does not cover changed_files', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('/files?')) {
      return new Response(JSON.stringify([{ filename: 'docs/README.md' }]), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  await assert.rejects(
    validatePullRequestGovernance({
      event: {
        pull_request: {
          number: 42,
          body: BODY,
          additions: 10,
          deletions: 2,
          changed_files: 2,
          user: { login: 'author' },
          head: { sha: HEAD_SHA },
        },
      },
      repository: 'owner/repo',
      token: 'test-token',
      apiBase: 'https://github.invalid',
      sensitivePaths: ['.github/'],
      fetchImpl,
    }),
    /files response is incomplete or ambiguous: received 1 records for changed_files=2/u,
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0], /pulls\/42\/files\?per_page=100&page=1/u);
});

test('PR governance rejects duplicate or malformed file records even when counts match', async () => {
  for (const files of [
    [{ filename: 'docs/README.md' }, { filename: 'docs/README.md' }],
    [{ filename: 'docs/README.md' }, {}],
  ]) {
    await assert.rejects(
      validatePullRequestGovernance({
        event: {
          pull_request: {
            number: 42,
            body: BODY,
            additions: 10,
            deletions: 2,
            changed_files: 2,
            user: { login: 'author' },
            head: { sha: HEAD_SHA },
          },
        },
        repository: 'owner/repo',
        token: 'test-token',
        apiBase: 'https://github.invalid',
        sensitivePaths: ['.github/'],
        fetchImpl: async () => new Response(JSON.stringify(files), { status: 200 }),
      }),
      /files response is incomplete or ambiguous/u,
    );
  }
});

test('PR governance rejects missing author or head identity before API reads', async () => {
  for (const pullRequest of [
    { number: 42, body: BODY, additions: 1, deletions: 0, changed_files: 1, head: { sha: HEAD_SHA } },
    { number: 42, body: BODY, additions: 1, deletions: 0, changed_files: 1, user: { login: 'author' } },
  ]) {
    let apiCalls = 0;
    await assert.rejects(
      validatePullRequestGovernance({
        event: { pull_request: pullRequest },
        repository: 'owner/repo',
        token: 'test-token',
        sensitivePaths: ['.github/'],
        fetchImpl: async () => { apiCalls += 1; throw new Error('must not fetch'); },
      }),
      /pull request (?:author|head)/u,
    );
    assert.equal(apiCalls, 0);
  }
});

test('PR governance rejects incomplete review id, identity, type, or commit', async () => {
  const valid = { id: 7, state: 'APPROVED', commit_id: HEAD_SHA, author_association: 'MEMBER', user: { login: 'reviewer', type: 'User' } };
  for (const review of [
    { ...valid, id: undefined },
    { ...valid, user: { type: 'User' } },
    { ...valid, user: { login: 'reviewer' } },
    { ...valid, commit_id: '' },
  ]) {
    await assert.rejects(
      validatePullRequestGovernance({
        event: { pull_request: { number: 42, body: BODY, additions: 1, deletions: 0, changed_files: 1, user: { login: 'author' }, head: { sha: HEAD_SHA } } },
        repository: 'owner/repo',
        token: 'test-token',
        apiBase: 'https://github.invalid',
        sensitivePaths: ['.github/'],
        fetchImpl: async (url) => new Response(JSON.stringify(url.includes('/files?') ? [{ filename: '.github/workflows/ci.yml' }] : [review]), { status: 200 }),
      }),
      /reviews response/u,
    );
  }
});

test('PR governance main reads the event file and returns semantic success and failure codes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pr-governance-main-'));
  const eventPath = join(directory, 'event.json');
  const event = {
    pull_request: {
      number: 42,
      body: BODY,
      additions: 1,
      deletions: 0,
      changed_files: 1,
      user: { login: 'author' },
      head: { sha: HEAD_SHA },
    },
  };
  const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'token', GITHUB_API_URL: 'https://github.invalid' };
  const fetchImpl = async () => new Response(JSON.stringify([{ filename: 'README.md' }]), { status: 200 });
  try {
    writeFileSync(eventPath, `${JSON.stringify(event)}\n`, 'utf8');
    assert.equal(await validatePrGovernanceMain({ env, fetchImpl }), 0);
    writeFileSync(eventPath, `${JSON.stringify({ ...event, pull_request: { ...event.pull_request, body: '' } })}\n`, 'utf8');
    assert.equal(await validatePrGovernanceMain({ env, fetchImpl }), 1);
    await assert.rejects(validatePrGovernanceMain({ env: {} }), /GITHUB_EVENT_PATH is required/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('PR governance CLI exposes successful and failed process exits', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pr-governance-cli-'));
  const eventPath = join(directory, 'event.json');
  const preloadPath = join(directory, 'fetch-preload.mjs');
  const event = {
    pull_request: {
      number: 42,
      body: BODY,
      additions: 1,
      deletions: 0,
      changed_files: 1,
      user: { login: 'author' },
      head: { sha: HEAD_SHA },
    },
  };
  writeFileSync(eventPath, `${JSON.stringify(event)}\n`, 'utf8');
  writeFileSync(preloadPath, "globalThis.fetch = async () => new Response(JSON.stringify([{ filename: 'README.md' }]), { status: 200 });\n", 'utf8');
  try {
    const passed = await runCli({
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_TOKEN: 'token',
      GITHUB_API_URL: 'https://github.invalid',
    }, preloadPath);
    assert.equal(passed.code, 0, passed.stderr);
    assert.match(passed.stdout, /OK PR Governance passed/u);

    const failed = await runCli({ GITHUB_EVENT_PATH: '', GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'token' });
    assert.equal(failed.code, 1);
    assert.match(failed.stderr, /ERROR GITHUB_EVENT_PATH is required/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
