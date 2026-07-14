import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReleaseSummary } from '../../scripts/generate-release-summary.mjs';

const stable = {
  version: '4.0.0',
  tag: 'v4.0.0',
  commit: 'a'.repeat(40),
  pluginTreeSha256: 'b'.repeat(64),
  state: 'INSTALL_PROVEN',
};
const proof = {
  matches: true,
  stable: { version: stable.version, tag: stable.tag, commit: stable.commit },
  candidateTreeDigest: stable.pluginTreeSha256,
  installedTreeDigest: stable.pluginTreeSha256,
};

test('release summary verifies a stable install only when every governed identity matches', () => {
  const summary = buildReleaseSummary({ channels: { stable }, proof, adoption: { status: 'not-demonstrated' } });
  assert.match(summary.sections.verified[1], /matches tree digest/u);
  const stale = buildReleaseSummary({ channels: { stable }, proof: { ...proof, installedTreeDigest: 'c'.repeat(64) }, adoption: { status: 'not-demonstrated' } });
  assert.equal(stale.sections.verified.length, 1);
  assert.ok(stale.sections.notVerified.includes('No matching stable install proof.'));
});
