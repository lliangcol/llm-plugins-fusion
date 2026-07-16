import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { extractArtifactReport, verifyGithubActionsPerformanceSample } from '../../scripts/lib/github-actions-performance-provenance.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function storedZip(name, content) {
  const nameBytes = Buffer.from(name);
  const body = Buffer.from(content);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(body.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(body.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const centralOffset = local.length + nameBytes.length + body.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + nameBytes.length, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, nameBytes, body, central, nameBytes, eocd]);
}

function fixture() {
  const profile = {
    id: 'linux-x64-node22-github-hosted-3-fresh-process-full-uncached',
    platform: 'linux',
    arch: 'x64',
    nodeMajor: 22,
    runnerClass: 'github-hosted',
    concurrency: 3,
    scenario: 'fresh-process-full-uncached',
  };
  const collection = {
    repository: 'example/project',
    workflowPath: '.github/workflows/ci.yml',
    workflowRef: 'refs/heads/main',
    jobName: 'Required / Tests',
    artifactName: 'validation-timing-trend',
  };
  const observedAt = '2026-06-01T00:01:00Z';
  const sourceCommit = 'a'.repeat(40);
  const report = {
    schemaVersion: 2,
    runId: '12345',
    generatedAt: observedAt,
    failed: 0,
    skipped: 0,
    summary: {
      elapsedWallMs: 900,
      runtimeSmokeMs: 600,
      sumTaskMs: 600,
      selectedTaskCount: 1,
      mode: 'full',
      cacheHitCount: 0,
      profile: { ...profile, comparable: true },
    },
    gates: [{ id: 'runtime.smoke', status: 'passed', durationMs: 600, cached: false }],
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const archive = storedZip('validation-timings.json', reportBytes);
  const sample = {
    sampleId: 'github-12345-1',
    profile,
    sourceCommit,
    workflow: {
      repository: collection.repository,
      path: collection.workflowPath,
      ref: collection.workflowRef,
      sha: sourceCommit,
      runId: 12345,
      runAttempt: 1,
      jobName: collection.jobName,
    },
    observedAt,
    evidence: {
      artifactName: collection.artifactName,
      artifactId: 67890,
      artifactSha256: sha256(archive),
      reportPath: 'validation-timings.json',
      reportSha256: sha256(reportBytes),
    },
    metrics: { elapsedWallMs: 900, runtimeSmokeMs: 600, failed: 0, skipped: 0 },
  };
  const run = {
    id: 12345,
    run_attempt: 1,
    repository: { full_name: collection.repository },
    path: collection.workflowPath,
    head_branch: 'main',
    head_sha: sourceCommit,
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    run_started_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:02:00Z',
  };
  const jobs = {
    jobs: [{
      name: collection.jobName,
      run_id: 12345,
      run_attempt: 1,
      head_sha: sourceCommit,
      status: 'completed',
      conclusion: 'success',
    }],
  };
  const artifact = {
    id: 67890,
    name: collection.artifactName,
    expired: false,
    size_in_bytes: archive.length,
    digest: `sha256:${sample.evidence.artifactSha256}`,
    created_at: '2026-06-01T00:03:00Z',
    workflow_run: { id: 12345, head_sha: sourceCommit, head_branch: 'main' },
  };
  return { profile, collection, sample, archive, run, jobs, artifact };
}

function fakeFetch(state) {
  return async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['X-GitHub-Api-Version'], '2026-03-10');
    if (url.endsWith('/actions/runs/12345/attempts/1')) return Response.json(state.run);
    if (url.endsWith('/actions/runs/12345/attempts/1/jobs?per_page=100')) return Response.json(state.jobs);
    if (url.endsWith('/actions/artifacts/67890')) return Response.json(state.artifact);
    if (url.endsWith('/actions/artifacts/67890/zip')) return new Response(state.archive);
    return new Response('not found', { status: 404 });
  };
}

test('GitHub provenance binds run attempt, governed job, artifact API digest, and raw report bytes', async () => {
  const state = fixture();
  const result = await verifyGithubActionsPerformanceSample({
    sample: state.sample,
    profile: state.profile,
    collection: state.collection,
    token: 'test-token',
    fetchImpl: fakeFetch(state),
    apiBase: 'https://api.example.test',
  });
  assert.deepEqual(result, {
    sampleId: state.sample.sampleId,
    runId: 12345,
    runAttempt: 1,
    artifactId: 67890,
    artifactSha256: state.sample.evidence.artifactSha256,
    reportSha256: state.sample.evidence.reportSha256,
  });
});

test('GitHub provenance rejects a repository-manifest digest that API state does not corroborate', async () => {
  const state = fixture();
  state.artifact.digest = `sha256:${'0'.repeat(64)}`;
  await assert.rejects(
    verifyGithubActionsPerformanceSample({
      sample: state.sample,
      profile: state.profile,
      collection: state.collection,
      token: 'test-token',
      fetchImpl: fakeFetch(state),
      apiBase: 'https://api.example.test',
    }),
    /artifact provenance does not match/u,
  );
});

test('GitHub artifact download enforces a streaming hard cap even when API metadata understates size', async () => {
  const state = fixture();
  const ordinaryFetch = fakeFetch(state);
  let chunks = 0;
  const oversized = new ReadableStream({
    pull(controller) {
      if (chunks++ < 26) controller.enqueue(new Uint8Array(1024 * 1024));
      else controller.close();
    },
  });
  const fetchImpl = async (url, options) => url.endsWith('/actions/artifacts/67890/zip')
    ? new Response(oversized)
    : ordinaryFetch(url, options);
  await assert.rejects(
    verifyGithubActionsPerformanceSample({
      sample: state.sample,
      profile: state.profile,
      collection: state.collection,
      token: 'test-token',
      fetchImpl,
      apiBase: 'https://api.example.test',
    }),
    /artifact download exceeds 26214400 bytes/u,
  );
});

test('artifact extraction rejects unsafe or missing report paths', () => {
  const archive = storedZip('../validation-timings.json', Buffer.from('{}'));
  assert.throws(() => extractArtifactReport(archive, 'validation-timings.json'), /unsafe path/u);
  assert.throws(() => extractArtifactReport(Buffer.from('not-a-zip'), 'validation-timings.json'), /end-of-central-directory/u);
});
