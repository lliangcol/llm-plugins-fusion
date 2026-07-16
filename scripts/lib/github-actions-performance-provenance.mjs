import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { canonicalSha256 } from './canonical-json.mjs';

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_REPORT_BYTES = 5 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 200;
const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function safeEntryName(name) {
  return typeof name === 'string'
    && name.length > 0
    && !name.includes('\0')
    && !name.includes('\\')
    && !name.startsWith('/')
    && !/^[A-Za-z]:/u.test(name)
    && !name.split('/').includes('..');
}

/** Extract one exact regular file from a bounded GitHub artifact ZIP. */
export function extractArtifactReport(archive, reportPath) {
  if (!Buffer.isBuffer(archive)) throw new Error('GitHub performance artifact archive must be a Buffer');
  if (archive.length === 0 || archive.length > MAX_ARCHIVE_BYTES) throw new Error(`GitHub performance artifact archive must be 1-${MAX_ARCHIVE_BYTES} bytes`);
  if (!safeEntryName(reportPath)) throw new Error('GitHub performance report path is unsafe');

  const minimumEocd = 22;
  let eocd = -1;
  for (let offset = archive.length - minimumEocd; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === EOCD_SIGNATURE) { eocd = offset; break; }
  }
  if (eocd === -1) throw new Error('GitHub performance artifact ZIP has no end-of-central-directory record');
  const eocdCommentBytes = archive.readUInt16LE(eocd + 20);
  if (eocd + minimumEocd + eocdCommentBytes !== archive.length) throw new Error('GitHub performance artifact ZIP has trailing or truncated data');
  const disk = archive.readUInt16LE(eocd + 4);
  const centralDisk = archive.readUInt16LE(eocd + 6);
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const entries = archive.readUInt16LE(eocd + 10);
  const centralBytes = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entries) throw new Error('GitHub performance artifact ZIP must be a single-disk archive');
  if (entries < 1 || entries > MAX_ZIP_ENTRIES) throw new Error(`GitHub performance artifact ZIP entry count must be 1-${MAX_ZIP_ENTRIES}`);
  if (centralOffset + centralBytes > eocd) throw new Error('GitHub performance artifact ZIP central directory is out of bounds');

  let cursor = centralOffset;
  let report = null;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) throw new Error('GitHub performance artifact ZIP central entry is invalid');
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const compressedBytes = archive.readUInt32LE(cursor + 20);
    const uncompressedBytes = archive.readUInt32LE(cursor + 24);
    const nameBytes = archive.readUInt16LE(cursor + 28);
    const extraBytes = archive.readUInt16LE(cursor + 30);
    const commentBytes = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameBytes + extraBytes + commentBytes;
    if (next > centralOffset + centralBytes) throw new Error('GitHub performance artifact ZIP central entry escapes its directory');
    const name = archive.subarray(cursor + 46, cursor + 46 + nameBytes).toString('utf8');
    if (!safeEntryName(name)) throw new Error(`GitHub performance artifact ZIP contains unsafe path ${JSON.stringify(name)}`);
    if ((flags & 0x1) !== 0) throw new Error('GitHub performance artifact ZIP must not contain encrypted entries');
    if (![0, 8].includes(method)) throw new Error(`GitHub performance artifact ZIP uses unsupported compression method ${method}`);
    if (uncompressedBytes > MAX_REPORT_BYTES) throw new Error(`GitHub performance artifact ZIP entry ${name} exceeds ${MAX_REPORT_BYTES} bytes`);

    if (name === reportPath) {
      if (report !== null) throw new Error(`GitHub performance artifact ZIP contains duplicate report path ${reportPath}`);
      if (localOffset + 30 > centralOffset || archive.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw new Error('GitHub performance artifact ZIP local report entry is invalid');
      const localFlags = archive.readUInt16LE(localOffset + 6);
      const localMethod = archive.readUInt16LE(localOffset + 8);
      const localNameBytes = archive.readUInt16LE(localOffset + 26);
      const localExtraBytes = archive.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameBytes + localExtraBytes;
      const dataEnd = dataStart + compressedBytes;
      if (dataEnd > centralOffset) throw new Error('GitHub performance artifact ZIP report data is out of bounds');
      const localName = archive.subarray(localOffset + 30, localOffset + 30 + localNameBytes).toString('utf8');
      if (localName !== name || localMethod !== method || localFlags !== flags) throw new Error('GitHub performance artifact ZIP local report metadata differs from its central entry');
      const compressed = archive.subarray(dataStart, dataEnd);
      report = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_REPORT_BYTES });
      if (report.length !== uncompressedBytes) throw new Error('GitHub performance artifact ZIP report size differs from its central directory');
    }
    cursor = next;
  }
  if (cursor !== centralOffset + centralBytes) throw new Error('GitHub performance artifact ZIP central directory length is inconsistent');
  if (report === null) throw new Error(`GitHub performance artifact ZIP is missing ${reportPath}`);
  return report;
}

function githubHeaders(token, apiVersion) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': apiVersion,
    'User-Agent': 'llm-plugins-fusion-performance-provenance',
  };
}

async function githubResponse(fetchImpl, url, token, apiVersion, label) {
  let response;
  try {
    response = await fetchImpl(url, { headers: githubHeaders(token, apiVersion), redirect: 'follow' });
  } catch (error) {
    throw new Error(`${label} GitHub API request failed: ${error.message}`);
  }
  if (!response?.ok) throw new Error(`${label} GitHub API returned HTTP ${response?.status ?? 'unknown'}`);
  return response;
}

async function githubJson(fetchImpl, url, token, apiVersion, label) {
  const response = await githubResponse(fetchImpl, url, token, apiVersion, label);
  try { return await response.json(); } catch (error) { throw new Error(`${label} GitHub API JSON is invalid: ${error.message}`); }
}

async function boundedResponseBuffer(response, maximumBytes, label) {
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error(`${label} has no bounded response stream`);
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel('maximum artifact size exceeded').catch(() => {});
      throw new Error(`${label} exceeds ${maximumBytes} bytes`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, bytes);
}

function exactProfile(value) {
  return {
    id: value?.id,
    platform: value?.platform,
    arch: value?.arch,
    nodeMajor: value?.nodeMajor,
    runnerClass: value?.runnerClass,
    concurrency: value?.concurrency,
    scenario: value?.scenario,
  };
}

function validateReport(report, sample, profile) {
  if (report?.schemaVersion !== 2 || String(report.runId) !== String(sample.workflow.runId)) throw new Error(`sample ${sample.sampleId} raw report does not match its GitHub run id`);
  if (report.generatedAt !== sample.observedAt) throw new Error(`sample ${sample.sampleId} observation time does not match its raw report`);
  if (report.failed !== 0 || report.skipped !== 0) throw new Error(`sample ${sample.sampleId} raw report is not a complete passed run`);
  if (canonicalSha256(exactProfile(report.summary?.profile)) !== canonicalSha256(exactProfile(profile))) throw new Error(`sample ${sample.sampleId} raw report profile identity does not match`);
  if (report.summary?.profile?.comparable !== true || report.summary?.mode !== 'full' || report.summary?.cacheHitCount !== 0) throw new Error(`sample ${sample.sampleId} raw report is not a comparable full uncached run`);
  if (report.summary.elapsedWallMs !== sample.metrics.elapsedWallMs || report.summary.runtimeSmokeMs !== sample.metrics.runtimeSmokeMs) throw new Error(`sample ${sample.sampleId} raw report metrics do not match the manifest`);
  if (!Array.isArray(report.gates) || report.gates.length === 0 || report.gates.some((gate) => gate.status !== 'passed' || gate.cached === true)) throw new Error(`sample ${sample.sampleId} raw report gates are incomplete, failed, or cached`);
  if (report.gates.some((gate) => !Number.isInteger(gate.durationMs) || gate.durationMs < 0)) throw new Error(`sample ${sample.sampleId} raw report has an invalid gate duration`);
  if (report.summary.selectedTaskCount !== report.gates.length) throw new Error(`sample ${sample.sampleId} raw report selected task count is inconsistent`);
  const sumTaskMs = report.gates.reduce((sum, gate) => sum + gate.durationMs, 0);
  if (report.summary.sumTaskMs !== sumTaskMs) throw new Error(`sample ${sample.sampleId} raw report summed task time is inconsistent`);
  const runtimeSmoke = report.gates.filter((gate) => gate.id === 'runtime.smoke');
  if (runtimeSmoke.length !== 1 || runtimeSmoke[0].durationMs !== report.summary.runtimeSmokeMs) throw new Error(`sample ${sample.sampleId} raw report runtime smoke is inconsistent`);
}

/** Verify a manifest sample against immutable GitHub Actions API state and raw artifact bytes. */
export async function verifyGithubActionsPerformanceSample({
  sample,
  profile,
  collection,
  token,
  fetchImpl = globalThis.fetch,
  apiBase = 'https://api.github.com',
  apiVersion = '2026-03-10',
}) {
  if (typeof fetchImpl !== 'function') throw new Error('GitHub performance provenance requires fetch');
  if (typeof token !== 'string' || token.length < 1) throw new Error('GitHub performance provenance requires GH_TOKEN or GITHUB_TOKEN');
  const repoApi = `${apiBase.replace(/\/$/u, '')}/repos/${collection.repository}`;
  const attemptApi = `${repoApi}/actions/runs/${sample.workflow.runId}/attempts/${sample.workflow.runAttempt}`;
  if (apiVersion !== '2026-03-10') throw new Error('GitHub performance provenance requires API version 2026-03-10');
  const run = await githubJson(fetchImpl, attemptApi, token, apiVersion, `sample ${sample.sampleId} run attempt`);
  const branch = collection.workflowRef.replace(/^refs\/heads\//u, '');
  if (run.id !== sample.workflow.runId
    || run.run_attempt !== sample.workflow.runAttempt
    || run.repository?.full_name !== collection.repository
    || run.path !== collection.workflowPath
    || run.head_branch !== branch
    || run.head_sha !== sample.sourceCommit
    || run.event !== 'push'
    || run.status !== 'completed'
    || run.conclusion !== 'success') {
    throw new Error(`sample ${sample.sampleId} GitHub run provenance does not match the governed completed main-branch workflow`);
  }

  const jobs = await githubJson(fetchImpl, `${attemptApi}/jobs?per_page=100`, token, apiVersion, `sample ${sample.sampleId} jobs`);
  const matchingJobs = Array.isArray(jobs.jobs) ? jobs.jobs.filter((job) => job.name === collection.jobName) : [];
  if (matchingJobs.length !== 1) throw new Error(`sample ${sample.sampleId} GitHub run must contain exactly one governed job ${collection.jobName}`);
  const job = matchingJobs[0];
  if (job.run_id !== sample.workflow.runId || job.run_attempt !== sample.workflow.runAttempt || job.head_sha !== sample.sourceCommit || job.status !== 'completed' || job.conclusion !== 'success') {
    throw new Error(`sample ${sample.sampleId} GitHub job provenance does not match the governed run attempt`);
  }

  const artifactApi = `${repoApi}/actions/artifacts/${sample.evidence.artifactId}`;
  const artifact = await githubJson(fetchImpl, artifactApi, token, apiVersion, `sample ${sample.sampleId} artifact`);
  if (artifact.id !== sample.evidence.artifactId
    || artifact.name !== collection.artifactName
    || artifact.expired !== false
    || !Number.isInteger(artifact.size_in_bytes)
    || artifact.size_in_bytes < 1
    || artifact.size_in_bytes > MAX_ARCHIVE_BYTES
    || artifact.digest !== `sha256:${sample.evidence.artifactSha256}`
    || artifact.workflow_run?.id !== sample.workflow.runId
    || artifact.workflow_run?.head_sha !== sample.sourceCommit
    || artifact.workflow_run?.head_branch !== branch) {
    throw new Error(`sample ${sample.sampleId} GitHub artifact provenance does not match the governed run and digest`);
  }

  const archiveResponse = await githubResponse(fetchImpl, `${artifactApi}/zip`, token, apiVersion, `sample ${sample.sampleId} artifact download`);
  const archive = await boundedResponseBuffer(archiveResponse, MAX_ARCHIVE_BYTES, `sample ${sample.sampleId} artifact download`);
  if (archive.length !== artifact.size_in_bytes) throw new Error(`sample ${sample.sampleId} downloaded GitHub artifact size does not match API state`);
  if (sha256(archive) !== sample.evidence.artifactSha256) throw new Error(`sample ${sample.sampleId} downloaded GitHub artifact digest does not match`);
  const reportBytes = extractArtifactReport(archive, sample.evidence.reportPath);
  if (sha256(reportBytes) !== sample.evidence.reportSha256) throw new Error(`sample ${sample.sampleId} raw report digest does not match`);
  let report;
  try { report = JSON.parse(reportBytes.toString('utf8')); } catch (error) { throw new Error(`sample ${sample.sampleId} raw report JSON is invalid: ${error.message}`); }
  validateReport(report, sample, profile);

  const observedAt = new Date(sample.observedAt).getTime();
  const runStartedAt = new Date(run.run_started_at ?? run.created_at ?? '').getTime();
  const runUpdatedAt = new Date(run.updated_at ?? '').getTime();
  const artifactCreatedAt = new Date(artifact.created_at ?? '').getTime();
  if ([runStartedAt, runUpdatedAt, artifactCreatedAt].some(Number.isNaN)
    || observedAt < runStartedAt
    || observedAt > runUpdatedAt
    || artifactCreatedAt < observedAt) {
    throw new Error(`sample ${sample.sampleId} observation time is inconsistent with GitHub run and artifact timestamps`);
  }
  return {
    sampleId: sample.sampleId,
    runId: run.id,
    runAttempt: run.run_attempt,
    artifactId: artifact.id,
    artifactSha256: sample.evidence.artifactSha256,
    reportSha256: sample.evidence.reportSha256,
  };
}
