import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { orchestrateRelease } from '../../scripts/release-orchestrator.mjs';

test('release continuation requires and extends the prior verified ledger', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'nova-ledger-'));
  try {
    const control = resolve(directory, 'control.json'); const intent = resolve(directory, 'intent.json'); const eventDir = resolve(directory, 'events');
    const sourceCommit = 'a'.repeat(40); const bundleSha256 = 'b'.repeat(64);
    writeFileSync(control, `${JSON.stringify({ bundleSha256 })}\n`);
    writeFileSync(intent, `${JSON.stringify({ stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit, candidateCoreSha256: 'c'.repeat(64), controlBundleSha256: bundleSha256 })}\n`);
    const base = { stableTag: 'v4.1.0', candidateTag: 'v4.1.0-rc.1', sourceCommit, promotionIntent: intent, controlBundle: control, eventDir };
    assert.throws(() => orchestrateRelease({ ...base, mode: 'recover', state: 'CANDIDATE_TAGGED', targetState: 'CANDIDATE_VERIFIED', runId: 'missing', dryRun: false }), /prior release ledger/u);
    orchestrateRelease({ ...base, mode: 'promote', state: 'DRAFT', targetState: 'CANDIDATE_TAGGED', runId: 'first', dryRun: false }, () => new Date('2026-07-13T00:00:00Z'));
    const result = orchestrateRelease({ ...base, mode: 'recover', state: 'CANDIDATE_TAGGED', targetState: 'CANDIDATE_VERIFIED', runId: 'second', dryRun: false }, () => new Date('2026-07-13T00:00:01Z'));
    assert.equal(result.ledgerHeadState, 'CANDIDATE_VERIFIED');
    assert.equal(JSON.parse(readFileSync(resolve(eventDir, 'release-ledger.json'))).events.length, 2);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
